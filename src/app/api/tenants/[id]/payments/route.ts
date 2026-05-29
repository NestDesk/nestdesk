import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/tenants/[id]/payments — Owner fetches payment history for a specific tenant
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenantId } = await params;

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

  // Verify the tenant belongs to this owner
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, full_name, agreed_rent_amount, hostel_id, room_id")
    .eq("id", tenantId)
    .eq("owner_id", owner.id)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant not found or access denied." },
      { status: 403 },
    );
  }

  const { data: payments, error } = await admin
    .from("payments")
    .select(
      "id, amount, month, status, method, receipt_number, notes, paid_at, paid_on, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = payments ?? [];
  const totalPaid = rows
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  const disputedAmount = rows
    .filter((p) => p.status === "disputed")
    .reduce((s, p) => s + Number(p.amount), 0);

  return NextResponse.json({
    payments: rows,
    summary: {
      totalPaid,
      disputedAmount,
      total: rows.length,
    },
  });
}
