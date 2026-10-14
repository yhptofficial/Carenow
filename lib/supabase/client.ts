import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser client.
 *
 * Auth is the first CareNow concern on Supabase (bookings, payments and the
 * rest still run on the local adapter in `lib/db.ts`). The client exists only
 * when the project is configured — without env vars the app stays in local
 * prototype mode, demo account included, exactly as before.
 *
 * The anon key is client-safe by design: it can only do what Row Level
 * Security in `supabase/schema.sql` allows, which for `profiles` is
 * "your own row". Never put the service-role key in a NEXT_PUBLIC_ variable.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when a Supabase project is configured; gates every Supabase code path. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** The shared browser client, or null in local prototype mode. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        // Persist the session so a patient stays signed in across visits,
        // and refresh the token before it expires.
        persistSession: true,
        autoRefreshToken: true,
        // Email confirmation links land back on the onboarding screen.
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
