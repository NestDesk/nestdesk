import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);

  let query = admin
    .from("sales_leads")
    .select(
      "contact_name, contact_email, contact_phone, institution_name, property_count, tenant_count, preferred_timeline, status, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && ["fresh", "contacted", "closed", "rejected"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data: leads, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: leads ?? [], total: count ?? 0 });
}

export async function PATCH(request: NextRequest) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { contactEmail, createdAt, status } = body as {
    contactEmail?: string;
    createdAt?: string;
    status?: string;
  };

  if (!contactEmail || !createdAt || !status) {
    return NextResponse.json(
      { error: "contactEmail, createdAt, and status are required." },
      { status: 400 },
    );
  }

  if (!["fresh", "contacted", "closed", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("sales_leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("contact_email", contactEmail)
    .eq("created_at", createdAt);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
