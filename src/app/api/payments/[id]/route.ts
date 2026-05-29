import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

async function resolveOwnerAndPayment(paymentId: string) {
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
    .select("id")
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

  const { data: payment } = await admin
    .from("payments")
    .select("id, hostel_id, tenant_id, status, receipt_number, paid_at, recorded_by")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) {
    return {
      error: NextResponse.json({ error: "Payment not found." }, { status: 404 }),
    };
  }

  // Verify ownership through recorded_by or through hostel ownership
  const { data: hostel } = await admin
    .from("hostels")
    .select("owner_id")
    .eq("id", payment.hostel_id)
    .maybeSingle();

  if (!hostel || hostel.owner_id !== owner.id) {
    return {
      error: NextResponse.json({ error: "Access denied." }, { status: 403 }),
    };
  }

  return { ownerId: owner.id, payment, admin };
}

const patchSchema = z.object({
  status: z.enum(["paid", "disputed"]).optional(),
  method: z
    .enum(["cash", "upi", "bank_transfer", "razorpay", "other"])
    .nullable()
    .optional(),
  notes: z.string().max(1000).nullable().optional(),
  amount: z.number().min(0).max(9999999).optional(),
  paid_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "paid_on must be YYYY-MM-DD.")
    .optional(),
});

// PATCH /api/payments/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await resolveOwnerAndPayment(id);
  if (ctx.error) return ctx.error;
  const { payment, admin } = ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error." },
      { status: 400 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    if (parsed.data.status === "paid" && payment.status !== "paid") {
      updates.paid_at = new Date().toISOString();
      if (!payment.receipt_number) {
        updates.receipt_number = generateReceiptNumber();
      }
    } else if (parsed.data.status !== "paid" && payment.status === "paid") {
      updates.paid_at = null;
    }
  }
  if (parsed.data.method !== undefined) updates.method = parsed.data.method;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.amount !== undefined) updates.amount = parsed.data.amount;
  if (parsed.data.paid_on !== undefined) {
    updates.paid_on = parsed.data.paid_on;
  }

  const { data: updated, error } = await admin
    .from("payments")
    .update(updates)
    .eq("id", id)
    .select(
      "id, tenant_id, hostel_id, amount, month, status, method, receipt_number, notes, paid_at, paid_on, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ payment: updated });
}

// DELETE /api/payments/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await resolveOwnerAndPayment(id);
  if (ctx.error) return ctx.error;
  const { admin } = ctx;

  const { error } = await admin.from("payments").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
