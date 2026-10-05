import type { Finance } from "../hooks/use-finance";
import type { Editor } from "../components/entry-dialog";
import type { Payment } from "../components/payment-dialog";
import { occurrences, money, dueDate } from "../lib/finance";
import { subscriptionLogo, subscriptions } from "../lib/subscriptions";
import { Button } from "../components/ui/button";
import { Confirm, Empty, Panel } from "../components/shared";
export function Bills({
  finance,
  month,
  onEdit,
  onPayment,
}: {
  finance: Finance;
  month: string;
  onEdit: (editor: Editor) => void;
  onPayment: (payment: Payment) => void;
}) {
  const schedule = occurrences(finance.data, month);
  return (
    <div className="space-y-6 page-enter">
      <Panel
        title="Payments this month"
        description="Each weekly, monthly, or yearly bill has its own dated payment."
        action={
          <Button onClick={() => onEdit({ kind: "commitments" })}>
            Add bill
          </Button>
        }
      >
        {schedule.length === 0 ? (
          <Empty>
            No bills are scheduled. Add one or choose a subscription below.
          </Empty>
        ) : (
          <div className="divide-y">
            {schedule.map((o) => {
              const logo = subscriptionLogo(o.commitment.title);
              const paid = o.log?.status === "paid";
              return (
                <div className="row" key={o.id}>
                  <div className="flex items-center gap-3">
                    {logo && <img src={logo} className="size-8" alt="" />}
                    <div>
                      <p className="font-medium">{o.commitment.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {o.dueDate} · {o.commitment.frequency} ·{" "}
                        {paid ? "Paid" : "Unpaid"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="mb-1 text-sm font-medium tabular-nums">
                      {money(
                        paid
                          ? (o.log?.amount ?? o.commitment.amount)
                          : o.commitment.amount,
                      )}
                    </p>
                    {paid ? (
                      <Confirm
                        disabled={finance.pending}
                        title="Reverse this bill payment?"
                        description="Its linked expense will also be removed."
                        onConfirm={() => finance.undoBill(o.log!.id)}
                      >
                        Undo payment
                      </Confirm>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={finance.pending}
                        onClick={() =>
                          onPayment({ kind: "bill", occurrence: o })
                        }
                      >
                        Record payment
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      <Panel
        title="Subscription shortcuts"
        description="Choose a service and enter your plan price. No subscription is added until you save."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((service) => (
            <Button
              key={service.name}
              variant="outline"
              className="h-auto justify-start gap-3 py-4"
              onClick={() =>
                onEdit({ kind: "commitments", row: { title: service.name } })
              }
            >
              <img
                src={`/logos/${service.logo}.svg`}
                alt=""
                className="size-8"
              />
              <span className="text-left">
                <span className="block text-sm">{service.name}</span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {service.description}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </Panel>
      <Panel
        title="Recurring bill details"
        description="Stopping a bill preserves its recorded payment history."
      >
        {finance.data.commitments.length === 0 ? (
          <Empty>No recurring bills yet.</Empty>
        ) : (
          <div className="divide-y">
            {finance.data.commitments.map((bill) => (
              <div className="row" key={bill.id}>
                <div>
                  <p className="font-medium">{bill.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {money(bill.amount)} · {bill.frequency}
                    {bill.endDate && ` · Ends ${bill.endDate.slice(0, 10)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onEdit({ kind: "commitments", row: { ...bill } })
                    }
                  >
                    Edit
                  </Button>
                  <Confirm
                    disabled={finance.pending}
                    title="Stop this bill after the selected month?"
                    description={`No payments will be scheduled after ${dueDate(month, 31)}. Recorded history is retained.`}
                    onConfirm={() =>
                      finance.change(
                        [
                          {
                            store: "commitments",
                            value: { ...bill, endDate: dueDate(month, 31) },
                          },
                        ],
                        "Bill end date updated.",
                      )
                    }
                  >
                    Stop
                  </Confirm>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
