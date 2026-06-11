"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { formatDateInIndia } from "../../lib/date";
import { formatPlanLabel, type OwnerPlan } from "../../lib/subscriptions";

type SubscriptionEntry = {
  id: string;
  plan: OwnerPlan;
  status: string;
  starts_at: string;
  ends_at: string | null;
  razorpay_sub_id: string | null;
  created_at: string;
};

type PaymentOrderEntry = {
  id: string;
  plan: OwnerPlan;
  status: string;
  amount_paise: number;
  currency: string;
  receipt: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  notes: {
    billing_cycle?: string;
    proration_credit_paise?: number;
    amount_due_paise?: number;
    credit_used_paise?: number;
    unused_credit_paise_after?: number;
  } | null;
  created_at: string;
  updated_at: string;
};

type CreditTransactionEntry = {
  id: string;
  event_type: "admin_credit_added" | "credit_used" | "downgrade_credit_added";
  amount_paise: number;
  balance_before: number;
  balance_after: number;
  note: string | null;
  payment_order_id: string | null;
  created_by: string | null;
  created_at: string;
};

type SubscriptionHistoryClientProps = {
  currentPlan: OwnerPlan;
  subscriptionHistory: SubscriptionEntry[];
  paymentHistory: PaymentOrderEntry[];
  creditHistory: CreditTransactionEntry[];
};

function formatDate(value: string | null) {
  return formatDateInIndia(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmountPaise(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountPaise / 100);
}

export function SubscriptionHistoryClient({
  currentPlan,
  subscriptionHistory,
  paymentHistory,
  creditHistory,
}: SubscriptionHistoryClientProps) {
  const activePlanName = formatPlanLabel(currentPlan);
  const filteredPaymentHistory = paymentHistory.filter((order) => {
    if (order.status !== "paid") return false;
    if (order.razorpay_payment_id) return true;
    if (order.amount_paise === 0) return true;
    if ((order.notes?.proration_credit_paise ?? 0) > 0) return true;
    if ((order.notes?.credit_used_paise ?? 0) > 0) return true;
    if ((order.notes?.unused_credit_paise_after ?? 0) > 0) return true;
    return false;
  });

  const transactionHistory = [
    ...filteredPaymentHistory.map((order) => ({
      type: "payment" as const,
      created_at: order.created_at,
      order,
    })),
    ...creditHistory.map((transaction) => ({
      type: "credit" as const,
      created_at: transaction.created_at,
      transaction,
    })),
  ].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="space-y-2 mt-4">
      <Accordion type="multiple" className="space-y-2">
        <AccordionItem value="subscription-history">
          <AccordionTrigger className="rounded-t-2xl border border-border/70 border-b-0 bg-background/80 px-3 py-2 text-sm">
            Subscription history
          </AccordionTrigger>
          <AccordionContent className="rounded-none border border-border/70 border-t-0 bg-background/80 p-3">
            <div className="mb-3 rounded-2xl border border-border/70 bg-card/80 p-3">
              <p className="text-xs text-muted-foreground">
                Active plan:{" "}
                <span className="font-semibold text-foreground">
                  {activePlanName}
                </span>
              </p>
            </div>
            {subscriptionHistory.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">
                No subscription records found.
              </p>
            ) : (
              <div className="space-y-3">
                {subscriptionHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-border/70 bg-card/80 p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {formatPlanLabel(entry.plan)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {entry.status.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground">
                        Started {formatDate(entry.starts_at)}
                        <br />
                        {entry.status === "expired" ||
                        entry.status === "cancelled" ? (
                          <>Ended {formatDate(entry.ends_at)}</>
                        ) : (
                          <>Ends {formatDate(entry.ends_at)}</>
                        )}
                      </div>
                    </div>
                    {entry.razorpay_sub_id ? (
                      <div className="mt-2 rounded-2xl bg-muted/50 p-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {entry.razorpay_sub_id}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="payment-history">
          <AccordionTrigger className="rounded-t-2xl border border-border/70 border-b-0 bg-background/80 px-3 py-2 text-sm">
            Transaction history
          </AccordionTrigger>
          <AccordionContent className="rounded-none border border-border/70 border-t-0 bg-background/80 p-3">
            {transactionHistory.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">
                No completed transactions or credit-driven plan changes found.
              </p>
            ) : (
              <div className="space-y-3">
                {transactionHistory.map((entry) =>
                  entry.type === "payment" ? (
                    <div
                      key={entry.order.id}
                      className="rounded-2xl border border-border/70 bg-card/80 p-3"
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {formatPlanLabel(entry.order.plan)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {entry.order.status.replace(/_/g, " ")}
                          </p>
                        </div>
                        <div className="text-right text-sm font-semibold text-foreground">
                          {formatAmountPaise(entry.order.amount_paise)}
                        </div>
                      </div>
                      {(entry.order.amount_paise === 0 ||
                        (entry.order.notes?.credit_used_paise ?? 0) > 0 ||
                        (entry.order.notes?.proration_credit_paise ?? 0) > 0) && (
                        <div className="mt-2 space-y-1 rounded-2xl border border-emerald-200  p-3 text-[11px]">
                          {entry.order.amount_paise === 0 ? (
                            <p className="font-semibold">Credit-only upgrade</p>
                          ) : (
                            <p className="font-semibold">
                              Plan change with credit applied:
                              {formatAmountPaise(
                                entry.order.notes?.credit_used_paise ?? 0,
                              ).replace(/[^0-9.,]/g, "")}
                            </p>
                          )}
                          {entry.order.notes?.proration_credit_paise ? (
                            <p>
                              Proration credit:
                              {formatAmountPaise(
                                entry.order.notes.proration_credit_paise,
                              )}
                            </p>
                          ) : null}
                          {entry.order.notes?.credit_used_paise ? (
                            <p>
                              Credit used:
                              {formatAmountPaise(
                                entry.order.notes.credit_used_paise,
                              )}
                            </p>
                          ) : null}
                          {entry.order.notes?.amount_due_paise != null ? (
                            <p>
                              Amount due now:
                              {formatAmountPaise(entry.order.notes.amount_due_paise)}
                            </p>
                          ) : null}
                          {entry.order.notes?.unused_credit_paise_after != null ? (
                            <p>
                              Credit balance after:
                              {formatAmountPaise(
                                entry.order.notes.unused_credit_paise_after,
                              )}
                            </p>
                          ) : null}
                        </div>
                      )}
                      <div className="mt-2 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                        <div>
                          Order ID:{" "}
                          <span className="font-medium text-foreground">
                            {entry.order.razorpay_order_id}
                          </span>
                        </div>
                        <div>
                          Payment ID:{" "}
                          <span className="font-medium text-foreground">
                            {entry.order.razorpay_payment_id ?? "--"}
                          </span>
                        </div>
                        <div>Receipt: {entry.order.receipt}</div>
                        <div>
                          Cycle: {entry.order.notes?.billing_cycle ?? "monthly"}
                        </div>
                        <div>Created: {formatDate(entry.order.created_at)}</div>
                        <div>
                          Status updated: {formatDate(entry.order.updated_at)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={entry.transaction.id}
                      className="rounded-2xl border border-border/70 bg-card/80 p-3"
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {entry.transaction.event_type === "admin_credit_added"
                              ? "Credits added"
                              : entry.transaction.event_type ===
                                  "downgrade_credit_added"
                                ? "Downgrade credit added"
                                : "Credits used"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {entry.transaction.event_type === "admin_credit_added"
                              ? "Admin credit adjustment"
                              : entry.transaction.event_type ===
                                  "downgrade_credit_added"
                                ? "Credit generated by downgrade"
                                : "Owner credit consumption"}
                          </p>
                        </div>
                        <div className="text-right text-sm font-semibold text-foreground">
                          {entry.transaction.event_type === "credit_used"
                            ? `-${formatAmountPaise(entry.transaction.amount_paise)}`
                            : formatAmountPaise(entry.transaction.amount_paise)}
                        </div>
                      </div>
                      <div className="mt-2 space-y-1 rounded-2xl border border-slate-200 p-3 text-[11px] text-muted-foreground">
                        <p>
                          Balance before:{" "}
                          {formatAmountPaise(entry.transaction.balance_before)}
                        </p>
                        <p>
                          Balance after:{" "}
                          {formatAmountPaise(entry.transaction.balance_after)}
                        </p>
                        {entry.transaction.note ? (
                          <p>Note: {entry.transaction.note}</p>
                        ) : null}
                        {entry.transaction.payment_order_id ? (
                          <p>Payment order: {entry.transaction.payment_order_id}</p>
                        ) : null}
                        {entry.transaction.created_by ? (
                          <p>Recorded by: {entry.transaction.created_by}</p>
                        ) : null}
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Recorded: {formatDate(entry.transaction.created_at)}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
