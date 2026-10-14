/**
 * CareNow business rules.
 *
 * Every rule the product depends on lives here as a pure function so it can be
 * unit-tested without a browser, a database or a render. `lib/store.ts` and the
 * screens call these rather than re-implementing the logic — that is what keeps
 * the cancellation policy in the checkout copy identical to the one that
 * actually decides a refund.
 */

import { DEFAULT_CURRENCY, formatMoney } from "./currency";
import type { BookingStatus, Currency, Medication, PaymentStatus } from "./types";

/* ------------------------------------------------------------------ *
 * Policy constants
 * ------------------------------------------------------------------ */

/** Free cancellation window, in hours before the start time. */
export const FREE_CANCELLATION_HOURS = 2;

/** How long a patient may wait for a doctor before a no-show refund is due. */
export const NO_SHOW_GRACE_MINS = 10;

/** A slot must be at least this far out to be bookable (reminder lead time). */
export const MIN_BOOKING_LEAD_MINS = 20;

/** A room opens this many minutes before the slot starts. */
export const JOIN_OPENS_MINS_BEFORE = 10;

/** Grace period after the slot starts during which the room is still open. */
export const JOIN_CLOSES_MINS_AFTER = 15;

/** Reminder lead time before the slot starts. */
export const REMINDER_LEAD_MINS = 30;

/* ------------------------------------------------------------------ *
 * Booking
 * ------------------------------------------------------------------ */

export interface SlotLike {
  startsAt: string;
  durationMins: number;
  status?: "open" | "booked";
}

/** A doctor must be manually verified before they can be discovered or booked. */
export function isBookable(doctor: { verified: boolean }): boolean {
  return doctor.verified === true;
}

/** Reasons a slot cannot be booked, in the order a patient would hit them. */
export function slotBlockReason(
  slot: SlotLike | null | undefined,
  now: Date = new Date(),
): "missing" | "taken" | "too_soon" | null {
  if (!slot) return "missing";
  if (slot.status && slot.status !== "open") return "taken";
  if (new Date(slot.startsAt).getTime() < now.getTime() + MIN_BOOKING_LEAD_MINS * 60_000) {
    return "too_soon";
  }
  return null;
}

export function canBookSlot(slot: SlotLike | null | undefined, now: Date = new Date()): boolean {
  return slotBlockReason(slot, now) === null;
}

/* ------------------------------------------------------------------ *
 * Payment
 * ------------------------------------------------------------------ */

export type PaymentOutcome = "paid" | "requires_3ds" | "declined";

/**
 * Simulated provider response. Card numbers are the same test fixtures the
 * checkout screen advertises, so what the UI promises is what the logic does.
 */
export function paymentOutcomeFor(cardNumber: string): PaymentOutcome {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.startsWith("0002")) return "declined";
  if (digits.startsWith("4000")) return "requires_3ds";
  return "paid";
}

/** Card number is plausible: 15–19 digits after stripping separators. */
export function isValidCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  return digits.length >= 15 && digits.length <= 19;
}

/** Last four digits, for receipts. Never store or display more than this. */
export function last4(cardNumber: string): string {
  return cardNumber.replace(/\D/g, "").slice(-4);
}

/** A booking is confirmed only once the money has landed. */
export function statusAfterPayment(payment: PaymentStatus): BookingStatus | null {
  return payment === "paid" ? "confirmed" : null;
}

/* ------------------------------------------------------------------ *
 * Cancellation and no-shows
 * ------------------------------------------------------------------ */

export function hoursUntil(iso: string, now: Date = new Date()): number {
  return (new Date(iso).getTime() - now.getTime()) / 3_600_000;
}

/**
 * Inside the free window a paid consultation is refunded in full. This is the
 * single source of truth for the refund promise shown in checkout, the
 * cancellation sheet, and the booking detail panel.
 */
export function isRefundableOnCancel(
  booking: { startsAt: string; payment: { status: PaymentStatus } },
  now: Date = new Date(),
): boolean {
  if (booking.payment.status !== "paid") return false;
  return hoursUntil(booking.startsAt, now) >= FREE_CANCELLATION_HOURS;
}

export function cancellationOutcome(
  booking: {
    startsAt: string;
    payment: { status: PaymentStatus; amount: number; currency?: Currency };
  },
  now: Date = new Date(),
): { refunded: boolean; message: string } {
  if (booking.payment.status !== "paid") {
    return {
      refunded: false,
      message: "No payment was taken for this consultation, so cancelling is free.",
    };
  }
  if (isRefundableOnCancel(booking, now)) {
    return {
      refunded: true,
      message: `Full refund of ${formatMoney(booking.payment.amount, booking.payment.currency)} issued to your original payment method (5–7 working days).`,
    };
  }
  return {
    refunded: false,
    message:
      "Cancelled inside the 2-hour window, so this consultation isn't refundable. You can reschedule at no cost instead.",
  };
}

/**
 * A no-show refund becomes available once the patient has waited the grace
 * period past the start time. Before then, the doctor may still join.
 */
export function isNoShowResolvable(
  booking: { startsAt: string; status: BookingStatus },
  now: Date = new Date(),
): boolean {
  if (booking.status !== "confirmed" && booking.status !== "in_progress") return false;
  const waitedMins = (now.getTime() - new Date(booking.startsAt).getTime()) / 60_000;
  return waitedMins >= NO_SHOW_GRACE_MINS;
}

export function noShowResolution(amount: number, currency: Currency = DEFAULT_CURRENCY): string {
  return `Nobody joined within ${NO_SHOW_GRACE_MINS} minutes, so the full fee of ${formatMoney(amount, currency)} has been refunded to your original payment method.`;
}

/* ------------------------------------------------------------------ *
 * Joining a consultation
 * ------------------------------------------------------------------ */

export interface JoinableLike {
  startsAt: string;
  durationMins: number;
  status: BookingStatus;
  payment: { status: PaymentStatus };
}

/**
 * The room opens ten minutes before the slot and closes fifteen minutes after
 * the slot would have ended. Payment must be captured first — this is the rule
 * that stops an unpaid consultation from being treated.
 */
export function joinState(
  booking: JoinableLike | null | undefined,
  now: Date = new Date(),
): { canJoin: boolean; reason: "ok" | "unpaid" | "too_early" | "closed" | "inactive" } {
  if (!booking) return { canJoin: false, reason: "inactive" };
  if (booking.payment.status !== "paid") return { canJoin: false, reason: "unpaid" };

  if (booking.status === "cancelled" || booking.status === "no_show") {
    return { canJoin: false, reason: "inactive" };
  }

  const start = new Date(booking.startsAt).getTime();
  const end = start + (booking.durationMins + JOIN_CLOSES_MINS_AFTER) * 60_000;
  const nowMs = now.getTime();

  if (nowMs < start - JOIN_OPENS_MINS_BEFORE * 60_000) return { canJoin: false, reason: "too_early" };
  if (nowMs > end) return { canJoin: false, reason: "closed" };
  return { canJoin: true, reason: "ok" };
}

export function canJoinConsultation(booking: JoinableLike | null | undefined, now: Date = new Date()): boolean {
  return joinState(booking, now).canJoin;
}

/* ------------------------------------------------------------------ *
 * Prescribing
 * ------------------------------------------------------------------ */

export interface PrescriptionDraft {
  diagnosis: string;
  medications: Medication[];
  advice: string;
  doctorNotes?: string;
}

export interface ValidationResult {
  valid: boolean;
  /** Field-keyed messages, so the UI can point at the offending input. */
  errors: Record<string, string>;
}

const MIN_DIAGNOSIS_CHARS = 3;
const MIN_ADVICE_CHARS = 10;

/**
 * A prescription that a pharmacist cannot fill is a patient-safety incident, so
 * every medicine must carry a name, dose, frequency and duration. Advice is
 * mandatory too: a prescription with no instructions is how people take the
 * wrong dose.
 */
export function validatePrescription(draft: PrescriptionDraft): ValidationResult {
  const errors: Record<string, string> = {};

  if (draft.diagnosis.trim().length < MIN_DIAGNOSIS_CHARS) {
    errors.diagnosis = "Enter a diagnosis of at least 3 characters.";
  }

  if (draft.medications.length === 0) {
    errors.medications = "Add at least one medicine, or issue advice only.";
  } else {
    draft.medications.forEach((m, i) => {
      const label = `medications.${i}`;
      if (!m.name.trim()) errors[label] = "Drug name and strength is required.";
      else if (!m.dosage.trim()) errors[label] = "Dose is required (e.g. 1 tablet).";
      else if (!m.frequency.trim()) errors[label] = "Frequency is required (e.g. twice daily).";
      else if (!m.duration.trim()) errors[label] = "Duration is required (e.g. 5 days).";
    });
  }

  if (draft.advice.trim().length < MIN_ADVICE_CHARS) {
    errors.advice = "Give the patient at least a line of advice.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Follow-up dates are derived, never typed, so they can't disagree with the count. */
export function followUpDate(issuedAt: string, days: number): string | null {
  if (!days || days <= 0) return null;
  return new Date(new Date(issuedAt).getTime() + days * 86_400_000).toISOString();
}

/* ------------------------------------------------------------------ *
 * Access control (the client-side mirror of the RLS policies)
 * ------------------------------------------------------------------ */

/** A patient may read their own record; a doctor only for their own consultation. */
export function canReadPrescription(
  prescription: { patientId: string; doctorId: string },
  viewer: { patientId?: string | null; doctorId?: string | null },
): boolean {
  if (viewer.patientId && viewer.patientId === prescription.patientId) return true;
  if (viewer.doctorId && viewer.doctorId === prescription.doctorId) return true;
  return false;
}

/** A doctor sees a patient's health history only if that patient booked them. */
export function doctorMayReadHealth(
  bookings: { patientId: string; doctorId: string; status: BookingStatus; paymentStatus: PaymentStatus }[],
  doctorId: string,
  patientId: string,
): boolean {
  return bookings.some(
    (b) =>
      b.patientId === patientId &&
      b.doctorId === doctorId &&
      b.paymentStatus === "paid" &&
      (b.status === "confirmed" || b.status === "in_progress" || b.status === "completed"),
  );
}

/* ------------------------------------------------------------------ *
 * Admin console — access control and credential verification
 * ------------------------------------------------------------------ */

/**
 * One admin role, one set of powers.
 *
 * An earlier revision split seats into `owner` and `verifier` scopes so a
 * credentialing officer could not widen their own access. That split has been
 * removed at the product owner's direction: anyone holding the admin role gets
 * the whole console, including the ability to hand out and revoke seats.
 *
 * The one rule that survives is the one about not locking everybody out —
 * see `isLastAdmin()` — because that is a footgun rather than a privilege
 * boundary, and it protects the platform instead of restricting a person.
 */

/**
 * True when removing this seat would leave the platform with no admin at all.
 *
 * Not a permission check: it applies to every seat equally, and it is what
 * stops the last admin from revoking themselves (or being revoked) out of the
 * one screen that can hand a seat back. It is enforced in the store and, in
 * production, by `guard_profile_role()` in `supabase/admin_setup.sql`.
 */
export function isLastAdmin(
  seats: { id: string }[],
  targetId: string,
): boolean {
  return seats.length > 0 && seats.every((seat) => seat.id === targetId);
}

/** MDCN registration numbers are written `MDCN/R/41208`. */
export function isValidLicenceNumber(value: string): boolean {
  return /^MDCN\/[A-Z]{1,3}\/\d{4,6}$/i.test(value.trim());
}

/**
 * Split MDCN numbers never a licence number and never an address.
 *
 * A typo here cannot be caught by the council later: `verified_at` is what the
 * patient-facing listing trusts, so the format is checked before the decision
 * is recorded.
 */
export function licenceNumberError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter the MDCN number you checked against the register.";
  if (!isValidLicenceNumber(trimmed)) {
    return "That doesn't look like an MDCN number. They read MDCN/R/41208.";
  }
  return null;
}

export function rejectionReasonError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 10) {
    return "Give the clinician a reason they can act on (at least 10 characters).";
  }
  return null;
}

/**
 * The other clinician already holding this MDCN number, if any.
 *
 * One registration number is one doctor. Two listings sharing a number means
 * one of them is practising on somebody else's licence — which is the exact
 * failure the manual credential check exists to catch, so it is checked again
 * at the moment of approval and not only by eye.
 */
export function licenceConflict(
  doctors: { id: string; fullName: string; verification: { licenceNumber: string } }[],
  licenceNumber: string,
  exceptDoctorId: string,
): { id: string; fullName: string } | null {
  const wanted = licenceNumber.trim().toUpperCase();
  const clash = doctors.find(
    (d) => d.id !== exceptDoctorId && d.verification.licenceNumber.trim().toUpperCase() === wanted,
  );
  return clash ? { id: clash.id, fullName: clash.fullName } : null;
}

/* ------------------------------------------------------------------ *
 * Platform metrics
 * ------------------------------------------------------------------ */

/** The booking fields the money and volume figures are computed from. */
export interface MetricBooking {
  status: BookingStatus;
  durationMins: number;
  patientId: string;
  doctorId: string;
  payment: { status: PaymentStatus; amount: number };
}

export interface PlatformMetrics {
  total: number;
  /** Confirmed or in progress — a consultation still to happen. */
  upcoming: number;
  completed: number;
  cancelled: number;
  noShow: number;
  awaitingPayment: number;
  /** Captured and kept: paid, and not since refunded. */
  collected: number;
  /** Money returned to patients. */
  refunded: number;
  /** Value of bookings that were never paid for. */
  outstanding: number;
  /** 0–1, over consultations that reached a decision (completed / no-show). */
  noShowRate: number;
  /** 0–1, of every booking taken. */
  completionRate: number;
  /** Minutes of clinical time delivered. */
  consultMinutes: number;
  patients: number;
  doctors: number;
}

/**
 * Everything the console's headline numbers are derived from.
 *
 * Refunded bookings are counted as money returned rather than money kept —
 * the difference between `collected` and `refunded` is what the platform
 * actually held on to, which is the figure an operator is asked for.
 */
export function platformMetrics(bookings: MetricBooking[]): PlatformMetrics {
  const paid = bookings.filter((b) => b.payment.status === "paid");
  const refunded = bookings.filter((b) => b.payment.status === "refunded");
  const completed = bookings.filter((b) => b.status === "completed");
  const noShow = bookings.filter((b) => b.status === "no_show");
  const decided = completed.length + noShow.length;
  const sum = (list: MetricBooking[]) => list.reduce((total, b) => total + b.payment.amount, 0);

  return {
    total: bookings.length,
    upcoming: bookings.filter((b) => b.status === "confirmed" || b.status === "in_progress").length,
    completed: completed.length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
    noShow: noShow.length,
    awaitingPayment: bookings.filter((b) => b.status === "pending_payment").length,
    collected: sum(paid),
    refunded: sum(refunded),
    outstanding: sum(bookings.filter((b) => b.payment.status === "unpaid" || b.payment.status === "failed")),
    noShowRate: decided ? noShow.length / decided : 0,
    completionRate: bookings.length ? completed.length / bookings.length : 0,
    consultMinutes: completed.reduce((total, b) => total + b.durationMins, 0),
    patients: new Set(bookings.map((b) => b.patientId)).size,
    doctors: new Set(bookings.map((b) => b.doctorId)).size,
  };
}

/* ------------------------------------------------------------------ *
 * Misc form rules
 * ------------------------------------------------------------------ */

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, "").length >= 10;
}

export function ageFromDOB(dob: string, now: Date = new Date()): number | undefined {
  if (!dob) return undefined;

  // Parse YYYY-MM-DD as written. `new Date("1997-04-18")` is UTC midnight, which
  // lands on the 17th for anyone west of Greenwich — an off-by-one birthday.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  const year = iso ? Number(iso[1]) : new Date(dob).getFullYear();
  const month = iso ? Number(iso[2]) - 1 : new Date(dob).getMonth();
  const day = iso ? Number(iso[3]) : new Date(dob).getDate();
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;

  // Calendar arithmetic, so a birthday is never a year early or late.
  let years = now.getFullYear() - year;
  const monthDelta = now.getMonth() - month;
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < day)) years -= 1;

  return years >= 0 && years < 130 ? years : undefined;
}

/** Booking references are CN- followed by six unambiguous characters. */
export function isValidBookingReference(reference: string): boolean {
  return /^CN-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(reference);
}
