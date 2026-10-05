import {
  ImageIcon,
  categoryIcon,
  type IconName,
} from "../components/image-icon";
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
import { billImage } from "../lib/icons";
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
      <section
        className={`balance-card ${stats.safeToSpend < 0 ? "balance-negative" : ""}`}
      >
        <div className="balance-topline">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ImageIcon name="shield" className="icon-light size-4" />
            Safe to spend
          </p>
          <img
            src="/icons/wallet-art.svg"
            alt=""
            className="wallet-art"
            aria-hidden="true"
          />
        </div>
        <h2 data-testid="safe-to-spend" className="balance-amount">
          {money(stats.safeToSpend)}
        </h2>
        <p className="balance-caption">
          After bills, debt payments &amp; your savings target.
        </p>
        <div className="balance-footer">
          <span className="flex items-center gap-2 text-xs">
            <ImageIcon name="check" className="icon-light size-4" />
            {stats.safeToSpend < 0
              ? "Commitments exceed your balance"
              : "Your commitments are accounted for"}
          </span>
          <Button
            className="balance-add"
            onClick={() => onEdit({ kind: "expenses" })}
          >
            <ImageIcon name="plus" className="size-4" />
            Add expense
          </Button>
        </div>
      </section>
      <div className="summary-grid">
        {(
          [
            {
              label: "Available balance",
              value: stats.balance,
              icon: "wallet",
            },
            {
              label: "Income this month",
              value: stats.totalIncome,
              icon: "income",
            },
            {
              label: "Unpaid bills",
              value: stats.unpaidBills,
              icon: "receipt",
            },
            {
              label: "Savings set aside",
              value: stats.savings,
              icon: "savings",
            },
          ] satisfies { label: string; value: number; icon: IconName }[]
        ).map((item) => (
          <div key={item.label} className="summary-tile">
            <span className="summary-icon">
              <ImageIcon name={item.icon} />
            </span>
            <div className="min-w-0">
              <p className="summary-label">{item.label}</p>
              <p className="summary-value">{money(item.value)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="quick-actions" aria-label="Quick actions">
        <Button variant="ghost" onClick={() => onEdit({ kind: "income" })}>
          <span className="quick-icon">
            <ImageIcon name="income" />
          </span>
          <span>Add income</span>
        </Button>
        <Button variant="ghost" onClick={() => onEdit({ kind: "commitments" })}>
          <span className="quick-icon">
            <ImageIcon name="receipt" />
          </span>
          <span>Add bill</span>
        </Button>
        <Button variant="ghost" onClick={onScan}>
          <span className="quick-icon">
            <ImageIcon name="scan" />
          </span>
          <span>Scan receipt</span>
        </Button>
        <Button variant="ghost" onClick={() => onView("Reports")}>
          <span className="quick-icon">
            <ImageIcon name="chart" />
          </span>
          <span>View reports</span>
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Upcoming bills"
          icon="calendar"
          action={
            <Button variant="ghost" size="sm" onClick={() => onView("Bills")}>
              View all
            </Button>
          }
        >
          {stats.schedule.filter((o) => o.log?.status !== "paid").length ===
          0 ? (
            <Empty icon="check">No unpaid bills for this month.</Empty>
          ) : (
            <div className="divide-y">
              {stats.schedule
                .filter((o) => o.log?.status !== "paid")
                .slice(0, 4)
                .map((o) => {
                  const logo = billImage(o.commitment);
                  return (
                    <div key={o.id} className="row">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="icon-tile">
                          <img src={logo} alt="" className="size-6" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium break-words">
                            {o.commitment.title}
                          </p>
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
          icon="activity"
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
          icon="clock"
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
        icon="budget"
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
                  <span className="flex min-w-0 items-center gap-2">
                    <ImageIcon
                      name={categoryIcon(category.name)}
                      className="size-4"
                    />
                    {category.name}
                  </span>
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
