import type { Finance } from "../hooks/use-finance";
import { calculate, money, sum, monthLabel } from "../lib/finance";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Button } from "../components/ui/button";
import { Confirm, Empty, Panel } from "../components/shared";
export default function Reports({
  finance,
  month,
  onMonth,
}: {
  finance: Finance;
  month: string;
  onMonth: (month: string) => void;
}) {
  const stats = calculate(finance.data, month);
  const snapshot = finance.data.monthlySnapshots.find((s) => s.id === month);
  function snapshotMonth() {
    return finance.change(
      [
        {
          store: "monthlySnapshots",
          value: {
            id: month,
            totals: {
              income: stats.totalIncome,
              expenses: stats.totalExpenses,
              commitments: { total: stats.totalBills, paid: stats.paidBills },
              savings: stats.savings,
              debts: stats.debtPayments,
              balance: stats.balance,
            },
            categories: finance.data.categories
              .filter((c) => c.type === "expense")
              .map((c) => ({
                id: c.id,
                name: c.name,
                spent: sum(
                  stats.expenses
                    .filter((e) => e.categoryId === c.id)
                    .map((e) => e.amount),
                ),
              })),
            createdAt: new Date().toISOString(),
          },
        },
      ],
      "Monthly snapshot saved.",
    );
  }
  const points = [
    { name: "Income", amount: stats.totalIncome },
    {
      name: "Outflows",
      amount: sum([stats.totalIncome + stats.carryover - stats.balance]),
    },
    { name: "Safe to spend", amount: stats.safeToSpend },
  ];
  return (
    <div className="space-y-6">
      <Panel
        title="Monthly overview"
        description="Outflows include expenses, completed bill/debt payments, and savings set aside."
        action={
          snapshot ? (
            <Confirm
              title="Replace this month’s snapshot?"
              description="The saved summary will be replaced with current totals. Transactions remain editable."
              onConfirm={snapshotMonth}
            >
              Update snapshot
            </Confirm>
          ) : (
            <Button
              disabled={finance.pending}
              onClick={() => void snapshotMonth()}
            >
              Save snapshot
            </Button>
          )
        }
      >
        <div className="h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                width={65}
                tickFormatter={(v) => `${Number(v) / 1000}k`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => money(Number(v))}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              />
              <Bar
                dataKey="amount"
                fill="var(--primary)"
                radius={[3, 3, 0, 0]}
                maxBarSize={72}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel
        title="Saved monthly snapshots"
        description="Snapshots capture totals at a point in time. They do not lock or delete transactions."
      >
        {finance.data.monthlySnapshots.length === 0 ? (
          <Empty>No monthly snapshots yet.</Empty>
        ) : (
          <div className="divide-y">
            {[...finance.data.monthlySnapshots]
              .sort((a, b) => b.id.localeCompare(a.id))
              .map((s) => (
                <div key={s.id} className="row">
                  <div>
                    <p className="font-medium">{monthLabel(s.id)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Balance {money(s.totals.balance)} · Saved{" "}
                      {s.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onMonth(s.id)}
                  >
                    View month
                  </Button>
                </div>
              ))}
          </div>
        )}
      </Panel>
      {snapshot && (
        <Panel title={`Snapshot · ${monthLabel(snapshot.id)}`}>
          <dl className="grid grid-cols-2 gap-4">
            {[
              { label: "Income", amount: snapshot.totals.income },
              { label: "Expenses", amount: snapshot.totals.expenses },
              { label: "Bills paid", amount: snapshot.totals.commitments.paid },
              { label: "Debt payments", amount: snapshot.totals.debts },
              { label: "Savings", amount: snapshot.totals.savings },
              { label: "Balance", amount: snapshot.totals.balance },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {money(item.amount)}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}
    </div>
  );
}
