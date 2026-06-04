import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildOrderReceipt,
  getPlanAmountPaise,
  normalizeOwnerPlan,
  type OwnerPlan,
} from "@/lib/subscriptions";

const MINIMUM_AMOUNT_PAISE = 100;
const RAZORPAY_CURRENCY = "INR" as const;

const createOrderSchema = z.object({
  receipt: z.string().max(80).optional(),
  plan: z
    .enum(["free", "micro", "test", "starter", "pro", "business", "enterprise"])
    .optional(),
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
  const amount = getPlanAmountPaise(requestedPlan);

  if (requestedPlan === "free") {
    return NextResponse.json(
      { error: "Free plan does not require an online payment order." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(amount) || amount < MINIMUM_AMOUNT_PAISE) {
    return NextResponse.json(
      { error: "Invalid plan amount configured." },
      { status: 500 },
    );
  }

  const currency = RAZORPAY_CURRENCY;
  const receipt =
    parsed.data.receipt?.trim() ||
    buildOrderReceipt(ownerCtx.owner.id, requestedPlan);

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
      amount,
      currency,
      receipt,
      notes: {
        owner_id: ownerCtx.owner.id,
        owner_email: ownerCtx.user.email ?? "",
        plan: requestedPlan,
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
      amount_paise: responseJson.amount ?? amount,
      currency: responseJson.currency ?? currency,
      receipt,
      razorpay_order_id: responseJson.id,
      notes: {
        owner_id: ownerCtx.owner.id,
        owner_email: ownerCtx.user.email ?? "",
        plan: requestedPlan,
      },
    })
    .then(({ error }) => {
      if (error) {
        console.error("Failed to record payment order:", error.message);
      }
    });

  return NextResponse.json({
    order_id: responseJson.id,
    amount: responseJson.amount ?? amount,
    currency: responseJson.currency ?? currency,
    plan: requestedPlan,
    key_id: keyId,
  });
}
