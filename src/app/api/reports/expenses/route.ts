import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type SupabaseResponse<T> = { data: T | null; error: unknown };
type HostelSummary = { id: string; name: string };

type ExpenseRecord = {
  id: string;
  hostel_id: string;
  title: string;
  category: string | null;
  amount: string | number | null;
  expense_date: string | null;
  status: string;
  payment_mode: string | null;
  vendor_name: string | null;
  bill_number: string | null;
  notes: string | null;
};

async function getOwnerCtx() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
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
          totalExpenses: 0,
          paidExpenses: 0,
          pendingExpenses: 0,
          disputedExpenses: 0,
        },
        chart: [],
        table: [],
      },
    });
  }

  let expQ = admin
    .from("expenses")
    .select(
      "id, hostel_id, title, category, amount, expense_date, status, payment_mode, vendor_name, bill_number, notes",
    )
    .eq("owner_id", ctx.ownerId)
    .is("deleted_at", null)
    .in("hostel_id", scopedIds)
    .order("expense_date", { ascending: false });

  if (startDate) expQ = expQ.gte("expense_date", startDate);
  if (endDate) expQ = expQ.lte("expense_date", endDate);

  const { data: expenses } = (await expQ) as SupabaseResponse<ExpenseRecord[]>;

  const totalExpenses = (expenses ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0,
  );
  const paidExpenses = (expenses ?? [])
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const pendingExpenses = (expenses ?? [])
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const disputedExpenses = (expenses ?? [])
    .filter((row) => row.status === "disputed")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  const monthly = new Map<string, number>();
  for (const row of expenses ?? []) {
    const month = String(row.expense_date ?? "").slice(0, 7);
    if (!month) continue;
    monthly.set(month, (monthly.get(month) ?? 0) + Number(row.amount ?? 0));
  }

  const chart = Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));

  const table = (expenses ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category ?? "miscellaneous",
    hostel_name: hostelNameMap.get(row.hostel_id) ?? "—",
    amount: Number(row.amount ?? 0),
    expense_date: row.expense_date ?? "—",
    status: row.status,
    payment_mode: row.payment_mode ?? "—",
    vendor_name: row.vendor_name ?? "—",
    bill_number: row.bill_number ?? "—",
    notes: row.notes ?? "—",
  }));

  return NextResponse.json({
    data: {
      kpis: { totalExpenses, paidExpenses, pendingExpenses, disputedExpenses },
      chart,
      table,
    },
  });
}
