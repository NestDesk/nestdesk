import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/tenant/terms — returns property terms for the authenticated tenant's hostel
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("hostel_id, hostels(name, property_type)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant)
    return NextResponse.json({ error: "Tenant not found." }, { status: 403 });

  const { data: terms } = await admin
    .from("property_terms")
    .select("content, is_default, updated_at")
    .eq("hostel_id", tenant.hostel_id)
    .maybeSingle();

  const hostel =
    // @ts-expect-error supabase nested type
    (tenant.hostels as { name: string; property_type: string | null } | null) ??
    null;

  return NextResponse.json({
    hostel_name: hostel?.name ?? "Your Property",
    property_type: hostel?.property_type ?? null,
    terms: terms ?? null,
  });
}
