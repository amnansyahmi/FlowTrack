import { Button } from "../components/ui/button";
import { Empty, Panel } from "../components/shared";
import type { Finance } from "../hooks/use-finance";
import {
  calculate,
  dateKey,
  money,
  paydayPlan,
  sum,
  budgetLimit,
} from "../lib/finance";
import { DEFAULT_SETTINGS } from "../lib/types";
import { subscriptionLogo } from "../lib/subscriptions";
import type { Payment } from "../components/payment-dialog";
import type { Editor } from "../components/entry-dialog";
export function Dashboard({
  finance,
  month,
  onEdit,
  onPayment,
  onScan,
  onView,
}: {
  finance: Finance;
  month: string;
  onEdit: (editor: Editor) => void;
  onPayment: (payment: Payment) => void;
  onScan: () => void;
  onView: (view: string) => void;
}) {
  const { data } = finance;
  const stats = calculate(data, month);
  const payday = paydayPlan(
    stats.safeToSpend,
    (data.settings[0] ?? DEFAULT_SETTINGS).paydayDay,
  );
  const breakdown = data.categories
    .filter((c) => c.type === "expense")
    .map((category) => ({
      ...category,
      spent: sum(
        stats.expenses
          .filter((e) => e.categoryId === category.id)
          .map((e) => e.amount),
      ),
      limit: budgetLimit(data, category.id, month),
    }))
    .filter((c) => c.spent > 0 || c.limit > 0)
    .sort((a, b) => b.spent - a.spent);
  return (
    <div className="space-y-6 page-enter">
      <section className="summary-surface">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Safe to spend</p>
            <h2
              data-testid="safe-to-spend"
              className={`mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl ${stats.safeToSpend < 0 ? "text-destructive" : ""}`}
            >
              {money(stats.safeToSpend)}
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              After unpaid bills, debt payments, and your savings target.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => onEdit({ kind: "expenses" })}
          >
            Add expense
          </Button>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-5 border-t pt-5 sm:grid-cols-4">
          {[
            { label: "Available balance", value: stats.balance },
            { label: "Income this month", value: stats.totalIncome },
            { label: "Unpaid bills", value: stats.unpaidBills },
            { label: "Savings set aside", value: stats.savings },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1.5 text-lg font-medium tabular-nums">
                {money(item.value)}
              </p>
            </div>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => onEdit({ kind: "income" })}>
          Add income
        </Button>
        <Button
          variant="outline"
          onClick={() => onEdit({ kind: "commitments" })}
        >
          Add bill
        </Button>
        <Button variant="outline" onClick={onScan}>
          Scan receipt
        </Button>
        <Button variant="ghost" onClick={() => onView("Reports")}>
          View reports
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Upcoming bills"
          action={
            <Button variant="ghost" size="sm" onClick={() => onView("Bills")}>
              View all
            </Button>
          }
        >
          {stats.schedule.filter((o) => o.log?.status !== "paid").length ===
          0 ? (
            <Empty>No unpaid bills for this month.</Empty>
          ) : (
            <div className="divide-y">
              {stats.schedule
                .filter((o) => o.log?.status !== "paid")
                .slice(0, 4)
                .map((o) => {
                  const logo = subscriptionLogo(o.commitment.title);
                  return (
                    <div key={o.id} className="row">
                      <div className="flex min-w-0 items-center gap-3">
                        {logo && (
                          <img src={logo} alt="" className="size-7 shrink-0" />
                        )}
                        <div>
                          <p className="font-medium">{o.commitment.title}</p>
                          <p
                            className={`mt-1 text-xs ${o.dueDate < dateKey() ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            {o.dueDate} ·{" "}
                            {o.dueDate < dateKey()
                              ? "Overdue"
                              : o.dueDate === dateKey()
                                ? "Due today"
                                : "Upcoming"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="tabular-nums text-sm font-medium">
                          {money(o.commitment.amount)}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={finance.pending}
                          onClick={() =>
                            onPayment({ kind: "bill", occurrence: o })
                          }
                        >
                          Pay
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Panel>
        <Panel
          title="Cash flow"
          description="All completed payments are counted once."
        >
          <dl className="space-y-3 text-sm">
            {[
              { label: "Opening balance & carryover", value: stats.carryover },
              { label: "Income received", value: stats.totalIncome },
              {
                label: "Expenses & payments",
                value: -sum([
                  stats.totalExpenses,
                  stats.paidBills -
                    sum(
                      stats.expenses
                        .filter((e) => e.commitmentLogId)
                        .map((e) => e.amount),
                    ),
                  stats.debtPayments -
                    sum(
                      stats.expenses
                        .filter((e) => e.debtPaymentId)
                        .map((e) => e.amount),
                    ),
                ]),
              },
              { label: "Savings moved out", value: -stats.savings },
              { label: "Unpaid bills", value: -stats.unpaidBills },
              { label: "Remaining debt payments", value: -stats.remainingDebt },
              {
                label: "Unfunded savings target",
                value: -stats.savingsReserve,
              },
            ].map((item) => (
              <div key={item.label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="tabular-nums">{money(item.value)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex justify-between border-t pt-4 font-semibold">
            <span>Projected available</span>
            <span className={stats.safeToSpend < 0 ? "text-destructive" : ""}>
              {money(stats.safeToSpend)}
            </span>
          </div>
        </Panel>
      </div>
      {month === dateKey().slice(0, 7) && (
        <Panel
          title="Until your next payday"
          description={`Next payday: ${payday.next}. Future salary is not counted as received income.`}
        >
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {money(payday.daily)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                per day
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {payday.days} days to go
            </p>
          </div>
        </Panel>
      )}
      <Panel
        title="Spending by category"
        action={
          <Button variant="ghost" size="sm" onClick={() => onView("Budgets")}>
            Manage budgets
          </Button>
        }
      >
        {breakdown.length === 0 ? (
          <Empty>Add an expense or set a category budget to get started.</Empty>
        ) : (
          <div className="space-y-5">
            {breakdown.map((category) => (
              <div key={category.id}>
                <div className="mb-2 flex justify-between gap-3 text-sm">
                  <span>{category.name}</span>
                  <span className="tabular-nums">
                    {money(category.spent)}
                    {category.limit > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        / {money(category.limit)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={
                      category.limit > 0 && category.spent > category.limit
                        ? "h-full bg-destructive"
                        : "h-full bg-primary"
                    }
                    style={{
                      width: `${Math.min(100, category.limit ? (category.spent / category.limit) * 100 : stats.totalExpenses ? (category.spent / stats.totalExpenses) * 100 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
