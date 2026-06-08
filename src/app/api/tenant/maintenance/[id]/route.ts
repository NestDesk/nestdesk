import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

const updateSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters.").max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
});

async function resolveTenantId() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant) {
    return {
      error: NextResponse.json({ error: "Tenant not found." }, { status: 404 }),
    };
  }

  return { tenantId: tenant.id };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const resolved = await resolveTenantId();
  if ("error" in resolved) {
    return resolved.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("maintenance_requests")
    .select("id, status")
    .eq("id", params.id)
    .eq("tenant_id", resolved.tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  if (existing.status !== "open") {
    return NextResponse.json(
      {
        error:
          "Only open maintenance requests can be edited by tenants. Contact your property owner for further updates.",
      },
      { status: 403 },
    );
  }

  const { data: updated, error } = await admin
    .from("maintenance_requests")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ? parsed.data.description : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select("id, title, description, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, request: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const resolved = await resolveTenantId();
  if ("error" in resolved) {
    return resolved.error;
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("maintenance_requests")
    .select("id, status")
    .eq("id", params.id)
    .eq("tenant_id", resolved.tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  if (existing.status !== "open") {
    return NextResponse.json(
      {
        error:
          "Only open maintenance requests can be deleted by tenants. Contact your property owner for further updates.",
      },
      { status: 403 },
    );
  }

  const { error } = await admin
    .from("maintenance_requests")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
