import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

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

const querySchema = z.object({
  ownerId: z.string().uuid("Invalid owner ID."),
});

export async function GET(request: NextRequest) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ ownerId: url.searchParams.get("ownerId") });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("credit_transactions")
    .select(
      "id, event_type, amount_paise, balance_before, balance_after, note, payment_order_id, created_by, created_at",
    )
    .eq("owner_id", parsed.data.ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data ?? [] });
}
