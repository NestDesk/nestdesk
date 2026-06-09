"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { formatDateInIndia } from "../../lib/date";
import {
  formatPlanLabel,
  getPlanConfig,
  normalizeOwnerPlan,
  type OwnerPlan,
} from "../../lib/subscriptions";

type SubscriptionSummary = {
  id: string;
  plan: OwnerPlan;
  status: string;
  starts_at: string;
  ends_at: string | null;
  razorpay_payment_id: string | null;
} | null;

type SubscriptionsUsageClientProps = {
  currentPlan: OwnerPlan;
  subscription: SubscriptionSummary;
  propertyCount: number;
  tenantCount: number;
  unusedCreditPaise?: number;
  subscriptionStatusLabel?: string;
  displayExpiresOn?: string | null;
  downgradeNote?: string | null;
};

function formatDate(value: string | null) {
  return formatDateInIndia(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SubscriptionsUsageClient({
  currentPlan,
  subscription,
  propertyCount,
  tenantCount,
  unusedCreditPaise = 0,
  subscriptionStatusLabel,
  displayExpiresOn,
  downgradeNote,
}: SubscriptionsUsageClientProps) {
  const activePlan = normalizeOwnerPlan(currentPlan);
  const planConfig = getPlanConfig(activePlan);

  return (
    <div className="space-y-2">
      <Card className="rounded-3xl border border-border/70 py-2 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="rounded-3xl border border-border/70 bg-muted/70 p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Plan</p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatPlanLabel(activePlan)}
            </p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-muted/70 p-3">
            <p className="text-[11px] uppercase  text-muted-foreground">
              Properties
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {propertyCount}/{planConfig.maxProperties}
            </p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-muted/70 p-3">
            <p className="text-[11px] uppercase  text-muted-foreground">Tenants</p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {tenantCount}/{planConfig.maxTenants}
            </p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-muted/70 p-3">
            <p className="text-[11px] uppercase  text-muted-foreground">
              Expires On
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {displayExpiresOn ? formatDate(displayExpiresOn) : "-"}
            </p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-muted/70 p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Credits</p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              ₹
              {(unusedCreditPaise / 100).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </CardContent>
        {downgradeNote ? (
          <CardContent className="border-t border-border/70 pt-3">
            <div className="rounded-3xl border border-amber-300/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/10 dark:text-amber-100">
              {downgradeNote}
            </div>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
