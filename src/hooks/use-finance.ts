import { useCallback, useEffect, useRef, useState } from "react";
import { commitChanges, loadData, type Change } from "../lib/db";
import { DEFAULT_SETTINGS, emptyData, type StoreData } from "../lib/types";
import { round, dateKey, dueDate, type Occurrence } from "../lib/finance";
import { validateData } from "../lib/backup";

const defaultCategories: StoreData["categories"] = [
  { id: "1", name: "Food", icon: "", type: "expense" },
  { id: "2", name: "Transport", icon: "", type: "expense" },
  { id: "3", name: "Bills", icon: "", type: "expense" },
  { id: "4", name: "Shopping", icon: "", type: "expense" },
  { id: "5", name: "Groceries", icon: "", type: "expense" },
  { id: "6", name: "Healthcare", icon: "", type: "expense" },
  { id: "7", name: "Entertainment", icon: "", type: "expense" },
  { id: "8", name: "Family", icon: "", type: "expense" },
  { id: "9", name: "Debt", icon: "", type: "expense" },
  { id: "10", name: "Others", icon: "", type: "expense" },
  { id: "101", name: "Salary", icon: "", type: "income" },
  { id: "102", name: "Refund", icon: "", type: "income" },
  { id: "103", name: "Other income", icon: "", type: "income" },
  { id: "201", name: "Housing", icon: "", type: "commitment" },
  { id: "202", name: "Loan", icon: "", type: "commitment" },
  { id: "203", name: "Subscriptions", icon: "", type: "commitment" },
];
export function useFinance() {
  const [data, setData] = useState<StoreData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const reload = useCallback(async () => {
    const result = await loadData();
    setData(result);
    return result;
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const existing = await loadData();
        const changes: Change[] = [];
        if (!existing.categories.length)
          for (const value of defaultCategories)
            changes.push({ store: "categories", value });
        if (!existing.settings.length)
          changes.push({ store: "settings", value: DEFAULT_SETTINGS });
        for (const bill of existing.commitments) {
          if (!bill.startDate) {
            const firstMonth =
              existing.commitmentLogs
                .filter((l) => l.commitmentId === bill.id)
                .map((l) => l.monthYear)
                .sort()[0] ?? dateKey().slice(0, 7);
            changes.push({
              store: "commitments",
              value: {
                ...bill,
                startDate: dueDate(
                  firstMonth,
                  bill.frequency === "weekly" ? bill.dueDateDay : 1,
                ),
              },
            });
          }
        }
        // Preserve paid amounts independently of future bill edits/removal.
        for (const log of existing.commitmentLogs) {
          const bill = existing.commitments.find(
            (c) => c.id === log.commitmentId,
          );
          if (log.amount === undefined && bill)
            changes.push({
              store: "commitmentLogs",
              value: { ...log, amount: bill.amount, title: bill.title },
            });
        }
        await commitChanges(changes);
        const result = await loadData();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to open local data.",
          );
          setLoading(false);
        }
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);
  const run = useCallback(
    async (action: () => Promise<void>, success = "Saved.") => {
      if (lock.current) return false;
      lock.current = true;
      setPending(true);
      setError("");
      setMessage("");
      try {
        await action();
        await reload();
        setMessage(success);
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "The change could not be saved.",
        );
        return false;
      } finally {
        lock.current = false;
        setPending(false);
      }
    },
    [reload],
  );
  const change = useCallback(
    (changes: Change[], message?: string) =>
      run(async () => {
        const next = { ...data };
        for (const change of changes) {
          const rows = next[change.store].filter(
            (row) => row.id !== (change.deleteId ?? change.value?.id),
          );
          (next[change.store] as unknown[]) = change.value
            ? [...rows, change.value]
            : rows;
        }
        validateData(next);
        await commitChanges(
          changes.map((change) => ({
            ...change,
            expected:
              data[change.store].find(
                (row) => row.id === (change.deleteId ?? change.value?.id),
              ) ?? null,
          })),
        );
      }, message),
    [run, data],
  );
  const payBill = (
    occurrence: Occurrence,
    date: string,
    accountId?: string,
  ) => {
    const id = occurrence.log?.id ?? occurrence.id;
    const log = {
      id,
      commitmentId: occurrence.commitment.id,
      dueDate: occurrence.dueDate,
      monthYear: occurrence.dueDate.slice(0, 7),
      status: "paid" as const,
      paidDate: date,
      amount: occurrence.commitment.amount,
      title: occurrence.commitment.title,
      accountId,
    };
    const expense = {
      id: crypto.randomUUID(),
      amount: log.amount,
      date,
      categoryId:
        data.categories.find((c) => c.name === "Bills" && c.type === "expense")
          ?.id ?? "10",
      note: log.title,
      accountId,
      commitmentLogId: id,
      paymentMethod: occurrence.commitment.paymentMethod,
    };
    return change(
      [
        { store: "commitmentLogs", value: log },
        { store: "expenses", value: expense },
      ],
      "Bill payment recorded.",
    );
  };
  const undoBill = (logId: string) => {
    const log = data.commitmentLogs.find((l) => l.id === logId);
    if (!log) return Promise.resolve(false);
    const changes: Change[] = [
      {
        store: "commitmentLogs",
        value: { ...log, status: "unpaid", paidDate: undefined },
      },
    ];
    for (const expense of data.expenses.filter(
      (e) => e.commitmentLogId === logId,
    ))
      changes.push({ store: "expenses", deleteId: expense.id });
    return change(changes, "Payment reversed.");
  };
  const payDebt = (
    debtId: string,
    value: number,
    date: string,
    accountId?: string,
  ) => {
    const debt = data.debts.find((d) => d.id === debtId);
    if (!debt || value <= 0 || value > debt.remainingAmount) {
      setError(
        "Payment must be positive and cannot exceed remaining principal.",
      );
      return Promise.resolve(false);
    }
    const payment = {
      id: crypto.randomUUID(),
      debtId,
      amount: value,
      date,
      accountId,
    };
    const expense = {
      id: crypto.randomUUID(),
      amount: value,
      date,
      accountId,
      debtPaymentId: payment.id,
      categoryId:
        data.categories.find((c) => c.name === "Debt" && c.type === "expense")
          ?.id ?? "10",
      note: debt.name,
    };
    return change(
      [
        {
          store: "debts",
          value: {
            ...debt,
            remainingAmount: round(debt.remainingAmount - value),
          },
        },
        { store: "debtPayments", value: payment },
        { store: "expenses", value: expense },
      ],
      "Debt payment recorded.",
    );
  };
  const receivePayment = (
    receivableId: string,
    value: number,
    date: string,
    accountId?: string,
  ) => {
    const debt = data.receivables.find((r) => r.id === receivableId);
    if (!debt || value <= 0 || value > debt.remainingAmount) {
      setError("Repayment cannot exceed the amount owed.");
      return Promise.resolve(false);
    }
    const repayment = {
      id: crypto.randomUUID(),
      receivableId,
      amount: value,
      date,
      accountId,
    };
    const income = {
      id: crypto.randomUUID(),
      amount: value,
      date,
      accountId,
      repaymentId: repayment.id,
      source: debt.borrower,
      note: `Repayment: ${debt.name}`,
    };
    return change(
      [
        {
          store: "receivables",
          value: {
            ...debt,
            remainingAmount: round(debt.remainingAmount - value),
          },
        },
        { store: "repayments", value: repayment },
        { store: "income", value: income },
      ],
      "Repayment received.",
    );
  };
  const contribute = (
    goalId: string,
    value: number,
    date: string,
    accountId?: string,
  ) => {
    const goal = data.goals.find((g) => g.id === goalId);
    if (!goal) return Promise.resolve(false);
    return change(
      [
        {
          store: "goals",
          value: { ...goal, currentAmount: round(goal.currentAmount + value) },
        },
        {
          store: "goalContributions",
          value: {
            id: crypto.randomUUID(),
            goalId,
            amount: value,
            date,
            monthYear: date.slice(0, 7),
            accountId,
          },
        },
      ],
      "Savings set aside.",
    );
  };
  return {
    data,
    loading,
    pending,
    error,
    message,
    setError,
    setMessage,
    reload,
    run,
    change,
    payBill,
    undoBill,
    payDebt,
    receivePayment,
    contribute,
  };
}
export type Finance = ReturnType<typeof useFinance>;
