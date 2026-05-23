import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function resolveOwnerAndNotice(noticeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const admin = createAdminClient();

  const { data: owner } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) {
    return {
      error: NextResponse.json(
        { error: "Owner account not found." },
        { status: 403 },
      ),
    };
  }

  const { data: notice } = await admin
    .from("notices")
    .select("id, hostel_id, owner_id, is_published, deleted_at")
    .eq("id", noticeId)
    .maybeSingle();

  if (!notice || notice.deleted_at !== null) {
    return {
      error: NextResponse.json({ error: "Notice not found." }, { status: 404 }),
    };
  }

  if (notice.owner_id !== owner.id) {
    return {
      error: NextResponse.json({ error: "Access denied." }, { status: 403 }),
    };
  }

  return { ownerId: owner.id, notice, admin };
}

const patchSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters.")
    .max(200, "Title too long.")
    .optional(),
  body: z
    .string()
    .min(5, "Body must be at least 5 characters.")
    .max(5000, "Body too long.")
    .optional(),
  is_published: z.boolean().optional(),
});

// PATCH /api/notices/[id] — Edit / publish / unpublish a notice
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await resolveOwnerAndNotice(id);
  if (ctx.error) return ctx.error;
  const { notice, admin } = ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Validation error." },
      { status: 400 },
    );
  }

  if (
    !parsed.data.title &&
    !parsed.data.body &&
    parsed.data.is_published === undefined
  ) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
  if (parsed.data.body !== undefined) updates.body = parsed.data.body.trim();

  if (parsed.data.is_published !== undefined) {
    updates.is_published = parsed.data.is_published;
    if (parsed.data.is_published && !notice.is_published) {
      updates.published_at = new Date().toISOString();
    } else if (!parsed.data.is_published) {
      updates.published_at = null;
    }
  }

  const { data: updated, error } = await admin
    .from("notices")
    .update(updates)
    .eq("id", id)
    .select(
      "id, hostel_id, title, body, is_published, published_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notice: updated });
}

// DELETE /api/notices/[id] — Soft delete a notice
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await resolveOwnerAndNotice(id);
  if (ctx.error) return ctx.error;
  const { admin } = ctx;

  const { error } = await admin
    .from("notices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
