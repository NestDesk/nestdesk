import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type SupabaseResponse<T> = { data: T | null; error: unknown };
type HostelSummary = { id: string; name: string };
type MaintenanceRequestRecord = {
  id: string;
  hostel_id: string;
  room_id: string | null;
  title: string;
  category: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
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
  const { data: hostels } = await admin
    .from("hostels")
    .select("id, name")
    .eq("owner_id", owner.id);
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
        kpis: { total: 0, open: 0, avgResolutionDays: 0, completed: 0 },
        chart: [],
        table: [],
      },
    });
  }

  let q = admin
    .from("maintenance_requests")
    .select(
      "id, hostel_id, room_id, title, category, status, created_at, updated_at, deleted_at",
    )
    .in("hostel_id", scopedIds)
    .is("deleted_at", null);
  if (startDate) q = q.gte("created_at", startDate);
  if (endDate) q = q.lte("created_at", endDate + "T23:59:59");
  const { data: requests } = (await q) as SupabaseResponse<
    MaintenanceRequestRecord[]
  >;

  const rIds = Array.from(
    new Set((requests ?? []).map((r) => r.room_id).filter((x): x is string => !!x)),
  );
  const rMap = new Map<string, string>();
  if (rIds.length) {
    const { data: rooms } = (await admin
      .from("rooms")
      .select("id, room_number")
      .in("id", rIds)) as SupabaseResponse<RoomRecord[]>;
    (rooms ?? []).forEach((r) => rMap.set(r.id, r.room_number));
  }

  const total = (requests ?? []).length;
  const open = (requests ?? []).filter((r) =>
    ["open", "in_progress"].includes(r.status),
  ).length;
  const completed = (requests ?? []).filter((r) =>
    ["completed", "resolved", "closed"].includes(r.status),
  ).length;

  // avg resolution for completed tickets (created→updated as proxy)
  const resolutions = (requests ?? [])
    .filter((r) => ["completed", "resolved", "closed"].includes(r.status))
    .map((r) => {
      const a = new Date(r.created_at).getTime();
      const b = new Date(r.updated_at).getTime();
      return Math.max(0, Math.round((b - a) / 86400000));
    });
  const avgResolutionDays = resolutions.length
    ? Math.round(resolutions.reduce((a, b) => a + b, 0) / resolutions.length)
    : 0;

  // chart: ticket count by property
  const chart = scopedIds.map((hid) => ({
    property: hostelNameMap.get(hid) ?? hid,
    total: (requests ?? []).filter((r) => r.hostel_id === hid).length,
    open: (requests ?? []).filter(
      (r) => r.hostel_id === hid && ["open", "in_progress"].includes(r.status),
    ).length,
    completed: (requests ?? []).filter(
      (r) =>
        r.hostel_id === hid &&
        ["completed", "resolved", "closed"].includes(r.status),
    ).length,
  }));

  // table rows
  const table = (requests ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category ?? "—",
    hostel_name: hostelNameMap.get(r.hostel_id) ?? "—",
    room_number: r.room_id ? (rMap.get(r.room_id) ?? "—") : "—",
    status: r.status,
    created_at: String(r.created_at).slice(0, 10),
    updated_at: String(r.updated_at).slice(0, 10),
  }));

  return NextResponse.json({
    data: { kpis: { total, open, avgResolutionDays, completed }, chart, table },
  });
}
