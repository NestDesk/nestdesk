import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type SupabaseResponse<T> = { data: T | null; error: unknown };
type HostelSummary = { id: string; name: string };
type OverduePaymentRecord = {
  id: string;
  tenant_id: string | null;
  hostel_id: string;
  amount: string | number | null;
  month: string | null;
  status: string;
  paid_on: string | null;
};
type TenantContact = {
  id: string;
  full_name: string;
  room_id: string | null;
  phone: string | null;
};
type TenantMeta = Omit<TenantContact, "id">;
type RoomRecord = { id: string; room_number: string };

async function getOwnerCtx() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
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
  const hostelParam = url.searchParams.get("hostelIds");
  const admin = createAdminClient();

  const hostelNameMap = new Map(ctx.hostels.map((h) => [h.id, h.name]));
  const scopedIds = hostelParam
    ? hostelParam.split(",").filter((id) => ctx.hostelIds.includes(id))
    : ctx.hostelIds;

  if (!scopedIds.length) {
    return NextResponse.json({
      data: {
        kpis: { totalDefaulters: 0, totalOverdue: 0, disputed: 0, bucket30: 0 },
        table: [],
      },
    });
  }

  // All non-paid payments
  const { data: overdue } = (await admin
    .from("payments")
    .select("id, tenant_id, hostel_id, amount, month, status, paid_on")
    .in("hostel_id", scopedIds)
    .neq("status", "paid")) as SupabaseResponse<OverduePaymentRecord[]>;

  // tenant names
  const tIds = Array.from(
    new Set(
      (overdue ?? []).map((p) => p.tenant_id).filter((p): p is string => Boolean(p)),
    ),
  );
  const tMap = new Map<string, TenantMeta>();
  if (tIds.length) {
    const { data: tenants } = (await admin
      .from("tenants")
      .select("id, full_name, room_id, phone")
      .in("id", tIds)) as SupabaseResponse<TenantContact[]>;
    (tenants ?? []).forEach((t) =>
      tMap.set(t.id, { full_name: t.full_name, room_id: t.room_id, phone: t.phone }),
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

  const now = new Date();

  // Bucket by aging
  const rows = (overdue ?? []).map((p) => {
    const due = new Date(`${p.month}-01`);
    const agingDays = Math.max(
      0,
      Math.round((now.getTime() - due.getTime()) / 86400000),
    );
    const t = p.tenant_id ? tMap.get(p.tenant_id) : undefined;
    return {
      id: p.id,
      tenant_name: t?.full_name ?? "—",
      phone: t?.phone ?? "—",
      room_number: t?.room_id ? (rMap.get(t.room_id) ?? "—") : "—",
      hostel_name: hostelNameMap.get(p.hostel_id) ?? "—",
      amount: Number(p.amount),
      month: String(p.month),
      status: p.status,
      aging_days: agingDays,
      bucket:
        agingDays <= 30
          ? "0–30 days"
          : agingDays <= 60
            ? "31–60 days"
            : agingDays <= 90
              ? "61–90 days"
              : "90+ days",
    };
  });

  const totalOverdue = rows.reduce((s, r) => s + r.amount, 0);
  const disputed = rows
    .filter((r) => r.status === "disputed")
    .reduce((s, r) => s + r.amount, 0);
  const bucket30 = rows
    .filter((r) => r.aging_days <= 30)
    .reduce((s, r) => s + r.amount, 0);

  // unique defaulters
  const uniqueTenants = new Set(rows.map((r) => r.tenant_name)).size;

  return NextResponse.json({
    data: {
      kpis: { totalDefaulters: uniqueTenants, totalOverdue, disputed, bucket30 },
      table: rows.sort((a, b) => b.aging_days - a.aging_days),
    },
  });
}
