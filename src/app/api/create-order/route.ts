import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import {
  BILLING_CYCLES,
  buildOrderReceipt,
  getPlanAmountPaiseForCycle,
  getPlanRank,
  inferBillingCycleFromSubscription,
  isPaidPlan,
  normalizeOwnerPlan,
  OWNER_PLANS,
  type BillingCycle,
  type OwnerPlan,
} from "../../../lib/subscriptions";

const MINIMUM_AMOUNT_PAISE = 100;
const RAZORPAY_CURRENCY = "INR" as const;

const createOrderSchema = z.object({
  receipt: z.string().max(80).optional(),
  plan: z.enum(OWNER_PLANS).optional(),
  billingCycle: z.enum(BILLING_CYCLES).optional(),
  preview: z.boolean().optional(),
  confirm: z.boolean().optional(),
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
    .select("id, plan, unused_credit_paise")
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
    owner,
    user,
  };
}

export async function POST(request: NextRequest) {
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

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error." },
      { status: 400 },
    );
  }

  const requestedPlan: OwnerPlan = normalizeOwnerPlan(
    parsed.data.plan ?? ownerCtx.owner.plan,
  );
  const billingCycle = parsed.data.billingCycle === "yearly" ? "yearly" : "monthly";
  const preview = parsed.data.preview === true;
  const confirm = parsed.data.confirm === true;

  if (!isPaidPlan(requestedPlan)) {
    return NextResponse.json(
      {
        error:
          requestedPlan === "free"
            ? "Free plan does not require an online payment order."
            : "Institution plan is custom. Please contact the sales team.",
      },
      { status: 400 },
    );
  }

  const currentPlan = normalizeOwnerPlan(ownerCtx.owner.plan);
  const currentOwnerCreditPaise = ownerCtx.owner.unused_credit_paise ?? 0;

  const { data: activeSubscription } = await createAdminClient()
    .from("subscriptions")
    .select("plan, status, starts_at, ends_at")
    .eq("owner_id", ownerCtx.owner.id)
    .in("status", ["active", "grace_period"])
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  let activeSubscriptionPlan: OwnerPlan = "free";
  let activeBillingCycle: BillingCycle = "monthly";
  let activeEndsAt: Date | null = null;
  let activeStartsAt: Date | null = null;
  let hasActiveSubscription = false;

  if (activeSubscription?.ends_at) {
    const endsAt = new Date(activeSubscription.ends_at);
    if (endsAt > now) {
      hasActiveSubscription = true;
      activeSubscriptionPlan = normalizeOwnerPlan(activeSubscription.plan);
      activeEndsAt = endsAt;
      activeStartsAt = activeSubscription.starts_at
        ? new Date(activeSubscription.starts_at)
        : null;
      if (activeStartsAt && activeEndsAt) {
        activeBillingCycle = inferBillingCycleFromSubscription(
          activeStartsAt,
          activeEndsAt,
        );
      }
    }
  }

  const isDowngrade =
    hasActiveSubscription &&
    getPlanRank(requestedPlan) < getPlanRank(activeSubscriptionPlan);

  if (isDowngrade) {
    return NextResponse.json(
      {
        error:
          "Downgrades are blocked during an active subscription period. Please wait until the current billing period ends.",
      },
      { status: 400 },
    );
  }

  if (requestedPlan === activeSubscriptionPlan && !preview && !confirm) {
    return NextResponse.json(
      { error: "You are already on this plan." },
      { status: 400 },
    );
  }

  const currentAmountPaise = hasActiveSubscription
    ? getPlanAmountPaiseForCycle(activeSubscriptionPlan, activeBillingCycle)
    : 0;
  const newAmountPaise = getPlanAmountPaiseForCycle(requestedPlan, billingCycle);

  let prorationCreditPaise = 0;
  let remainingDays = 0;
  const currentPlanEndsAt = activeEndsAt?.toISOString() ?? null;

  if (hasActiveSubscription && activeEndsAt) {
    const millisRemaining = activeEndsAt.getTime() - now.getTime();
    remainingDays = Math.max(0, Math.ceil(millisRemaining / (1000 * 60 * 60 * 24)));
    const daysInCycle = activeBillingCycle === "yearly" ? 365 : 30;
    prorationCreditPaise = Math.round(
      (currentAmountPaise / daysInCycle) * remainingDays,
    );
  }

  const availableCreditPaise = Math.max(
    0,
    currentOwnerCreditPaise + prorationCreditPaise,
  );
  const creditUsedPaise = Math.min(availableCreditPaise, newAmountPaise);
  const leftoverCreditPaise = Math.max(0, availableCreditPaise - newAmountPaise);
  const amountDuePaise = Math.max(0, newAmountPaise - availableCreditPaise);

  if (preview) {
    return NextResponse.json({
      success: true,
      preview: true,
      requestedPlan,
      billingCycle,
      currentPlan: activeSubscriptionPlan,
      currentPlanBillingCycle: activeBillingCycle,
      currentPlanAmountPaise: currentAmountPaise,
      newPlanAmountPaise: newAmountPaise,
      currentOwnerCreditPaise,
      prorationCreditPaise,
      availableCreditPaise,
      creditUsedPaise,
      leftoverCreditPaise,
      amountDuePaise,
      currentPlanEndsAt,
      requiresCheckout: amountDuePaise > 0,
    });
  }

  if (amountDuePaise === 0 && !confirm) {
    return NextResponse.json(
      {
        error:
          "No payment is required. Confirm the upgrade to apply it immediately.",
        amountDuePaise: 0,
        requiresCheckout: false,
      },
      { status: 400 },
    );
  }

  const receipt =
    parsed.data.receipt?.trim() ||
    buildOrderReceipt(ownerCtx.owner.id, requestedPlan);

  if (amountDuePaise === 0 && confirm) {
    const nowIso = now.toISOString();
    const newEndsAtIso = new Date(
      new Date(now).setMonth(now.getMonth() + (billingCycle === "yearly" ? 12 : 1)),
    ).toISOString();

    const { error: createOrderError } = await createAdminClient()
      .from("payment_orders")
      .insert({
        owner_id: ownerCtx.owner.id,
        plan: requestedPlan,
        status: "paid",
        amount_paise: 0,
        currency: RAZORPAY_CURRENCY,
        receipt,
        razorpay_order_id: `CREDIT-${receipt}`,
        razorpay_payment_id: null,
        notes: {
          owner_id: ownerCtx.owner.id,
          owner_email: ownerCtx.user.email ?? "",
          plan: requestedPlan,
          billing_cycle: billingCycle,
          current_plan: activeSubscriptionPlan,
          current_plan_billing_cycle: activeBillingCycle,
          current_plan_ends_at: currentPlanEndsAt,
          proration_credit_paise: prorationCreditPaise,
          credit_used_paise: creditUsedPaise,
          available_credit_paise: availableCreditPaise,
          unused_credit_paise_after: leftoverCreditPaise,
          amount_due_paise: amountDuePaise,
          is_proration: prorationCreditPaise > 0,
        },
      });

    if (createOrderError) {
      return NextResponse.json({ error: createOrderError.message }, { status: 500 });
    }

    const { error: expireError } = await createAdminClient()
      .from("subscriptions")
      .update({
        status: "expired",
        ends_at: nowIso,
        updated_at: nowIso,
      })
      .eq("owner_id", ownerCtx.owner.id)
      .eq("status", "active");

    if (expireError) {
      return NextResponse.json({ error: expireError.message }, { status: 500 });
    }

    const { error: createSubscriptionError } = await createAdminClient()
      .from("subscriptions")
      .insert({
        owner_id: ownerCtx.owner.id,
        plan: requestedPlan,
        status: "active",
        razorpay_sub_id: null,
        starts_at: nowIso,
        ends_at: newEndsAtIso,
      });

    if (createSubscriptionError) {
      return NextResponse.json(
        { error: createSubscriptionError.message },
        { status: 500 },
      );
    }

    const { error: ownerUpdateError } = await createAdminClient()
      .from("owners")
      .update({
        plan: requestedPlan,
        unused_credit_paise: leftoverCreditPaise,
        updated_at: nowIso,
      })
      .eq("id", ownerCtx.owner.id);

    if (ownerUpdateError) {
      return NextResponse.json({ error: ownerUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      requiresCheckout: false,
      plan: requestedPlan,
      starts_at: now.toISOString(),
      ends_at: newEndsAtIso,
    });
  }

  if (!Number.isFinite(amountDuePaise) || amountDuePaise < MINIMUM_AMOUNT_PAISE) {
    return NextResponse.json(
      {
        error: "Invalid plan amount configured.",
      },
      { status: 500 },
    );
  }

  const currency = RAZORPAY_CURRENCY;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json(
      {
        error:
          "Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      },
      { status: 500 },
    );
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountDuePaise,
      currency,
      receipt,
      notes: {
        owner_id: ownerCtx.owner.id,
        owner_email: ownerCtx.user.email ?? "",
        plan: requestedPlan,
        billing_cycle: billingCycle,
        current_plan: activeSubscriptionPlan,
        current_plan_billing_cycle: activeBillingCycle,
        current_plan_ends_at: currentPlanEndsAt,
        proration_credit_paise: prorationCreditPaise,
        amount_due_paise: amountDuePaise,
        is_proration: prorationCreditPaise > 0,
      },
    }),
    cache: "no-store",
  });

  const responseBody = await response.text().catch(() => "");
  let responseJson: {
    id?: string;
    amount?: number;
    currency?: string;
    error?: { code?: string; description?: string };
  } | null = null;

  try {
    responseJson = responseBody ? JSON.parse(responseBody) : null;
  } catch {
    responseJson = null;
  }

  if (response.status === 401 || response.status === 403) {
    return NextResponse.json(
      {
        error:
          responseJson?.error?.description ||
          "Razorpay authentication failed. Confirm your Razorpay API keys.",
      },
      { status: 401 },
    );
  }

  if (!response.ok || !responseJson?.id) {
    const razorpayMessage = responseJson?.error?.description;
    return NextResponse.json(
      {
        error:
          razorpayMessage ||
          `Failed to create Razorpay order. ${response.statusText || "Unknown error."}`,
      },
      { status: 500 },
    );
  }

  await createAdminClient()
    .from("payment_orders")
    .insert({
      owner_id: ownerCtx.owner.id,
      plan: requestedPlan,
      status: "created",
      amount_paise: responseJson.amount ?? amountDuePaise,
      currency: responseJson.currency ?? currency,
      receipt,
      razorpay_order_id: responseJson.id,
      notes: {
        owner_id: ownerCtx.owner.id,
        owner_email: ownerCtx.user.email ?? "",
        plan: requestedPlan,
        billing_cycle: billingCycle,
        current_plan: activeSubscriptionPlan,
        current_plan_billing_cycle: activeBillingCycle,
        current_plan_ends_at: currentPlanEndsAt,
        previous_owner_credit_paise: currentOwnerCreditPaise,
        proration_credit_paise: prorationCreditPaise,
        available_credit_paise: availableCreditPaise,
        credit_used_paise: creditUsedPaise,
        unused_credit_paise_after: leftoverCreditPaise,
        amount_due_paise: amountDuePaise,
        is_proration: prorationCreditPaise > 0,
      },
    })
    .then(({ error }) => {
      if (error) {
        console.error("Failed to record payment order:", error.message);
      }
    });

  return NextResponse.json({
    order_id: responseJson.id,
    amount: responseJson.amount ?? amountDuePaise,
    currency: responseJson.currency ?? currency,
    plan: requestedPlan,
    key_id: keyId,
  });
}
