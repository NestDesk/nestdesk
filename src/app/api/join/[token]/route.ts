import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  token: z.string().min(1).max(64),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> | { token: string } },
) {
  const params = await Promise.resolve(context.params);
  const parsed = paramsSchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  const { token } = parsed.data;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("hostels")
    .select("id, name, property_type, city, state, is_active")
    .eq("tenant_join_token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Invite link not found." }, { status: 404 });
  }

  if (!data.is_active) {
    return NextResponse.json(
      { error: "This property is not currently accepting registrations." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    hostel: {
      id: data.id,
      name: data.name,
      property_type: data.property_type,
      city: data.city,
      state: data.state,
    },
  });
}
