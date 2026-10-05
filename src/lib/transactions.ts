import type { Finance } from "../hooks/use-finance";
import type { StoreData } from "./types";
import { incomeMonth, paidAmount, round } from "./finance";
import type { Change } from "./db";
export interface Transaction {
  id: string;
  type: "income" | "expense" | "bill" | "debt" | "savings";
  title: string;
  date: string;
  amount: number;
  categoryId?: string;
  receiptId?: string;
  linked: boolean;
  row: Record<string, unknown>;
}
export function transactions(data: StoreData, month: string): Transaction[] {
  const result: Transaction[] = [
    ...data.income
      .filter((i) => incomeMonth(i) === month)
      .map((i) => ({
        id: i.id,
        type: "income" as const,
        title: i.note || i.source || "Income",
        date: i.date,
        amount: i.amount,
        categoryId: i.categoryId,
        linked: !!i.repaymentId,
        row: { ...i },
      })),
    ...data.expenses
      .filter((e) => e.date.slice(0, 7) === month)
      .map((e) => ({
        id: e.id,
        type: "expense" as const,
        title:
          e.note ||
          e.merchant ||
          data.categories.find((c) => c.id === e.categoryId)?.name ||
          "Expense",
        date: e.date,
        amount: e.amount,
        categoryId: e.categoryId,
        receiptId: e.receiptId,
        linked: !!(e.commitmentLogId || e.debtPaymentId),
        row: { ...e },
      })),
    ...data.commitmentLogs
      .filter(
        (l) =>
          l.status === "paid" &&
          l.monthYear === month &&
          !data.expenses.some((e) => e.commitmentLogId === l.id),
      )
      .map((l) => ({
        id: l.id,
        type: "bill" as const,
        title:
          l.title ||
          data.commitments.find((c) => c.id === l.commitmentId)?.title ||
          "Bill payment",
        date: l.paidDate || l.dueDate || `${l.monthYear}-01`,
        amount: paidAmount(data, l),
        receiptId: l.receiptId,
        linked: true,
        row: { ...l },
      })),
    ...data.debtPayments
      .filter(
        (p) =>
          p.date.slice(0, 7) === month &&
          !data.expenses.some((e) => e.debtPaymentId === p.id),
      )
      .map((p) => ({
        id: p.id,
        type: "debt" as const,
        title:
          data.debts.find((d) => d.id === p.debtId)?.name || "Debt payment",
        date: p.date,
        amount: p.amount,
        receiptId: p.receiptId,
        linked: true,
        row: { ...p },
      })),
    ...data.goalContributions
      .filter((c) => c.monthYear === month)
      .map((c) => ({
        id: c.id,
        type: "savings" as const,
        title:
          data.goals.find((g) => g.id === c.goalId)?.name ||
          "Savings contribution",
        date: c.date,
        amount: c.amount,
        linked: true,
        row: { ...c },
      })),
  ];
  return result.sort((a, b) => b.date.localeCompare(a.date));
}
export async function reverseTransaction(
  finance: Finance,
  transaction: Transaction,
): Promise<boolean> {
  const { data } = finance;
  const changes: Change[] = [];
  const row = transaction.row;
  if (transaction.type === "bill" || row.commitmentLogId)
    return finance.undoBill(String(row.commitmentLogId ?? transaction.id));
  if (transaction.type === "debt" || row.debtPaymentId) {
    const payment = data.debtPayments.find(
      (p) => p.id === (row.debtPaymentId ?? transaction.id),
    );
    const debt = data.debts.find((d) => d.id === payment?.debtId);
    if (!payment || !debt) {
      finance.setError(
        "The linked debt is missing. Restore its record before reversing this payment.",
      );
      return false;
    }
    changes.push(
      {
        store: "debts",
        value: {
          ...debt,
          remainingAmount: round(debt.remainingAmount + payment.amount),
        },
      },
      { store: "debtPayments", deleteId: payment.id },
    );
    for (const expense of data.expenses.filter(
      (e) => e.debtPaymentId === payment.id,
    ))
      changes.push({ store: "expenses", deleteId: expense.id });
  } else if (row.repaymentId) {
    const payment = data.repayments.find((p) => p.id === row.repaymentId);
    const debt = data.receivables.find((d) => d.id === payment?.receivableId);
    if (!payment || !debt) {
      finance.setError("The linked receivable is missing.");
      return false;
    }
    changes.push(
      {
        store: "receivables",
        value: {
          ...debt,
          remainingAmount: round(debt.remainingAmount + payment.amount),
        },
      },
      { store: "repayments", deleteId: payment.id },
      { store: "income", deleteId: transaction.id },
    );
  } else if (transaction.type === "savings") {
    const contribution = data.goalContributions.find(
      (c) => c.id === transaction.id,
    );
    const goal = data.goals.find((g) => g.id === contribution?.goalId);
    if (!goal || !contribution || goal.currentAmount < contribution.amount) {
      finance.setError(
        "The savings goal balance cannot support this reversal. Restore its record first.",
      );
      return false;
    }
    changes.push(
      {
        store: "goals",
        value: {
          ...goal,
          currentAmount: round(goal.currentAmount - contribution.amount),
        },
      },
      { store: "goalContributions", deleteId: transaction.id },
    );
  } else
    changes.push({
      store: transaction.type === "income" ? "income" : "expenses",
      deleteId: transaction.id,
    });
  return finance.change(changes, "Transaction reversed.");
}
