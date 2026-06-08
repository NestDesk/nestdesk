/**
 * Validates that all required Supabase environment variables are present.
 * Call this at the top of any file that uses Supabase to get an early,
 * readable error instead of a cryptic runtime crash.
 *
 * Safe to call on both server and client — only NEXT_PUBLIC_ vars are
 * validated on the client side.
 */
export function validateSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || url === "https://YOUR_PROJECT_ID.supabase.co") {
    throw new Error(
      "[NestDesk] NEXT_PUBLIC_SUPABASE_URL is missing or still set to the placeholder value.\n" +
        "→ Copy .env.example to .env.local and fill in your DEV Supabase project credentials.",
    );
  }

  if (!anonKey || anonKey === "YOUR_ANON_KEY") {
    throw new Error(
      "[NestDesk] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or still set to the placeholder value.\n" +
        "→ Copy .env.example to .env.local and fill in your DEV Supabase project credentials.",
    );
  }

  return { url, anonKey };
}

/**
 * Validates the service role key.
 * SERVER SIDE ONLY — never call this in client components.
 */
export function validateServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey || serviceRoleKey === "YOUR_SERVICE_ROLE_KEY") {
    throw new Error(
      "[NestDesk] SUPABASE_SERVICE_ROLE_KEY is missing or still set to the placeholder value.\n" +
        "→ Add it to .env.local (dev) or set it in the Vercel dashboard (prod).\n" +
        "→ Restart the Next.js server after changing environment files.\n" +
        "⚠️  Never expose this key to the browser.",
    );
  }

  return serviceRoleKey;
}

export function isSupabaseUrlConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://YOUR_PROJECT_ID.supabase.co",
  );
}

export function isAnonKeyConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "YOUR_ANON_KEY",
  );
}

export function isServiceRoleKeyConfigured() {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY !== "YOUR_SERVICE_ROLE_KEY",
  );
}
