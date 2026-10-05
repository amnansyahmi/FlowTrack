import { useState } from "react";
import type { Finance } from "../hooks/use-finance";
import type { Editor } from "../components/entry-dialog";
import { DEFAULT_SETTINGS } from "../lib/types";
import { amount, day } from "../lib/validation";
import { makeBackup } from "../lib/backup";
import { loadData } from "../lib/db";
import { Button } from "../components/ui/button";
import { Confirm, Field, Panel } from "../components/shared";
export function Settings({
  finance,
  onEdit,
  onImport,
}: {
  finance: Finance;
  onEdit: (editor: Editor) => void;
  onImport: () => void;
}) {
  const preferences = finance.data.settings[0] ?? DEFAULT_SETTINGS;
  const [error, setError] = useState("");
  const [storage, setStorage] = useState("");
  async function exportBackup() {
    await finance.run(async () => {
      const all = await loadData();
      const blob = new Blob([makeBackup(all)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `flowtrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "Backup exported.");
  }
  return (
    <div className="space-y-6">
      <Panel
        title="Savings & payday"
        description="Your savings target is reserved from safe spending and stays saved after reload."
      >
        <form
          key={`${preferences.savingsTarget}:${preferences.paydayDay}`}
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const form = new FormData(event.currentTarget);
            try {
              await finance.change(
                [
                  {
                    store: "settings",
                    value: {
                      ...preferences,
                      savingsTarget: amount(
                        form.get("target"),
                        "Savings target",
                        true,
                      ),
                      paydayDay: day(form.get("payday")),
                    },
                  },
                ],
                "Preferences saved.",
              );
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Review these settings.",
              );
            }
          }}
        >
          <div className="form-grid">
            <Field
              label="Monthly savings target (RM)"
              name="target"
              type="number"
              step="0.01"
              min="0"
              defaultValue={preferences.savingsTarget}
              required
            />
            <Field
              label="Payday (day of month)"
              name="payday"
              type="number"
              min="1"
              max="31"
              defaultValue={preferences.paydayDay}
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button disabled={finance.pending} type="submit">
            Save preferences
          </Button>
        </form>
      </Panel>
      <Panel
        title="Backup & restore"
        description="Your records are stored on this device. Keep backups before clearing browser data or changing devices."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={finance.pending}
            onClick={() => void exportBackup()}
          >
            Export JSON backup
          </Button>
          <Button onClick={onImport}>Import file or paste text</Button>
        </div>
      </Panel>
      <Panel
        title="Categories"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit({ kind: "categories" })}
          >
            Add category
          </Button>
        }
      >
        <div className="divide-y">
          {finance.data.categories.map((category) => (
            <div className="row" key={category.id}>
              <div>
                <span className="text-sm font-medium">{category.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {category.type}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onEdit({ kind: "categories", row: { ...category } })
                  }
                >
                  Edit
                </Button>
                <Confirm
                  disabled={finance.pending}
                  description="Categories used by transactions, bills, or budgets cannot be deleted."
                  onConfirm={() => {
                    if (
                      [
                        ...finance.data.income,
                        ...finance.data.expenses,
                        ...finance.data.commitments,
                        ...finance.data.budgets,
                      ].some((row) => row.categoryId === category.id)
                    ) {
                      finance.setError(
                        "This category is in use. Reassign its records before deleting.",
                      );
                      return Promise.resolve(false);
                    }
                    return finance.change([
                      { store: "categories", deleteId: category.id },
                    ]);
                  }}
                >
                  Delete
                </Confirm>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel
        title="Device storage"
        description="Core screens work offline after the installed app is cached. Receipt scanning may need a connection for its first download."
      >
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const persisted = await navigator.storage?.persist?.();
              const estimate = await navigator.storage?.estimate?.();
              setStorage(
                `${persisted ? "Persistent storage enabled." : "Browser controls storage retention."} ${estimate?.usage ? `${(estimate.usage / 1024 / 1024).toFixed(1)} MB used.` : ""}`,
              );
            } catch {
              setStorage(
                "Storage protection is unavailable in this browser. Keep a backup.",
              );
            }
          }}
        >
          Protect local storage
        </Button>
        {storage && (
          <p className="mt-3 text-sm text-muted-foreground">{storage}</p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          FlowTrack · Local data · No cloud account required
        </p>
      </Panel>
    </div>
  );
}
