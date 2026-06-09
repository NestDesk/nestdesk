import { Rocket } from "lucide-react";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { formatDateInIndia } from "../../../lib/date";
import {
  formatPlanLabel,
  getEffectivePlan,
  isSubscriptionCurrent,
  normalizeOwnerPlan,
  type SubscriptionStatus,
} from "../../../lib/subscriptions";
import { SubscriptionsUsageClient } from "../../../components/subscriptions/SubscriptionsUsageClient";
import { SubscriptionHistoryClient } from "../../../components/subscriptions/SubscriptionHistoryClient";
import { PricingPlans } from "../../../components/layout/PricingPlans";

type SubscriptionRow = {
  id: string;
  plan: string;
  status: SubscriptionStatus;
  starts_at: string;
  ends_at: string | null;
  razorpay_sub_id: string | null;
};

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();

  const { data: owner } = await admin
    .from("owners")
    .select("id, plan, unused_credit_paise")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) return null;

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, plan, status, starts_at, ends_at, razorpay_sub_id")
    .eq("owner_id", owner.id)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>();

  const effectivePlan = getEffectivePlan(subscription ?? null);
  const currentSubscriptionPlan = subscription
    ? normalizeOwnerPlan(subscription.plan)
    : null;

  const isDowngradedToFreeAfterExpiry =
    effectivePlan === "free" &&
    subscription !== null &&
    !isSubscriptionCurrent(subscription) &&
    currentSubscriptionPlan !== "free";

  const displayExpiresOn =
    effectivePlan === "free" ? null : (subscription?.ends_at ?? null);

  const downgradeNote = isDowngradedToFreeAfterExpiry
    ? `${formatPlanLabel(currentSubscriptionPlan ?? "free")} expired on ${formatDateInIndia(
        subscription?.ends_at ?? new Date().toISOString(),
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        },
      )}. Your account has been downgraded to Free Plan.`
    : null;

  const currentPlanLabel = formatPlanLabel(effectivePlan);
  const currentPlanDisplayLabel = downgradeNote
    ? `${currentPlanLabel} (downgraded)`
    : currentPlanLabel;

  const { count: propertyCount } = await admin
    .from("hostels")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", owner.id);

  const { count: tenantCount } = await admin
    .from("tenants")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", owner.id)
    .eq("status", "active");

  const { data: subscriptionHistory } = await admin
    .from("subscriptions")
    .select("id, plan, status, starts_at, ends_at, razorpay_sub_id, created_at")
    .eq("owner_id", owner.id)
    .order("starts_at", { ascending: false });

  const { data: paymentHistory } = await admin
    .from("payment_orders")
    .select(
      "id, plan, status, amount_paise, currency, receipt, razorpay_order_id, razorpay_payment_id, notes, created_at, updated_at",
    )
    .eq("owner_id", owner.id)
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  const unusedCreditPaise = owner.unused_credit_paise ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-10">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-border/70 bg-background/80 p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Billing overview
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Subscriptions and usage
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  View your active plan, credits, and recent history in a modern
                  dashboard designed for fast decision making.
                </p>
              </div>
            </div>
          </div>

          <SubscriptionsUsageClient
            currentPlan={effectivePlan}
            propertyCount={propertyCount ?? 0}
            tenantCount={tenantCount ?? 0}
            unusedCreditPaise={unusedCreditPaise}
            displayExpiresOn={displayExpiresOn}
            downgradeNote={downgradeNote}
          />
        </div>
        <aside className="space-y-4">
          <div className="rounded-[28px] border border-border/70 bg-background/80 p-6 shadow-sm">
            <p className="text-sm font-semibold text-foreground">Quick summary</p>
            <div className="mt-2 space-y-3 text-sm text-muted-foreground">
              <p>
                Current plan:{" "}
                <span className="font-semibold text-foreground">
                  {currentPlanDisplayLabel}
                </span>
              </p>
              {downgradeNote ? (
                <p className="text-foreground">{downgradeNote}</p>
              ) : (
                <p>
                  Proration-based upgrades apply unused credit instantly. Downgrades
                  are blocked while your active subscription is still live.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-border/70 bg-background/80 p-6 shadow-sm">
            <p className="text-sm font-semibold text-foreground">How it works</p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>
                When you upgrade, your new plan begins immediately and any unused
                days from your current plan are credited toward the new charge. If
                the amount due becomes zero, the upgrade is applied instantly without
                requiring payment.
              </p>
            </div>
          </div>
        </aside>
      </div>
      <div className="rounded-[28px] border border-border/70 bg-background/80 p-6 shadow-sm mt-2">
        <div className="mb-4">
          <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
            Upgrade plans
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Choose the right plan for your growth
          </h2>
        </div>

        <PricingPlans
          isLoggedIn
          currentPlan={effectivePlan}
          ctaText="Buy"
          title=""
          description=""
        />
      </div>
      <SubscriptionHistoryClient
        currentPlan={effectivePlan}
        subscriptionHistory={subscriptionHistory ?? []}
        paymentHistory={paymentHistory ?? []}
      />
    </div>
  );
}
