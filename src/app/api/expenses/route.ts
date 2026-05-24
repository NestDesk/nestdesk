import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_MODES,
  EXPENSE_RECURRING_FREQUENCIES,
  EXPENSE_STATUSES,
} from "@/lib/expenses";

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

function getMonthRange(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const from = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(from.getTime())) return null;
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const createSchema = z.object({
  hostel_id: z.string().uuid("Invalid property."),
  title: z
    .string()
    .min(2, "Title must be at least 2 characters.")
    .max(160, "Title too long."),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z
    .number({ message: "Amount must be a number." })
    .min(0, "Amount cannot be negative.")
    .max(9999999, "Amount too large."),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format."),
  status: z.enum(EXPENSE_STATUSES).optional().default("paid"),
  payment_mode: z.enum(EXPENSE_PAYMENT_MODES).nullable().optional(),
  vendor_name: z.string().max(120, "Vendor name too long.").nullable().optional(),
  bill_number: z.string().max(80, "Bill number too long.").nullable().optional(),
  notes: z.string().max(1000, "Notes too long.").nullable().optional(),
  is_recurring: z.boolean().optional().default(false),
  recurring_frequency: z.enum(EXPENSE_RECURRING_FREQUENCIES).nullable().optional(),
  next_due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Next due date must be YYYY-MM-DD format.")
    .nullable()
    .optional(),
});

// GET /api/expenses — Owner lists all expenses across owned properties
export async function GET(request: NextRequest) {
  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) return ctx;

  const hostels = Array.from(ctx.hostelMap.entries()).map(([id, value]) => ({
    id,
    name: value.name,
    location: `${value.city}, ${value.state}`,
  }));

  if (ctx.hostelIds.length === 0) {
    return NextResponse.json({
      expenses: [],
      hostels,
      summary: { total: 0, paid: 0, pending: 0, disputed: 0, this_month: 0 },
      property_totals: [],
      category_totals: [],
      monthly_totals: [],
    });
  }

  const { searchParams } = new URL(request.url);
  const hostelFilter = searchParams.get("hostel_id");
  const monthFilter = searchParams.get("month");
  const statusFilter = searchParams.get("status");
  const categoryFilter = searchParams.get("category");
  const queryText = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const admin = createAdminClient();

  let query = admin
    .from("expenses")
    .select(
      "id, owner_id, hostel_id, title, category, amount, expense_date, status, payment_mode, vendor_name, bill_number, notes, is_recurring, recurring_frequency, next_due_date, receipt_url, created_by, created_at, updated_at",
    )
    .in("hostel_id", ctx.hostelIds)
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (hostelFilter && ctx.hostelIds.includes(hostelFilter)) {
    query = query.eq("hostel_id", hostelFilter);
  }

  if (
    statusFilter &&
    EXPENSE_STATUSES.includes(statusFilter as (typeof EXPENSE_STATUSES)[number])
  ) {
    query = query.eq("status", statusFilter);
  }

  if (
    categoryFilter &&
    EXPENSE_CATEGORIES.includes(
      categoryFilter as (typeof EXPENSE_CATEGORIES)[number],
    )
  ) {
    query = query.eq("category", categoryFilter);
  }

  if (monthFilter) {
    const range = getMonthRange(monthFilter);
    if (range) {
      query = query.gte("expense_date", range.from).lt("expense_date", range.to);
    }
  }

  const { data: expenses, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = expenses ?? [];

  if (queryText.length > 0) {
    rows = rows.filter((row) => {
      const values = [
        row.title,
        row.vendor_name ?? "",
        row.bill_number ?? "",
        row.notes ?? "",
        row.category,
        ctx.hostelMap.get(row.hostel_id)?.name ?? "",
      ];
      return values.some((v) => v.toLowerCase().includes(queryText));
    });
  }

  const responseRows = rows.map((row) => {
    const hostel = ctx.hostelMap.get(row.hostel_id);
    return {
      ...row,
      hostel_name: hostel?.name ?? "Property",
      hostel_location: hostel ? `${hostel.city}, ${hostel.state}` : null,
    };
  });

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const summary = rows.reduce(
    (acc, row) => {
      const amount = Number(row.amount);
      acc.total += amount;
      if (row.status === "paid") acc.paid += amount;
      if (row.status === "pending") acc.pending += amount;
      if (row.status === "disputed") acc.disputed += amount;
      if (String(row.expense_date).slice(0, 7) === thisMonthKey) {
        acc.this_month += amount;
      }
      return acc;
    },
    { total: 0, paid: 0, pending: 0, disputed: 0, this_month: 0 },
  );

  const propertyMap = new Map<
    string,
    {
      hostel_id: string;
      hostel_name: string;
      hostel_location: string | null;
      total: number;
    }
  >();
  const categoryMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();

  for (const row of responseRows) {
    const amount = Number(row.amount);

    const existingProperty = propertyMap.get(row.hostel_id);
    if (existingProperty) {
      existingProperty.total += amount;
    } else {
      propertyMap.set(row.hostel_id, {
        hostel_id: row.hostel_id,
        hostel_name: row.hostel_name,
        hostel_location: row.hostel_location,
        total: amount,
      });
    }

    categoryMap.set(row.category, (categoryMap.get(row.category) ?? 0) + amount);

    const monthKey = String(row.expense_date).slice(0, 7);
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + amount);
  }

  const propertyTotals = Array.from(propertyMap.values()).sort(
    (a, b) => b.total - a.total,
  );

  const categoryTotals = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const monthlyTotals = Array.from(monthlyMap.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json({
    expenses: responseRows,
    hostels,
    summary,
    property_totals: propertyTotals,
    category_totals: categoryTotals,
    monthly_totals: monthlyTotals,
  });
}

// POST /api/expenses — Owner records an expense
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

  const data = parsed.data;

  if (!ctx.hostelIds.includes(data.hostel_id)) {
    return NextResponse.json(
      { error: "Property not found or access denied." },
      { status: 403 },
    );
  }

  if (data.is_recurring && !data.recurring_frequency) {
    return NextResponse.json(
      { error: "Recurring frequency is required for recurring expenses." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: expense, error } = await admin
    .from("expenses")
    .insert({
      owner_id: ctx.ownerId,
      hostel_id: data.hostel_id,
      title: data.title.trim(),
      category: data.category,
      amount: data.amount,
      expense_date: data.expense_date,
      status: data.status,
      payment_mode: data.payment_mode ?? null,
      vendor_name: data.vendor_name?.trim() || null,
      bill_number: data.bill_number?.trim() || null,
      notes: data.notes?.trim() || null,
      is_recurring: data.is_recurring,
      recurring_frequency: data.is_recurring
        ? (data.recurring_frequency ?? null)
        : null,
      next_due_date: data.is_recurring ? (data.next_due_date ?? null) : null,
      created_by: ctx.ownerId,
    })
    .select(
      "id, owner_id, hostel_id, title, category, amount, expense_date, status, payment_mode, vendor_name, bill_number, notes, is_recurring, recurring_frequency, next_due_date, receipt_url, created_by, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hostel = ctx.hostelMap.get(expense.hostel_id);

  return NextResponse.json({
    expense: {
      ...expense,
      hostel_name: hostel?.name ?? "Property",
      hostel_location: hostel ? `${hostel.city}, ${hostel.state}` : null,
    },
  });
}
