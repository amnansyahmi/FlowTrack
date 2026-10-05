import { useState } from "react";
import type { Finance } from "../hooks/use-finance";
import type { Occurrence } from "../lib/finance";
import { dateKey, money } from "../lib/finance";
import { amount, date } from "../lib/validation";
import { AccountField, DateField, Field, FormActions, Modal } from "./shared";
export type Payment =
  | { kind: "bill"; occurrence: Occurrence }
  | { kind: "debt" | "repayment" | "goal"; id: string };
export function PaymentDialog({
  payment,
  finance,
  month,
  onClose,
}: {
  payment: Payment;
  finance: Finance;
  month: string;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const { data } = finance;
  const entity =
    payment.kind === "bill"
      ? payment.occurrence.commitment
      : payment.kind === "debt"
        ? data.debts.find((d) => d.id === payment.id)
        : payment.kind === "repayment"
          ? data.receivables.find((d) => d.id === payment.id)
          : data.goals.find((g) => g.id === payment.id);
  if (!entity) return null;
  const name = "title" in entity ? entity.title : entity.name;
  const fixed =
    payment.kind === "bill" ? payment.occurrence.commitment.amount : undefined;
  const defaultAmount =
    payment.kind === "debt"
      ? Math.min(
          data.debts.find((d) => d.id === payment.id)!.monthlyPayment,
          data.debts.find((d) => d.id === payment.id)!.remainingAmount,
        )
      : payment.kind === "repayment"
        ? Math.min(
            data.receivables.find((d) => d.id === payment.id)!.monthlyRepayment,
            data.receivables.find((d) => d.id === payment.id)!.remainingAmount,
          )
        : undefined;
  const dateDefault =
    month === dateKey().slice(0, 7) ? dateKey() : `${month}-01`;
  return (
    <Modal
      title={
        payment.kind === "repayment"
          ? "Receive repayment"
          : payment.kind === "goal"
            ? "Set aside savings"
            : "Record payment"
      }
      description={
        payment.kind === "goal"
          ? `${name}. Contributions move money outside your tracked accounts.`
          : String(name)
      }
      onClose={onClose}
      busy={finance.pending}
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          const form = new FormData(event.currentTarget);
          try {
            const value = fixed ?? amount(form.get("amount"));
            const paidDate = date(form.get("date"));
            if (
              payment.kind === "bill" &&
              paidDate.slice(0, 7) !== payment.occurrence.dueDate.slice(0, 7)
            )
              throw new Error(
                "Use a payment date in the selected billing month.",
              );
            const accountId =
              form.get("accountId") === "unassigned"
                ? undefined
                : String(form.get("accountId"));
            if (
              accountId &&
              !data.accounts.some(
                (a) => a.id === accountId && a.openingDate <= paidDate,
              )
            )
              throw new Error("Payment must follow the account opening date.");
            let ok = false;
            if (payment.kind === "bill")
              ok = await finance.payBill(
                payment.occurrence,
                paidDate,
                accountId,
              );
            else if (payment.kind === "debt")
              ok = await finance.payDebt(
                payment.id,
                value,
                paidDate,
                accountId,
              );
            else if (payment.kind === "repayment")
              ok = await finance.receivePayment(
                payment.id,
                value,
                paidDate,
                accountId,
              );
            else
              ok = await finance.contribute(
                payment.id,
                value,
                paidDate,
                accountId,
              );
            if (ok) onClose();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Review this payment.",
            );
          }
        }}
      >
        {fixed !== undefined ? (
          <p className="text-2xl font-semibold tabular-nums">{money(fixed)}</p>
        ) : (
          <Field
            label="Amount (RM)"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={defaultAmount || ""}
            required
          />
        )}
        <DateField defaultValue={dateDefault} />
        <AccountField accounts={data.accounts} />
        {(error || finance.error) && (
          <p role="alert" className="text-sm text-destructive">
            {error || finance.error}
          </p>
        )}
        <FormActions busy={finance.pending} onClose={onClose} />
      </form>
    </Modal>
  );
}
