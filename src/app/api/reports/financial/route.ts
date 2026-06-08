import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type SupabaseResponse<T> = { data: T | null; error: unknown };
type HostelSummary = { id: string; name: string };
type PaymentRecord = {
  id: string;
  tenant_id: string | null;
  hostel_id: string;
  amount: string | number | null;
  month: string | null;
  status: string;
  method: string | null;
  paid_on: string | null;
  receipt_number: string | null;
};
type ExpenseRecord = {
  id: string;
  hostel_id: string;
  amount: string | number | null;
  expense_date: string | null;
  category: string | null;
  status: string;
};
type TenantRecord = { id: string; full_name: string; room_id: string | null };
type RoomRecord = { id: string; room_number: string };
type PaymentAmountRecord = { amount: string | number | null };

async function getOwnerCtx() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const admin = createAdminClient();
  const { data: owner } = (await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()) as SupabaseResponse<{ id: string }>;
  if (!owner) return null;
  const { data: hostels } = (await admin
    .from("hostels")
    .select("id, name")
    .eq("owner_id", owner.id)) as SupabaseResponse<HostelSummary[]>;
  return {
    ownerId: owner.id,
    hostels: hostels ?? [],
    hostelIds: (hostels ?? []).map((h) => h.id),
  };
}

export async function GET(req: NextRequest) {
  const ctx = await getOwnerCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const hostelParam = url.searchParams.get("hostelIds");
  const admin = createAdminClient();

  const hostelNameMap = new Map(ctx.hostels.map((h) => [h.id, h.name]));
  const scopedIds = hostelParam
    ? hostelParam.split(",").filter((id) => ctx.hostelIds.includes(id))
    : ctx.hostelIds;

  if (!scopedIds.length) {
    return NextResponse.json({
      data: {
        kpis: {
          totalCollected: 0,
          totalExpenses: 0,
          netOperatingIncome: 0,
          outstandingDues: 0,
        },
        chart: [],
        table: [],
      },
    });
  }

  // --- payments ---
  let payQ = admin
    .from("payments")
    .select(
      "id, tenant_id, hostel_id, amount, month, status, method, paid_on, receipt_number",
    )
    .in("hostel_id", scopedIds);
  if (startDate) payQ = payQ.gte("paid_on", startDate);
  if (endDate) payQ = payQ.lte("paid_on", endDate);
  const { data: payments } = (await payQ) as SupabaseResponse<PaymentRecord[]>;

  // outstanding (no date filter)
  const { data: unpaid } = (await admin
    .from("payments")
    .select("amount")
    .in("hostel_id", scopedIds)
    .neq("status", "paid")) as SupabaseResponse<PaymentAmountRecord[]>;

  // --- expenses ---
  let expQ = admin
    .from("expenses")
    .select("id, hostel_id, amount, expense_date, category, status")
    .eq("owner_id", ctx.ownerId)
    .is("deleted_at", null)
    .in("hostel_id", scopedIds);
  if (startDate) expQ = expQ.gte("expense_date", startDate);
  if (endDate) expQ = expQ.lte("expense_date", endDate);
  const { data: expenses } = (await expQ) as SupabaseResponse<ExpenseRecord[]>;

  // --- tenant / room names for table ---
  const tIds = Array.from(
    new Set(
      (payments ?? [])
        .map((p) => p.tenant_id)
        .filter((p): p is string => Boolean(p)),
    ),
  );
  const tMap = new Map<string, { full_name: string; room_id: string | null }>();
  if (tIds.length) {
    const { data: tenants } = (await admin
      .from("tenants")
      .select("id, full_name, room_id")
      .in("id", tIds)) as SupabaseResponse<TenantRecord[]>;
    (tenants ?? []).forEach((t) =>
      tMap.set(t.id, { full_name: t.full_name, room_id: t.room_id }),
    );
  }
  const rIds = Array.from(
    new Set(
      Array.from(tMap.values())
        .map((t) => t.room_id)
        .filter((x): x is string => !!x),
    ),
  );
  const rMap = new Map<string, string>();
  if (rIds.length) {
    const { data: rooms } = (await admin
      .from("rooms")
      .select("id, room_number")
      .in("id", rIds)) as SupabaseResponse<RoomRecord[]>;
    (rooms ?? []).forEach((r) => rMap.set(r.id, r.room_number));
  }

  // --- KPIs ---
  const totalCollected = (payments ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalExpenses = (expenses ?? [])
    .filter((e) => e.status === "paid")
    .reduce((s, e) => s + Number(e.amount), 0);
  const outstandingDues = (unpaid ?? []).reduce((s, p) => s + Number(p.amount), 0);

  // --- monthly chart ---
  const mMap = new Map<string, { income: number; expenses: number }>();
  for (const p of payments ?? []) {
    if (p.status !== "paid" || !p.paid_on) continue;
    const m = String(p.paid_on).slice(0, 7);
    const e = mMap.get(m) ?? { income: 0, expenses: 0 };
    e.income += Number(p.amount);
    mMap.set(m, e);
  }
  for (const e of expenses ?? []) {
    if (e.status !== "paid") continue;
    const m = String(e.expense_date).slice(0, 7);
    const entry = mMap.get(m) ?? { income: 0, expenses: 0 };
    entry.expenses += Number(e.amount);
    mMap.set(m, entry);
  }
  const chart = Array.from(mMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      income: d.income,
      expenses: d.expenses,
      noi: d.income - d.expenses,
    }));

  // --- table rows ---
  const table = (payments ?? []).map((p) => {
    const t = p.tenant_id ? tMap.get(p.tenant_id) : undefined;
    return {
      id: p.id,
      tenant_name: t?.full_name ?? "—",
      room_number: t?.room_id ? (rMap.get(t.room_id) ?? "—") : "—",
      hostel_name: hostelNameMap.get(p.hostel_id) ?? "—",
      amount: Number(p.amount),
      month: String(p.month),
      status: p.status,
      method: p.method ?? "—",
      paid_on: p.paid_on,
      receipt_number: p.receipt_number,
    };
  });

  return NextResponse.json({
    data: {
      kpis: {
        totalCollected,
        totalExpenses,
        netOperatingIncome: totalCollected - totalExpenses,
        outstandingDues,
      },
      chart,
      table,
    },
  });
}
