import { ImageIcon } from "../components/image-icon";
import type { Finance } from "../hooks/use-finance";
import type { Editor } from "../components/entry-dialog";
import type { Payment } from "../components/payment-dialog";
import { occurrences, money, dueDate } from "../lib/finance";
import { subscriptions } from "../lib/subscriptions";
import { billImage } from "../lib/icons";
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
        icon="calendar"
        description="Review, edit, and record your scheduled payments."
        action={
          <Button onClick={() => onEdit({ kind: "commitments" })}>
            <ImageIcon name="plus" className="icon-light size-4" />
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
              const logo = billImage(o.commitment);
              const paid = o.log?.status === "paid";
              return (
                <div className="bill-payment" key={o.id}>
                  <div className="bill-payment-heading">
                    <span className="icon-tile">
                      <img src={logo} className="size-6" alt="" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium break-words">
                        {o.commitment.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(`${o.dueDate}T12:00:00`).toLocaleDateString(
                          "en-MY",
                          { day: "numeric", month: "short" },
                        )}{" "}
                        · {o.commitment.frequency}
                      </p>
                    </div>
                    <p className="bill-amount">
                      {money(
                        paid
                          ? (o.log?.amount ?? o.commitment.amount)
                          : o.commitment.amount,
                      )}
                    </p>
                  </div>
                  <div className="bill-payment-footer">
                    <span className={`bill-status ${paid ? "is-paid" : ""}`}>
                      <span />
                      {paid ? "Paid" : "Unpaid"}
                    </span>
                    <div className="bill-actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={finance.pending}
                        aria-label={`Edit ${o.commitment.title}`}
                        onClick={() =>
                          onEdit({
                            kind: "commitments",
                            row: { ...o.commitment },
                          })
                        }
                      >
                        <ImageIcon name="edit" className="size-4" />
                        Edit
                      </Button>
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
                          <ImageIcon name="check" className="size-4" />
                          Record payment
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      <Panel
        title="Subscription shortcuts"
        icon="receipt"
        description="Choose a service and enter your plan price. No subscription is added until you save."
      >
        <div className="subscription-grid">
          {subscriptions.map((service) => (
            <Button
              key={service.name}
              variant="outline"
              className="subscription-tile"
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
        icon="settings"
        description="Stopping a bill preserves its recorded payment history."
      >
        {finance.data.commitments.length === 0 ? (
          <Empty>No recurring bills yet.</Empty>
        ) : (
          <div className="divide-y">
            {finance.data.commitments.map((bill) => (
              <div className="row recurring-row" key={bill.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="icon-tile">
                    <img src={billImage(bill)} alt="" className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium break-words">{bill.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {money(bill.amount)} · {bill.frequency}
                      {bill.endDate && ` · Ends ${bill.endDate.slice(0, 10)}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onEdit({ kind: "commitments", row: { ...bill } })
                    }
                  >
                    <ImageIcon name="edit" className="size-4" />
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
