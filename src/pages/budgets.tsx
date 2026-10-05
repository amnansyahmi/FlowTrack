import type { Finance } from "../hooks/use-finance";
import type { Editor } from "../components/entry-dialog";
import { budgetLimit, calculate, money, shiftMonth, sum } from "../lib/finance";
import { Button } from "../components/ui/button";
import { Confirm, Panel } from "../components/shared";
export function Budgets({
  finance,
  month,
  onEdit,
}: {
  finance: Finance;
  month: string;
  onEdit: (editor: Editor) => void;
}) {
  const { data } = finance;
  const stats = calculate(data, month);
  const previous = shiftMonth(month, -1);
  const expenseCategories = data.categories.filter((c) => c.type === "expense");
  return (
    <Panel
      title="Monthly category budgets"
      icon="budget"
      description="Limits are saved separately for each month. Zero means no spending limit."
      action={
        <Button onClick={() => onEdit({ kind: "budgets" })}>Add budget</Button>
      }
    >
      <div className="mb-5">
        <Confirm
          title="Copy last month’s budgets?"
          description={`Existing limits for ${month} will be replaced with limits from ${previous}.`}
          disabled={finance.pending}
          onConfirm={() =>
            finance.change(
              expenseCategories.map((c) => ({
                store: "budgets",
                value: {
                  id:
                    data.budgets.find(
                      (b) => b.categoryId === c.id && b.monthKey === month,
                    )?.id ?? `${month}:${c.id}`,
                  categoryId: c.id,
                  monthKey: month,
                  limit: budgetLimit(data, c.id, previous),
                },
              })),
              "Budgets copied.",
            )
          }
        >
          Copy previous month
        </Confirm>
      </div>
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        {expenseCategories.map((category) => {
          const limit = budgetLimit(data, category.id, month);
          const spent = sum(
            stats.expenses
              .filter((e) => e.categoryId === category.id)
              .map((e) => e.amount),
          );
          return (
            <div key={category.id} className="border-b pb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {money(spent)}
                    {limit ? ` of ${money(limit)}` : " · No limit"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onEdit({
                      kind: "budgets",
                      row: { categoryId: category.id },
                    })
                  }
                >
                  Edit
                </Button>
              </div>
              {limit > 0 && (
                <>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        spent > limit
                          ? "h-full bg-destructive"
                          : "h-full bg-primary"
                      }
                      style={{
                        width: `${Math.min(100, (spent / limit) * 100)}%`,
                      }}
                    />
                  </div>
                  <p
                    className={`mt-2 text-xs ${spent > limit ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {spent > limit
                      ? `${money(spent - limit)} over budget`
                      : `${money(limit - spent)} remaining`}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
