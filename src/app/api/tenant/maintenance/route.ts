import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { data, error } = await admin
    .from("maintenance_requests")
    .select("id, title, description, status, created_at, updated_at")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

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

  return NextResponse.json({ requests });
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

  const { error } = await admin.from("maintenance_requests").insert({
    hostel_id: tenant.hostel_id,
    tenant_id: tenant.id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    status: "open",
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
