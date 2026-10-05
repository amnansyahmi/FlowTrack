import { useEffect, useState } from "react";
import type { Finance } from "../hooks/use-finance";
import type { parseReceipt } from "../lib/ocr";
import { amount, date, text } from "../lib/validation";
import { Modal, Field, DateField, SelectField, AccountField } from "./shared";
import { Button } from "./ui/button";
import { commitChanges } from "../lib/db";
export function ScanDialog({
  file,
  finance,
  onClose,
}: {
  file: File;
  finance: Finance;
  onClose: () => void;
}) {
  const [result, setResult] = useState<ReturnType<typeof parseReceipt> | null>(
    null,
  );
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [override, setOverride] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function scan() {
      try {
        const { scanReceipt, receiptImage } = await import("../lib/ocr");
        const compressed = await receiptImage(file);
        if (!cancelled) setImage(compressed);
        const parsed = await scanReceipt(file, controller.signal);
        if (!cancelled) setResult(parsed);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "Scanning failed. Try another image or add the expense manually.",
          );
      }
    }
    void scan();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [file]);
  return (
    <Modal
      title="Scan receipt"
      description="Review the merchant, final total, and date before saving."
      onClose={onClose}
      busy={finance.pending}
    >
      {image && (
        <img
          src={image}
          alt="Receipt being scanned"
          className="max-h-44 w-full rounded-md bg-muted object-contain"
        />
      )}
      {!result && !error && (
        <p role="status" className="py-6 text-sm text-muted-foreground">
          Reading receipt… You can close this window at any time.
        </p>
      )}
      {result && (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const form = new FormData(event.currentTarget);
            try {
              const value = amount(form.get("amount"));
              const transactionDate = date(form.get("date"));
              const merchant = text(form.get("merchant"), "Merchant");
              const duplicate = finance.data.expenses.some(
                (e) =>
                  e.amount === value &&
                  e.date.slice(0, 10) === transactionDate &&
                  (e.merchant ?? e.note ?? "").toLowerCase() ===
                    merchant.toLowerCase(),
              );
              if (duplicate && !override) {
                setError(
                  "A matching expense already exists. Check your history or confirm below to keep both.",
                );
                return;
              }
              const accountId =
                form.get("accountId") === "unassigned"
                  ? undefined
                  : String(form.get("accountId"));
              if (
                accountId &&
                !finance.data.accounts.some(
                  (a) => a.id === accountId && a.openingDate <= transactionDate,
                )
              )
                throw new Error(
                  "Expense date must follow account opening date.",
                );
              const receiptId = crypto.randomUUID();
              const receipt = {
                id: receiptId,
                data: image,
                type: "image/jpeg",
                name: file.name,
                ocrText: result.raw,
              };
              const expense = {
                id: crypto.randomUUID(),
                amount: value,
                date: transactionDate,
                merchant,
                note: merchant,
                categoryId: String(form.get("categoryId")),
                accountId,
                receiptId,
              };
              if (
                await finance.run(
                  () =>
                    commitChanges([
                      { store: "receipts", value: receipt },
                      { store: "expenses", value: expense },
                    ]),
                  "Scanned expense saved with receipt.",
                )
              )
                onClose();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Review this receipt.",
              );
            }
          }}
        >
          <p className="text-xs text-muted-foreground">
            Text recognition confidence: {Math.round(result.confidence)}%. This
            does not verify the extracted amount.
          </p>
          {result.warnings.map((warning) => (
            <p key={warning} className="text-sm text-destructive">
              {warning}
            </p>
          ))}
          <Field
            label="Merchant"
            name="merchant"
            defaultValue={result.merchant}
            required
          />
          <div className="form-grid">
            <Field
              label="Final total (RM)"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={result.amount || ""}
              required
            />
            <DateField defaultValue={result.date} />
          </div>
          <SelectField
            label="Category"
            name="categoryId"
            options={finance.data.categories
              .filter((c) => c.type === "expense")
              .map((c) => ({ value: c.id, label: c.name }))}
          />
          <AccountField accounts={finance.data.accounts} />
          {error.includes("matching expense") && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
              />
              Keep both matching expenses
            </label>
          )}
          <Button type="submit" disabled={finance.pending}>
            {finance.pending ? "Saving…" : "Save expense & receipt"}
          </Button>
        </form>
      )}
      {(error || finance.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || finance.error}
        </p>
      )}
    </Modal>
  );
}
