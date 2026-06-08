import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

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
    .select("hostel_id, hostels(id, owner_id)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant)
    return NextResponse.json({ error: "Tenant not found." }, { status: 403 });

  // @ts-expect-error supabase nested select
  const hostel = tenant.hostels as { id: string; owner_id: string } | null;
  if (!hostel)
    return NextResponse.json({ error: "Property not found." }, { status: 403 });

  const { data: staff } = await admin
    .from("support_staff")
    .select("id, name, phone, designation")
    .eq("owner_id", hostel.owner_id)
    .or(`hostel_id.eq.${tenant.hostel_id},hostel_id.is.null`)
    .order("created_at", { ascending: true });

  return NextResponse.json(staff ?? []);
}
