import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/tenant/notices — Active tenant reads published notices for their property
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, hostel_id, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant account not found." },
      { status: 403 },
    );
  }

  if (tenant.status !== "active") {
    return NextResponse.json({ notices: [], inactive: true });
  }

  const { data: notices, error } = await admin
    .from("notices")
    .select("id, title, body, published_at, created_at")
    .eq("hostel_id", tenant.hostel_id)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("published_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notices: notices ?? [] });
}
