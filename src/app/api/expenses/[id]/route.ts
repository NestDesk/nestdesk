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

function addMonthsISO(dateStr: string, months: number) {
  const source = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(source.getTime())) return dateStr;

  const sourceDay = source.getUTCDate();
  const target = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(sourceDay, lastDay));
  return target.toISOString().slice(0, 10);
}

function monthsForFrequency(
  frequency: (typeof EXPENSE_RECURRING_FREQUENCIES)[number],
) {
  if (frequency === "monthly") return 1;
  if (frequency === "quarterly") return 3;
  return 12;
}

async function resolveOwnerAndExpense(expenseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const admin = createAdminClient();

  const { data: owner } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) {
    return {
      error: NextResponse.json(
        { error: "Owner account not found." },
        { status: 403 },
      ),
    };
  }

  const { data: expense } = await admin
    .from("expenses")
    .select(
      "id, owner_id, hostel_id, title, category, amount, expense_date, status, payment_mode, vendor_name, bill_number, notes, is_recurring, recurring_frequency, next_due_date, receipt_url, created_by, created_at, updated_at, deleted_at",
    )
    .eq("id", expenseId)
    .maybeSingle();

  if (!expense || expense.deleted_at !== null) {
    return {
      error: NextResponse.json({ error: "Expense not found." }, { status: 404 }),
    };
  }

  if (expense.owner_id !== owner.id) {
    return {
      error: NextResponse.json({ error: "Access denied." }, { status: 403 }),
    };
  }

  return { ownerId: owner.id, expense, admin };
}

const patchSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters.")
    .max(160, "Title too long.")
    .optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  amount: z.number().min(0, "Amount cannot be negative.").max(9999999).optional(),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format.")
    .optional(),
  status: z.enum(EXPENSE_STATUSES).optional(),
  payment_mode: z.enum(EXPENSE_PAYMENT_MODES).nullable().optional(),
  vendor_name: z.string().max(120).nullable().optional(),
  bill_number: z.string().max(80).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  is_recurring: z.boolean().optional(),
  recurring_frequency: z.enum(EXPENSE_RECURRING_FREQUENCIES).nullable().optional(),
  next_due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

// PATCH /api/expenses/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await resolveOwnerAndExpense(id);
  if (ctx.error) return ctx.error;
  const { expense, admin } = ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error." },
      { status: 400 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (parsed.data.amount !== undefined) updates.amount = parsed.data.amount;
  if (parsed.data.expense_date !== undefined)
    updates.expense_date = parsed.data.expense_date;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.payment_mode !== undefined)
    updates.payment_mode = parsed.data.payment_mode;
  if (parsed.data.vendor_name !== undefined)
    updates.vendor_name = parsed.data.vendor_name?.trim() || null;
  if (parsed.data.bill_number !== undefined)
    updates.bill_number = parsed.data.bill_number?.trim() || null;
  if (parsed.data.notes !== undefined)
    updates.notes = parsed.data.notes?.trim() || null;

  const nextRecurring =
    parsed.data.is_recurring !== undefined
      ? parsed.data.is_recurring
      : expense.is_recurring;
  const nextFrequency =
    parsed.data.recurring_frequency !== undefined
      ? parsed.data.recurring_frequency
      : expense.recurring_frequency;
  const nextExpenseDate = parsed.data.expense_date ?? expense.expense_date;

  if (parsed.data.is_recurring !== undefined) {
    updates.is_recurring = parsed.data.is_recurring;
  }
  if (parsed.data.recurring_frequency !== undefined) {
    updates.recurring_frequency = parsed.data.recurring_frequency;
  }
  if (parsed.data.next_due_date !== undefined) {
    updates.next_due_date = parsed.data.next_due_date;
  }

  if (nextRecurring && !nextFrequency) {
    return NextResponse.json(
      { error: "Recurring frequency is required for recurring expenses." },
      { status: 400 },
    );
  }

  if (!nextRecurring) {
    updates.recurring_frequency = null;
    updates.next_due_date = null;
  } else if (nextFrequency && parsed.data.next_due_date === undefined) {
    const shouldDeriveNextDue =
      !expense.next_due_date ||
      parsed.data.expense_date !== undefined ||
      parsed.data.recurring_frequency !== undefined ||
      parsed.data.is_recurring !== undefined;

    if (shouldDeriveNextDue) {
      updates.next_due_date = addMonthsISO(
        nextExpenseDate,
        monthsForFrequency(nextFrequency),
      );
    }
  }

  const { data: updated, error } = await admin
    .from("expenses")
    .update(updates)
    .eq("id", id)
    .select(
      "id, owner_id, hostel_id, title, category, amount, expense_date, status, payment_mode, vendor_name, bill_number, notes, is_recurring, recurring_frequency, next_due_date, receipt_url, created_by, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expense: updated });
}

// DELETE /api/expenses/[id] — Soft delete an expense
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await resolveOwnerAndExpense(id);
  if (ctx.error) return ctx.error;
  const { admin } = ctx;

  const { error } = await admin
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
