import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../../lib/supabase/admin";

const querySchema = z.object({
  code: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z]{1,3}-\d{8}$/i, "Invalid property code format."),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ code: searchParams.get("code") ?? "" });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid property code format." },
      { status: 400 },
    );
  }

  const code = parsed.data.code.toUpperCase();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("hostels")
    .select("id, tenant_join_token, is_active")
    .eq("property_code", code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Property not found. Check the code and try again." },
      { status: 404 },
    );
  }

  if (!data.is_active) {
    return NextResponse.json(
      { error: "This property is not currently accepting registrations." },
      { status: 403 },
    );
  }

  if (!data.tenant_join_token) {
    return NextResponse.json(
      { error: "This property does not have an active invite link yet." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    token: data.tenant_join_token,
    hostelId: data.id,
  });
}
