import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import {
  getCurrentReminderMonthKey,
  REMINDER_COOLDOWN_HOURS,
  sendRentReminderForTenant,
} from "../../../../lib/messaging/rent-reminder";

const REMINDER_LIMIT = 3;

async function getOwnerContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: owner, error: ownerError } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerError) {
    return { error: NextResponse.json({ error: ownerError.message }, { status: 500 }) };
  }

  if (!owner) {
    return {
      error: NextResponse.json({ error: "Owner account not found." }, { status: 403 }),
    };
  }

  return { ownerId: owner.id };
}

export async function GET() {
  const ctx = await getOwnerContext();
  if ("error" in ctx) {
    return ctx.error;
  }

  const admin = createAdminClient();
  const reminderMonth = getCurrentReminderMonthKey();

  const { data: tenants, error: tenantsError } = await admin
    .from("tenants")
    .select("id")
    .eq("owner_id", ctx.ownerId)
    .is("deleted_at", null);

  if (tenantsError) {
    return NextResponse.json({ error: tenantsError.message }, { status: 500 });
  }

  if (!tenants?.length) {
    return NextResponse.json({ reminderMonth, reminders: [] });
  }

  const tenantIds = tenants.map((tenant) => tenant.id);
  const { data: reminderLogs, error: reminderLogsError } = await (async () => {
    const baseQuery = admin
      .from("rent_reminder_logs")
      .select("tenant_id, attempt_count, sent_at")
      .in("tenant_id", tenantIds)
      .eq("reminder_month", reminderMonth)
      .eq("template_name", "rent_reminder")
      .eq("status", "sent");

    const { data, error } = await baseQuery;
    if (!error) {
      return { data: (data ?? []).map((entry) => ({ ...entry, attempt_count: Number(entry.attempt_count ?? 1) })), error: null };
    }

    const fallbackMessage = error.message?.toLowerCase() ?? "";
    if (fallbackMessage.includes("attempt_count") || fallbackMessage.includes("does not exist")) {
      const fallback = await admin
        .from("rent_reminder_logs")
        .select("tenant_id, sent_at")
        .in("tenant_id", tenantIds)
        .eq("reminder_month", reminderMonth)
        .eq("template_name", "rent_reminder")
        .eq("status", "sent");

      return {
        data: (fallback.data ?? []).map((entry) => ({ tenant_id: entry.tenant_id, sent_at: entry.sent_at, attempt_count: 1 })),
        error: fallback.error,
      };
    }

    return { data: [], error };
  })();

  if (reminderLogsError) {
    return NextResponse.json({ error: reminderLogsError.message }, { status: 500 });
  }

  const countByTenant = new Map<string, number>();
  const cooldownUntilByTenant = new Map<string, string>();

  for (const entry of reminderLogs ?? []) {
    const tenantId = entry.tenant_id;
    const attemptCount = Number(entry.attempt_count ?? 1);
    countByTenant.set(tenantId, (countByTenant.get(tenantId) ?? 0) + attemptCount);

    if (entry.sent_at) {
      const sentAt = new Date(entry.sent_at);
      const cooldownUntil = new Date(sentAt.getTime() + REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000);
      const existing = cooldownUntilByTenant.get(tenantId);
      if (!existing || cooldownUntil > new Date(existing)) {
        cooldownUntilByTenant.set(tenantId, cooldownUntil.toISOString());
      }
    }
  }

  return NextResponse.json({
    reminderMonth,
    limit: REMINDER_LIMIT,
    reminders: tenants.map((tenant) => ({
      tenant_id: tenant.id,
      count: countByTenant.get(tenant.id) ?? 0,
      limit: REMINDER_LIMIT,
      cooldown_until: cooldownUntilByTenant.get(tenant.id) ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) {
    return ctx.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const tenantIds = Array.isArray((body as { tenantIds?: unknown }).tenantIds)
    ? ((body as { tenantIds?: unknown }).tenantIds as unknown[]).filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      )
    : [];

  if (tenantIds.length === 0) {
    return NextResponse.json({ error: "Select at least one tenant." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: tenants, error } = await admin
    .from("tenants")
    .select("id, hostel_id, owner_id")
    .eq("owner_id", ctx.ownerId)
    .in("id", tenantIds)
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tenantMap = new Map((tenants ?? []).map((tenant) => [tenant.id, tenant]));
  const results = [] as Array<{ tenantId: string; sent: boolean; reason?: string }>;

  for (const tenantId of tenantIds) {
    const tenant = tenantMap.get(tenantId);
    if (!tenant) {
      results.push({ tenantId, sent: false, reason: "Tenant not allowed" });
      continue;
    }

    const result = await sendRentReminderForTenant({
      tenantId: tenant.id,
      hostelId: tenant.hostel_id,
      skipDueDateCheck: true,
    });
    results.push({ tenantId: tenant.id, ...result });
  }

  return NextResponse.json({
    ok: true,
    requested: tenantIds.length,
    sent: results.filter((item) => item.sent).length,
    results,
  });
}
