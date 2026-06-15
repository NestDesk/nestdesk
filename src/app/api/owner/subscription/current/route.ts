import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import {
  getEffectivePlan,
  isSubscriptionCurrent,
  normalizeOwnerPlan,
  type SubscriptionStatus,
} from "../../../../../lib/subscriptions";

type CurrentSubscription = {
  id?: string;
  plan: string;
  status: SubscriptionStatus;
  razorpay_sub_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: owner } = await admin
    .from("owners")
    .select("id, plan")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) {
    return NextResponse.json({ error: "Owner account not found." }, { status: 403 });
  }

  const subscriptionResult = await admin
    .from("subscriptions")
    .select("id, status, starts_at, ends_at, razorpay_sub_id, plan")
    .eq("owner_id", owner.id)
    .in("status", ["active", "grace_period"])
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscription = subscriptionResult.data as CurrentSubscription | null;
  const ownerPlan = normalizeOwnerPlan(owner.plan);
  const effectivePlan = getEffectivePlan(subscription ?? null);
  const subscriptionStatus = subscription
    ? isSubscriptionCurrent(subscription)
      ? subscription.status
      : "expired"
    : null;

  return NextResponse.json({
    ownerPlan,
    plan: effectivePlan,
    subscription: subscription
      ? {
          id: subscription.id,
          plan: normalizeOwnerPlan(subscription.plan),
          status: subscriptionStatus,
          starts_at: subscription.starts_at,
          ends_at: subscription.ends_at,
          razorpay_payment_id: subscription.razorpay_sub_id,
        }
      : null,
  });
}
