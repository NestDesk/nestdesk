import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type OwnerContext = {
  ownerId: string;
  hostelIds: string[];
  hostelMap: Map<string, { name: string; city: string; state: string }>;
};

async function getOwnerContext(): Promise<OwnerContext | NextResponse> {
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

  const { data: hostels, error: hostelsError } = await admin
    .from("hostels")
    .select("id, name, city, state")
    .eq("owner_id", owner.id);

  if (hostelsError) {
    return NextResponse.json({ error: hostelsError.message }, { status: 500 });
  }

  const hostelMap = new Map<string, { name: string; city: string; state: string }>();
  for (const row of hostels ?? []) {
    hostelMap.set(row.id, { name: row.name, city: row.city, state: row.state });
  }

  return {
    ownerId: owner.id,
    hostelIds: Array.from(hostelMap.keys()),
    hostelMap,
  };
}

function generateReceiptNumber(): string {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (const byte of arr) {
    suffix += chars[byte % chars.length];
  }
  return `ND-${yyyymm}-${suffix}`;
}

// GET /api/payments — Owner lists all payments across owned properties
export async function GET(request: NextRequest) {
  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.hostelIds.length === 0) {
    return NextResponse.json({
      payments: [],
      summary: { total: 0, paid: 0, pending: 0, overdue: 0, disputed: 0 },
    });
  }

  const { searchParams } = new URL(request.url);
  const hostelFilter = searchParams.get("hostel_id");
  const monthFilter = searchParams.get("month"); // YYYY-MM
  const statusFilter = searchParams.get("status");

  const admin = createAdminClient();

  let query = admin
    .from("payments")
    .select(
      "id, tenant_id, hostel_id, amount, month, status, method, receipt_number, notes, paid_at, recorded_by, created_at, updated_at",
    )
    .in("hostel_id", ctx.hostelIds)
    .order("created_at", { ascending: false });

  if (hostelFilter && ctx.hostelIds.includes(hostelFilter)) {
    query = query.eq("hostel_id", hostelFilter);
  }
  if (monthFilter) {
    // month stored as DATE first-of-month: "2026-05-01"
    const parsed = new Date(`${monthFilter}-01`);
    if (!isNaN(parsed.getTime())) {
      query = query.eq("month", `${monthFilter}-01`);
    }
  }
  if (
    statusFilter &&
    ["pending", "paid", "overdue", "disputed"].includes(statusFilter)
  ) {
    query = query.eq("status", statusFilter);
  }

  const { data: payments, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = payments ?? [];

  const tenantIds = Array.from(
    new Set(rows.map((p) => p.tenant_id).filter((v): v is string => !!v)),
  );

  const { data: tenants } = tenantIds.length
    ? await admin
        .from("tenants")
        .select("id, full_name, room_id, rooms(room_number)")
        .in("id", tenantIds)
    : {
        data: [] as Array<{ id: string; full_name: string; room_id: string | null }>,
      };

  type TenantRow = {
    id: string;
    full_name: string;
    room_id: string | null;
    rooms?: { room_number: string } | null;
  };
  const tenantMap = new Map<
    string,
    { fullName: string; roomNumber: string | null }
  >();
  for (const t of (tenants ?? []) as TenantRow[]) {
    tenantMap.set(t.id, {
      fullName: t.full_name,
      roomNumber: (t.rooms as { room_number: string } | null)?.room_number ?? null,
    });
  }

  const responseRows = rows.map((p) => {
    const hostel = ctx.hostelMap.get(p.hostel_id);
    const tenant = tenantMap.get(p.tenant_id);
    return {
      ...p,
      hostel_name: hostel?.name ?? "Property",
      hostel_location: hostel ? `${hostel.city}, ${hostel.state}` : null,
      tenant_name: tenant?.fullName ?? "Tenant",
      room_number: tenant?.roomNumber ?? null,
    };
  });

  const summary = rows.reduce(
    (acc, p) => {
      acc.total += Number(p.amount);
      if (p.status === "paid") acc.paid += Number(p.amount);
      else if (p.status === "pending") acc.pending += Number(p.amount);
      else if (p.status === "overdue") acc.overdue += Number(p.amount);
      else if (p.status === "disputed") acc.disputed += Number(p.amount);
      return acc;
    },
    { total: 0, paid: 0, pending: 0, overdue: 0, disputed: 0 },
  );

  return NextResponse.json({ payments: responseRows, summary });
}

const createSchema = z.object({
  tenant_id: z.string().uuid("Invalid tenant."),
  hostel_id: z.string().uuid("Invalid property."),
  amount: z
    .number({ invalid_type_error: "Amount must be a number." })
    .min(0, "Amount cannot be negative.")
    .max(9999999, "Amount too large."),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM format."),
  method: z
    .enum(["cash", "upi", "bank_transfer", "razorpay", "other"])
    .nullable()
    .optional(),
  notes: z.string().max(1000, "Notes too long.").optional().nullable(),
  status: z
    .enum(["pending", "paid", "overdue", "disputed"])
    .optional()
    .default("pending"),
});

// POST /api/payments — Owner records a new payment
export async function POST(request: NextRequest) {
  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Validation error." },
      { status: 400 },
    );
  }

  const { tenant_id, hostel_id, amount, month, method, notes, status } = parsed.data;

  if (!ctx.hostelIds.includes(hostel_id)) {
    return NextResponse.json(
      { error: "Property not found or access denied." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // Verify tenant belongs to this hostel and owner
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, full_name, room_id, rooms(room_number)")
    .eq("id", tenant_id)
    .eq("hostel_id", hostel_id)
    .eq("owner_id", ctx.ownerId)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant not found or access denied." },
      { status: 403 },
    );
  }

  const isPaid = status === "paid";
  const now = new Date().toISOString();
  const receiptNumber = isPaid ? generateReceiptNumber() : null;

  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      tenant_id,
      hostel_id,
      amount,
      month: `${month}-01`,
      status,
      method: method ?? null,
      notes: notes ?? null,
      receipt_number: receiptNumber,
      paid_at: isPaid ? now : null,
      recorded_by: ctx.ownerId,
    })
    .select(
      "id, tenant_id, hostel_id, amount, month, status, method, receipt_number, notes, paid_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hostel = ctx.hostelMap.get(payment.hostel_id);
  type TenantRow = { full_name: string; rooms?: { room_number: string } | null };
  const tenantRow = tenant as unknown as TenantRow;

  return NextResponse.json({
    payment: {
      ...payment,
      hostel_name: hostel?.name ?? "Property",
      hostel_location: hostel ? `${hostel.city}, ${hostel.state}` : null,
      tenant_name: tenantRow.full_name,
      room_number:
        (tenantRow.rooms as { room_number: string } | null)?.room_number ?? null,
    },
  });
}
