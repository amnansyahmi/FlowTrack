import { debtTypes } from "../lib/debt-statement";
import { ImageIcon } from "../components/image-icon";
import { useState } from "react";
import type { Finance } from "../hooks/use-finance";
import type { Editor } from "../components/entry-dialog";
import type { Payment } from "../components/payment-dialog";
import { money, dueDate, shiftMonth, sum } from "../lib/finance";
import { Button } from "../components/ui/button";
import { Confirm, Empty, Panel, Modal } from "../components/shared";
export function Plans({
  finance,
  month,
  onEdit,
  onPayment,
  onStatement,
}: {
  finance: Finance;
  month: string;
  onEdit: (editor: Editor) => void;
  onPayment: (payment: Payment) => void;
  onStatement: (editor?: Editor) => void;
}) {
  const [statementId, setStatementId] = useState<string | null>(null);
  const [tab, setTab] = useState("Debts");
  const { data } = finance;
  return (
    <div className="space-y-5 page-enter">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Plan type">
        {["Debts", "Savings goals", "Money owed to you"].map((label) => (
          <Button
            key={label}
            variant={tab === label ? "default" : "outline"}
            onClick={() => setTab(label)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "Debts" && (
        <div className="space-y-4">
          <div className="debt-shortcuts">
            {debtTypes
              .filter((type) => type.value !== "loan")
              .map((type) => (
                <Button
                  key={type.value}
                  variant="outline"
                  className="debt-shortcut"
                  onClick={() =>
                    onEdit({
                      kind: "debts",
                      row: {
                        debtType: type.value,
                        name: type.label,
                        lender: type.value === "credit-card" ? "" : type.label,
                      },
                    })
                  }
                >
                  <span className="icon-tile">
                    <ImageIcon name={type.icon} />
                  </span>
                  <span>{type.label}</span>
                </Button>
              ))}
          </div>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onStatement()}
          >
            <ImageIcon name="upload" />
            Upload statement or screenshot
          </Button>
          <Panel
            title="Debt & instalment plans"
            icon="loan"
            description="Track principal, fixed monthly payments, and payoff progress."
            action={
              <Button onClick={() => onEdit({ kind: "debts" })}>
                <ImageIcon name="plus" className="icon-light size-4" />
                Add debt
              </Button>
            }
          >
            {data.debts.filter((d) => !d.archived).length === 0 ? (
              <Empty>No active debts.</Empty>
            ) : (
              <div className="divide-y">
                {data.debts
                  .filter((d) => !d.archived)
                  .map((debt) => {
                    const paid = sum(
                      data.debtPayments
                        .filter((p) => p.debtId === debt.id)
                        .map((p) => p.amount),
                    );
                    const months =
                      debt.monthlyPayment > 0
                        ? Math.ceil(debt.remainingAmount / debt.monthlyPayment)
                        : undefined;
                    const paidInMonth = sum(
                      data.debtPayments
                        .filter(
                          (p) =>
                            p.debtId === debt.id &&
                            p.date.slice(0, 7) === month,
                        )
                        .map((p) => p.amount),
                    );
                    const firstPaymentMonth = shiftMonth(
                      month,
                      paidInMonth >= debt.monthlyPayment &&
                        debt.monthlyPayment > 0
                        ? 1
                        : 0,
                    );
                    const fullPayments =
                      Math.floor(paid / (debt.monthlyPayment || 1)) +
                      (debt.initialPaidInstallments ?? 0);
                    const remainingInstallments = debt.totalInstallments
                      ? Math.max(0, debt.totalInstallments - fullPayments)
                      : undefined;
                    return (
                      <div key={debt.id} className="space-y-4 py-5">
                        <div className="flex flex-wrap justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="icon-tile">
                              <ImageIcon
                                name={
                                  debtTypes.find(
                                    (type) => type.value === debt.debtType,
                                  )?.icon ?? "loan"
                                }
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium break-words">
                                {debt.name}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {debt.lender} · {money(debt.monthlyPayment)} /
                                month
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-semibold tabular-nums">
                              {money(debt.remainingAmount)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Remaining of {money(debt.originalAmount)}
                            </p>
                          </div>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${Math.max(0, Math.min(100, ((debt.originalAmount - debt.remainingAmount) / debt.originalAmount) * 100))}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {remainingInstallments !== undefined
                            ? `${remainingInstallments} instalments remaining. `
                            : ""}
                          {months && debt.remainingAmount > 0
                            ? `Estimated final payment: ${dueDate(shiftMonth(firstPaymentMonth, months - 1), debt.dueDay)} at the current payment amount.`
                            : debt.remainingAmount === 0
                              ? "Fully paid."
                              : "Set a monthly payment to estimate your payoff date."}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={
                              debt.remainingAmount === 0 || finance.pending
                            }
                            onClick={() =>
                              onPayment({ kind: "debt", id: debt.id })
                            }
                          >
                            Record payment
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              onEdit({ kind: "debts", row: { ...debt } })
                            }
                          >
                            <ImageIcon name="edit" className="size-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              onStatement({ kind: "debts", row: { ...debt } })
                            }
                          >
                            <ImageIcon name="scan" className="size-4" />
                            Read statement
                          </Button>
                          {debt.statementId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setStatementId(debt.statementId!)}
                            >
                              <ImageIcon name="receipt" className="size-4" />
                              Statement preview
                            </Button>
                          )}
                          <Confirm
                            title="Archive this debt?"
                            description="Payment history is retained. Archived debts are excluded from future payment reserves."
                            disabled={finance.pending}
                            onConfirm={() =>
                              finance.change(
                                [
                                  {
                                    store: "debts",
                                    value: { ...debt, archived: true },
                                  },
                                ],
                                "Debt archived.",
                              )
                            }
                          >
                            Archive
                          </Confirm>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Panel>
        </div>
      )}
      {tab === "Savings goals" && (
        <Panel
          title="Savings goals"
          icon="target"
          description="Contributions move money outside your tracked accounts and protect it from spending."
          action={
            <Button onClick={() => onEdit({ kind: "goals" })}>Add goal</Button>
          }
        >
          {data.goals.length === 0 ? (
            <Empty>No savings goals yet.</Empty>
          ) : (
            <div className="divide-y">
              {data.goals.map((goal) => (
                <div key={goal.id} className="space-y-4 py-5">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium">{goal.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {goal.deadline ? `By ${goal.deadline}` : "No deadline"}
                      </p>
                    </div>
                    <p className="tabular-nums text-sm">
                      {money(goal.currentAmount)} / {money(goal.targetAmount)}
                    </p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => onPayment({ kind: "goal", id: goal.id })}
                    >
                      Add contribution
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onEdit({ kind: "goals", row: { ...goal } })
                      }
                    >
                      Edit
                    </Button>
                    <Confirm
                      disabled={finance.pending}
                      description="Goals with contribution history cannot be removed. Reverse their contributions first."
                      onConfirm={() => {
                        if (
                          data.goalContributions.some(
                            (c) => c.goalId === goal.id,
                          )
                        ) {
                          finance.setError(
                            "Reverse this goal’s contributions in Transactions before deleting it.",
                          );
                          return Promise.resolve(false);
                        }
                        return finance.change([
                          { store: "goals", deleteId: goal.id },
                        ]);
                      }}
                    >
                      Delete
                    </Confirm>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
      {tab === "Money owed to you" && (
        <Panel
          title="Money owed to you"
          icon="income"
          description="Expected repayments are only counted as income when you receive them."
          action={
            <Button onClick={() => onEdit({ kind: "receivables" })}>
              Add receivable
            </Button>
          }
        >
          {data.receivables.filter((r) => !r.archived).length === 0 ? (
            <Empty>No receivables yet.</Empty>
          ) : (
            <div className="divide-y">
              {data.receivables
                .filter((r) => !r.archived)
                .map((item) => (
                  <div key={item.id} className="space-y-4 py-5">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.borrower} · Expected{" "}
                          {money(item.monthlyRepayment)} monthly
                        </p>
                      </div>
                      <p className="font-semibold tabular-nums">
                        {money(item.remainingAmount)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={item.remainingAmount === 0 || finance.pending}
                        onClick={() =>
                          onPayment({ kind: "repayment", id: item.id })
                        }
                      >
                        Receive repayment
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onEdit({ kind: "receivables", row: { ...item } })
                        }
                      >
                        Edit
                      </Button>
                      <Confirm
                        title="Archive this receivable?"
                        description="Your repayment and income history will be retained."
                        onConfirm={() =>
                          finance.change([
                            {
                              store: "receivables",
                              value: { ...item, archived: true },
                            },
                          ])
                        }
                      >
                        Archive
                      </Confirm>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Panel>
      )}
      {(data.debts.some((d) => d.archived) ||
        data.receivables.some((r) => r.archived)) && (
        <Panel title="Archived plans" icon="loan">
          <div className="divide-y">
            {[
              ...data.debts
                .filter((d) => d.archived)
                .map((d) => ({
                  id: d.id,
                  name: d.name,
                  store: "debts" as const,
                  value: d,
                })),
              ...data.receivables
                .filter((r) => r.archived)
                .map((r) => ({
                  id: r.id,
                  name: r.name,
                  store: "receivables" as const,
                  value: r,
                })),
            ].map((item) => (
              <div key={item.id} className="row">
                <span className="text-sm">{item.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={finance.pending}
                  onClick={() =>
                    void finance.change(
                      [
                        {
                          store: item.store,
                          value: { ...item.value, archived: false },
                        },
                      ],
                      "Plan restored.",
                    )
                  }
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {statementId && (
        <Modal
          title="Statement preview"
          description={
            data.receipts.find((receipt) => receipt.id === statementId)?.name ??
            "Debt statement"
          }
          onClose={() => setStatementId(null)}
        >
          <img
            src={
              data.receipts.find((receipt) => receipt.id === statementId)?.data
            }
            alt="Saved statement preview"
            className="max-h-[65dvh] w-full object-contain"
          />
        </Modal>
      )}
    </div>
  );
}
