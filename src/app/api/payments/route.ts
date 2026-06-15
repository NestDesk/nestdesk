import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";

type BillingDataRow = {
  hostel_id: string;
  gst_number: string | null;
  pan_number: string | null;
  upi_id: string | null;
  billing_address: string | null;
};

type OwnerContext = {
  ownerId: string;
  hostelIds: string[];
  hostelMap: Map<
    string,
    {
      name: string;
      city: string;
      state: string;
      address: string | null;
      pincode: string | null;
    }
  >;
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
    .select("id, name, city, state, address, pincode")
    .eq("owner_id", owner.id);

  if (hostelsError) {
    return NextResponse.json({ error: hostelsError.message }, { status: 500 });
  }

  const hostelMap = new Map<
    string,
    {
      name: string;
      city: string;
      state: string;
      address: string | null;
      pincode: string | null;
    }
  >();
  for (const row of hostels ?? []) {
    hostelMap.set(row.id, {
      name: row.name,
      city: row.city,
      state: row.state,
      address: row.address ?? null,
      pincode: row.pincode ?? null,
    });
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
  for (let i = 0; i < arr.length; i += 1) {
    const byte = arr[i];
    suffix += chars[byte % chars.length];
  }
  return `ND-${yyyymm}-${suffix}`;
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

// GET /api/payments — Owner lists all payments across owned properties
export async function GET(request: NextRequest) {
  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.hostelIds.length === 0) {
    return NextResponse.json({
      payments: [],
      summary: { total: 0, paid: 0, disputed: 0 },
    });
  }

  const { searchParams } = new URL(request.url);
  const hostelFilter = searchParams.get("hostel_id");
  const monthFilter = searchParams.get("month"); // YYYY-MM
  const statusFilter = searchParams.get("status");
  const fromDate = searchParams.get("from"); // YYYY-MM-DD paid_on >=
  const toDate = searchParams.get("to"); // YYYY-MM-DD paid_on <=
  const tenantFilter = searchParams.get("tenant_id");

  const admin = createAdminClient();

  let query = admin
    .from("payments")
    .select(
      "id, tenant_id, hostel_id, amount, month, billing_start, billing_end, status, method, receipt_number, notes, paid_at, paid_on, recorded_by, created_at, updated_at",
    )
    .in("hostel_id", ctx.hostelIds)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (hostelFilter && ctx.hostelIds.includes(hostelFilter)) {
    query = query.eq("hostel_id", hostelFilter);
  }
  if (monthFilter) {
    const parsed = new Date(`${monthFilter}-01`);
    if (!isNaN(parsed.getTime())) {
      query = query.eq("month", `${monthFilter}-01`);
    }
  }
  if (statusFilter && ["paid", "disputed"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }
  if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    query = query.gte("paid_on", fromDate);
  }
  if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    query = query.lte("paid_on", toDate);
  }
  if (tenantFilter) {
    query = query.eq("tenant_id", tenantFilter);
  }

  const { data: payments, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = payments ?? [];

  const billingHostelIds = Array.from(
    new Set(rows.map((p) => p.hostel_id).filter(Boolean)),
  );
  const { data: billingData, error: billingError } = await admin
    .from("property_billing")
    .select("hostel_id, gst_number, pan_number, upi_id, billing_address")
    .in("hostel_id", billingHostelIds);

  if (billingError) {
    return NextResponse.json({ error: billingError.message }, { status: 500 });
  }

  const billingMap = new Map<string, BillingDataRow>(
    (billingData ?? []).map((entry) => [entry.hostel_id, entry as BillingDataRow]),
  );

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
    const billing = billingMap.get(p.hostel_id);
    const tenant = tenantMap.get(p.tenant_id);
    return {
      ...p,
      hostel_name: hostel?.name ?? "Property",
      hostel_location: hostel ? `${hostel.city}, ${hostel.state}` : null,
      hostel_address: hostel?.address ?? null,
      hostel_city: hostel?.city ?? null,
      hostel_state: hostel?.state ?? null,
      hostel_pincode: hostel?.pincode ?? null,
      hostel_billing_address: billing?.billing_address ?? null,
      hostel_gst_number: billing?.gst_number ?? null,
      hostel_pan_number: billing?.pan_number ?? null,
      hostel_upi_id: billing?.upi_id ?? null,
      tenant_name: tenant?.fullName ?? "Tenant",
      room_number: tenant?.roomNumber ?? null,
    };
  });

  const summary = rows.reduce(
    (acc, p) => {
      acc.total += Number(p.amount);
      if (p.status === "paid") acc.paid += Number(p.amount);
      else if (p.status === "disputed") acc.disputed += Number(p.amount);
      return acc;
    },
    { total: 0, paid: 0, disputed: 0 },
  );

  return NextResponse.json({ payments: responseRows, summary });
}

const createSchema = z.object({
  tenant_id: z.string().uuid("Invalid tenant."),
  hostel_id: z.string().uuid("Invalid property."),
  amount: z
    .number({ message: "Amount must be a number." })
    .min(0, "Amount cannot be negative.")
    .max(9999999, "Amount too large."),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM format."),
  billing_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Billing start must be YYYY-MM-DD."),
  billing_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Billing end must be YYYY-MM-DD."),
  method: z
    .enum(["cash", "upi", "bank_transfer", "razorpay", "other"])
    .nullable()
    .optional(),
  notes: z.string().max(1000, "Notes too long.").optional().nullable(),
  status: z.enum(["paid", "disputed"]).optional().default("paid"),
  paid_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "paid_on must be YYYY-MM-DD.")
    .optional(),
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
      { error: parsed.error.issues[0]?.message ?? "Validation error." },
      { status: 400 },
    );
  }

  const {
    tenant_id,
    hostel_id,
    amount,
    month,
    billing_start,
    billing_end,
    method,
    notes,
    status,
    paid_on,
  } = parsed.data;

  const today = todayString();
  const resolvedPaidOn = paid_on ?? today;

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
      billing_start,
      billing_end,
      status,
      method: method ?? null,
      notes: notes ?? null,
      receipt_number: receiptNumber,
      paid_at: isPaid ? now : null,
      paid_on: resolvedPaidOn,
      recorded_by: ctx.ownerId,
    })
    .select(
      "id, tenant_id, hostel_id, amount, month, billing_start, billing_end, status, method, receipt_number, notes, paid_at, paid_on, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hostel = ctx.hostelMap.get(payment.hostel_id);
  const { data: billingRows } = await admin
    .from("property_billing")
    .select("hostel_id, gst_number, pan_number, billing_address")
    .eq("hostel_id", payment.hostel_id);
  const billing = (billingRows ?? [])[0] as
    | {
        hostel_id: string;
        gst_number: string | null;
        pan_number: string | null;
        billing_address: string | null;
      }
    | undefined;
  type TenantRow = { full_name: string; rooms?: { room_number: string } | null };
  const tenantRow = tenant as unknown as TenantRow;

  return NextResponse.json({
    payment: {
      ...payment,
      hostel_name: hostel?.name ?? "Property",
      hostel_location: hostel ? `${hostel.city}, ${hostel.state}` : null,
      hostel_address: hostel?.address ?? null,
      hostel_city: hostel?.city ?? null,
      hostel_state: hostel?.state ?? null,
      hostel_pincode: hostel?.pincode ?? null,
      hostel_billing_address: billing?.billing_address ?? null,
      hostel_gst_number: billing?.gst_number ?? null,
      hostel_pan_number: billing?.pan_number ?? null,
      tenant_name: tenantRow.full_name,
      room_number:
        (tenantRow.rooms as { room_number: string } | null)?.room_number ?? null,
    },
  });
}
