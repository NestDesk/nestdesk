import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const createFloorSchema = z.object({
  name: z.string().min(1, "Floor name is required.").max(100),
});

function normalizeText(value: string): string {
  return value.trim();
}

async function resolveOwnerAndHostel(hostelId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized.", status: 401 as const };
  }

  const admin = createAdminClient();

  const ownerResult = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerResult.error) {
    return { error: ownerResult.error.message, status: 500 as const };
  }

  const ownerId = ownerResult.data?.id;
  if (!ownerId) {
    return {
      error: "Complete onboarding before managing floor plans.",
      status: 409 as const,
    };
  }

  const hostelResult = await admin
    .from("hostels")
    .select("id")
    .eq("id", hostelId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (hostelResult.error) {
    return { error: hostelResult.error.message, status: 500 as const };
  }

  if (!hostelResult.data) {
    return { error: "Property not found.", status: 404 as const };
  }

  return { admin, userId: user.id, ownerId };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  const resolved = await resolveOwnerAndHostel(parsedParams.data.id);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const floorsResult = await resolved.admin
    .from("floors")
    .select("id, name, created_at")
    .eq("hostel_id", parsedParams.data.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (floorsResult.error) {
    return NextResponse.json({ error: floorsResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    floors: floorsResult.data ?? [],
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsedBody = createFloorSchema.safeParse(body);
  if (!parsedBody.success) {
    const firstError = parsedBody.error.issues[0]?.message ?? "Validation failed.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const resolved = await resolveOwnerAndHostel(parsedParams.data.id);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const normalizedName = normalizeText(parsedBody.data.name);

  const existingFloorsResult = await resolved.admin
    .from("floors")
    .select("id, name")
    .eq("hostel_id", parsedParams.data.id)
    .is("deleted_at", null);

  if (existingFloorsResult.error) {
    return NextResponse.json(
      { error: existingFloorsResult.error.message },
      { status: 500 },
    );
  }

  const duplicate = (existingFloorsResult.data ?? []).some(
    (floor) =>
      normalizeText(floor.name).toLowerCase() === normalizedName.toLowerCase(),
  );
  if (duplicate) {
    return NextResponse.json(
      { error: `Floor "${normalizedName}" already exists.` },
      { status: 409 },
    );
  }

  const insertResult = await resolved.admin
    .from("floors")
    .insert({
      hostel_id: parsedParams.data.id,
      name: normalizedName,
    })
    .select("id, name, created_at")
    .single();

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json(
      { error: insertResult.error?.message ?? "Failed to create floor." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, floor: insertResult.data });
}
