import { useState } from "react";
import type { Finance } from "../hooks/use-finance";
import { parseBackup } from "../lib/backup";
import { replaceData, type Change } from "../lib/db";
import {
  parseTextImport,
  type ImportLine,
  type ImportKind,
} from "../lib/text-import";
import { amount } from "../lib/validation";
import { DEFAULT_SETTINGS, type StoreData, type Category } from "../lib/types";
import { money, sum } from "../lib/finance";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { SelectField, Modal, Confirm } from "./shared";
export function ImportDialog({
  finance,
  month,
  onClose,
}: {
  finance: Finance;
  month: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [lines, setLines] = useState<ImportLine[]>([]);
  const [backup, setBackup] = useState<StoreData | null>(null);
  const [error, setError] = useState("");
  const [dueDay, setDueDay] = useState(1);
  const { data } = finance;
  function preview(value = text) {
    setError("");
    setBackup(null);
    setLines([]);
    try {
      if (!value.trim()) throw new Error("Paste your backup or list first.");
      if (value.trim().startsWith("{") || value.trim().startsWith("["))
        setBackup(parseBackup(value));
      else
        setLines(
          parseTextImport(value).map((line) =>
            line.kind === "bill" &&
            data.commitments.some(
              (c) => c.title.toLowerCase() === line.name.toLowerCase(),
            )
              ? {
                  ...line,
                  kind: "skip",
                  warning:
                    "An existing bill has this name. Skipped to prevent duplication.",
                }
              : line,
          ),
        );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to read this text.",
      );
    }
  }
  function update(id: string, patch: Partial<ImportLine>) {
    setLines((previous) =>
      previous.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }
  async function importList() {
    setError("");
    try {
      const selected = lines.filter((line) => line.kind !== "skip");
      if (!selected.length)
        throw new Error("Choose at least one row to import.");
      const changes: Change[] = [];
      const categories = [...data.categories];
      const settings = { ...(data.settings[0] ?? DEFAULT_SETTINGS) };
      const names = new Set<string>();
      const savingsAmounts: number[] = [];
      function category(name: string, type: Category["type"]) {
        const existing = categories.find(
          (c) => c.type === type && c.name.toLowerCase() === name.toLowerCase(),
        );
        if (existing) return existing.id;
        const value = { id: crypto.randomUUID(), name, icon: "", type };
        categories.push(value);
        changes.push({ store: "categories", value });
        return value.id;
      }
      for (const line of selected) {
        const value = amount(line.amount, "Amount");
        const name = line.name.trim();
        if (!name) throw new Error("Every imported row needs a name.");
        const key = `${line.kind}:${name.toLowerCase()}`;
        if (names.has(key))
          throw new Error(`Duplicate row: ${name}. Skip one before importing.`);
        names.add(key);
        if (line.kind === "bill") {
          if (
            data.commitments.some(
              (c) => c.title.toLowerCase() === name.toLowerCase(),
            )
          )
            throw new Error(
              `${name} already exists. Edit the existing bill or skip this row.`,
            );
          changes.push({
            store: "commitments",
            value: {
              id: crypto.randomUUID(),
              title: name,
              amount: value,
              dueDateDay: dueDay,
              categoryId: category("Imported bills", "commitment"),
              frequency: "monthly",
              startDate: `${month}-01`,
            },
          });
        } else if (line.kind === "budget") {
          const categoryId = category(name, "expense");
          changes.push({
            store: "budgets",
            value: {
              id:
                data.budgets.find(
                  (b) => b.categoryId === categoryId && b.monthKey === month,
                )?.id ?? `${month}:${categoryId}`,
              categoryId,
              monthKey: month,
              limit: value,
            },
          });
        } else if (line.kind === "income") {
          changes.push({
            store: "income",
            value: {
              id: crypto.randomUUID(),
              amount: value,
              date: `${month}-01`,
              note: name,
              source: name,
              categoryId: category("Imported income", "income"),
            },
          });
        } else savingsAmounts.push(value);
      }
      if (savingsAmounts.length)
        changes.push({
          store: "settings",
          value: { ...settings, savingsTarget: sum(savingsAmounts) },
        });
      if (await finance.change(changes, "Text list imported.")) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review the preview.");
    }
  }
  return (
    <Modal
      title="Import data"
      description="Paste a JSON backup or a list of monthly amounts. Review every suggestion before saving."
      onClose={onClose}
      wide
      busy={finance.pending}
    >
      <div className="space-y-4">
        <Label htmlFor="import-text">Backup JSON or expense list</Label>
        <Textarea
          id="import-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setLines([]);
            setBackup(null);
          }}
          className="min-h-40 font-mono text-xs"
          placeholder={
            "1. Loan Rumah - RM1300\n2. Netflix - RM50\n3. Groceries - RM400\n4. Saving - RM200"
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={finance.pending} onClick={() => preview()}>
            Preview import
          </Button>
          <Button asChild variant="outline">
            <label className="cursor-pointer">
              Choose JSON file
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 30 * 1024 * 1024) {
                    setError("Backup must be smaller than 30 MB.");
                    return;
                  }
                  const value = await file.text();
                  setText(value);
                  preview(value);
                }}
              />
            </label>
          </Button>
        </div>
        {backup && (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm">
              Validated backup:{" "}
              {sum(Object.values(backup).map((rows) => rows.length))} records.
            </p>
            <p className="text-sm text-muted-foreground">
              Restoring replaces all current records. Export a backup of your
              current data first.
            </p>
            <Confirm
              title="Replace current data with this backup?"
              description="All current records will be replaced together. If restore fails, your current records are retained."
              disabled={finance.pending}
              onConfirm={async () => {
                const ok = await finance.run(
                  () => replaceData(backup),
                  "Backup restored.",
                );
                if (ok) onClose();
                return ok;
              }}
            >
              Restore backup
            </Confirm>
          </div>
        )}
        {lines.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            <div className="form-grid">
              <SelectField
                label="Default bill due day"
                name="dueDay"
                value={String(dueDay)}
                onChange={(v) => setDueDay(Number(v))}
                options={Array.from({ length: 31 }, (_, i) => ({
                  value: String(i + 1),
                  label: String(i + 1),
                }))}
              />
              <div className="self-center text-sm text-muted-foreground">
                Importing into {month}. Budgets replace existing limits for that
                month; the savings target is replaced.
              </div>
            </div>
            <div className="max-h-80 overflow-auto divide-y">
              {lines.map((line) => (
                <div key={line.id} className="space-y-2 py-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_110px_150px]">
                    <Input
                      aria-label={`Name for line ${line.id}`}
                      value={line.name}
                      onChange={(e) =>
                        update(line.id, { name: e.target.value })
                      }
                    />
                    <Input
                      aria-label={`Amount for ${line.name}`}
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={line.amount ?? ""}
                      placeholder="Amount"
                      onChange={(e) =>
                        update(line.id, {
                          amount: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                    <SelectField
                      label="Import as"
                      name={`kind-${line.id}`}
                      value={line.kind}
                      onChange={(value) =>
                        update(line.id, { kind: value as ImportKind })
                      }
                      options={[
                        { value: "bill", label: "Monthly bill" },
                        { value: "budget", label: "Category budget" },
                        { value: "savings", label: "Savings target" },
                        { value: "income", label: "Income received" },
                        { value: "skip", label: "Skip" },
                      ]}
                    />
                  </div>
                  {line.warning && (
                    <p className="text-xs text-muted-foreground">
                      {line.warning}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t pt-3 text-sm">
              {(["bill", "budget", "savings", "income"] as ImportKind[]).map(
                (kind) => (
                  <p key={kind}>
                    {kind === "bill"
                      ? "Bills"
                      : kind === "budget"
                        ? "Budgets"
                        : kind === "savings"
                          ? "Savings"
                          : "Income"}
                    :{" "}
                    <strong>
                      {money(
                        sum(
                          lines
                            .filter((line) => line.kind === kind)
                            .map((line) => line.amount ?? 0),
                        ),
                      )}
                    </strong>
                  </p>
                ),
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Budgets are spending limits, not completed expenses. Expected
              repayments and summary balances are not added as income.
            </p>
            <Button
              disabled={finance.pending}
              onClick={() => void importList()}
            >
              {finance.pending ? "Importing…" : "Import reviewed rows"}
            </Button>
          </div>
        )}
        {(error || finance.error) && (
          <p role="alert" className="text-sm text-destructive">
            {error || finance.error}
          </p>
        )}
      </div>
    </Modal>
  );
}
