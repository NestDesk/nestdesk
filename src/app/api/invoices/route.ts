import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateRent,
  getFirstBillingPeriod,
  getFullMonthPeriod,
  getFinalBillingPeriod,
} from "@/lib/billing";

// ─── Auth helper (mirrors pattern in /api/payments) ──────────────────────────

type OwnerContext = {
  ownerId: string;
  hostelIds: string[];
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

  const { data: hostels } = await admin
    .from("hostels")
    .select("id")
    .eq("owner_id", owner.id);

  return {
    ownerId: owner.id,
    hostelIds: (hostels ?? []).map((h: { id: string }) => h.id),
  };
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  const suffix = Array.from(arr)
    .map((b) => chars[b % chars.length])
    .join("");
  return `INV-${yyyymm}-${suffix}`;
}

// ─── GET /api/invoices ────────────────────────────────────────────────────────
// Query params: tenant_id, hostel_id, status, from (YYYY-MM-DD), to (YYYY-MM-DD)

export async function GET(request: NextRequest) {
  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.hostelIds.length === 0) return NextResponse.json({ invoices: [] });

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenant_id");
  const hostelId = searchParams.get("hostel_id");
  const status = searchParams.get("status");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");

  const admin = createAdminClient();
  let query = admin
    .from("invoices")
    .select("*")
    .in("hostel_id", ctx.hostelIds)
    .is("deleted_at", null)
    .order("billing_start", { ascending: false });

  if (tenantId) query = query.eq("tenant_id", tenantId);

  if (hostelId && ctx.hostelIds.includes(hostelId)) {
    query = query.eq("hostel_id", hostelId);
  }

  const validStatuses = ["draft", "issued", "paid", "overdue", "waived"];
  if (status && validStatuses.includes(status)) {
    query = query.eq("status", status);
  }

  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  if (fromDate && isoRe.test(fromDate)) query = query.gte("billing_start", fromDate);
  if (toDate && isoRe.test(toDate)) query = query.lte("billing_start", toDate);

  const { data: invoices, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ invoices: [] });
  }

  // Enrich with tenant + hostel display names
  const uniqueTenantIds = [
    ...new Set(invoices.map((i: { tenant_id: string }) => i.tenant_id)),
  ];
  const uniqueHostelIds = [
    ...new Set(invoices.map((i: { hostel_id: string }) => i.hostel_id)),
  ];

  const [{ data: tenantRows }, { data: hostelRows }] = await Promise.all([
    admin
      .from("tenants")
      .select("id, full_name, rooms(room_number)")
      .in("id", uniqueTenantIds),
    admin.from("hostels").select("id, name, city, state").in("id", uniqueHostelIds),
  ]);

  const tenantMap = new Map(
    (tenantRows ?? []).map(
      (t: {
        id: string;
        full_name: string;
        rooms: Array<{ room_number: string }> | null;
      }) => [
        t.id,
        {
          fullName: t.full_name,
          roomNumber: t.rooms?.[0]?.room_number ?? null,
        },
      ],
    ),
  );

  const hostelMap = new Map(
    (hostelRows ?? []).map(
      (h: { id: string; name: string; city: string; state: string }) => [
        h.id,
        { name: h.name, location: `${h.city}, ${h.state}` },
      ],
    ),
  );

  const enriched = invoices.map((inv: Record<string, unknown>) => ({
    ...inv,
    tenant_name: tenantMap.get(inv.tenant_id as string)?.fullName ?? "Tenant",
    room_number: tenantMap.get(inv.tenant_id as string)?.roomNumber ?? null,
    hostel_name: hostelMap.get(inv.hostel_id as string)?.name ?? "Property",
    hostel_location: hostelMap.get(inv.hostel_id as string)?.location ?? null,
  }));

  return NextResponse.json({ invoices: enriched });
}

// ─── POST /api/invoices ───────────────────────────────────────────────────────

const createSchema = z.object({
  tenant_id: z.string().uuid("Invalid tenant_id"),
  /**
   * Explicit billing period. If both provided, `invoice_type` is used only
   * as a label override. If omitted the type drives the auto-calculation.
   */
  billing_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "billing_start must be YYYY-MM-DD")
    .optional(),
  billing_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "billing_end must be YYYY-MM-DD")
    .optional(),
  /**
   * Determines how the billing period is computed when no explicit dates
   * are supplied.
   *   first_partial  — from rent_start_date to end of that month
   *   full_month     — requires full_month_year + full_month_month
   *   final_partial  — from 1st of move_out_date month to move_out_date
   *   custom         — must supply explicit billing_start + billing_end
   */
  invoice_type: z
    .enum(["first_partial", "full_month", "final_partial", "custom"])
    .optional()
    .default("first_partial"),
  /** Required when invoice_type = "full_month" and no explicit dates given */
  full_month_year: z.number().int().min(2000).max(2100).optional(),
  /** 1-indexed month, 1–12. Required with full_month_year. */
  full_month_month: z.number().int().min(1).max(12).optional(),
  notes: z.string().max(1000).optional().nullable(),
  status: z.enum(["draft", "issued"]).optional().default("issued"),
});

export async function POST(request: NextRequest) {
  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error." },
      { status: 422 },
    );
  }

  const {
    tenant_id,
    billing_start,
    billing_end,
    invoice_type,
    full_month_year,
    full_month_month,
    notes,
    status,
  } = parsed.data;

  const admin = createAdminClient();

  // Load tenant — verify ownership and read billing inputs
  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select(
      "id, hostel_id, agreed_rent_amount, join_date, rent_start_date, move_out_date, status",
    )
    .eq("id", tenant_id)
    .in("hostel_id", ctx.hostelIds)
    .maybeSingle();

  if (tenantErr || !tenant) {
    return NextResponse.json(
      { error: "Tenant not found or you don't have access." },
      { status: 404 },
    );
  }

  const monthlyRent = Number(tenant.agreed_rent_amount);
  if (!isFinite(monthlyRent) || monthlyRent <= 0) {
    return NextResponse.json(
      { error: "Tenant has no agreed rent amount configured." },
      { status: 422 },
    );
  }

  const rentStart = tenant.rent_start_date ?? tenant.join_date;
  if (!rentStart) {
    return NextResponse.json(
      { error: "Tenant has no rent start date. Please set join_date first." },
      { status: 422 },
    );
  }

  // Compute the billing period
  let calc;
  try {
    if (billing_start && billing_end) {
      // Explicit period supplied by caller
      calc = calculateRent(monthlyRent, billing_start, billing_end, invoice_type);
    } else if (invoice_type === "full_month") {
      if (!full_month_year || !full_month_month) {
        return NextResponse.json(
          {
            error:
              "full_month_year and full_month_month are required for full_month invoice type.",
          },
          { status: 422 },
        );
      }
      calc = getFullMonthPeriod(full_month_year, full_month_month, monthlyRent);
    } else if (invoice_type === "final_partial") {
      if (!tenant.move_out_date) {
        return NextResponse.json(
          { error: "Tenant has no move_out_date set." },
          { status: 422 },
        );
      }
      calc = getFinalBillingPeriod(tenant.move_out_date, monthlyRent);
    } else {
      // Default: first billing period from rent_start_date
      calc = getFirstBillingPeriod(rentStart, monthlyRent);
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }

  const { data: invoice, error: insertErr } = await admin
    .from("invoices")
    .insert({
      tenant_id,
      hostel_id: tenant.hostel_id,
      billing_start: calc.billingStart,
      billing_end: calc.billingEnd,
      monthly_rent: calc.monthlyRent,
      days_in_month: calc.daysInMonth,
      occupied_days: calc.occupiedDays,
      per_day_rent: calc.perDayRent,
      payable_amount: calc.payableAmount,
      is_prorated: calc.isProrated,
      invoice_type: calc.invoiceType,
      status,
      notes: notes ?? null,
      generated_by: ctx.ownerId,
      invoice_number: generateInvoiceNumber(),
    })
    .select("*")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ invoice }, { status: 201 });
}
