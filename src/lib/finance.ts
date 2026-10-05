import {
  DEFAULT_SETTINGS,
  type Commitment,
  type CommitmentLog,
  type StoreData,
} from "./types";

export const money = (amount: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    amount,
  );
export const cents = (amount: number) => Math.round(amount * 100);
export const sum = (values: number[]) =>
  values.reduce((total, value) => total + cents(value), 0) / 100;
export const round = (amount: number) => cents(amount) / 100;
export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export const monthOf = (date: string) => date.slice(0, 7);
export function monthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}
export function shiftMonth(month: string, offset: number): string {
  const [year, number] = month.split("-").map(Number);
  return dateKey(new Date(year, number - 1 + offset, 1)).slice(0, 7);
}
export function dueDate(month: string, day: number): string {
  const [year, number] = month.split("-").map(Number);
  return dateKey(
    new Date(
      year,
      number - 1,
      Math.min(day, new Date(year, number, 0).getDate()),
    ),
  );
}
export function incomeMonth(item: StoreData["income"][number]): string {
  return item.isSalary && item.monthKey ? item.monthKey : monthOf(item.date);
}
export interface Occurrence {
  id: string;
  commitment: Commitment;
  dueDate: string;
  log?: CommitmentLog;
}
export function occurrences(data: StoreData, month: string): Occurrence[] {
  const end = dueDate(month, 31);
  const result: Occurrence[] = [];
  for (const commitment of data.commitments) {
    const start = commitment.startDate?.slice(0, 10) ?? `${month}-01`;
    const stop = commitment.endDate?.slice(0, 10);
    const dates: string[] = [];
    if (commitment.frequency === "weekly") {
      // Legacy weekly records lacked an anchor: use their due day in January 2026.
      const anchor =
        commitment.startDate?.slice(0, 10) ??
        dueDate("2026-01", commitment.dueDateDay);
      const cursor = new Date(`${anchor}T12:00:00`);
      const first = new Date(`${month}-01T12:00:00`);
      const offset = Math.max(
        0,
        Math.ceil((first.getTime() - cursor.getTime()) / 86400000 / 7),
      );
      cursor.setDate(cursor.getDate() + offset * 7);
      while (dateKey(cursor) <= end) {
        dates.push(dateKey(cursor));
        cursor.setDate(cursor.getDate() + 7);
      }
    } else if (
      commitment.frequency !== "yearly" ||
      month.slice(5) === start.slice(5, 7)
    ) {
      dates.push(dueDate(month, commitment.dueDateDay));
    }
    let legacyMatched = false;
    for (const date of dates) {
      if (date < start || (stop && date > stop)) continue;
      const exact = data.commitmentLogs.find(
        (log) => log.commitmentId === commitment.id && log.dueDate === date,
      );
      // Match a v3 monthly log once, even for a legacy weekly commitment.
      const legacy = !legacyMatched
        ? data.commitmentLogs.find(
            (log) =>
              log.commitmentId === commitment.id &&
              log.monthYear === month &&
              !log.dueDate,
          )
        : undefined;
      if (!exact && legacy) legacyMatched = true;
      result.push({
        id: `${commitment.id}:${date}`,
        commitment,
        dueDate: date,
        log: exact ?? legacy,
      });
    }
  }
  return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
export function paidAmount(data: StoreData, log: CommitmentLog): number {
  return (
    log.amount ??
    data.commitments.find((c) => c.id === log.commitmentId)?.amount ??
    0
  );
}
export function budgetLimit(
  data: StoreData,
  categoryId: string,
  month: string,
): number {
  return (
    data.budgets.find(
      (b) => b.categoryId === categoryId && b.monthKey === month,
    )?.limit ??
    data.categories.find((c) => c.id === categoryId)?.budget ??
    0
  );
}
export function accountBalance(
  data: StoreData,
  id: string,
  through = "9999-12-31",
): number {
  const account = data.accounts.find((a) => a.id === id);
  if (!account || account.openingDate > through) return 0;
  const eligible = (item: { date: string; accountId?: string }) =>
    item.accountId === id &&
    item.date.slice(0, 10) >= account.openingDate &&
    item.date.slice(0, 10) <= through;
  return round(
    account.openingBalance +
      sum(data.income.filter(eligible).map((i) => i.amount)) -
      sum(data.expenses.filter(eligible).map((i) => i.amount)) -
      sum(
        data.debtPayments
          .filter(
            (p) =>
              eligible(p) &&
              !data.expenses.some((e) => e.debtPaymentId === p.id),
          )
          .map((p) => p.amount),
      ) -
      sum(
        data.commitmentLogs
          .filter(
            (l) =>
              l.status === "paid" &&
              l.accountId === id &&
              (l.paidDate ?? l.dueDate ?? `${l.monthYear}-01`).slice(0, 10) >=
                account.openingDate &&
              (l.paidDate ?? l.dueDate ?? `${l.monthYear}-01`).slice(0, 10) <=
                through &&
              !data.expenses.some((e) => e.commitmentLogId === l.id),
          )
          .map((l) => paidAmount(data, l)),
      ) -
      sum(data.goalContributions.filter(eligible).map((c) => c.amount)) +
      sum(
        data.transfers
          .filter(
            (t) =>
              t.toAccountId === id &&
              t.date >= account.openingDate &&
              t.date <= through,
          )
          .map((t) => t.amount),
      ) -
      sum(
        data.transfers
          .filter(
            (t) =>
              t.fromAccountId === id &&
              t.date >= account.openingDate &&
              t.date <= through,
          )
          .map((t) => t.amount),
      ),
  );
}
export function calculate(data: StoreData, month: string) {
  const income = data.income.filter((i) => incomeMonth(i) === month);
  const expenses = data.expenses.filter((e) => monthOf(e.date) === month);
  const schedule = occurrences(data, month);
  const logs = data.commitmentLogs.filter(
    (l) => l.status === "paid" && l.monthYear === month,
  );
  const payments = data.debtPayments.filter((p) => monthOf(p.date) === month);
  const contributions = data.goalContributions.filter(
    (c) => c.monthYear === month,
  );
  const unpaidBills = sum(
    schedule
      .filter((o) => o.log?.status !== "paid")
      .map((o) => o.commitment.amount),
  );
  const paidBills = sum(logs.map((l) => paidAmount(data, l)));
  const unlinkedBills = sum(
    logs
      .filter((l) => !data.expenses.some((e) => e.commitmentLogId === l.id))
      .map((l) => paidAmount(data, l)),
  );
  const debtPayments = sum(payments.map((p) => p.amount));
  const unlinkedDebts = sum(
    payments
      .filter((p) => !data.expenses.some((e) => e.debtPaymentId === p.id))
      .map((p) => p.amount),
  );
  const remainingDebt = sum(
    data.debts
      .filter((d) => !d.archived && monthOf(d.startDate) <= month)
      .map((debt) => {
        // Reconstruct the end-of-selected-month principal when viewing past months.
        const later = sum(
          data.debtPayments
            .filter((p) => p.debtId === debt.id && monthOf(p.date) > month)
            .map((p) => p.amount),
        );
        const paid = sum(
          payments.filter((p) => p.debtId === debt.id).map((p) => p.amount),
        );
        const remaining = round(debt.remainingAmount + later);
        return Math.max(
          0,
          Math.min(debt.monthlyPayment, remaining + paid) - paid,
        );
      }),
  );
  const previousIncome = sum(
    data.income.filter((i) => incomeMonth(i) < month).map((i) => i.amount),
  );
  const previousExpenses = sum(
    data.expenses.filter((e) => monthOf(e.date) < month).map((e) => e.amount),
  );
  const previousBills = sum(
    data.commitmentLogs
      .filter(
        (l) =>
          l.status === "paid" &&
          l.monthYear < month &&
          !data.expenses.some((e) => e.commitmentLogId === l.id),
      )
      .map((l) => paidAmount(data, l)),
  );
  const previousDebts = sum(
    data.debtPayments
      .filter(
        (p) =>
          monthOf(p.date) < month &&
          !data.expenses.some((e) => e.debtPaymentId === p.id),
      )
      .map((p) => p.amount),
  );
  const previousSavings = sum(
    data.goalContributions
      .filter((c) => c.monthYear < month)
      .map((c) => c.amount),
  );
  const opening = sum(
    data.accounts
      .filter((a) => monthOf(a.openingDate) <= month)
      .map((a) => a.openingBalance),
  );
  const carryover = round(
    opening +
      previousIncome -
      previousExpenses -
      previousBills -
      previousDebts -
      previousSavings,
  );
  const totalIncome = sum(income.map((i) => i.amount));
  const totalExpenses = sum(expenses.map((e) => e.amount));
  const savings = sum(contributions.map((c) => c.amount));
  const balance = round(
    carryover +
      totalIncome -
      totalExpenses -
      unlinkedBills -
      unlinkedDebts -
      savings,
  );
  const settings = data.settings[0] ?? DEFAULT_SETTINGS;
  const savingsReserve = Math.max(0, round(settings.savingsTarget - savings));
  const safeToSpend = round(
    balance - unpaidBills - remainingDebt - savingsReserve,
  );
  return {
    income,
    expenses,
    schedule,
    payments,
    contributions,
    totalIncome,
    totalExpenses,
    paidBills,
    totalBills: sum(schedule.map((o) => o.commitment.amount)),
    unpaidBills,
    debtPayments,
    remainingDebt,
    savings,
    savingsReserve,
    carryover,
    balance,
    safeToSpend,
  };
}
export function paydayPlan(
  safeToSpend: number,
  day: number,
  today = dateKey(),
) {
  const month = monthOf(today);
  const current = dueDate(month, day);
  const next = current > today ? current : dueDate(shiftMonth(month, 1), day);
  const days = Math.max(
    1,
    Math.round(
      (new Date(`${next}T12:00:00`).getTime() -
        new Date(`${today}T12:00:00`).getTime()) /
        86400000,
    ),
  );
  return {
    next,
    days,
    daily: Math.floor((Math.max(0, safeToSpend) * 100) / days) / 100,
  };
}
