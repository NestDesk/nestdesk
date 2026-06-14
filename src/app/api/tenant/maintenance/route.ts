import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { notifyMaintenanceOwnerByWhatsApp } from "../../../../lib/messaging/maintenance";

// ── GET /api/tenant/maintenance ─────────────────────────────────────────────
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
    .select("id, hostel_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { data, error } = await admin
    .from("maintenance_requests")
    .select("id, title, description, status, created_at, updated_at")
    .eq("tenant_id", tenant.id)
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const maintenanceLimit = 3;
  const requestsRaised = data?.length ?? 0;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const requestIds = (data ?? []).map((row) => row.id);
  const { data: comments } = requestIds.length
    ? await admin
        .from("maintenance_request_comments")
        .select("id, maintenance_request_id, comment, created_at")
        .in("maintenance_request_id", requestIds)
        .order("created_at", { ascending: true })
    : {
        data: [] as Array<{
          id: string;
          maintenance_request_id: string;
          comment: string;
          created_at: string;
        }>,
      };

  const commentsByRequest = new Map<
    string,
    Array<{ id: string; comment: string; created_at: string }>
  >();
  for (const c of comments ?? []) {
    const current = commentsByRequest.get(c.maintenance_request_id) ?? [];
    current.push({ id: c.id, comment: c.comment, created_at: c.created_at });
    commentsByRequest.set(c.maintenance_request_id, current);
  }

  const requests = (data ?? []).map((row) => ({
    ...row,
    owner_comments: commentsByRequest.get(row.id) ?? [],
  }));

  return NextResponse.json({
    requests,
    maintenanceLimit,
    requestsRaised,
    requestsRemaining: Math.max(0, maintenanceLimit - requestsRaised),
  });
}

// ── POST /api/tenant/maintenance ────────────────────────────────────────────
const createSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters.").max(200),
  description: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, hostel_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { count, error: countError } = await admin
    .from("maintenance_requests")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd)
    .is("deleted_at", null);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: "You can raise up to 3 maintenance requests this month." },
      { status: 403 },
    );
  }

  const { data: insertedRequest, error } = await admin
    .from("maintenance_requests")
    .insert({
      hostel_id: tenant.hostel_id,
      tenant_id: tenant.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: "open",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await notifyMaintenanceOwnerByWhatsApp({
      hostelId: tenant.hostel_id,
      tenantId: tenant.id,
      issueHeading: parsed.data.title,
      issueDescription: parsed.data.description ?? null,
    });
  } catch (notificationError) {
    console.error("Failed to notify owner about maintenance request", notificationError);
  }

  return NextResponse.json({ success: true, maintenanceRequestId: insertedRequest?.id });
}
