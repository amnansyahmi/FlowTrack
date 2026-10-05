import { ImageIcon, categoryIcon } from "../components/image-icon";
import { useRef, useState } from "react";
import type { Finance } from "../hooks/use-finance";
import type { Editor } from "../components/entry-dialog";
import { money } from "../lib/finance";
import {
  transactions,
  reverseTransaction,
  type Transaction,
} from "../lib/transactions";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Confirm, Empty, Modal, Panel } from "../components/shared";
export function Transactions({
  finance,
  month,
  onEdit,
}: {
  finance: Finance;
  month: string;
  onEdit: (editor: Editor) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [attach, setAttach] = useState<Transaction | null>(null);
  const [uploading, setUploading] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const rows = transactions(finance.data, month).filter(
    (t) =>
      (filter === "All" ||
        (filter === "Income" ? t.type === "income" : t.type !== "income")) &&
      `${t.title} ${finance.data.categories.find((c) => c.id === t.categoryId)?.name ?? ""} ${t.date}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function uploadReceipt(file: File, transaction: Transaction) {
    setUploading(true);
    try {
      const { receiptImage } = await import("../lib/ocr");
      const image = await receiptImage(file);
      const id = crypto.randomUUID();
      const store =
        transaction.type === "expense"
          ? "expenses"
          : transaction.type === "bill"
            ? "commitmentLogs"
            : "debtPayments";
      await finance.change(
        [
          {
            store: "receipts",
            value: { id, data: image, name: file.name, type: "image/jpeg" },
          },
          {
            store,
            value: { ...transaction.row, id: transaction.id, receiptId: id },
          },
        ],
        "Receipt attached.",
      );
    } catch (error) {
      finance.setError(
        error instanceof Error ? error.message : "Unable to attach this image.",
      );
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          {["All", "Income", "Outflows"].map((v) => (
            <Button
              key={v}
              variant={filter === v ? "default" : "outline"}
              onClick={() => setFilter(v)}
            >
              {v}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onEdit({ kind: "income" })}>
            Add income
          </Button>
          <Button onClick={() => onEdit({ kind: "expenses" })}>
            Add expense
          </Button>
        </div>
      </div>
      <Input
        aria-label="Search transactions"
        placeholder="Search name, category, or date"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Panel
        title="Transaction history"
        icon="activity"
        description="Payments, expenses, income, and savings in one place."
      >
        {rows.length === 0 ? (
          <Empty>No matching transactions this month.</Empty>
        ) : (
          <div className="divide-y">
            {rows.map((transaction) => (
              <div
                key={`${transaction.type}:${transaction.id}`}
                className="py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="icon-tile">
                      <ImageIcon
                        name={
                          transaction.type === "income"
                            ? "income"
                            : categoryIcon(
                                finance.data.categories.find(
                                  (category) =>
                                    category.id === transaction.categoryId,
                                )?.name ?? transaction.title,
                              )
                        }
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium break-words">
                        {transaction.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {transaction.date.slice(0, 10)} ·{" "}
                        {transaction.type === "expense"
                          ? transaction.row.debtPaymentId
                            ? "Debt payment"
                            : transaction.row.commitmentLogId
                              ? "Bill payment"
                              : finance.data.categories.find(
                                  (c) => c.id === transaction.categoryId,
                                )?.name || "Expense"
                          : transaction.type}
                        {transaction.linked ? " · Linked" : ""}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`shrink-0 font-medium tabular-nums ${transaction.type === "income" ? "text-primary" : ""}`}
                  >
                    {transaction.type === "income" ? "+" : "−"}
                    {money(transaction.amount)}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-1">
                  {(transaction.type === "income" ||
                    transaction.type === "expense") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onEdit({
                          kind:
                            transaction.type === "income"
                              ? "income"
                              : "expenses",
                          row: transaction.row,
                        })
                      }
                    >
                      Edit
                    </Button>
                  )}
                  {transaction.type === "expense" && !transaction.linked && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={finance.pending}
                      onClick={() =>
                        onEdit({
                          kind: "expenses",
                          row: {
                            amount: transaction.amount,
                            categoryId: transaction.categoryId,
                            note: transaction.row.note,
                            merchant: transaction.row.merchant,
                            paymentMethod: transaction.row.paymentMethod,
                            accountId: transaction.row.accountId,
                          },
                        })
                      }
                    >
                      Duplicate
                    </Button>
                  )}
                  {transaction.receiptId ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setReceipt(transaction.receiptId!)}
                    >
                      View receipt
                    </Button>
                  ) : (
                    ["expense", "bill", "debt"].includes(transaction.type) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={uploading || finance.pending}
                        onClick={() => {
                          setAttach(transaction);
                          upload.current?.click();
                        }}
                      >
                        Attach receipt
                      </Button>
                    )
                  )}
                  <Confirm
                    disabled={finance.pending}
                    title={
                      transaction.linked
                        ? "Reverse this payment?"
                        : "Delete this transaction?"
                    }
                    description={
                      transaction.linked
                        ? "The linked payment, transaction, and remaining balance will be reversed together."
                        : "The transaction will be removed from your local records."
                    }
                    onConfirm={() => reverseTransaction(finance, transaction)}
                  >
                    {transaction.linked ? "Reverse" : "Delete"}
                  </Confirm>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <input
        ref={upload}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && attach) void uploadReceipt(file, attach);
          e.target.value = "";
        }}
      />
      {receipt && (
        <Modal
          title="Receipt"
          description={
            finance.data.receipts.find((r) => r.id === receipt)?.name ??
            "Original receipt"
          }
          onClose={() => setReceipt(null)}
        >
          <img
            src={finance.data.receipts.find((r) => r.id === receipt)?.data}
            className="max-h-[65dvh] w-full object-contain"
            alt="Attached transaction receipt"
          />
        </Modal>
      )}
    </div>
  );
}
