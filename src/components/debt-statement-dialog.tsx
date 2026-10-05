import { useEffect, useRef, useState } from "react";
import { Modal, Field } from "./shared";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ImageIcon } from "./image-icon";
import { parseDebtStatement } from "../lib/debt-statement";
import { money } from "../lib/finance";
import type { Editor } from "./entry-dialog";

export function DebtStatementDialog({
  editor,
  onReview,
  onClose,
}: {
  editor?: Editor;
  onReview: (editor: Editor) => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [raw, setRaw] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<
    (ReturnType<typeof parseDebtStatement> & { image?: string }) | null
  >(null);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function read(next: File) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setResult(null);
    setError("");
    setStatus("Opening statement…");
    try {
      const { readDebtStatement } = await import("../lib/statement-reader");
      const parsed = await readDebtStatement(
        next,
        controller.signal,
        (message) => {
          if (!controller.signal.aborted) setStatus(message);
        },
        password,
      );
      if (!controller.signal.aborted) setResult(parsed);
    } catch (err) {
      if (!controller.signal.aborted)
        setError(
          err instanceof Error ? err.message : "Unable to read this statement.",
        );
    } finally {
      if (!controller.signal.aborted) setStatus("");
    }
  }
  return (
    <Modal
      title="Read debt statement"
      description="Upload a PDF or screenshot, or paste statement text. Review all amounts before saving."
      onClose={onClose}
    >
      <div className="statement-upload">
        <ImageIcon name="upload" className="size-7" />
        <p className="text-sm font-medium">Credit card or PayLater statement</p>
        <p className="text-xs text-muted-foreground">
          PDF up to 12 MB · Images up to 8 MB
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => input.current?.click()}
          disabled={!!status}
        >
          Choose statement
        </Button>
        <input
          ref={input}
          type="file"
          aria-label="Upload debt statement"
          accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            const next = event.target.files?.[0];
            if (next) {
              setFile(next);
              void read(next);
            }
            event.target.value = "";
          }}
        />
      </div>
      {file && (
        <div className="space-y-3">
          <p className="break-words text-xs text-muted-foreground">
            {file.name}
          </p>
          {(file.type === "application/pdf" || /\.pdf$/i.test(file.name)) && (
            <Field
              label="PDF password (if required)"
              name="password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
          <Button
            type="button"
            variant="outline"
            disabled={!!status}
            onClick={() => void read(file)}
          >
            Read file again
          </Button>
        </div>
      )}
      <details className="statement-text">
        <summary className="cursor-pointer text-sm font-medium">
          Paste statement text instead
        </summary>
        <div className="mt-3 space-y-3">
          <Textarea
            aria-label="Statement text"
            placeholder="Outstanding balance RM1,200.00\nMonthly instalment RM200.00\nDue date 15/10/2026"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            rows={6}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!!status || !raw.trim()}
            onClick={() => {
              setError("");
              setResult(parseDebtStatement(raw));
            }}
          >
            Detect statement details
          </Button>
        </div>
      </details>
      {status && (
        <p role="status" className="text-sm text-muted-foreground">
          {status} You can close this window to cancel.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div className="space-y-4">
          {result.image && (
            <img
              src={result.image}
              alt="Statement preview"
              className="max-h-40 w-full rounded-lg bg-muted object-contain"
            />
          )}
          <dl className="statement-results">
            {[
              { label: "Provider", value: result.lender || "Not detected" },
              {
                label: "Outstanding balance",
                value:
                  result.remainingAmount === undefined
                    ? "Not detected"
                    : money(result.remainingAmount),
              },
              {
                label: "Suggested monthly payment",
                value:
                  result.monthlyPayment === undefined
                    ? "Not detected"
                    : money(result.monthlyPayment),
              },
              { label: "Due date", value: result.dueDate ?? "Not detected" },
            ].map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-2">
            {result.warnings.map((warning, index) => (
              <p key={index} className="text-xs text-muted-foreground">
                {warning}
              </p>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Processed on this device. A first-page/image preview is kept only
            when you save; the original PDF is not stored.
          </p>
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              const existing = editor?.row ?? {};
              const remaining = result.remainingAmount;
              onReview({
                kind: "debts",
                row: {
                  ...existing,
                  name: existing.name || result.name,
                  lender: existing.lender || result.lender,
                  debtType: existing.debtType || result.debtType,
                  originalAmount: existing.id
                    ? existing.originalAmount
                    : (result.originalAmount ?? remaining),
                  remainingAmount: remaining ?? existing.remainingAmount,
                  monthlyPayment:
                    result.monthlyPayment ?? existing.monthlyPayment,
                  dueDay: result.dueDate
                    ? Number(result.dueDate.slice(8, 10))
                    : existing.dueDay,
                  totalInstallments:
                    result.totalInstallments ?? existing.totalInstallments,
                  initialPaidInstallments: existing.id
                    ? existing.initialPaidInstallments
                    : result.initialPaidInstallments,
                },
                attachment: result.image
                  ? {
                      id: crypto.randomUUID(),
                      data: result.image,
                      type: "image/jpeg",
                      name: file?.name ?? "Statement",
                      ocrText: result.raw,
                    }
                  : editor?.attachment,
              });
            }}
          >
            <ImageIcon name="edit" className="icon-light size-4" />
            Review &amp; edit debt
          </Button>
        </div>
      )}
    </Modal>
  );
}
