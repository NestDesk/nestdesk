import { NextRequest, NextResponse } from "next/server";
import https from "https";
import { z } from "zod";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";

const createHostelSchema = z.object({
  hostelName: z.string().min(2).max(200),
  propertyType: z.enum(["pg", "hostel", "coliving", "rental"]),
  address: z.string().min(5).max(300),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
});

function normalizeText(value: string): string {
  return value.trim();
}

function fetchPincodeData(pincode: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.postalpincode.in",
        path: `/pincode/${encodeURIComponent(pincode)}`,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        agent: new https.Agent({ rejectUnauthorized: false }),
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
}

async function verifyCityStateForPincode(
  pincode: string,
  city: string,
  state: string,
): Promise<boolean> {
  try {
    const raw = await fetchPincodeData(pincode);
    const payload = JSON.parse(raw) as Array<{
      Status?: string;
      PostOffice?: Array<{ Name?: string; District?: string; State?: string }>;
    }>;

    if (!Array.isArray(payload) || payload.length === 0) {
      return false;
    }

    const result = payload[0];
    if (result.Status !== "Success" || !Array.isArray(result.PostOffice)) {
      return false;
    }

    const normalizedCity = normalizeText(city).toLowerCase();
    const normalizedState = normalizeText(state).toLowerCase();

    return result.PostOffice.some(
      (office: { State?: string; District?: string; Name?: string }) => {
        const officeState = normalizeText(String(office.State ?? "")).toLowerCase();
        const officeDistrict = normalizeText(
          String(office.District ?? ""),
        ).toLowerCase();
        const officeName = normalizeText(String(office.Name ?? "")).toLowerCase();

        const stateMatches = officeState === normalizedState;
        const cityMatches =
          officeDistrict === normalizedCity ||
          officeName === normalizedCity ||
          officeDistrict.includes(normalizedCity) ||
          officeName.includes(normalizedCity) ||
          normalizedCity.includes(officeDistrict) ||
          normalizedCity.includes(officeName);

        return stateMatches && cityMatches;
      },
    );
  } catch {
    return false;
  }
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

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

  const ownerResult = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerResult.error) {
    return NextResponse.json({ error: ownerResult.error.message }, { status: 500 });
  }

  const ownerId = ownerResult.data?.id;
  if (!ownerId) {
    return NextResponse.json({ hostels: [] });
  }

  const hostelsResult = await admin
    .from("hostels")
    .select("id, name, city, state, is_active")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });

  if (hostelsResult.error) {
    return NextResponse.json(
      { error: hostelsResult.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ hostels: hostelsResult.data ?? [] });
}

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

  const parsed = createHostelSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Validation failed.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const data = parsed.data;

  const isValidLocation = await verifyCityStateForPincode(
    data.pincode,
    data.city,
    data.state,
  );

  if (!isValidLocation) {
    return NextResponse.json(
      { error: "Pincode does not match the provided city and state." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const ip = getClientIp(request);

  const ownerResult = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerResult.error) {
    return NextResponse.json({ error: ownerResult.error.message }, { status: 500 });
  }

  const ownerId = ownerResult.data?.id;
  if (!ownerId) {
    return NextResponse.json(
      { error: "Complete onboarding before adding properties." },
      { status: 409 },
    );
  }

  const hostelPayload = {
    owner_id: ownerId,
    name: normalizeText(data.hostelName),
    property_type: data.propertyType,
    address: normalizeText(data.address),
    city: normalizeText(data.city),
    state: normalizeText(data.state),
    pincode: data.pincode,
    total_rooms: 0,
    is_active: false,
  };

  const hostelInsert = await admin
    .from("hostels")
    .insert(hostelPayload)
    .select("id")
    .single();

  if (hostelInsert.error || !hostelInsert.data) {
    return NextResponse.json(
      { error: hostelInsert.error?.message ?? "Failed to create property." },
      { status: 500 },
    );
  }

  await admin.from("audit_logs").insert({
    owner_id: ownerId,
    user_id: user.id,
    action: "CREATE",
    table_name: "hostels",
    record_id: hostelInsert.data.id,
    new_value: hostelPayload,
    ip_address: ip,
  });

  return NextResponse.json({ success: true, redirectTo: "/hostels" });
}
