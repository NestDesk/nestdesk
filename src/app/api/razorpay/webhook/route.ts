import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { computeSubscriptionEndDate, normalizeOwnerPlan } from "../../../../lib/subscriptions";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: Record<string, unknown>;
    };
  };
};

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

function verifyRazorpayWebhookSignature(
  rawBody: ArrayBuffer,
  razorpaySignature: string,
  webhookSecret: string,
) {
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(Buffer.from(rawBody))
    .digest("hex");

  return expectedSignature === razorpaySignature;
}

export async function POST(request: NextRequest) {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Razorpay webhook secret is not configured." },
      { status: 500 },
    );
  }

  const razorpaySignature = request.headers.get("x-razorpay-signature");
  if (!razorpaySignature) {
    return NextResponse.json(
      { error: "Missing Razorpay webhook signature." },
      { status: 400 },
    );
  }

  const rawBody = await request.arrayBuffer();

  if (
    !verifyRazorpayWebhookSignature(
      rawBody,
      razorpaySignature,
      RAZORPAY_WEBHOOK_SECRET,
    )
  ) {
    return NextResponse.json(
      { error: "Webhook signature mismatch." },
      { status: 400 },
    );
  }

  const text = new TextDecoder().decode(rawBody);
  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const event = payload.event;
  const paymentEntity = payload.payload?.payment?.entity;

  if (event !== "payment.captured" || !paymentEntity) {
    return NextResponse.json(
      { success: true, message: "Webhook received but not processed." },
      { status: 200 },
    );
  }

  const razorpayPaymentId = paymentEntity.id;
  const razorpayOrderId = paymentEntity.order_id;
  const amount = paymentEntity.amount;
  const currency = paymentEntity.currency;
  const status = paymentEntity.status;

  if (!razorpayPaymentId || !razorpayOrderId || typeof amount !== "number") {
    return NextResponse.json(
      { error: "Missing payment fields in webhook payload." },
      { status: 400 },
    );
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return NextResponse.json(
      { error: "Razorpay credentials are not configured." },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const { data: paymentOrder, error: orderFetchError } = await admin
    .from("payment_orders")
    .select("id, owner_id, plan, status, amount_paise, currency")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();

  if (orderFetchError) {
    return NextResponse.json(
      { error: "Failed to fetch payment order." },
      { status: 500 },
    );
  }

  if (!paymentOrder) {
    return NextResponse.json({ error: "Payment order not found." }, { status: 404 });
  }

  if (paymentOrder.status !== "created") {
    return NextResponse.json(
      { success: true, message: "Payment order already processed." },
      { status: 200 },
    );
  }

  if (currency !== "INR" || paymentOrder.currency !== "INR") {
    return NextResponse.json({ error: "Currency mismatch." }, { status: 400 });
  }

  if (amount !== paymentOrder.amount_paise) {
    return NextResponse.json({ error: "Payment amount mismatch." }, { status: 400 });
  }

  if (status !== "captured") {
    return NextResponse.json({ error: "Payment is not captured." }, { status: 400 });
  }

  const { error: paymentOrderUpdateError } = await admin
    .from("payment_orders")
    .update({
      status: "paid",
      razorpay_payment_id: razorpayPaymentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentOrder.id)
    .eq("status", "created");

  if (paymentOrderUpdateError) {
    return NextResponse.json(
      { error: "Failed to update payment order." },
      { status: 500 },
    );
  }

  const plan = normalizeOwnerPlan(paymentOrder.plan);
  const startedAt = new Date();
  const startsAtIso = startedAt.toISOString();
  const endsAtIso = computeSubscriptionEndDate(plan, startedAt).toISOString();

  const { error: expireError } = await admin
    .from("subscriptions")
    .update({
      status: "expired",
      ends_at: startsAtIso,
      updated_at: startsAtIso,
    })
    .eq("owner_id", paymentOrder.owner_id)
    .eq("status", "active");

  if (expireError) {
    return NextResponse.json({ error: expireError.message }, { status: 500 });
  }

  const { error: createSubscriptionError } = await admin
    .from("subscriptions")
    .insert({
      owner_id: paymentOrder.owner_id,
      plan,
      status: "active",
      razorpay_sub_id: razorpayPaymentId,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
    });

  if (createSubscriptionError) {
    return NextResponse.json(
      { error: createSubscriptionError.message },
      { status: 500 },
    );
  }

  const { error: ownerUpdateError } = await admin
    .from("owners")
    .update({ plan, updated_at: startsAtIso })
    .eq("id", paymentOrder.owner_id);

  if (ownerUpdateError) {
    return NextResponse.json({ error: ownerUpdateError.message }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    owner_id: paymentOrder.owner_id,
    action: "subscription_payment_webhook",
    table_name: "subscriptions",
    new_value: {
      plan,
      status: "active",
      razorpay_payment_id: razorpayPaymentId,
      razorpay_order_id: razorpayOrderId,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
    },
  });

  return NextResponse.json({ success: true });
}
