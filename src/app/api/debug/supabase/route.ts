import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import {
  isAnonKeyConfigured,
  isServiceRoleKeyConfigured,
  isSupabaseUrlConfigured,
} from "../../../../lib/supabase/env-check";

export async function GET() {
  const envStatus = {
    supabaseUrl: isSupabaseUrlConfigured(),
    anonKey: isAnonKeyConfigured(),
    serviceRoleKey: isServiceRoleKeyConfigured(),
  };

  const adminTest = {
    success: false,
    error: null as string | null,
  };

  try {
    const admin = createAdminClient();
    const result = await admin.from("owners").select("id").limit(1).maybeSingle();

    if (result.error) {
      adminTest.error = result.error.message;
    } else {
      adminTest.success = true;
    }
  } catch (error) {
    adminTest.error =
      error instanceof Error ? error.message : "Unknown admin check error";
  }

  return NextResponse.json({
    success: true,
    env: envStatus,
    adminTest,
    message: envStatus.serviceRoleKey
      ? "SUPABASE_SERVICE_ROLE_KEY is loaded in the running server environment."
      : "SUPABASE_SERVICE_ROLE_KEY is not loaded. Restart the server after updating environment variables.",
  });
}
