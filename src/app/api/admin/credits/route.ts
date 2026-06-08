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
