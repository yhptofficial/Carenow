import { getSupabase, isSupabaseConfigured } from "./client";
import type { Booking } from "../types";

/**
 * Booking sync — local-first, Supabase-mirrored.
 *
 * The app still books against the local adapter (instant, offline-tolerant);
 * when Supabase is configured AND the patient is signed in through Supabase,
 * each booking event is mirrored into the Postgres `bookings` table via the
 * RPCs in `supabase/bookings_setup.sql`. The local booking id → Supabase
 * booking uuid mapping lives in localStorage, next to the local database.
 *
 * Sync is best-effort by design at this stage: a failed mirror logs a warning
 * and the local booking stands. Reads still come from the local store — the
 * read-path migration is a later phase.
 */

/**
 * Local catalogue id → Supabase doctor uuid.
 * MUST match the fixed uuids seeded by `supabase/bookings_setup.sql`.
 */
export const SUPABASE_DOCTOR_IDS: Record<string, string> = {
  "doc-chidinma-okonkwo": "d0000000-0000-4000-8000-000000000001",
  "doc-adebayo-oyeleke": "d0000000-0000-4000-8000-000000000002",
  "doc-zainab-bello": "d0000000-0000-4000-8000-000000000003",
  "doc-emeka-nwachukwu": "d0000000-0000-4000-8000-000000000004",
  "doc-aisha-suleiman": "d0000000-0000-4000-8000-000000000005",
  "doc-eghosa-omoregie": "d0000000-0000-4000-8000-000000000006",
  "doc-ngozi-umeh": "d0000000-0000-4000-8000-000000000007",
  "doc-ibrahim-danjuma": "d0000000-0000-4000-8000-000000000008",
  "doc-folake-adeyemi": "d0000000-0000-4000-8000-000000000009",
  "doc-uche-obi": "d0000000-0000-4000-8000-000000000010",
  "doc-halima-yusuf": "d0000000-0000-4000-8000-000000000011",
  "doc-haruna-bala": "d0000000-0000-4000-8000-000000000012",
};

const MAP_KEY = "carenow.supabase.bookings";

type IdMap = Record<string, string>;

function readMap(): IdMap {
  try {
    const raw = localStorage.getItem(MAP_KEY);
    return raw ? (JSON.parse(raw) as IdMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: IdMap): void {
  try {
    localStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    // Storage full/blocked: sync continues, the mapping just won't persist.
  }
}

function warn(what: string, error: unknown): void {
  console.warn(
    `[carenow] Supabase booking sync failed (${what}):`,
    error instanceof Error ? error.message : error,
  );
}

/** Mirror a freshly created booking. Returns the Supabase booking id, if any. */
export async function syncBookingCreated(booking: Booking): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const existing = readMap()[booking.id];
  if (existing) return existing;

  const doctorId = SUPABASE_DOCTOR_IDS[booking.doctorId];
  if (!doctorId) {
    warn("create", `no Supabase doctor mapped for ${booking.doctorId}`);
    return null;
  }

  try {
    const { data, error } = await supabase.rpc("book_appointment", {
      p_doctor_id: doctorId,
      p_starts_at: booking.startsAt,
      p_duration_mins: booking.durationMins,
      p_reason: booking.intake.reason,
      p_notes: booking.intake.notes,
      p_duration: booking.intake.duration,
      p_severity: booking.intake.severity,
      p_share_history: booking.intake.attachProfileHistory,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) throw new Error("book_appointment returned no booking");
    const map = readMap();
    map[booking.id] = row.id as string;
    writeMap(map);
    return row.id as string;
  } catch (e) {
    warn("create", e);
    return null;
  }
}

/** The Supabase id for a local booking, creating the mirror first if needed. */
async function ensureMirrored(booking: Booking): Promise<string | null> {
  return readMap()[booking.id] ?? (await syncBookingCreated(booking));
}

/** Mirror a successful (simulated) payment: booking becomes confirmed. */
export async function syncBookingPaid(booking: Booking): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const bookingId = await ensureMirrored(booking);
    if (!bookingId) return;
    const { error } = await supabase.rpc("confirm_payment", {
      p_booking_id: bookingId,
      p_provider: "simulated-card",
      p_reference: booking.reference,
    });
    if (error) throw error;
  } catch (e) {
    warn("pay", e);
  }
}

/** Mirror a cancellation (the RPC applies the same refund rule server-side). */
export async function syncBookingCancelled(booking: Booking, reason: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const bookingId = await ensureMirrored(booking);
    if (!bookingId) return;
    const { error } = await supabase.rpc("cancel_booking", {
      p_booking_id: bookingId,
      p_reason: reason,
    });
    if (error) throw error;
  } catch (e) {
    warn("cancel", e);
  }
}

/** Mirror a reschedule; `booking` must already carry the NEW start time. */
export async function syncBookingRescheduled(booking: Booking): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const bookingId = await ensureMirrored(booking);
    if (!bookingId) return;
    const { error } = await supabase.rpc("reschedule_booking", {
      p_booking_id: bookingId,
      p_new_starts_at: booking.startsAt,
      p_new_duration_mins: booking.durationMins,
    });
    if (error) throw error;
  } catch (e) {
    warn("reschedule", e);
  }
}
