import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./client";
import type { ConsentRecord } from "../types";

/**
 * Supabase Auth — email + password.
 *
 * Sign-in and sign-up mirror the local adapter's two doors (`signIn` /
 * `signUp` in `lib/store.ts`) so the onboarding screen barely changes: the
 * same credentials go in, and either a signed-in user or an actionable,
 * patient-readable error comes out.
 *
 * Phone sign-in stays on the local adapter for now: Supabase phone auth in
 * production needs an SMS provider, which the project doesn't have yet.
 */

export type SupabaseAuthOutcome =
  /** Signed in (or, for sign-up, signed in immediately — confirmation off). */
  | { status: "signed-in"; user: User }
  /** Account created, but the email must be confirmed before sign-in. */
  | { status: "confirm-email" };

export interface SupabaseProfile {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  consent?: ConsentRecord;
}

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

/** Map Supabase's error strings to messages a patient can act on. */
function friendlyAuthError(message: string, context: "signIn" | "signUp"): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email and password don't match an account. Check them and try again — or create an account if you're new.";
  }
  if (m.includes("already registered") || m.includes("already exists")) {
    return "An account already exists for this email. Sign in instead.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm your email first — we sent a confirmation link when you signed up. Check your inbox (and spam), then sign in.";
  }
  if (m.includes("password should be at least")) {
    return "Use at least 8 characters for your password.";
  }
  if (m.includes("unable to validate email") || m.includes("invalid format")) {
    return "Enter a valid email address.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return context === "signUp"
    ? "We couldn't create your account. Try again."
    : "We couldn't sign you in. Try again.";
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<SupabaseAuthOutcome> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      // Read by the `handle_new_user` trigger to create the profiles row,
      // and used below as the display name until that row is fetched.
      data: { full_name: input.fullName.trim() },
      emailRedirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/onboarding` : undefined,
    },
  });
  if (error) throw new Error(friendlyAuthError(error.message, "signUp"));

  // With email confirmation on, Supabase returns a user but no session.
  // Obfuscated-user-enumeration responses also land here (identities empty).
  if (!data.session) return { status: "confirm-email" };
  return { status: "signed-in", user: data.session.user };
}

export async function signInWithEmail(input: {
  email: string;
  password: string;
}): Promise<SupabaseAuthOutcome> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (error) throw new Error(friendlyAuthError(error.message, "signIn"));
  return { status: "signed-in", user: data.user };
}

export async function signOutOfSupabase(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  // Local scope: end this device's session without signing the patient out
  // of CareNow everywhere else.
  await supabase.auth.signOut({ scope: "local" });
}

/**
 * The `profiles` row (plus the latest consent) for a signed-in user.
 *
 * Falls back to the auth user's own metadata when the row isn't there yet —
 * e.g. projects where `supabase/auth_setup.sql` hasn't been run — so sign-in
 * never hard-fails on a missing profile.
 */
export async function fetchSupabaseProfile(user: User): Promise<SupabaseProfile> {
  const fallback: SupabaseProfile = {
    id: user.id,
    fullName:
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
      user.email?.split("@")[0] ||
      "New patient",
    email: user.email ?? undefined,
    phone: user.phone ?? undefined,
  };

  const supabase = getSupabase();
  if (!supabase) return fallback;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return fallback;

  const result: SupabaseProfile = {
    id: user.id,
    fullName: profile.full_name || fallback.fullName,
    email: profile.email ?? fallback.email,
    phone: profile.phone ?? fallback.phone,
  };

  const { data: consent } = await supabase
    .from("consents")
    .select("version, health_data_consent, recording_consent, accepted_at")
    .eq("patient_id", user.id)
    .is("withdrawn_at", null)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (consent) {
    result.consent = {
      version: consent.version,
      acceptedAt: consent.accepted_at,
      healthDataConsent: consent.health_data_consent,
      recordingConsent: consent.recording_consent,
    };
  }
  return result;
}
