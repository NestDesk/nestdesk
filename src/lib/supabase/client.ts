import { createBrowserClient } from "@supabase/ssr";
import { validateSupabaseEnv } from "./env-check";

export function createClient() {
  const { url, anonKey } = validateSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
