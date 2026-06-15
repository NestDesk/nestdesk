import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

const COMPANY_ADMIN_EMAIL = "support@nestdesk.in";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || user.email !== COMPANY_ADMIN_EMAIL) {
    return {
      user: null,
      denied: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user, denied: null };
}

const addCreditsSchema = z.object({
  ownerId: z.string().uuid("Invalid owner ID."),
  amountPaise: z
    .number()
    .int("Amount must be a whole number of paise.")
    .min(100, "Minimum credit amount is ₹1 (100 paise).")
    .max(100_000_00, "Maximum single credit allocation is ₹1,00,000."),
  note: z.string().max(500).optional(),
});

const deleteCreditSchema = z.object({
  creditId: z.string().uuid("Invalid credit transaction ID."),
});

export async function POST(request: NextRequest) {
  const { user: adminUser, denied } = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = addCreditsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { ownerId, amountPaise, note } = parsed.data;
  const admin = createAdminClient();

  const { data: owner, error: ownerError } = await admin
    .from("owners")
    .select("id, full_name, email, unused_credit_paise")
    .eq("id", ownerId)
    .maybeSingle();

  if (ownerError || !owner) {
    return NextResponse.json({ error: "Owner account not found." }, { status: 404 });
  }

  const newBalance = (owner.unused_credit_paise ?? 0) + amountPaise;

  const { error: updateError } = await admin
    .from("owners")
    .update({ unused_credit_paise: newBalance })
    .eq("id", ownerId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await admin.from("credit_transactions").insert({
    owner_id: ownerId,
    payment_order_id: null,
    event_type: "admin_credit_added",
    amount_paise: amountPaise,
    balance_before: owner.unused_credit_paise ?? 0,
    balance_after: newBalance,
    note: note ?? null,
    created_by: adminUser?.email ?? null,
    metadata: {},
  });

  await admin.from("audit_logs").insert({
    owner_id: ownerId,
    action: "admin_add_credits",
    table_name: "owners",
    record_id: ownerId,
    old_value: { unused_credit_paise: owner.unused_credit_paise ?? 0 },
    new_value: {
      unused_credit_paise: newBalance,
      note: note ?? null,
      added_by: adminUser?.email,
    },
  });

  return NextResponse.json({
    success: true,
    ownerId,
    ownerName: owner.full_name,
    previousBalancePaise: owner.unused_credit_paise ?? 0,
    addedPaise: amountPaise,
    newBalancePaise: newBalance,
  });
}

export async function DELETE(request: NextRequest) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const parsed = deleteCreditSchema.safeParse({
    creditId: url.searchParams.get("creditId"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: credit, error: creditError } = await admin
    .from("credit_transactions")
    .select("id, owner_id, amount_paise, event_type")
    .eq("id", parsed.data.creditId)
    .maybeSingle();

  if (creditError) {
    return NextResponse.json({ error: creditError.message }, { status: 500 });
  }

  if (!credit) {
    return NextResponse.json({ error: "Credit record not found." }, { status: 404 });
  }

  if (credit.event_type !== "admin_credit_added") {
    return NextResponse.json(
      { error: "Only admin-added credits can be deleted." },
      { status: 403 },
    );
  }

  const { data: owner, error: ownerError } = await admin
    .from("owners")
    .select("id, unused_credit_paise")
    .eq("id", credit.owner_id)
    .maybeSingle();

  if (ownerError) {
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }

  if (!owner) {
    return NextResponse.json({ error: "Owner account not found." }, { status: 404 });
  }

  const currentBalance = owner.unused_credit_paise ?? 0;
  const newBalance = currentBalance - credit.amount_paise;

  if (newBalance < 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete this credit because some of it has already been consumed.",
      },
      { status: 400 },
    );
  }

  const { error: updateError } = await admin
    .from("owners")
    .update({ unused_credit_paise: newBalance })
    .eq("id", owner.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: deleteError } = await admin
    .from("credit_transactions")
    .delete()
    .eq("id", credit.id);

  if (deleteError) {
    await admin
      .from("owners")
      .update({ unused_credit_paise: currentBalance })
      .eq("id", owner.id);

    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    owner_id: owner.id,
    action: "admin_delete_credit",
    table_name: "credit_transactions",
    record_id: credit.id,
    old_value: {
      unused_credit_paise: currentBalance,
      credit_amount_paise: credit.amount_paise,
    },
    new_value: {
      unused_credit_paise: newBalance,
    },
  });

  return NextResponse.json({
    success: true,
    deletedCreditId: credit.id,
    newBalancePaise: newBalance,
  });
}
