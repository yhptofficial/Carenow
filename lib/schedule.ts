import type { Doctor, DoctorAvailabilityDay, NextAvailability, Slot } from "./types";

/* ------------------------------------------------------------------ *
 * Deterministic availability engine
 *
 * In production the open-slot list comes from Postgres. For v1 the PWA runs
 * against a seeded catalogue, so we derive a *stable* weekly rota per doctor
 * from a hash of their id. The same inputs always produce the same slots,
 * which means a slot a patient taps is the slot they book.
 * ------------------------------------------------------------------ */

const SLOT_STEP_MINS = 20;
const DAYS_AHEAD = 14;
/** How long before a slot starts it stops being bookable. */
const LEAD_TIME_MINS = 20;

/** FNV-1a — small, fast, and stable across reloads. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic value in [0, 1). */
function rand(seed: string): number {
  return (hash(seed) % 100000) / 100000;
}

export interface DoctorRota {
  /** First slot start hour, local time. */
  startHour: number;
  /** Last slot start hour, local time (exclusive end of the day). */
  endHour: number;
  worksSaturday: boolean;
  worksSunday: boolean;
  /** 20 for most clinics; psychiatry books longer first sessions. */
  slotMins: number;
}

export function rota(doctor: Doctor): DoctorRota {
  const r = rand(doctor.id);
  const long = doctor.specialty === "mental-health";
  // Clinicians with higher volume tend to open earlier; a few work late evenings.
  const startHour = r > 0.72 ? 11 : r > 0.35 ? 9 : 10;
  const endHour = r > 0.85 ? 21 : r > 0.5 ? 19 : 18;
  return {
    startHour,
    endHour,
    worksSaturday: rand(doctor.id + "sat") > 0.25,
    worksSunday: rand(doctor.id + "sun") > 0.85,
    slotMins: long ? 45 : SLOT_STEP_MINS,
  };
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function toISODate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Every slot a doctor could offer on one calendar day, before real bookings are
 * overlaid. Sundays/Saturdays follow the rota; today is trimmed to the lead time.
 */
export function slotsForDay(doctor: Doctor, day: Date, now = new Date()): Slot[] {
  const r = rota(doctor);
  const weekday = day.getDay();
  if (weekday === 0 && !r.worksSunday) return [];
  if (weekday === 6 && !r.worksSaturday) return [];

  const slots: Slot[] = [];
  const dayStart = startOfDay(day);

  // Today: never offer a slot we can't email a reminder for.
  const earliest = dayStart.getTime() === startOfDay(now).getTime()
    ? now.getTime() + LEAD_TIME_MINS * 60_000
    : -Infinity;

  for (let h = r.startHour; h < r.endHour; h++) {
    for (let m = 0; m < 60; m += r.slotMins) {
      const start = new Date(dayStart);
      start.setHours(h, m, 0, 0);
      if (start.getTime() < earliest) continue;

      const id = `${doctor.id}_${toISODate(day)}_${h}${`${m}`.padStart(2, "0")}`;
      // Pre-existing demand: roughly a third of the rota is already gone.
      const taken = rand(id) < 0.34;

      slots.push({
        id,
        doctorId: doctor.id,
        startsAt: start.toISOString(),
        durationMins: r.slotMins,
        status: taken ? "booked" : "open",
      });
    }
  }
  return slots;
}

/** The next `days` days of availability, with the current turn's bookings applied. */
export function availability(
  doctor: Doctor,
  bookingsAtSlot: Map<string, { id: string }>,
  days = DAYS_AHEAD,
  now = new Date(),
): DoctorAvailabilityDay[] {
  const out: DoctorAvailabilityDay[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const slots = slotsForDay(doctor, day, now).map((slot) => {
      const booking = bookingsAtSlot.get(slot.id);
      return booking ? { ...slot, status: "booked" as const, bookingId: booking.id } : slot;
    });
    if (slots.length === 0) continue;
    out.push({
      date: toISODate(day),
      label: dayLabel(day, now),
      weekday: day.toLocaleDateString(undefined, { weekday: "short" }),
      slots,
    });
  }
  return out;
}

export function dayLabel(day: Date, now = new Date()): string {
  const a = startOfDay(day).getTime();
  const b = startOfDay(now).getTime();
  const diffDays = Math.round((a - b) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** The headline availability shown on a doctor card: "Today · 6:30 PM". */
export function nextAvailability(
  doctor: Doctor,
  bookingsAtSlot: Map<string, { id: string }>,
  now = new Date(),
): NextAvailability | null {
  const days = availability(doctor, bookingsAtSlot, 7, now);
  for (const day of days) {
    const open = day.slots.find((s) => s.status === "open");
    if (open) {
      const start = new Date(open.startsAt).getTime();
      return {
        slotId: open.id,
        startsAt: open.startsAt,
        dayLabel: day.label,
        timeLabel: timeLabel(open.startsAt),
        soon: start - now.getTime() <= 2 * 60 * 60 * 1000,
      };
    }
  }
  return null;
}

/** Slot that is currently joinable: started up to 10 min ago, not yet ended. */
export function isJoinable(startsAt: string, durationMins: number, now = new Date()): boolean {
  const start = new Date(startsAt).getTime();
  const graceMins = 10;
  const end = start + (durationMins + 15) * 60_000;
  return now.getTime() >= start - graceMins * 60_000 && now.getTime() <= end;
}

export function minutesUntil(iso: string, now = new Date()): number {
  return Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);
}

/** "in 2h 15m" / "in 12m" / "now" — used on booking cards. */
export function relativeCountdown(iso: string, now = new Date()): string {
  const mins = minutesUntil(iso, now);
  if (mins <= 0) return "Starting now";
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `in ${h}h ${m}m` : `in ${h}h`;
  const d = Math.floor(h / 24);
  return `in ${d} day${d > 1 ? "s" : ""}`;
}

export const SCHEDULE_DAYS_AHEAD = DAYS_AHEAD;
export const SCHEDULE_LEAD_TIME_MINS = LEAD_TIME_MINS;
