import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

// GET /api/tenant/payments — Tenant reads their own payment history
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

  type TenantPaymentRow = {
    id: string;
    amount: number;
    month: string;
    billing_start?: string | null;
    billing_end?: string | null;
    status: string;
    method: string | null;
    receipt_number: string | null;
    notes: string | null;
    paid_on: string;
    created_at: string;
  };

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id, full_name, agreed_rent_amount, hostel_id, room_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 });
  }

  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant account not found." },
      { status: 403 },
    );
  }

  const { data: payments, error } = await admin
    .from("payments")
    .select(
      "id, amount, month, billing_start, billing_end, status, method, receipt_number, notes, paid_on, created_at",
    )
    .eq("tenant_id", tenant.id)
    .order("month", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const [{ data: hostel }, { data: billing }, { data: roomData }] =
    await Promise.all([
      admin
        .from("hostels")
        .select("name, address, city, state, pincode")
        .eq("id", tenant.hostel_id)
        .maybeSingle(),
      admin
        .from("property_billing")
        .select("gst_number, pan_number, billing_address")
        .eq("hostel_id", tenant.hostel_id)
        .maybeSingle(),
      admin
        .from("rooms")
        .select("room_number")
        .eq("id", tenant.room_id)
        .maybeSingle(),
    ]);

  const rows = ((payments ?? []) as TenantPaymentRow[]).map((p) => ({
    ...p,
    tenant_name: tenant.full_name ?? "Tenant",
    room_number: roomData?.room_number ?? null,
    hostel_name: hostel?.name ?? "Property",
    hostel_address: hostel?.address ?? null,
    hostel_city: hostel?.city ?? null,
    hostel_state: hostel?.state ?? null,
    hostel_pincode: hostel?.pincode ?? null,
    hostel_billing_address: billing?.billing_address ?? null,
    hostel_gst_number: billing?.gst_number ?? null,
    hostel_pan_number: billing?.pan_number ?? null,
  }));

  const totalPaid = rows
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  const disputedAmount = rows
    .filter((p) => p.status === "disputed")
    .reduce((s, p) => s + Number(p.amount), 0);

  return NextResponse.json({
    payments: rows,
    agreed_rent_amount: tenant.agreed_rent_amount,
    summary: { totalPaid, disputedAmount, total: rows.length },
  });
}
