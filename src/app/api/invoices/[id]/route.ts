import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Auth + ownership verification ───────────────────────────────────────────

type VerifiedCtx = {
  ownerId: string;
  invoice: { id: string; hostel_id: string; status: string };
  admin: ReturnType<typeof createAdminClient>;
};

async function verifyOwnership(
  invoiceId: string,
): Promise<VerifiedCtx | NextResponse> {
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

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, hostel_id, status, deleted_at")
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  // Verify the hostel belongs to this owner
  const { data: hostel } = await admin
    .from("hostels")
    .select("owner_id")
    .eq("id", invoice.hostel_id)
    .maybeSingle();

  if (!hostel || hostel.owner_id !== owner.id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  return { ownerId: owner.id, invoice, admin };
}

// ─── PATCH /api/invoices/[id] ─────────────────────────────────────────────────
// Allowed mutations: status, notes, payment_id.
// The calculation snapshot fields are immutable — use delete + new invoice.

const patchSchema = z.object({
  status: z.enum(["draft", "issued", "paid", "overdue", "waived"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
  payment_id: z.string().uuid("Invalid payment_id").optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await verifyOwnership(params.id);
  if (ctx instanceof NextResponse) return ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error." },
      { status: 422 },
    );
  }

  const payload: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) payload.status = parsed.data.status;
  if (parsed.data.notes !== undefined) payload.notes = parsed.data.notes;
  if (parsed.data.payment_id !== undefined)
    payload.payment_id = parsed.data.payment_id;

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ message: "No fields to update." });
  }

  const { data, error } = await ctx.admin
    .from("invoices")
    .update(payload)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invoice: data });
}

// ─── DELETE /api/invoices/[id] ────────────────────────────────────────────────
// Soft-deletes the invoice. Paid invoices cannot be deleted.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await verifyOwnership(params.id);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.invoice.status === "paid") {
    return NextResponse.json(
      { error: "Paid invoices cannot be deleted." },
      { status: 409 },
    );
  }

  const { error } = await ctx.admin
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
