import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, agreed_rent_amount")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant account not found." },
      { status: 403 },
    );
  }

  const { data: payments, error } = await admin
    .from("payments")
    .select(
      "id, amount, month, status, method, receipt_number, notes, paid_at, created_at",
    )
    .eq("tenant_id", tenant.id)
    .order("month", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = payments ?? [];
  const totalPaid = rows
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  const pendingAmount = rows
    .filter((p) => p.status === "pending" || p.status === "overdue")
    .reduce((s, p) => s + Number(p.amount), 0);

  return NextResponse.json({
    payments: rows,
    agreed_rent_amount: tenant.agreed_rent_amount,
    summary: { totalPaid, pendingAmount, total: rows.length },
  });
}
