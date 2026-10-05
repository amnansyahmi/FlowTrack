import { useState } from "react";
import type { Finance } from "../hooks/use-finance";
import type { StoreName } from "../lib/types";
import { amount, date, day, text } from "../lib/validation";
import { dateKey, budgetLimit } from "../lib/finance";
import { subscriptions } from "../lib/subscriptions";
import {
  AccountField,
  DateField,
  Field,
  FormActions,
  Modal,
  SelectField,
} from "./shared";
import { Button } from "./ui/button";
export type EditorKind =
  | "income"
  | "expenses"
  | "commitments"
  | "goals"
  | "debts"
  | "accounts"
  | "transfers"
  | "receivables"
  | "budgets"
  | "categories";
export interface Editor {
  kind: EditorKind;
  row?: Record<string, unknown>;
}
const titles: Record<EditorKind, string> = {
  income: "income",
  expenses: "expense",
  commitments: "bill",
  goals: "savings goal",
  debts: "debt",
  accounts: "account",
  transfers: "transfer",
  receivables: "money owed to you",
  budgets: "monthly budget",
  categories: "category",
};
export function EntryDialog({
  editor,
  finance,
  month,
  onClose,
}: {
  editor: Editor;
  finance: Finance;
  month: string;
  onClose: () => void;
}) {
  const { kind, row } = editor;
  const { data } = finance;
  const [error, setError] = useState("");
  const [preset, setPreset] = useState(String(row?.title ?? ""));
  const str = (key: string, fallback = "") =>
    row?.[key] !== undefined ? String(row[key]) : fallback;
  const linked = !!(
    row?.commitmentLogId ||
    row?.debtPaymentId ||
    row?.repaymentId
  );
  const defaultDate =
    month === dateKey().slice(0, 7) ? dateKey() : `${month}-01`;
  const accountId = (form: FormData) =>
    form.get("accountId") === "unassigned"
      ? undefined
      : String(form.get("accountId") ?? "") || undefined;
  const categories = data.categories.filter(
    (c) => c.type === (kind === "income" ? "income" : "expense"),
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const id = String(row?.id ?? crypto.randomUUID());
      let value: Record<string, unknown> = { ...row, id };
      let store: StoreName = kind;
      if (kind === "income" || kind === "expenses") {
        const transactionDate = linked
          ? String(row?.date)
          : date(form.get("date"));
        const selectedAccount = linked ? row?.accountId : accountId(form);
        if (selectedAccount) {
          const account = data.accounts.find((a) => a.id === selectedAccount);
          if (!account || transactionDate.slice(0, 10) < account.openingDate)
            throw new Error(
              "Transaction date must be on or after the account opening date.",
            );
        }
        value = {
          ...value,
          amount: linked ? row?.amount : amount(form.get("amount")),
          date: transactionDate,
          note: String(form.get("note") ?? ""),
          categoryId: form.get("categoryId") || undefined,
          accountId: selectedAccount,
        };
        if (kind === "expenses") {
          if (!form.get("categoryId")) throw new Error("Choose a category.");
          value.merchant = String(form.get("merchant") ?? "");
          value.paymentMethod = String(form.get("paymentMethod") ?? "");
        } else {
          value.source = String(form.get("source") ?? "");
          value.isSalary = form.get("isSalary") === "true";
          value.monthKey = value.isSalary
            ? String(form.get("monthKey") || month)
            : undefined;
          if (
            value.monthKey &&
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value.monthKey))
          )
            throw new Error("Choose a valid salary month.");
        }
      } else if (kind === "commitments") {
        const start = date(form.get("startDate"));
        const end = String(form.get("endDate") ?? "");
        if (end && end < start)
          throw new Error("End date must follow start date.");
        value = {
          ...value,
          title: text(form.get("title"), "Bill name"),
          amount: amount(form.get("amount")),
          dueDateDay: day(form.get("day")),
          frequency: form.get("frequency"),
          startDate: start,
          endDate: end || undefined,
          categoryId: String(
            row?.categoryId ??
              data.categories.find((c) => c.type === "commitment")?.id ??
              "203",
          ),
          paymentMethod: String(form.get("paymentMethod") ?? ""),
        };
      } else if (kind === "goals") {
        value = {
          ...value,
          name: text(form.get("name"), "Goal name"),
          targetAmount: amount(form.get("target"), "Target"),
          currentAmount: amount(
            form.get("current") ?? "0",
            "Existing savings",
            true,
          ),
          deadline: String(form.get("deadline") ?? "") || undefined,
        };
      } else if (kind === "debts" || kind === "receivables") {
        const original = amount(form.get("original"), "Original amount");
        const remaining = amount(
          form.get("remaining"),
          "Remaining amount",
          true,
        );
        if (remaining > original)
          throw new Error("Remaining amount cannot exceed original amount.");
        value = {
          ...value,
          name: text(form.get("name"), "Name"),
          originalAmount: original,
          remainingAmount: remaining,
          dueDay: day(form.get("day")),
          startDate: date(form.get("startDate")),
        };
        if (kind === "debts") {
          value.lender = text(form.get("lender"), "Lender");
          value.monthlyPayment = amount(
            form.get("monthly"),
            "Monthly payment",
            true,
          );
          const count = String(form.get("installments") ?? "").trim();
          const paid = String(form.get("initialPaid") ?? "0").trim();
          if (count && (!Number.isInteger(Number(count)) || Number(count) < 1))
            throw new Error(
              "Instalment count must be a positive whole number.",
            );
          if (
            !Number.isInteger(Number(paid)) ||
            Number(paid) < 0 ||
            (count && Number(paid) > Number(count))
          )
            throw new Error("Invalid previous instalment count.");
          value.totalInstallments = count ? Number(count) : undefined;
          value.initialPaidInstallments = Number(paid);
        } else {
          value.borrower = text(form.get("borrower"), "Borrower");
          value.monthlyRepayment = amount(
            form.get("monthly"),
            "Expected monthly repayment",
            true,
          );
        }
      } else if (kind === "accounts") {
        const balance = Number(form.get("opening"));
        if (
          !Number.isFinite(balance) ||
          Math.abs(balance) > 100000000 ||
          Math.abs(balance * 100 - Math.round(balance * 100)) > 0.00001
        )
          throw new Error("Enter a valid opening balance.");
        const openingDate = date(form.get("openingDate"));
        if (
          row &&
          [
            ...data.income,
            ...data.expenses,
            ...data.goalContributions,
            ...data.debtPayments,
            ...data.repayments,
          ].some((t) => t.accountId === id && t.date.slice(0, 10) < openingDate)
        )
          throw new Error(
            "Opening date cannot be later than existing account transactions.",
          );
        value = {
          ...value,
          name: text(form.get("name"), "Account name"),
          type: form.get("type"),
          openingBalance: balance,
          openingDate,
        };
      } else if (kind === "transfers") {
        if (form.get("fromAccountId") === form.get("toAccountId"))
          throw new Error("Choose two different accounts.");
        const transactionDate = date(form.get("date"));
        for (const field of ["fromAccountId", "toAccountId"])
          if (
            !data.accounts.some(
              (a) =>
                a.id === form.get(field) && a.openingDate <= transactionDate,
            )
          )
            throw new Error(
              "Transfer must follow both accounts’ opening dates.",
            );
        value = {
          ...value,
          fromAccountId: form.get("fromAccountId"),
          toAccountId: form.get("toAccountId"),
          amount: amount(form.get("amount")),
          date: transactionDate,
          note: String(form.get("note") ?? ""),
        };
      } else if (kind === "budgets") {
        const categoryId = String(form.get("categoryId"));
        value = {
          id:
            data.budgets.find(
              (b) => b.categoryId === categoryId && b.monthKey === month,
            )?.id ?? `${month}:${categoryId}`,
          categoryId,
          monthKey: month,
          limit: amount(form.get("limit"), "Budget limit", true),
        };
      } else if (kind === "categories") {
        const name = text(form.get("name"), "Category name");
        const type = form.get("type");
        if (
          data.categories.some(
            (c) =>
              c.id !== id &&
              c.type === type &&
              c.name.toLowerCase() === name.toLowerCase(),
          )
        )
          throw new Error("This category already exists.");
        value = { ...value, name, type, icon: "" };
      }
      if (await finance.change([{ store, value: value as { id: string } }]))
        onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review the form.");
    }
  }
  return (
    <Modal
      title={`${row?.id ? "Edit" : "Add"} ${titles[kind]}`}
      description={
        kind === "budgets"
          ? `Set a limit for ${month}.`
          : linked
            ? "This transaction is linked to a payment. Reverse the payment to change its amount or date."
            : "Enter the details below."
      }
      onClose={onClose}
      busy={finance.pending}
    >
      <form onSubmit={submit} className="space-y-4">
        {kind === "commitments" && (
          <>
            {!row?.id && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Start with a subscription
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {subscriptions.map((service) => (
                    <Button
                      key={service.name}
                      type="button"
                      variant="outline"
                      className="h-12 justify-start text-xs"
                      onClick={() => setPreset(service.name)}
                    >
                      <img
                        src={`/logos/${service.logo}.svg`}
                        alt=""
                        className="size-5"
                      />
                      {service.name}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Enter your plan price below.
                </p>
              </div>
            )}
            <Field
              label="Bill name"
              name="title"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              required
            />
            <div className="form-grid">
              <Field
                label="Amount (RM)"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={str("amount")}
                required
              />
              <Field
                label="Due day (1–31)"
                name="day"
                type="number"
                min="1"
                max="31"
                defaultValue={str("dueDateDay", "1")}
                required
              />
            </div>
            <SelectField
              label="Frequency"
              name="frequency"
              defaultValue={str("frequency", "monthly")}
              options={["monthly", "weekly", "yearly"].map((v) => ({
                value: v,
                label: v[0].toUpperCase() + v.slice(1),
              }))}
            />
            <p className="text-xs text-muted-foreground">
              Weekly bills repeat every 7 days from the start date. Yearly bills
              use its month.
            </p>
            <div className="form-grid">
              <DateField
                label="Start date"
                name="startDate"
                defaultValue={str("startDate", `${month}-01`)}
              />
              <DateField
                label="End date (optional)"
                name="endDate"
                defaultValue={str("endDate")}
                optional
              />
            </div>
            <Field
              label="Payment method (optional)"
              name="paymentMethod"
              defaultValue={str("paymentMethod")}
            />
          </>
        )}
        {(kind === "income" || kind === "expenses") && (
          <>
            {linked ? (
              <p className="text-sm">
                Amount: RM {Number(row?.amount).toFixed(2)} ·{" "}
                {String(row?.date).slice(0, 10)}
              </p>
            ) : (
              <div className="form-grid">
                <Field
                  label="Amount (RM)"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={str("amount")}
                  required
                />
                <DateField defaultValue={str("date", defaultDate)} />
              </div>
            )}
            <SelectField
              label="Category"
              name="categoryId"
              defaultValue={str("categoryId", categories[0]?.id)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            {!linked && (
              <AccountField
                accounts={data.accounts}
                defaultValue={str("accountId", "unassigned")}
              />
            )}
            {kind === "income" ? (
              <>
                <Field
                  label="Source"
                  name="source"
                  defaultValue={str("source")}
                />
                {!linked && (
                  <div className="form-grid">
                    <SelectField
                      label="Income type"
                      name="isSalary"
                      defaultValue={str("isSalary", "false")}
                      options={[
                        { value: "false", label: "Other income" },
                        { value: "true", label: "Salary" },
                      ]}
                    />
                    <Field
                      label="Salary month"
                      name="monthKey"
                      type="month"
                      defaultValue={str("monthKey", month)}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="form-grid">
                <Field
                  label="Merchant"
                  name="merchant"
                  defaultValue={str("merchant")}
                />
                <Field
                  label="Payment method"
                  name="paymentMethod"
                  defaultValue={str("paymentMethod")}
                />
              </div>
            )}
            <Field label="Note" name="note" defaultValue={str("note")} />
          </>
        )}
        {kind === "goals" && (
          <>
            <Field
              label="Goal name"
              name="name"
              defaultValue={str("name")}
              required
            />
            <div className="form-grid">
              <Field
                label="Target (RM)"
                name="target"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={str("targetAmount")}
                required
              />
              <Field
                label="Existing savings (RM)"
                name="current"
                type="number"
                step="0.01"
                min="0"
                defaultValue={str("currentAmount", "0")}
                required
              />
            </div>
            <DateField
              label="Deadline (optional)"
              name="deadline"
              defaultValue={str("deadline")}
              optional
            />
          </>
        )}
        {(kind === "debts" || kind === "receivables") && (
          <>
            <Field
              label="Name"
              name="name"
              defaultValue={str("name")}
              required
            />
            <Field
              label={kind === "debts" ? "Lender" : "Borrower"}
              name={kind === "debts" ? "lender" : "borrower"}
              defaultValue={str(kind === "debts" ? "lender" : "borrower")}
              required
            />
            <div className="form-grid">
              <Field
                label="Original amount (RM)"
                name="original"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={str("originalAmount")}
                required
              />
              <Field
                label="Remaining amount (RM)"
                name="remaining"
                type="number"
                step="0.01"
                min="0"
                defaultValue={str("remainingAmount")}
                required
              />
            </div>
            <div className="form-grid">
              <Field
                label={
                  kind === "debts"
                    ? "Monthly payment (RM)"
                    : "Expected monthly repayment (RM)"
                }
                name="monthly"
                type="number"
                step="0.01"
                min="0"
                defaultValue={str(
                  kind === "debts" ? "monthlyPayment" : "monthlyRepayment",
                  "0",
                )}
                required
              />
              <Field
                label="Due day"
                name="day"
                type="number"
                min="1"
                max="31"
                defaultValue={str("dueDay", "1")}
                required
              />
            </div>
            <DateField
              label="Start date"
              name="startDate"
              defaultValue={str("startDate", `${month}-01`)}
            />
            {kind === "debts" && (
              <>
                <div className="form-grid">
                  <Field
                    label="Total instalments (optional)"
                    name="installments"
                    type="number"
                    min="1"
                    defaultValue={str("totalInstallments")}
                  />
                  <Field
                    label="Previously paid instalments"
                    name="initialPaid"
                    type="number"
                    min="0"
                    defaultValue={str("initialPaidInstallments", "0")}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Tracks principal and fixed payments. Interest is not
                  calculated automatically.
                </p>
              </>
            )}
          </>
        )}
        {kind === "accounts" && (
          <>
            <Field
              label="Account name"
              name="name"
              defaultValue={str("name")}
              placeholder="Maybank / cash / TNG"
              required
            />
            <SelectField
              label="Account type"
              name="type"
              defaultValue={str("type", "bank")}
              options={[
                { value: "bank", label: "Bank" },
                { value: "cash", label: "Cash" },
                { value: "ewallet", label: "E-wallet" },
              ]}
            />
            <Field
              label="Opening balance (RM)"
              name="opening"
              type="number"
              step="0.01"
              defaultValue={str("openingBalance", "0")}
              required
            />
            <DateField
              label="Opening date"
              name="openingDate"
              defaultValue={str("openingDate", `${month}-01`)}
            />
            <p className="text-xs text-muted-foreground">
              Balance before your first tracked transaction. Do not include
              income already recorded in FlowTrack.
            </p>
          </>
        )}
        {kind === "transfers" && (
          <>
            <SelectField
              label="From account"
              name="fromAccountId"
              defaultValue={str("fromAccountId", data.accounts[0]?.id)}
              options={data.accounts.map((a) => ({
                value: a.id,
                label: a.name,
              }))}
            />
            <SelectField
              label="To account"
              name="toAccountId"
              defaultValue={str("toAccountId", data.accounts[1]?.id)}
              options={data.accounts.map((a) => ({
                value: a.id,
                label: a.name,
              }))}
            />
            <div className="form-grid">
              <Field
                label="Amount (RM)"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={str("amount")}
                required
              />
              <DateField defaultValue={str("date", defaultDate)} />
            </div>
            <Field label="Note" name="note" defaultValue={str("note")} />
          </>
        )}
        {kind === "budgets" && (
          <>
            <SelectField
              label="Category"
              name="categoryId"
              defaultValue={str(
                "categoryId",
                data.categories.find((c) => c.type === "expense")?.id,
              )}
              options={data.categories
                .filter((c) => c.type === "expense")
                .map((c) => ({ value: c.id, label: c.name }))}
            />
            <Field
              label="Budget limit (RM)"
              name="limit"
              type="number"
              step="0.01"
              min="0"
              defaultValue={
                row?.categoryId
                  ? budgetLimit(data, String(row.categoryId), month)
                  : ""
              }
              required
            />
          </>
        )}
        {kind === "categories" && (
          <>
            <Field
              label="Category name"
              name="name"
              defaultValue={str("name")}
              required
            />
            <SelectField
              label="Type"
              name="type"
              defaultValue={str("type", "expense")}
              options={["expense", "income", "commitment"].map((v) => ({
                value: v,
                label: v[0].toUpperCase() + v.slice(1),
              }))}
            />
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {finance.error && (
          <p role="alert" className="text-sm text-destructive">
            {finance.error}
          </p>
        )}
        <FormActions busy={finance.pending} onClose={onClose} />
      </form>
    </Modal>
  );
}
