import { isDebtType } from "./debt-statement";
import { isBillIcon } from "./icons";
import {
  STORE_NAMES,
  emptyData,
  type StoreData,
  type StoreName,
} from "./types";
import { validDate } from "./validation";
export const BACKUP_VERSION = 1;
const required: Record<StoreName, string[]> = {
  categories: ["name", "icon", "type"],
  income: ["amount", "date"],
  expenses: ["amount", "date", "categoryId"],
  commitments: ["title", "amount", "dueDateDay", "categoryId", "frequency"],
  commitmentLogs: ["commitmentId", "monthYear", "status"],
  receipts: ["data", "type", "name"],
  goals: ["name", "targetAmount", "currentAmount"],
  goalContributions: ["goalId", "amount", "date", "monthYear"],
  budgets: ["categoryId", "monthKey", "limit"],
  debts: [
    "name",
    "lender",
    "originalAmount",
    "remainingAmount",
    "monthlyPayment",
    "dueDay",
    "startDate",
  ],
  debtPayments: ["debtId", "amount", "date"],
  monthlySnapshots: ["totals", "categories", "createdAt"],
  accounts: ["name", "type", "openingBalance", "openingDate"],
  transfers: ["fromAccountId", "toAccountId", "amount", "date"],
  receivables: [
    "name",
    "borrower",
    "originalAmount",
    "remainingAmount",
    "monthlyRepayment",
    "dueDay",
    "startDate",
  ],
  repayments: ["receivableId", "amount", "date"],
  settings: ["savingsTarget", "paydayDay"],
};
const numericFields = [
  "amount",
  "budget",
  "targetAmount",
  "currentAmount",
  "monthlyAllocation",
  "limit",
  "originalAmount",
  "remainingAmount",
  "monthlyPayment",
  "interestRate",
  "monthlyRepayment",
  "openingBalance",
  "savingsTarget",
  "dueDateDay",
  "dueDay",
  "paydayDay",
  "totalInstallments",
  "initialPaidInstallments",
];
const dateFields = [
  "date",
  "paidDate",
  "dueDate",
  "startDate",
  "endDate",
  "deadline",
  "openingDate",
  "createdAt",
];
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function validateData(input: unknown): StoreData {
  if (!record(input))
    throw new Error("Backup must contain an object of records.");
  if (Object.keys(input).some((key) => !STORE_NAMES.includes(key as StoreName)))
    throw new Error("Backup contains an unknown record type.");
  const data = emptyData();
  for (const store of STORE_NAMES) {
    const rawRows = input[store] ?? [];
    if (!Array.isArray(rawRows) || rawRows.length > 100000)
      throw new Error(`Invalid ${store} records.`);
    // v3 forms sometimes persisted null for empty optional inputs.
    const rows = rawRows.map((row) =>
      record(row)
        ? Object.fromEntries(
            Object.entries(row).filter(
              ([key, value]) =>
                value !== undefined &&
                (value !== null || required[store].includes(key)),
            ),
          )
        : row,
    );
    const ids = new Set<string>();
    for (const row of rows) {
      if (
        !record(row) ||
        typeof row.id !== "string" ||
        !row.id ||
        ids.has(row.id)
      )
        throw new Error(`Invalid or duplicate ID in ${store}.`);
      ids.add(row.id);
      for (const key of required[store])
        if (row[key] === undefined || row[key] === null)
          throw new Error(`${store}: missing ${key}.`);
      for (const [key, value] of Object.entries(row)) {
        if (numericFields.includes(key)) {
          if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            (key !== "openingBalance" && value < 0) ||
            Math.abs(value) > 100000000
          )
            throw new Error(`${store}: invalid ${key}.`);
          if (
            ["dueDateDay", "dueDay", "paydayDay"].includes(key) &&
            (!Number.isInteger(value) || value < 1 || value > 31)
          )
            throw new Error(`${store}: invalid day.`);
          if (
            ["totalInstallments", "initialPaidInstallments"].includes(key) &&
            (!Number.isInteger(value) ||
              value < (key === "totalInstallments" ? 1 : 0))
          )
            throw new Error(`${store}: invalid instalment count.`);
          if (
            ![
              "dueDateDay",
              "dueDay",
              "paydayDay",
              "totalInstallments",
              "initialPaidInstallments",
              "interestRate",
            ].includes(key) &&
            Math.abs(value * 100 - Math.round(value * 100)) > 0.00001
          )
            throw new Error(`${store}: amounts must use two decimal places.`);
        }
        if (dateFields.includes(key) && !validDate(value))
          throw new Error(`${store}: invalid ${key}.`);
        if (
          ["monthKey", "monthYear"].includes(key) &&
          (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
        )
          throw new Error(`${store}: invalid month.`);
        if (
          ["isSalary", "archived"].includes(key) &&
          typeof value !== "boolean"
        )
          throw new Error(`${store}: invalid ${key}.`);
        if (
          !numericFields.includes(key) &&
          ![
            "isSalary",
            "archived",
            "totals",
            "categories",
            "detectedData",
          ].includes(key) &&
          typeof value !== "string"
        )
          throw new Error(`${store}: invalid ${key}.`);
      }
      if (
        store === "categories" &&
        !["income", "expense", "commitment"].includes(String(row.type))
      )
        throw new Error("Invalid category type.");
      if (
        store === "commitments" &&
        !["weekly", "monthly", "yearly"].includes(String(row.frequency))
      )
        throw new Error("Invalid frequency.");
      if (
        store === "commitments" &&
        row.icon !== undefined &&
        !isBillIcon(row.icon)
      )
        throw new Error("Invalid bill icon.");
      if (
        store === "commitmentLogs" &&
        !["paid", "unpaid", "overdue"].includes(String(row.status))
      )
        throw new Error("Invalid payment status.");
      if (
        store === "accounts" &&
        !["bank", "cash", "ewallet"].includes(String(row.type))
      )
        throw new Error("Invalid account type.");
      if (
        ["debts", "receivables"].includes(store) &&
        Number(row.remainingAmount) > Number(row.originalAmount)
      )
        throw new Error("Remaining principal exceeds original principal.");
      if (
        store === "debts" &&
        row.debtType !== undefined &&
        !isDebtType(row.debtType)
      )
        throw new Error("Invalid debt type.");
      if (store === "goals" && Number(row.targetAmount) <= 0)
        throw new Error("Savings target must be positive.");
      if (store === "settings" && row.id !== "preferences")
        throw new Error("Invalid settings record.");
      if (
        [
          "income",
          "expenses",
          "commitments",
          "goalContributions",
          "debtPayments",
          "transfers",
          "repayments",
        ].includes(store) &&
        Number(row.amount) <= 0
      )
        throw new Error(`${store}: amount must be positive.`);
      if (
        store === "receipts" &&
        !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(
          String(row.data),
        )
      )
        throw new Error("Invalid receipt image.");
      if (row.detectedData !== undefined) {
        if (!record(row.detectedData))
          throw new Error("Invalid receipt details.");
        for (const [key, value] of Object.entries(row.detectedData)) {
          if (
            key === "amount"
              ? typeof value !== "number" ||
                !Number.isFinite(value) ||
                value < 0
              : key === "date"
                ? !validDate(value)
                : !["merchant", "paymentMethod"].includes(key) ||
                  typeof value !== "string"
          )
            throw new Error("Invalid receipt details.");
        }
      }
      if (store === "monthlySnapshots") {
        if (
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.id) ||
          !record(row.totals) ||
          !Array.isArray(row.categories)
        )
          throw new Error("Invalid snapshot.");
        for (const key of ["income", "expenses", "savings", "debts", "balance"])
          if (
            typeof row.totals[key] !== "number" ||
            !Number.isFinite(row.totals[key])
          )
            throw new Error("Invalid snapshot totals.");
        const bills = row.totals.commitments;
        if (
          !record(bills) ||
          !["total", "paid"].every(
            (key) =>
              typeof bills[key] === "number" && Number.isFinite(bills[key]),
          )
        )
          throw new Error("Invalid snapshot bills.");
        if (
          !row.categories.every(
            (c) =>
              record(c) &&
              typeof c.id === "string" &&
              typeof c.name === "string" &&
              typeof c.spent === "number" &&
              Number.isFinite(c.spent),
          )
        )
          throw new Error("Invalid snapshot categories.");
      }
    }
    (data[store] as unknown[]) = rows;
  }
  for (const store of STORE_NAMES)
    for (const row of data[store]) {
      if (
        "accountId" in row &&
        row.accountId &&
        !data.accounts.some((a) => a.id === row.accountId)
      )
        throw new Error("Backup references a missing account.");
    }
  for (const debt of data.debts)
    if (
      debt.statementId &&
      !data.receipts.some((receipt) => receipt.id === debt.statementId)
    )
      throw new Error("Backup references a missing debt statement preview.");
  for (const transfer of data.transfers)
    if (
      transfer.fromAccountId === transfer.toAccountId ||
      !data.accounts.some((a) => a.id === transfer.fromAccountId) ||
      !data.accounts.some((a) => a.id === transfer.toAccountId)
    )
      throw new Error("Invalid transfer accounts.");
  for (const expense of data.expenses) {
    if (
      expense.commitmentLogId &&
      !data.commitmentLogs.some(
        (l) =>
          l.id === expense.commitmentLogId &&
          l.status === "paid" &&
          l.amount === expense.amount &&
          l.monthYear === expense.date.slice(0, 7),
      )
    )
      throw new Error("Invalid linked bill payment.");
    if (
      expense.debtPaymentId &&
      !data.debtPayments.some(
        (p) =>
          p.id === expense.debtPaymentId &&
          p.amount === expense.amount &&
          p.date.slice(0, 10) === expense.date.slice(0, 10),
      )
    )
      throw new Error("Invalid linked debt payment.");
  }
  const billLinks = data.expenses.map((e) => e.commitmentLogId).filter(Boolean);
  const debtLinks = data.expenses.map((e) => e.debtPaymentId).filter(Boolean);
  if (
    new Set(billLinks).size !== billLinks.length ||
    new Set(debtLinks).size !== debtLinks.length
  )
    throw new Error("Duplicate linked payment transactions.");
  for (const income of data.income)
    if (
      income.repaymentId &&
      !data.repayments.some(
        (p) => p.id === income.repaymentId && p.amount === income.amount,
      )
    )
      throw new Error("Invalid linked repayment.");
  const repaymentLinks = data.income.map((i) => i.repaymentId).filter(Boolean);
  if (new Set(repaymentLinks).size !== repaymentLinks.length)
    throw new Error("Duplicate linked repayments.");
  const budgetKeys = data.budgets.map((b) => `${b.monthKey}:${b.categoryId}`);
  if (new Set(budgetKeys).size !== budgetKeys.length)
    throw new Error("Duplicate monthly category budgets.");
  return data;
}
export function parseBackup(text: string): StoreData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!record(parsed)) throw new Error("This is not a FlowTrack backup.");
  if ("version" in parsed || "app" in parsed) {
    if (parsed.app !== "FlowTrack" || parsed.version !== BACKUP_VERSION)
      throw new Error("Unsupported backup version.");
    return validateData(parsed.data);
  }
  if (!["categories", "income", "expenses"].every((key) => key in parsed))
    throw new Error("This is not a FlowTrack backup.");
  return validateData(parsed);
}
export function makeBackup(data: StoreData) {
  return JSON.stringify(
    {
      app: "FlowTrack",
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2,
  );
}
