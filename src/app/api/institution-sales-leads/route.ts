import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../lib/supabase/admin";

const institutionLeadSchema = z.object({
  contactName: z.string().min(2),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(6),
  institutionName: z.preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    }
    return value;
  }, z.string().min(2).optional()),
  propertyCount: z.number().int().nonnegative().optional(),
  tenantCount: z.number().int().nonnegative().optional(),
  preferredTimeline: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = institutionLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { error: insertError } = await admin.from("sales_leads").insert({
    contact_name: parsed.data.contactName.trim(),
    contact_email: parsed.data.contactEmail.trim(),
    contact_phone: parsed.data.contactPhone.trim(),
    institution_name: parsed.data.institutionName?.trim() ?? null,
    property_count: parsed.data.propertyCount ?? null,
    tenant_count: parsed.data.tenantCount ?? null,
    preferred_timeline: parsed.data.preferredTimeline?.trim() ?? null,
  });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message || "Failed to save lead." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
