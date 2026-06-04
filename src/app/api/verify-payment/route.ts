import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeSubscriptionEndDate,
  normalizeOwnerPlan,
  type OwnerPlan,
} from "@/lib/subscriptions";
import { verifyRazorpayPaymentSignature } from "@/lib/subscriptions-signature";

const verifySchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  plan: z.enum(["free", "micro", "starter", "pro", "business", "enterprise"]),
});

async function getOwnerContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("id, plan")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) {
    return {
      error: NextResponse.json(
        { error: "Owner account not found." },
        { status: 403 },
      ),
    };
  }

  return {
    admin,
    owner,
  };
}

export async function POST(request: NextRequest) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json(
      { error: "Razorpay credentials are not configured." },
      { status: 500 },
    );
  }

  const ownerCtx = await getOwnerContext();
  if ("error" in ownerCtx) {
    return ownerCtx.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Missing required payment fields.",
      },
      { status: 400 },
    );
  }

  const plan: OwnerPlan = normalizeOwnerPlan(parsed.data.plan);

  if (plan === "free") {
    return NextResponse.json(
      { error: "Free plan cannot be verified through online payment." },
      { status: 400 },
    );
  }

  const { data: paymentOrder, error: orderFetchError } = await ownerCtx.admin
    .from("payment_orders")
    .select("id, plan, status, amount_paise, razorpay_payment_id")
    .eq("owner_id", ownerCtx.owner.id)
    .eq("razorpay_order_id", parsed.data.razorpay_order_id)
    .maybeSingle();

  if (orderFetchError) {
    return NextResponse.json(
      { error: "Failed to verify payment order." },
      { status: 500 },
    );
  }

  if (!paymentOrder) {
    return NextResponse.json(
      { error: "Payment order not found for this owner." },
      { status: 400 },
    );
  }

  if (paymentOrder.status !== "created") {
    return NextResponse.json(
      { error: "Payment order has already been processed." },
      { status: 400 },
    );
  }

  if (paymentOrder.plan !== plan) {
    return NextResponse.json({ error: "Payment plan mismatch." }, { status: 400 });
  }

  const isValidSignature = verifyRazorpayPaymentSignature({
    razorpayOrderId: parsed.data.razorpay_order_id,
    razorpayPaymentId: parsed.data.razorpay_payment_id,
    razorpaySignature: parsed.data.razorpay_signature,
    keySecret,
  });

  if (!isValidSignature) {
    return NextResponse.json(
      { error: "Payment signature mismatch." },
      { status: 400 },
    );
  }

  const paymentOrderUpdate = await ownerCtx.admin
    .from("payment_orders")
    .update({
      status: "paid",
      razorpay_payment_id: parsed.data.razorpay_payment_id,
      razorpay_signature: parsed.data.razorpay_signature,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentOrder.id);

  if (paymentOrderUpdate.error) {
    return NextResponse.json(
      { error: "Failed to record verified payment." },
      { status: 500 },
    );
  }

  const startedAt = new Date();
  const startsAtIso = startedAt.toISOString();
  const endsAtIso = computeSubscriptionEndDate(plan, startedAt).toISOString();

  const { error: expireError } = await ownerCtx.admin
    .from("subscriptions")
    .update({
      status: "expired",
      ends_at: startsAtIso,
      updated_at: startsAtIso,
    })
    .eq("owner_id", ownerCtx.owner.id)
    .eq("status", "active");

  if (expireError) {
    return NextResponse.json({ error: expireError.message }, { status: 500 });
  }

  const { error: createSubscriptionError } = await ownerCtx.admin
    .from("subscriptions")
    .insert({
      owner_id: ownerCtx.owner.id,
      plan,
      status: "active",
      razorpay_sub_id: parsed.data.razorpay_payment_id,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
    });

  if (createSubscriptionError) {
    return NextResponse.json(
      { error: createSubscriptionError.message },
      { status: 500 },
    );
  }

  const { error: ownerUpdateError } = await ownerCtx.admin
    .from("owners")
    .update({
      plan,
      updated_at: startsAtIso,
    })
    .eq("id", ownerCtx.owner.id);

  if (ownerUpdateError) {
    return NextResponse.json({ error: ownerUpdateError.message }, { status: 500 });
  }

  await ownerCtx.admin.from("audit_logs").insert({
    owner_id: ownerCtx.owner.id,
    action: "subscription_payment_verified",
    table_name: "subscriptions",
    new_value: {
      plan,
      status: "active",
      razorpay_payment_id: parsed.data.razorpay_payment_id,
      razorpay_order_id: parsed.data.razorpay_order_id,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
    },
  });

  return NextResponse.json({
    success: true,
    plan,
    status: "active",
    starts_at: startsAtIso,
    ends_at: endsAtIso,
  });
}
