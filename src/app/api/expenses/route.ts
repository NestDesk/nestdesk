import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_MODES,
  EXPENSE_RECURRING_FREQUENCIES,
  EXPENSE_STATUSES,
} from "../../../lib/expenses";

type OwnerContext = {
  ownerId: string;
  hostelIds: string[];
  hostelMap: Map<
    string,
    { name: string; city: string; state: string; onboarded_at: string }
  >;
};

type ExpenseRecord = {
  id: string;
  owner_id: string;
  hostel_id: string;
  title: string;
  category: (typeof EXPENSE_CATEGORIES)[number];
  amount: number;
  expense_date: string;
  status: (typeof EXPENSE_STATUSES)[number];
  payment_mode: (typeof EXPENSE_PAYMENT_MODES)[number] | null;
  vendor_name: string | null;
  bill_number: string | null;
  notes: string | null;
  is_recurring: boolean;
  recurring_frequency: (typeof EXPENSE_RECURRING_FREQUENCIES)[number] | null;
  next_due_date: string | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const EXPENSE_SELECT =
  "id, owner_id, hostel_id, title, category, amount, expense_date, status, payment_mode, vendor_name, bill_number, notes, is_recurring, recurring_frequency, next_due_date, receipt_url, created_by, created_at, updated_at";

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
    .select("id, name, city, state, created_at")
    .eq("owner_id", owner.id);

  if (hostelsError) {
    return NextResponse.json({ error: hostelsError.message }, { status: 500 });
  }

  const hostelMap = new Map<
    string,
    { name: string; city: string; state: string; onboarded_at: string }
  >();
  for (const row of hostels ?? []) {
    hostelMap.set(row.id, {
      name: row.name,
      city: row.city,
      state: row.state,
      onboarded_at: String(row.created_at).slice(0, 10),
    });
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

function monthKey(dateValue: Date) {
  return `${dateValue.getUTCFullYear()}-${String(dateValue.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toDateOnly(dateValue: Date) {
  return dateValue.toISOString().slice(0, 10);
}

function parseDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function addMonthsISO(dateStr: string, months: number) {
  const source = parseDate(dateStr);
  if (Number.isNaN(source.getTime())) return dateStr;

  const sourceDay = source.getUTCDate();
  const target = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(sourceDay, lastDay));
  return toDateOnly(target);
}

function addDaysISO(dateStr: string, days: number) {
  const source = parseDate(dateStr);
  if (Number.isNaN(source.getTime())) return dateStr;

  const target = new Date(
    Date.UTC(
      source.getUTCFullYear(),
      source.getUTCMonth(),
      source.getUTCDate() + days,
    ),
  );
  return toDateOnly(target);
}

function nextRecurringDate(
  dateStr: string,
  frequency: (typeof EXPENSE_RECURRING_FREQUENCIES)[number],
) {
  if (frequency === "daily") return addDaysISO(dateStr, 1);
  if (frequency === "monthly") return addMonthsISO(dateStr, 1);
  if (frequency === "quarterly") return addMonthsISO(dateStr, 3);
  return addMonthsISO(dateStr, 12);
}

function makeExpenseKey(row: {
  hostel_id: string;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  vendor_name: string | null;
  bill_number: string | null;
}) {
  return [
    row.hostel_id,
    row.title.trim().toLowerCase(),
    row.category,
    Number(row.amount).toFixed(2),
    row.expense_date,
    (row.vendor_name ?? "").trim().toLowerCase(),
    (row.bill_number ?? "").trim().toLowerCase(),
  ].join("|");
}

function buildMonthOptions(fromDate: string, toDate: Date = new Date()) {
  const start = parseDate(fromDate);
  if (Number.isNaN(start.getTime())) return [] as string[];

  const months: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const end = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), 1));

  while (cursor.getTime() <= end.getTime()) {
    months.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months.sort((a, b) => b.localeCompare(a));
}

async function materializeRecurringExpenses(
  ctx: OwnerContext,
): Promise<NextResponse | null> {
  if (ctx.hostelIds.length === 0) return null;

  const admin = createAdminClient();
  const today = toDateOnly(new Date());

  const { data: recurringRows, error: recurringError } = await admin
    .from("expenses")
    .select(
      "id, owner_id, hostel_id, title, category, amount, expense_date, status, payment_mode, vendor_name, bill_number, notes, is_recurring, recurring_frequency, next_due_date, receipt_url, created_by, created_at, updated_at",
    )
    .eq("owner_id", ctx.ownerId)
    .in("hostel_id", ctx.hostelIds)
    .eq("is_recurring", true)
    .not("recurring_frequency", "is", null)
    .not("next_due_date", "is", null)
    .is("deleted_at", null);

  if (recurringError) {
    return NextResponse.json({ error: recurringError.message }, { status: 500 });
  }

  if (!recurringRows || recurringRows.length === 0) return null;

  const { data: existingRows, error: existingError } = await admin
    .from("expenses")
    .select(
      "hostel_id, title, category, amount, expense_date, vendor_name, bill_number",
    )
    .eq("owner_id", ctx.ownerId)
    .in("hostel_id", ctx.hostelIds)
    .is("deleted_at", null);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existingKeys = new Set(
    (existingRows ?? []).map((row) =>
      makeExpenseKey({
        hostel_id: row.hostel_id,
        title: row.title,
        category: row.category,
        amount: Number(row.amount),
        expense_date: row.expense_date,
        vendor_name: row.vendor_name,
        bill_number: row.bill_number,
      }),
    ),
  );

  const inserts: Array<Record<string, unknown>> = [];
  const nextDueUpdates: Array<{ id: string; next_due_date: string }> = [];

  for (const recurring of recurringRows as ExpenseRecord[]) {
    if (!recurring.recurring_frequency || !recurring.next_due_date) continue;

    let dueDate = recurring.next_due_date;
    let changed = false;
    let guard = 0;

    while (dueDate <= today && guard < 365) {
      const key = makeExpenseKey({
        hostel_id: recurring.hostel_id,
        title: recurring.title,
        category: recurring.category,
        amount: Number(recurring.amount),
        expense_date: dueDate,
        vendor_name: recurring.vendor_name,
        bill_number: recurring.bill_number,
      });

      if (!existingKeys.has(key)) {
        inserts.push({
          owner_id: recurring.owner_id,
          hostel_id: recurring.hostel_id,
          title: recurring.title,
          category: recurring.category,
          amount: Number(recurring.amount),
          expense_date: dueDate,
          status: recurring.status,
          payment_mode: recurring.payment_mode,
          vendor_name: recurring.vendor_name,
          bill_number: recurring.bill_number,
          notes: recurring.notes,
          is_recurring: false,
          recurring_frequency: null,
          next_due_date: null,
          receipt_url: recurring.receipt_url,
          created_by: recurring.created_by ?? ctx.ownerId,
        });
        existingKeys.add(key);
      }

      dueDate = nextRecurringDate(dueDate, recurring.recurring_frequency);
      changed = true;
      guard += 1;
    }

    if (changed && dueDate !== recurring.next_due_date) {
      nextDueUpdates.push({ id: recurring.id, next_due_date: dueDate });
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await admin.from("expenses").insert(inserts);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  if (nextDueUpdates.length > 0) {
    for (const update of nextDueUpdates) {
      const { error: updateError } = await admin
        .from("expenses")
        .update({ next_due_date: update.next_due_date })
        .eq("id", update.id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }
  }

  return null;
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
    onboarded_at: value.onboarded_at,
  }));

  if (ctx.hostelIds.length === 0) {
    return NextResponse.json({
      expenses: [],
      hostels,
      summary: { total: 0, paid: 0, pending: 0, disputed: 0, this_month: 0 },
      scope_onboarded_at: null,
      month_options: [],
      current_month_range: { start: null, end: null },
      current_month_property_totals: [],
      current_month_daily_totals: [],
      recurring_templates: [],
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

  const selectedHostelIds =
    hostelFilter && ctx.hostelIds.includes(hostelFilter)
      ? [hostelFilter]
      : ctx.hostelIds;

  const selectedHostelMeta = selectedHostelIds
    .map((id) => ({ id, meta: ctx.hostelMap.get(id) }))
    .filter(
      (
        item,
      ): item is {
        id: string;
        meta: NonNullable<
          OwnerContext["hostelMap"] extends Map<string, infer T> ? T : never
        >;
      } => Boolean(item.meta),
    );

  const onboardedDates = selectedHostelMeta.map((item) => item.meta.onboarded_at);
  const scopeOnboardedAt =
    onboardedDates.length > 0
      ? onboardedDates.sort((a, b) => a.localeCompare(b))[0]
      : null;

  const monthOptions = scopeOnboardedAt ? buildMonthOptions(scopeOnboardedAt) : [];

  const recurringSyncError = await materializeRecurringExpenses(ctx);
  if (recurringSyncError) return recurringSyncError;

  const admin = createAdminClient();

  const { data: allExpenses, error } = await admin
    .from("expenses")
    .select(EXPENSE_SELECT)
    .in("hostel_id", selectedHostelIds)
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allRows = (allExpenses ?? []) as ExpenseRecord[];
  let rows = allRows;

  if (
    statusFilter &&
    EXPENSE_STATUSES.includes(statusFilter as (typeof EXPENSE_STATUSES)[number])
  ) {
    rows = rows.filter((row) => row.status === statusFilter);
  }

  if (
    categoryFilter &&
    EXPENSE_CATEGORIES.includes(
      categoryFilter as (typeof EXPENSE_CATEGORIES)[number],
    )
  ) {
    rows = rows.filter((row) => row.category === categoryFilter);
  }

  if (monthFilter) {
    const range = getMonthRange(monthFilter);
    if (range) {
      rows = rows.filter(
        (row) => row.expense_date >= range.from && row.expense_date < range.to,
      );
    }
  }

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

  const summary = allRows.reduce(
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
  const thisMonthPropertyMap = new Map<
    string,
    {
      hostel_id: string;
      hostel_name: string;
      hostel_location: string | null;
      total: number;
    }
  >();

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const dailyMap = new Map<string, number>();
  for (let day = 1; day <= thisMonthEnd.getDate(); day += 1) {
    const key = `${thisMonthKey}-${String(day).padStart(2, "0")}`;
    dailyMap.set(key, 0);
  }

  for (const row of allRows.map((item) => {
    const hostel = ctx.hostelMap.get(item.hostel_id);
    return {
      ...item,
      hostel_name: hostel?.name ?? "Property",
      hostel_location: hostel ? `${hostel.city}, ${hostel.state}` : null,
    };
  })) {
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

    if (monthKey === thisMonthKey) {
      const dayKey = row.expense_date;
      if (dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + amount);
      }

      const thisMonthExisting = thisMonthPropertyMap.get(row.hostel_id);
      if (thisMonthExisting) {
        thisMonthExisting.total += amount;
      } else {
        thisMonthPropertyMap.set(row.hostel_id, {
          hostel_id: row.hostel_id,
          hostel_name: row.hostel_name,
          hostel_location: row.hostel_location,
          total: amount,
        });
      }
    }
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

  const currentMonthPropertyTotals = Array.from(thisMonthPropertyMap.values()).sort(
    (a, b) => b.total - a.total,
  );

  const currentMonthDailyTotals = Array.from(dailyMap.entries()).map(
    ([date, total]) => ({ date, total }),
  );

  const recurringTemplates = allRows
    .filter((row) => row.is_recurring)
    .map((row) => {
      const hostel = ctx.hostelMap.get(row.hostel_id);
      return {
        id: row.id,
        hostel_id: row.hostel_id,
        hostel_name: hostel?.name ?? "Property",
        title: row.title,
        amount: Number(row.amount),
        status: row.status,
        recurring_frequency: row.recurring_frequency,
        next_due_date: row.next_due_date,
      };
    })
    .sort((a, b) => {
      const left = a.next_due_date ?? "9999-12-31";
      const right = b.next_due_date ?? "9999-12-31";
      return left.localeCompare(right);
    });

  return NextResponse.json({
    expenses: responseRows,
    hostels,
    summary,
    scope_onboarded_at: scopeOnboardedAt,
    month_options: monthOptions,
    current_month_range: {
      start: toDateOnly(thisMonthStart),
      end: toDateOnly(thisMonthEnd),
    },
    current_month_property_totals: currentMonthPropertyTotals,
    current_month_daily_totals: currentMonthDailyTotals,
    recurring_templates: recurringTemplates,
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

  const computedNextDueDate = data.is_recurring
    ? (data.next_due_date ??
      nextRecurringDate(data.expense_date, data.recurring_frequency ?? "monthly"))
    : null;

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
      next_due_date: computedNextDueDate,
      created_by: ctx.ownerId,
    })
    .select(EXPENSE_SELECT)
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
