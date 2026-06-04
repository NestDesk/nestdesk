import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeOwnerPlan } from "@/lib/subscriptions";

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

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, status, starts_at, ends_at, razorpay_sub_id, plan")
    .eq("owner_id", owner.id)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    plan: normalizeOwnerPlan(owner.plan),
    subscription: subscription
      ? {
          id: subscription.id,
          plan: normalizeOwnerPlan(subscription.plan),
          status: subscription.status,
          starts_at: subscription.starts_at,
          ends_at: subscription.ends_at,
          razorpay_payment_id: subscription.razorpay_sub_id,
        }
      : null,
  });
}
