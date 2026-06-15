import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { calculateRent } from "../../../../lib/billing";

type SupabaseResponse<T> = { data: T | null; error: unknown };
type HostelSummary = { id: string; name: string };
type RoomRecord = { id: string; room_number: string };

type TenantCoverageRow = {
  id: string;
  full_name: string;
  room_id: string | null;
  phone: string | null;
  hostel_id: string;
  rent_start_date: string | null;
  agreed_rent_amount: number | null;
};

type PaidPaymentRecord = {
  tenant_id: string | null;
  billing_end: string | null;
};

function parseISODate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number) {
  const date = parseISODate(dateStr);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function calculatePendingBreakdown(
  monthlyRent: number,
  pendingFrom: string,
  pendingTo: string,
) {
  let cursor = parseISODate(pendingFrom);
  const end = parseISODate(pendingTo);
  const rows: Array<{ amount: number }> = [];

  while (cursor <= end) {
    const periodStart = new Date(cursor);
    const monthEnd = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth() + 1,
      0,
    );
    const periodEnd = monthEnd < end ? monthEnd : end;

    const calc = calculateRent(
      monthlyRent,
      toISODate(periodStart),
      toISODate(periodEnd),
    );

    rows.push({ amount: calc.payableAmount });
    cursor = new Date(periodEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return rows;
}

function bucketFromAging(agingDays: number) {
  if (agingDays <= 30) return "0–30 days";
  if (agingDays <= 60) return "31–60 days";
  if (agingDays <= 90) return "61–90 days";
  return "90+ days";
}

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

  const { data: tenants } = await admin
    .from("tenants")
    .select(
      "id, full_name, room_id, phone, hostel_id, rent_start_date, agreed_rent_amount",
    )
    .in("hostel_id", scopedIds)
    .eq("status", "active")
    .not("rent_start_date", "is", null)
    .gt("agreed_rent_amount", 0);

  const tenantIds = Array.from(
    new Set(((tenants ?? []) as TenantCoverageRow[]).map((t) => t.id)),
  );

  const paidByTenant: Record<string, string> = {};
  if (tenantIds.length) {
    const { data: paidPayments } = (await admin
      .from("payments")
      .select("tenant_id, billing_end")
      .in("tenant_id", tenantIds)
      .eq("status", "paid")
      .not("billing_end", "is", null)) as SupabaseResponse<PaidPaymentRecord[]>;

    (paidPayments ?? []).forEach((p) => {
      if (!p.tenant_id || !p.billing_end) return;
      const current = paidByTenant[p.tenant_id];
      if (!current || p.billing_end > current) {
        paidByTenant[p.tenant_id] = p.billing_end;
      }
    });
  }

  const disputedTenantIds = new Set<string>();
  if (tenantIds.length) {
    const { data: disputedRows } = (await admin
      .from("payments")
      .select("tenant_id")
      .in("tenant_id", tenantIds)
      .eq("status", "disputed")) as SupabaseResponse<Array<{ tenant_id: string }>>;
    (disputedRows ?? []).forEach((row) => {
      if (row.tenant_id) disputedTenantIds.add(row.tenant_id);
    });
  }

  const roomIds = Array.from(
    new Set(
      ((tenants ?? []) as TenantCoverageRow[])
        .map((t) => t.room_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const roomMap = new Map<string, string>();
  if (roomIds.length) {
    const { data: rooms } = (await admin
      .from("rooms")
      .select("id, room_number")
      .in("id", roomIds)) as SupabaseResponse<RoomRecord[]>;
    (rooms ?? []).forEach((room) => roomMap.set(room.id, room.room_number));
  }

  const today = toISODate(new Date());
  const rows = ((tenants ?? []) as TenantCoverageRow[])
    .map((tenant) => {
      if (!tenant.rent_start_date || tenant.agreed_rent_amount === null) return null;
      const coveredTill = paidByTenant[tenant.id] ?? null;
      const pendingFrom = coveredTill
        ? addDays(coveredTill, 1)
        : tenant.rent_start_date;

      if (pendingFrom > today) return null;

      const breakdown = calculatePendingBreakdown(
        Number(tenant.agreed_rent_amount),
        pendingFrom,
        today,
      );

      const amount = breakdown.reduce((sum, row) => sum + row.amount, 0);
      if (amount <= 0) return null;

      const agingDays = Math.max(
        0,
        Math.round(
          (parseISODate(today).getTime() - parseISODate(pendingFrom).getTime()) /
            86_400_000,
        ),
      );

      return {
        id: tenant.id,
        tenant_name: tenant.full_name,
        phone: tenant.phone ?? "—",
        room_number: tenant.room_id ? (roomMap.get(tenant.room_id) ?? "—") : "—",
        hostel_name: hostelNameMap.get(tenant.hostel_id) ?? "—",
        amount,
        month: pendingFrom.slice(0, 7),
        status: disputedTenantIds.has(tenant.id) ? "disputed" : "pending",
        aging_days: agingDays,
        bucket: bucketFromAging(agingDays),
      };
    })
    .filter(
      (
        row,
      ): row is {
        id: string;
        tenant_name: string;
        phone: string;
        room_number: string;
        hostel_name: string;
        amount: number;
        month: string;
        status: string;
        aging_days: number;
        bucket: string;
      } => Boolean(row),
    );

  const totalOverdue = rows.reduce((s, r) => s + r.amount, 0);
  const disputed = rows
    .filter((r) => r.status === "disputed")
    .reduce((s, r) => s + r.amount, 0);
  const bucket30 = rows
    .filter((r) => r.aging_days <= 30)
    .reduce((s, r) => s + r.amount, 0);

  // unique defaulters
  const uniqueTenants = new Set(rows.map((r) => r.id)).size;

  return NextResponse.json({
    data: {
      kpis: { totalDefaulters: uniqueTenants, totalOverdue, disputed, bucket30 },
      table: rows.sort((a, b) => b.aging_days - a.aging_days),
    },
  });
}
