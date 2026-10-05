import test from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
  occurrences,
  dueDate,
  incomeMonth,
  accountBalance,
  sum,
  paydayPlan,
  budgetLimit,
} from "../src/lib/finance";
import { emptyData } from "../src/lib/types";
const bill = {
  id: "bill",
  title: "Rent",
  amount: 100,
  dueDateDay: 31,
  categoryId: "bills",
  frequency: "monthly" as const,
  startDate: "2026-01-01",
};
function funded() {
  const data = emptyData();
  data.income = [{ id: "salary", amount: 1000, date: "2026-02-01" }];
  return data;
}
test("bill payment does not increase safe spending; linked expense is counted once", () => {
  const data = funded();
  data.commitments = [bill];
  const before = calculate(data, "2026-02");
  data.commitmentLogs = [
    {
      id: "paid",
      commitmentId: "bill",
      monthYear: "2026-02",
      dueDate: "2026-02-28",
      status: "paid",
      amount: 100,
    },
  ];
  data.expenses = [
    {
      id: "expense",
      amount: 100,
      date: "2026-02-28",
      categoryId: "bills",
      commitmentLogId: "paid",
    },
  ];
  const after = calculate(data, "2026-02");
  assert.equal(before.safeToSpend, 900);
  assert.equal(after.safeToSpend, 900);
  assert.equal(after.balance, 900);
});
test("legacy bill payment is deducted without a linked expense", () => {
  const data = funded();
  data.commitments = [bill];
  data.commitmentLogs = [
    { id: "log", commitmentId: "bill", monthYear: "2026-02", status: "paid" },
  ];
  assert.equal(calculate(data, "2026-02").safeToSpend, 900);
});
test("settling debt keeps safe spending unchanged and stops future reserves", () => {
  const data = funded();
  data.debts = [
    {
      id: "d",
      name: "Phone",
      lender: "Bank",
      originalAmount: 100,
      remainingAmount: 100,
      monthlyPayment: 100,
      dueDay: 1,
      startDate: "2026-02-01",
    },
  ];
  assert.equal(calculate(data, "2026-02").safeToSpend, 900);
  data.debts[0].remainingAmount = 0;
  data.debtPayments = [
    { id: "p", debtId: "d", amount: 100, date: "2026-02-02" },
  ];
  data.expenses = [
    {
      id: "e",
      amount: 100,
      date: "2026-02-02",
      categoryId: "debt",
      debtPaymentId: "p",
    },
  ];
  assert.equal(calculate(data, "2026-02").safeToSpend, 900);
  assert.equal(calculate(data, "2026-03").remainingDebt, 0);
});
test("payment of one debt cannot consume the reserve for another debt", () => {
  const data = funded();
  data.debts = ["a", "b"].map((id) => ({
    id,
    name: id,
    lender: "Bank",
    originalAmount: 1000,
    remainingAmount: id === "a" ? 800 : 1000,
    monthlyPayment: 100,
    dueDay: 1,
    startDate: "2026-01-01",
  }));
  data.debtPayments = [
    { id: "p", debtId: "a", amount: 200, date: "2026-02-01" },
  ];
  assert.equal(calculate(data, "2026-02").remainingDebt, 100);
});
test("savings target and completed contributions protect the same funds", () => {
  const data = funded();
  data.settings = [{ id: "preferences", savingsTarget: 200, paydayDay: 25 }];
  assert.equal(calculate(data, "2026-02").safeToSpend, 800);
  data.goalContributions = [
    {
      id: "g",
      goalId: "goal",
      amount: 100,
      date: "2026-02-02",
      monthYear: "2026-02",
    },
  ];
  const after = calculate(data, "2026-02");
  assert.equal(after.balance, 900);
  assert.equal(after.savingsReserve, 100);
  assert.equal(after.safeToSpend, 800);
});
test("negative cash projection is retained", () => {
  const data = funded();
  data.commitments = [{ ...bill, amount: 1500 }];
  assert.equal(calculate(data, "2026-02").safeToSpend, -500);
});
test("weekly bills create distinct occurrences and a legacy log matches once", () => {
  const data = emptyData();
  data.commitments = [
    { ...bill, frequency: "weekly", startDate: "2026-01-05" },
  ];
  data.commitmentLogs = [
    { id: "log", commitmentId: "bill", monthYear: "2026-01", status: "paid" },
  ];
  const schedule = occurrences(data, "2026-01");
  assert.deepEqual(
    schedule.map((o) => o.dueDate),
    ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"],
  );
  assert.equal(schedule.filter((o) => o.log).length, 1);
});
test("yearly bills occur only in their anchor month", () => {
  const data = emptyData();
  data.commitments = [
    { ...bill, frequency: "yearly", startDate: "2026-05-01" },
  ];
  assert.equal(occurrences(data, "2026-06").length, 0);
  assert.equal(occurrences(data, "2027-05").length, 1);
});
test("bills respect start and end dates", () => {
  const data = emptyData();
  data.commitments = [
    { ...bill, startDate: "2026-03-01", endDate: "2026-04-30" },
  ];
  assert.equal(occurrences(data, "2026-02").length, 0);
  assert.equal(occurrences(data, "2026-03").length, 1);
  assert.equal(occurrences(data, "2026-05").length, 0);
});
test("due day clamps to month end including leap years", () => {
  assert.equal(dueDate("2026-02", 31), "2026-02-28");
  assert.equal(dueDate("2028-02", 31), "2028-02-29");
});
test("salary belongs only to its assigned month", () => {
  const data = funded();
  data.income[0] = { ...data.income[0], isSalary: true, monthKey: "2026-03" };
  assert.equal(incomeMonth(data.income[0]), "2026-03");
  assert.equal(calculate(data, "2026-02").totalIncome, 0);
  assert.equal(calculate(data, "2026-03").totalIncome, 1000);
});
test("previous balances carry forward", () => {
  const data = funded();
  data.expenses = [
    { id: "e", amount: 250, date: "2026-02-05", categoryId: "food" },
  ];
  assert.equal(calculate(data, "2026-03").carryover, 750);
});
test("transfers affect account balances but not overall income", () => {
  const data = emptyData();
  data.accounts = [
    {
      id: "a",
      name: "Bank",
      type: "bank",
      openingBalance: 1000,
      openingDate: "2026-01-01",
    },
    {
      id: "b",
      name: "Wallet",
      type: "ewallet",
      openingBalance: 0,
      openingDate: "2026-01-01",
    },
  ];
  data.transfers = [
    {
      id: "t",
      fromAccountId: "a",
      toAccountId: "b",
      amount: 100,
      date: "2026-02-01",
    },
  ];
  assert.equal(accountBalance(data, "a"), 900);
  assert.equal(accountBalance(data, "b"), 100);
  assert.equal(calculate(data, "2026-02").balance, 1000);
  assert.equal(calculate(data, "2026-02").totalIncome, 0);
});
test("budget changes are isolated to their month", () => {
  const data = emptyData();
  data.budgets = [
    { id: "b", categoryId: "food", monthKey: "2026-01", limit: 200 },
    { id: "c", categoryId: "food", monthKey: "2026-02", limit: 300 },
  ];
  assert.equal(budgetLimit(data, "food", "2026-01"), 200);
  assert.equal(budgetLimit(data, "food", "2026-02"), 300);
});
test("money is summed in integer cents", () =>
  assert.equal(sum([0.1, 0.2]), 0.3));
test("payday handles December rollover and short months", () => {
  assert.equal(paydayPlan(100, 31, "2026-12-31").next, "2027-01-31");
  assert.equal(paydayPlan(100, 31, "2026-02-01").next, "2026-02-28");
  assert.equal(paydayPlan(-100, 25, "2026-02-01").daily, 0);
});
