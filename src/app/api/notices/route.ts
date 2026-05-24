import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type OwnerContext = {
  ownerId: string;
  hostelMap: Map<string, { name: string; city: string; state: string }>;
  hostelIds: string[];
};

async function getOwnerContext(): Promise<OwnerContext | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) {
    return NextResponse.json({ error: "Owner account not found." }, { status: 403 });
  }

  const { data: hostels, error: hostelsError } = await admin
    .from("hostels")
    .select("id, name, city, state")
    .eq("owner_id", owner.id);

  if (hostelsError) {
    return NextResponse.json({ error: hostelsError.message }, { status: 500 });
  }

  const hostelMap = new Map<string, { name: string; city: string; state: string }>();
  for (const row of hostels ?? []) {
    hostelMap.set(row.id, { name: row.name, city: row.city, state: row.state });
  }

  return {
    ownerId: owner.id,
    hostelIds: Array.from(hostelMap.keys()),
    hostelMap,
  };
}

// GET /api/notices — Owner lists all notices across owned properties
export async function GET() {
  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.hostelIds.length === 0) {
    return NextResponse.json({ notices: [] });
  }

  const admin = createAdminClient();
  const { data: notices, error } = await admin
    .from("notices")
    .select(
      "id, hostel_id, title, body, is_published, published_at, created_at, updated_at",
    )
    .in("hostel_id", ctx.hostelIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (notices ?? []).map((n) => {
    const hostel = ctx.hostelMap.get(n.hostel_id);
    return {
      ...n,
      hostel_name: hostel?.name ?? "Property",
      hostel_location: hostel ? `${hostel.city}, ${hostel.state}` : null,
    };
  });

  return NextResponse.json({ notices: rows });
}

const createSchema = z.object({
  hostel_id: z.string().uuid("Invalid property."),
  title: z
    .string()
    .min(2, "Title must be at least 2 characters.")
    .max(200, "Title too long."),
  body: z
    .string()
    .min(5, "Body must be at least 5 characters.")
    .max(5000, "Body too long."),
  publish: z.boolean().optional().default(false),
});

// POST /api/notices — Owner creates a notice
export async function POST(request: NextRequest) {
  const ctx = await getOwnerContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error." },
      { status: 400 },
    );
  }

  const { hostel_id, title, body: noticeBody, publish } = parsed.data;

  if (!ctx.hostelIds.includes(hostel_id)) {
    return NextResponse.json(
      { error: "Property not found or access denied." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: notice, error } = await admin
    .from("notices")
    .insert({
      hostel_id,
      owner_id: ctx.ownerId,
      title: title.trim(),
      body: noticeBody.trim(),
      is_published: publish,
      published_at: publish ? now : null,
    })
    .select(
      "id, hostel_id, title, body, is_published, published_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hostel = ctx.hostelMap.get(notice.hostel_id);

  return NextResponse.json({
    notice: {
      ...notice,
      hostel_name: hostel?.name ?? "Property",
      hostel_location: hostel ? `${hostel.city}, ${hostel.state}` : null,
    },
  });
}
