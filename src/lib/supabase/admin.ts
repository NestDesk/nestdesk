/**
 * Supabase Admin Client — SERVER SIDE ONLY
 *
 * Uses the service_role key which bypasses Row Level Security.
 * NEVER import this in client components or expose it to the browser.
 *
 * Use cases:
 *  - Cron jobs / background tasks
 *  - Admin operations that must bypass RLS
 *  - Webhooks (Razorpay, etc.)
 */
import { createClient } from "@supabase/supabase-js";
import { validateSupabaseEnv, validateServiceRoleKey } from "./env-check";

export function createAdminClient() {
  const { url } = validateSupabaseEnv();
  const serviceRoleKey = validateServiceRoleKey();

  return createClient(url, serviceRoleKey, {
    auth: {
      // Admin client should never persist sessions
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
