import type { Finance } from "../hooks/use-finance";
import type { Editor } from "../components/entry-dialog";
import { accountBalance, dueDate, money } from "../lib/finance";
import { Button } from "../components/ui/button";
import { Empty, Panel, Confirm } from "../components/shared";
export function Accounts({
  finance,
  month,
  onEdit,
}: {
  finance: Finance;
  month: string;
  onEdit: (editor: Editor) => void;
}) {
  const { data } = finance;
  return (
    <div className="space-y-6">
      <Panel
        title="Your accounts"
        icon="wallet"
        description="Balances reflect transactions assigned to each account through the selected month."
        action={
          <Button onClick={() => onEdit({ kind: "accounts" })}>
            Add account
          </Button>
        }
      >
        {data.accounts.length === 0 ? (
          <Empty>
            Add a bank, cash, or e-wallet account to track where your money is.
          </Empty>
        ) : (
          <div className="divide-y">
            {data.accounts.map((account) => (
              <div key={account.id} className="row">
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {account.type} · Opening date {account.openingDate}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {money(
                      accountBalance(data, account.id, dueDate(month, 31)),
                    )}
                  </p>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onEdit({ kind: "accounts", row: { ...account } })
                      }
                    >
                      Edit
                    </Button>
                    <Confirm
                      disabled={finance.pending}
                      description="Only accounts without linked transactions or transfers can be deleted."
                      onConfirm={() => {
                        if (
                          [
                            ...data.income,
                            ...data.expenses,
                            ...data.debtPayments,
                            ...data.goalContributions,
                            ...data.repayments,
                          ].some((t) => t.accountId === account.id) ||
                          data.commitmentLogs.some(
                            (l) => l.accountId === account.id,
                          ) ||
                          data.transfers.some(
                            (t) =>
                              t.fromAccountId === account.id ||
                              t.toAccountId === account.id,
                          )
                        ) {
                          finance.setError(
                            "This account has history. Reassign or reverse its transactions first.",
                          );
                          return Promise.resolve(false);
                        }
                        return finance.change([
                          { store: "accounts", deleteId: account.id },
                        ]);
                      }}
                    >
                      Delete
                    </Confirm>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel
        title="Transfers"
        icon="transfer"
        description="Transfers move money between accounts without adding income or expenses."
        action={
          <Button
            variant="outline"
            disabled={data.accounts.length < 2}
            onClick={() => onEdit({ kind: "transfers" })}
          >
            Add transfer
          </Button>
        }
      >
        {data.transfers.filter((t) => t.date.slice(0, 7) === month).length ===
        0 ? (
          <Empty>No transfers this month.</Empty>
        ) : (
          <div className="divide-y">
            {data.transfers
              .filter((t) => t.date.slice(0, 7) === month)
              .map((transfer) => (
                <div className="row" key={transfer.id}>
                  <div>
                    <p className="text-sm">
                      {
                        data.accounts.find(
                          (a) => a.id === transfer.fromAccountId,
                        )?.name
                      }{" "}
                      →{" "}
                      {
                        data.accounts.find((a) => a.id === transfer.toAccountId)
                          ?.name
                      }
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {transfer.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums">
                      {money(transfer.amount)}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onEdit({ kind: "transfers", row: { ...transfer } })
                        }
                      >
                        Edit
                      </Button>
                      <Confirm
                        disabled={finance.pending}
                        onConfirm={() =>
                          finance.change([
                            { store: "transfers", deleteId: transfer.id },
                          ])
                        }
                      >
                        Delete
                      </Confirm>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
