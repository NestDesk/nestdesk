import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { sendRentReminderForTenant } from "../../../../lib/messaging/rent-reminder";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get("user-agent")?.includes("vercel-cron/1.0") ?? false;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!cronSecret && !isVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: tenants, error } = await admin
    .from("tenants")
    .select("id, hostel_id")
    .eq("status", "active")
    .not("phone", "is", null)
    .neq("phone", "")
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [] as Array<{ tenantId: string; sent: boolean; reason?: string }>;
  for (const tenant of tenants ?? []) {
    const result = await sendRentReminderForTenant({
      tenantId: tenant.id,
      hostelId: tenant.hostel_id,
    });
    results.push({ tenantId: tenant.id, ...result });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
