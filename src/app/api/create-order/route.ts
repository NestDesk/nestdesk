import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import {
  BILLING_CYCLES,
  buildOrderReceipt,
  getPlanConfig,
  getPlanAmountPaiseForCycle,
  getPlanRank,
  inferBillingCycleFromSubscription,
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
  customPlanId: z.string().uuid().optional(),
  billingCycle: z.enum(BILLING_CYCLES).optional(),
  preview: z.boolean().optional(),
  confirm: z.boolean().optional(),
});

type PlanSnapshot = {
  activePlanId: string | null;
  activePlanName: string;
};

type CustomPlanPricing = {
  id: string;
  name: string;
  monthly_price_paise: number;
  yearly_price_paise: number;
};

async function getAssignedCustomPlanForOwner(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  customPlanId: string,
): Promise<CustomPlanPricing | null> {
  const { data } = await admin
    .from("owner_custom_institution_plans")
    .select(
      "custom_institution_plans!inner(id, name, monthly_price_paise, yearly_price_paise)",
    )
    .eq("owner_id", ownerId)
    .eq("custom_plan_id", customPlanId)
    .eq("is_active", true)
    .eq("custom_institution_plans.is_active", true)
    .maybeSingle();

  const nestedPlan = (data as { custom_institution_plans?: unknown } | null)
    ?.custom_institution_plans;

  if (Array.isArray(nestedPlan)) {
    return (nestedPlan[0] as CustomPlanPricing | null) ?? null;
  }

  return (nestedPlan as CustomPlanPricing | null) ?? null;
}

async function getActiveAssignedCustomPlanForOwner(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
): Promise<CustomPlanPricing | null> {
  const { data } = await admin
    .from("owner_custom_institution_plans")
    .select(
      "custom_institution_plans!inner(id, name, monthly_price_paise, yearly_price_paise)",
    )
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .eq("custom_institution_plans.is_active", true)
    .limit(1)
    .maybeSingle();

  const nestedPlan = (data as { custom_institution_plans?: unknown } | null)
    ?.custom_institution_plans;

  if (Array.isArray(nestedPlan)) {
    return (nestedPlan[0] as CustomPlanPricing | null) ?? null;
  }

  return (nestedPlan as CustomPlanPricing | null) ?? null;
}

async function getCustomPlanPricingById(
  admin: ReturnType<typeof createAdminClient>,
  customPlanId: string,
): Promise<CustomPlanPricing | null> {
  const { data } = await admin
    .from("custom_institution_plans")
    .select("id, name, monthly_price_paise, yearly_price_paise")
    .eq("id", customPlanId)
    .eq("is_active", true)
    .maybeSingle<CustomPlanPricing>();

  return data ?? null;
}

async function resolvePlanSnapshot(
  requestedPlan: OwnerPlan,
  customPlan: { id: string; name: string } | null,
): Promise<PlanSnapshot> {
  if (requestedPlan === "institution" && customPlan) {
    return {
      activePlanId: customPlan.id,
      activePlanName: customPlan.name,
    };
  }

  const { data: globalPlan } = await createAdminClient()
    .from("subscription_plans")
    .select("id, name")
    .eq("code", requestedPlan)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; name: string | null }>();

  return {
    activePlanId: globalPlan?.id ?? null,
    activePlanName: globalPlan?.name?.trim() || getPlanConfig(requestedPlan).name,
  };
}

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
  const admin = createAdminClient();

  let customPlan: CustomPlanPricing | null = null;
  if (requestedPlan === "institution") {
    if (parsed.data.customPlanId) {
      customPlan = await getAssignedCustomPlanForOwner(
        admin,
        ownerCtx.owner.id,
        parsed.data.customPlanId,
      );
      if (!customPlan) {
        return NextResponse.json(
          {
            error:
              "The selected custom institution plan is not assigned to your account.",
          },
          { status: 400 },
        );
      }
    } else {
      customPlan = await getActiveAssignedCustomPlanForOwner(
        admin,
        ownerCtx.owner.id,
      );
      if (!customPlan) {
        return NextResponse.json(
          { error: "Assigned custom institution plan is not available." },
          { status: 400 },
        );
      }
    }
  }

  const currentOwnerCreditPaise = ownerCtx.owner.unused_credit_paise ?? 0;

  const { data: activeSubscription } = await admin
    .from("subscriptions")
    .select("id, plan, status, starts_at, ends_at, custom_plan_id")
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

  const activeCustomPlanId = activeSubscription?.custom_plan_id ?? null;
  const requestedCustomPlanId = parsed.data.customPlanId ?? null;
  const samePlan =
    requestedPlan === activeSubscriptionPlan &&
    billingCycle === activeBillingCycle &&
    (requestedPlan !== "institution"
      ? true
      : requestedCustomPlanId
        ? requestedCustomPlanId === activeCustomPlanId
        : customPlan?.id === activeCustomPlanId);

  if (samePlan && !preview && !confirm) {
    return NextResponse.json(
      { error: "You are already on this plan." },
      { status: 400 },
    );
  }

  let currentAmountPaise = 0;
  if (hasActiveSubscription) {
    if (
      activeSubscriptionPlan === "institution" &&
      activeSubscription?.custom_plan_id
    ) {
      const activeCustomPricing = await getCustomPlanPricingById(
        admin,
        activeSubscription.custom_plan_id,
      );
      currentAmountPaise = activeCustomPricing
        ? activeBillingCycle === "yearly"
          ? activeCustomPricing.yearly_price_paise
          : activeCustomPricing.monthly_price_paise
        : getPlanAmountPaiseForCycle(activeSubscriptionPlan, activeBillingCycle);
    } else {
      currentAmountPaise = getPlanAmountPaiseForCycle(
        activeSubscriptionPlan,
        activeBillingCycle,
      );
    }
  }
  const newAmountPaise =
    requestedPlan === "institution" && customPlan
      ? billingCycle === "yearly"
        ? customPlan.yearly_price_paise
        : customPlan.monthly_price_paise
      : getPlanAmountPaiseForCycle(requestedPlan, billingCycle);

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
      customPlanId: customPlan?.id ?? null,
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
  const purchasedPlanSnapshot = await resolvePlanSnapshot(requestedPlan, customPlan);

  if (amountDuePaise === 0 && confirm) {
    const nowIso = now.toISOString();
    const newEndsAtIso = new Date(
      new Date(now).setMonth(now.getMonth() + (billingCycle === "yearly" ? 12 : 1)),
    ).toISOString();

    const { data: createdOrder, error: createOrderError } = await admin
      .from("payment_orders")
      .insert({
        owner_id: ownerCtx.owner.id,
        plan: requestedPlan,
        custom_plan_id: customPlan?.id ?? null,
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
          purchased_plan_id: purchasedPlanSnapshot.activePlanId,
          purchased_plan_name: purchasedPlanSnapshot.activePlanName,
          billing_cycle: billingCycle,
          current_plan: activeSubscriptionPlan,
          current_plan_billing_cycle: activeBillingCycle,
          current_plan_ends_at: currentPlanEndsAt,
          previous_owner_credit_paise: currentOwnerCreditPaise,
          proration_credit_paise: prorationCreditPaise,
          credit_used_paise: creditUsedPaise,
          available_credit_paise: availableCreditPaise,
          unused_credit_paise_after: leftoverCreditPaise,
          amount_due_paise: amountDuePaise,
          is_proration: prorationCreditPaise > 0,
        },
      })
      .select("id")
      .maybeSingle();

    if (createOrderError || !createdOrder?.id) {
      return NextResponse.json(
        { error: createOrderError?.message ?? "Failed to create order record." },
        { status: 500 },
      );
    }

    const previousSubscriptionId = activeSubscription?.id ?? null;
    const previousSubscriptionEndsAt = activeSubscription?.ends_at ?? null;
    const previousSubscriptionStatus = activeSubscription?.status ?? null;

    const { error: expireError } = previousSubscriptionId
      ? await admin
          .from("subscriptions")
          .update({
            status: "expired",
            ends_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", previousSubscriptionId)
      : { error: null };

    if (expireError) {
      await admin.from("payment_orders").delete().eq("id", createdOrder.id);
      return NextResponse.json({ error: expireError.message }, { status: 500 });
    }

    const { data: createdSubscription, error: createSubscriptionError } = await admin
      .from("subscriptions")
      .insert({
        owner_id: ownerCtx.owner.id,
        plan: requestedPlan,
        custom_plan_id: customPlan?.id ?? null,
        status: "active",
        razorpay_sub_id: null,
        starts_at: nowIso,
        ends_at: newEndsAtIso,
      })
      .select("id")
      .maybeSingle();

    if (createSubscriptionError || !createdSubscription?.id) {
      if (previousSubscriptionId) {
        await admin
          .from("subscriptions")
          .update({
            status: previousSubscriptionStatus,
            ends_at: previousSubscriptionEndsAt,
            updated_at: nowIso,
          })
          .eq("id", previousSubscriptionId);
      }
      await admin.from("payment_orders").delete().eq("id", createdOrder.id);

      return NextResponse.json(
        {
          error:
            createSubscriptionError?.message ??
            "Failed to create subscription record.",
        },
        { status: 500 },
      );
    }

    const { error: ownerUpdateError } = await admin
      .from("owners")
      .update({
        plan: requestedPlan,
        active_plan_id: purchasedPlanSnapshot.activePlanId,
        active_plan_name: purchasedPlanSnapshot.activePlanName,
        unused_credit_paise: leftoverCreditPaise,
        updated_at: nowIso,
      })
      .eq("id", ownerCtx.owner.id);

    if (ownerUpdateError) {
      await admin.from("subscriptions").delete().eq("id", createdSubscription.id);
      if (previousSubscriptionId) {
        await admin
          .from("subscriptions")
          .update({
            status: previousSubscriptionStatus,
            ends_at: previousSubscriptionEndsAt,
            updated_at: nowIso,
          })
          .eq("id", previousSubscriptionId);
      }
      await admin.from("payment_orders").delete().eq("id", createdOrder.id);

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
        purchased_plan_id: purchasedPlanSnapshot.activePlanId,
        purchased_plan_name: purchasedPlanSnapshot.activePlanName,
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
      custom_plan_id: customPlan?.id ?? null,
      status: "created",
      amount_paise: responseJson.amount ?? amountDuePaise,
      currency: responseJson.currency ?? currency,
      receipt,
      razorpay_order_id: responseJson.id,
      notes: {
        owner_id: ownerCtx.owner.id,
        owner_email: ownerCtx.user.email ?? "",
        plan: requestedPlan,
        custom_plan_id: customPlan?.id ?? null,
        purchased_plan_id: purchasedPlanSnapshot.activePlanId,
        purchased_plan_name: purchasedPlanSnapshot.activePlanName,
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
