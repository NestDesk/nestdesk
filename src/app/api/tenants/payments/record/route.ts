import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateInIndia } from "@/lib/date";

type OwnerContext = {
  ownerId: string;
};

async function getOwnerContext(): Promise<OwnerContext | NextResponse> {
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
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) {
    return NextResponse.json({ error: "Owner account not found." }, { status: 403 });
  }

  return { ownerId: owner.id };
}

function generateReceiptNumber(): string {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length; i += 1) {
    const byte = arr[i];
    suffix += chars[byte % chars.length];
  }
  return `ND-${yyyymm}-${suffix}`;
}

const recordPaymentSchema = z.object({
  tenant_id: z.string().uuid("Invalid tenant."),
  amount: z
    .number({ message: "Amount must be a number." })
    .min(0.01, "Amount must be greater than 0.")
    .max(9999999, "Amount too large."),
  method: z
    .enum(["cash", "upi", "bank_transfer", "razorpay", "other"])
    .nullable()
    .optional(),
  notes: z.string().max(1000, "Notes too long.").optional().nullable(),
  status: z.enum(["paid", "disputed"]).optional().default("paid"),
  recording_mode: z.enum(["monthly", "datewise"]).default("monthly"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  record_date: z.string().optional(),
  paid_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "paid_on must be YYYY-MM-DD.")
    .optional(),
});

// POST /api/tenants/payments/record — Record payment for a tenant from tenant portal
export async function POST(request: NextRequest) {
  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = recordPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error." },
      { status: 400 },
    );
  }

  const {
    tenant_id,
    amount,
    method,
    notes,
    status,
    recording_mode,
    start_date,
    end_date,
    record_date,
    paid_on,
  } = parsed.data;

  const admin = createAdminClient();

  // Verify tenant exists and belongs to this owner
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id, full_name, hostel_id, room_id, join_date")
    .eq("id", tenant_id)
    .eq("owner_id", ctx.ownerId)
    .maybeSingle();

  if (tenantError || !tenant) {
    return NextResponse.json(
      { error: "Tenant not found or access denied." },
      { status: 403 },
    );
  }

  const isPaid = status === "paid";
  const now = new Date().toISOString();
  const today = now.split("T")[0];
  const resolvedPaidOn = paid_on ?? today;
  const receiptNumber = isPaid ? generateReceiptNumber() : null;

  // Determine the month field based on recording mode
  let monthField: string;
  let paymentNotes: string = notes || "";

  if (recording_mode === "monthly" && start_date && end_date) {
    // For monthly billing, use the first day of the start month
    const startDateObj = new Date(start_date);
    monthField = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, "0")}-01`;

    // Add date range to notes for reference
    const endDateObj = new Date(end_date);
    const dateRange = `[Monthly: ${formatDateInIndia(start_date, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })} to ${formatDateInIndia(endDateObj, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}]`;
    paymentNotes = paymentNotes ? `${dateRange} ${paymentNotes}` : dateRange;
  } else if (recording_mode === "datewise" && record_date) {
    // For date-wise, use the record date
    const recordDateObj = new Date(record_date);
    monthField = `${recordDateObj.getFullYear()}-${String(recordDateObj.getMonth() + 1).padStart(2, "0")}-01`;

    // Add record date to notes for reference
    const dateString = `[Recorded: ${formatDateInIndia(recordDateObj, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}]`;
    paymentNotes = paymentNotes ? `${dateString} ${paymentNotes}` : dateString;
  } else if (tenant.join_date) {
    // Default to tenant join date's month
    const joinDateObj = new Date(tenant.join_date);
    monthField = `${joinDateObj.getFullYear()}-${String(joinDateObj.getMonth() + 1).padStart(2, "0")}-01`;
  } else {
    // Fallback to today
    const today = new Date();
    monthField = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  }

  // Create the payment record
  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .insert({
      tenant_id,
      hostel_id: tenant.hostel_id,
      amount,
      month: monthField,
      status,
      method: method || null,
      notes: paymentNotes || null,
      receipt_number: receiptNumber,
      paid_at: isPaid ? now : null,
      paid_on: resolvedPaidOn,
      recorded_by: ctx.ownerId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .maybeSingle();

  if (paymentError || !payment) {
    return NextResponse.json(
      { error: paymentError?.message ?? "Could not record payment." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      payment,
      message: "Payment recorded successfully.",
    },
    { status: 201 },
  );
}
