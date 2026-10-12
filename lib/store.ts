"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  DEMO_PATIENT_EMAIL,
  accentFor,
  bookingReference,
  getServerSnapshot,
  getSnapshot,
  initStore,
  initialsOf,
  mutate,
  readDB,
  resetStore,
  subscribe,
  uid,
} from "./db";
import { SPECIALTIES, specialtyLabel } from "./catalog";
import {
  availability as buildAvailability,
  nextAvailability,
  rota,
  slotsForDay,
  timeLabel,
  toISODate,
} from "./schedule";
import {
  cancellationOutcome,
  canJoinConsultation,
  canReadPrescription,
  isValidCardNumber,
  last4,
  paymentOutcomeFor,
  slotBlockReason,
  validatePrescription,
  type PrescriptionDraft,
} from "./rules";
import type {
  AuditEntry,
  Booking,
  Database,
  ConsentRecord,
  Doctor,
  DoctorAvailabilityDay,
  Intake,
  Medication,
  NextAvailability,
  PatientProfile,
  Prescription,
  Rating,
  SpecialtyId,
} from "./types";

/* ------------------------------------------------------------------ *
 * Errors — surfaced to the UI as inline messages, never as raw throws.
 * ------------------------------------------------------------------ */

export type CareNowErrorCode =
  | "slot_taken"
  | "not_signed_in"
  | "already_paid"
  | "invalid_card"
  | "not_found"
  | "not_allowed";

/**
 * Errors the patient is expected to see and act on.
 *
 * Fields are declared explicitly rather than via constructor parameter
 * properties, because those are not valid "erasable" TypeScript — and the test
 * suite imports this module directly with Node's type stripping.
 */
export class CareNowError extends Error {
  code: CareNowErrorCode;
  hint?: string;

  constructor(message: string, code: CareNowErrorCode, hint?: string) {
    super(message);
    this.name = "CareNowError";
    this.code = code;
    this.hint = hint;
  }
}

/* ------------------------------------------------------------------ *
 * Audit
 * ------------------------------------------------------------------ */

function auditEntry(
  actorType: AuditEntry["actorType"],
  actorId: string,
  action: AuditEntry["action"],
  subjectType: AuditEntry["subjectType"],
  subjectId: string,
  detail?: string,
): AuditEntry {
  return {
    id: uid("au"),
    at: new Date().toISOString(),
    actorType,
    actorId,
    action,
    subjectType,
    subjectId,
    detail,
  };
}

function audit(
  actorType: AuditEntry["actorType"],
  actorId: string,
  action: AuditEntry["action"],
  subjectType: AuditEntry["subjectType"],
  subjectId: string,
  detail?: string,
) {
  mutate((d) => {
    d.audit.push(auditEntry(actorType, actorId, action, subjectType, subjectId, detail));
    if (d.audit.length > 500) d.audit.splice(0, d.audit.length - 500);
  });
}

/* ------------------------------------------------------------------ *
 * Projections
 * ------------------------------------------------------------------ */

export interface BookingView extends Booking {
  doctor: Doctor;
  slot: { startsAt: string; durationMins: number } | null;
  /** True when the consult is inside its join window. */
  joinable: boolean;
  /** Countdown label for the card. */
  countdown: string;
}

function doctorById(id: string): Doctor | undefined {
  return readDB().doctors.find((d) => d.id === id);
}

/** Slots already claimed, as a lookup the availability engine can overlay. */
function bookedSlots(excludeBookingId?: string): Map<string, { id: string }> {
  const map = new Map<string, { id: string }>();
  const active: Booking["status"][] = ["pending_payment", "confirmed", "in_progress", "completed"];
  for (const b of readDB().bookings) {
    if (!active.includes(b.status)) continue;
    if (excludeBookingId && b.id === excludeBookingId) continue;
    map.set(b.slotId, { id: b.id });
  }
  return map;
}

function decorate(booking: Booking): BookingView | null {
  const doctor = doctorById(booking.doctorId);
  if (!doctor) return null;
  const now = new Date();
  // The join window is a shared rule so the patient room and the clinician
  // dashboard can never disagree about whether a consult is open.
  const joinable = canJoinConsultation(
    {
      startsAt: booking.startsAt,
      durationMins: booking.durationMins,
      status: booking.status,
      payment: { status: booking.payment.status },
    },
    now,
  );
  return {
    ...booking,
    doctor,
    slot: { startsAt: booking.startsAt, durationMins: booking.durationMins },
    joinable,
    countdown: countdownLabel(booking, now),
  };
}

function countdownLabel(booking: Booking, now: Date): string {
  const start = new Date(booking.startsAt).getTime();
  const diff = start - now.getTime();
  if (booking.status === "completed") return "Completed";
  if (booking.status === "cancelled") return "Cancelled";
  if (booking.status === "no_show") return "Missed";
  if (booking.status === "pending_payment") return "Awaiting payment";
  if (diff > 0) {
    const mins = Math.round(diff / 60_000);
    if (mins < 60) return `Starts in ${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h < 24) return m ? `Starts in ${h}h ${m}m` : `Starts in ${h}h`;
    const d = Math.floor(h / 24);
    return `Starts in ${d} day${d > 1 ? "s" : ""}`;
  }
  if (diff > -15 * 60_000) return "Waiting for your doctor";
  return "Room closed";
}

/* ------------------------------------------------------------------ *
 * The hook
 * ------------------------------------------------------------------ */

/**
 * Raw store access for screens that only need the session (headers, gates).
 * Heavier screens use `useStore()`, which additionally exposes the command API.
 */
export function useCareNow() {
  const snap = useSyncExternalStore(subscribeOnClient, getSnapshot, getServerSnapshot);
  const db = snap.db;
  return {
    db,
    ready: snap.ready,
    session: db.session,
    patient: db.session,
    doctorSession: db.doctorSession
      ? (db.doctors.find((d) => d.id === db.doctorSession!.doctorId) ?? null)
      : null,
    doctor: db.doctorSession
      ? (db.doctors.find((d) => d.id === db.doctorSession!.doctorId) ?? null)
      : null,
  };
}

/**
 * `useSyncExternalStore` requires a stable subscribe function. This wrapper makes
 * sure the localStorage read has happened before the first client snapshot is
 * taken, without changing the subscribe identity between renders.
 */
function subscribeOnClient(listener: () => void) {
  initStore();
  return subscribe(listener);
}

/**
 * Builds the command API for one database snapshot.
 *
 * Exported so it can be exercised outside a React render (the integration tests
 * drive the whole book → pay → consult → prescribe flow through it) and so a
 * screen can run a command without going through the hook.
 */
export function createStoreApi(db: Database, ready: boolean) {
  const session = db.session;

  return {
      ready,
      db,
      session,
      patient: session,
      signedIn: Boolean(session),
      doctorSession: db.doctorSession
        ? (db.doctors.find((d) => d.id === db.doctorSession!.doctorId) ?? null)
        : null,

      /* ---------------- Doctors ---------------- */

      /** Verified doctors only — the PRD's manual-verification gate. */
      listDoctors(filter?: { specialty?: SpecialtyId | "all"; query?: string }): DoctorView[] {
        const specialty = filter?.specialty ?? "all";
        const q = (filter?.query ?? "").trim().toLowerCase();
        const map = bookedSlots();
        const now = new Date();

        return db.doctors
          .filter((d) => d.verified)
          .filter((d) => (specialty === "all" ? true : d.specialty === specialty))
          .filter((d) => (q ? matches(d, q) : true))
          .map((doctor) => ({
            doctor,
            next: nextAvailability(doctor, map, now),
            initials: initialsOf(doctor.fullName),
            specialtyLabel: specialtyLabel(doctor.specialty),
          }))
          .sort((a, b) => {
            // Soonest available first; unrated-on-CareNow doctors break ties.
            const av = a.next ? new Date(a.next.startsAt).getTime() : Infinity;
            const bv = b.next ? new Date(b.next.startsAt).getTime() : Infinity;
            if (av !== bv) return av - bv;
            return b.doctor.rating - a.doctor.rating;
          });
      },

      getDoctor(id: string): { doctor: Doctor; initials: string; specialtyLabel: string } | null {
        const doctor = db.doctors.find((d) => d.id === id);
        if (!doctor) return null;
        return {
          doctor,
          initials: initialsOf(doctor.fullName),
          specialtyLabel: specialtyLabel(doctor.specialty),
        };
      },

      slotsFor(doctorId: string, days = 14, excludeBookingId?: string): DoctorAvailabilityDay[] {
        const doctor = db.doctors.find((d) => d.id === doctorId);
        if (!doctor) return [];
        return buildAvailability(doctor, bookedSlots(excludeBookingId), days, new Date());
      },

      nextAvailabilityFor(doctorId: string): NextAvailability | null {
        const doctor = db.doctors.find((d) => d.id === doctorId);
        if (!doctor) return null;
        return nextAvailability(doctor, bookedSlots(), new Date());
      },

      specialties: SPECIALTIES,

      /* ---------------- Auth & profile ---------------- */

      signIn(input: { email?: string; phone?: string; name?: string }): PatientProfile {
        const email = input.email?.trim().toLowerCase() || undefined;
        const phone = input.phone?.trim() || undefined;

        const existing = db.patients.find(
          (p) =>
            (email && p.email?.toLowerCase() === email) || (phone && p.phone === phone),
        );

        if (existing) {
          mutate((d) => {
            d.session = existing;
            d.audit.push(auditEntry("patient", existing.id, "sign_in", "session", existing.id));
          });
          return existing;
        }

        const name = input.name?.trim() || nameFromIdentity(email, phone);
        const created: PatientProfile = {
          id: uid("pt"),
          role: "patient",
          fullName: name,
          email,
          phone,
          location: "Coimbatore",
          allergies: [],
          conditions: [],
          currentMedications: [],
          accent: accentFor(name),
          reminderChannels: ["email", "sms"],
          createdAt: new Date().toISOString(),
        };
        mutate((d) => {
          d.patients.push(created);
          d.session = created;
          d.audit.push(auditEntry("patient", created.id, "sign_in", "session", created.id, "New account"));
        });
        return created;
      },

      signInDemo(): void {
        const demo = db.patients.find((p) => p.email === DEMO_PATIENT_EMAIL) ?? seedFallback();
        mutate((d) => {
          if (!d.patients.some((p) => p.id === demo.id)) d.patients.push(demo);
          d.session = demo;
          d.audit.push(auditEntry("patient", demo.id, "sign_in", "session", demo.id, "Demo account"));
        });
      },

      signInDoctor(doctorId: string): void {
        mutate((d) => {
          d.doctorSession = { doctorId };
          d.audit.push(auditEntry("doctor", doctorId, "sign_in", "session", doctorId));
        });
      },

      signOut(): void {
        mutate((d) => {
          d.session = null;
          d.doctorSession = null;
        });
      },

      acceptConsent(args: { healthDataConsent: boolean; recordingConsent: boolean }): void {
        if (!session) throw new CareNowError("Sign in first.", "not_signed_in");
        const record: ConsentRecord = {
          version: CONSENT_VERSION,
          acceptedAt: new Date().toISOString(),
          ...args,
        };
        mutate((d) => {
          const p = d.patients.find((x) => x.id === session.id);
          if (p) p.consent = record;
          if (d.session) d.session = { ...d.session, consent: record };
          d.audit.push(
            auditEntry("patient", session.id, "consent_accepted", "patient", session.id, `v${CONSENT_VERSION}`),
          );
        });
      },

      updateProfile(patch: Partial<PatientProfile>): void {
        if (!session) throw new CareNowError("Sign in first.", "not_signed_in");
        mutate((d) => {
          const p = d.patients.find((x) => x.id === session.id);
          if (p) Object.assign(p, patch);
          d.session = p ? { ...p } : d.session;
          d.audit.push(
            auditEntry("patient", session.id, "profile_updated", "patient", session.id, Object.keys(patch).join(", ")),
          );
        });
      },

      hasConsent(): boolean {
        return Boolean(session?.consent?.healthDataConsent);
      },

      /* ---------------- Booking ---------------- */

      createBooking(args: { doctorId: string; slotId: string; intake: Intake }): Booking {
        if (!session) throw new CareNowError("Sign in to book.", "not_signed_in");
        const doctor = db.doctors.find((d) => d.id === args.doctorId);
        if (!doctor) throw new CareNowError("That doctor is no longer listed.", "not_found");
        if (!doctor.verified) {
          throw new CareNowError("This doctor is still being verified.", "not_allowed");
        }

        // Re-derive the slot from the engine rather than trusting the caller.
        const day = new Date(args.slotId.includes("_") ? parseSlotDate(args.slotId) : Date.now());
        const slots = slotsForDay(doctor, day, new Date());
        const slot = slots.find((s) => s.id === args.slotId);
        if (!slot) throw new CareNowError("That slot is no longer offered.", "not_found");
        const blocked = slotBlockReason(
          { ...slot, status: bookedSlots().has(slot.id) ? "booked" : slot.status },
          new Date(),
        );
        if (blocked === "taken") {
          throw new CareNowError("That slot was just taken.", "slot_taken", "Pick another time.");
        }
        if (blocked === "too_soon") {
          throw new CareNowError(
            "That slot is less than 20 minutes away.",
            "slot_taken",
            "Book a later time so there's room for a reminder.",
          );
        }

        const booking: Booking = {
          id: uid("bk"),
          reference: bookingReference(),
          patientId: session.id,
          doctorId: doctor.id,
          slotId: slot.id,
          startsAt: slot.startsAt,
          durationMins: slot.durationMins,
          status: "pending_payment",
          intake: args.intake,
          payment: {
            status: "unpaid",
            provider: "stripe",
            amount: doctor.consultationFee,
            currency: doctor.currency,
          },
          reminders: {
            scheduledFor: new Date(new Date(slot.startsAt).getTime() - 30 * 60_000).toISOString(),
            channels: session.reminderChannels,
          },
          createdAt: new Date().toISOString(),
        };

        mutate((d) => {
          d.bookings.push(booking);
          d.audit.push(
            auditEntry("patient", session.id, "booking_created", "booking", booking.id, doctor.fullName),
          );
        });
        return booking;
      },

      getBooking(id: string): BookingView | null {
        const b = db.bookings.find((x) => x.id === id);
        if (!b) return null;
        return decorate(b);
      },

      /** All of the signed-in patient's bookings, newest first. */
      myBookings(): BookingView[] {
        if (!session) return [];
        return db.bookings
          .filter((b) => b.patientId === session.id)
          .map(decorate)
          .filter((b): b is BookingView => Boolean(b))
          .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
      },

      upcomingBookings(): BookingView[] {
        return this.myBookings()
          .filter((b) => b.status === "confirmed" || b.status === "in_progress" || b.status === "pending_payment")
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      },

      pastBookings(): BookingView[] {
        return this.myBookings().filter((b) =>
          b.status === "completed" || b.status === "cancelled" || b.status === "no_show",
        );
      },

      /**
       * Simulated payment. A card number starting `0002` is declined and `0001`
       * requires 3-D Secure, so both failure paths in the PRD are reachable.
       */
      payBooking(bookingId: string, card: { number: string; expiry: string; cvc: string; name: string }): void {
        if (!session) throw new CareNowError("Sign in to pay.", "not_signed_in");
        if (!isValidCardNumber(card.number)) {
          throw new CareNowError(
            "That card number doesn't look right.",
            "invalid_card",
            "Check the digits and try again.",
          );
        }

        const outcome = paymentOutcomeFor(card.number);
        const booking = db.bookings.find((b) => b.id === bookingId);
        if (!booking) throw new CareNowError("Booking not found.", "not_found");
        if (booking.payment.status === "paid") {
          throw new CareNowError("This consultation is already paid for.", "already_paid");
        }

        if (outcome === "declined") {
          mutate((d) => {
            const b = d.bookings.find((x) => x.id === bookingId)!;
            b.payment.status = "failed";
            b.payment.failureReason = "Your bank declined the payment (insufficient funds).";
            d.audit.push(
              auditEntry("patient", session.id, "payment_failed", "booking", bookingId, "card_declined"),
            );
          });
          throw new CareNowError(
            "Your bank declined that card.",
            "invalid_card",
            "Try a different card or pay on the day of the consultation.",
          );
        }

        mutate((d) => {
          const b = d.bookings.find((x) => x.id === bookingId)!;
          b.payment.status = "paid";
          b.payment.reference = `pi_${last4(card.number)}${Date.now().toString(36)}`;
          b.payment.paidAt = new Date().toISOString();
          b.payment.failureReason = undefined;
          b.status = "confirmed";
          d.audit.push(auditEntry("patient", session.id, "payment_captured", "booking", bookingId));
        });
      },

      cancelBooking(bookingId: string, reason: string): void {
        if (!session) throw new CareNowError("Sign in first.", "not_signed_in");
        const booking = db.bookings.find((b) => b.id === bookingId);
        if (!booking) throw new CareNowError("Booking not found.", "not_found");

        const outcome = cancellationOutcome(booking, new Date());

        mutate((d) => {
          const b = d.bookings.find((x) => x.id === bookingId)!;
          b.status = "cancelled";
          b.cancelledAt = new Date().toISOString();
          b.cancelReason = reason;
          if (outcome.refunded) {
            b.payment.status = "refunded";
            b.payment.refundedAt = new Date().toISOString();
          }
          b.resolution = outcome.message;
          d.audit.push(auditEntry("patient", session.id, "booking_cancelled", "booking", bookingId, reason));
          if (outcome.refunded) {
            d.audit.push(auditEntry("system", "system", "refund_issued", "booking", bookingId));
          }
        });
      },

      rescheduleBooking(bookingId: string, newSlotId: string): void {
        if (!session) throw new CareNowError("Sign in first.", "not_signed_in");
        const booking = db.bookings.find((b) => b.id === bookingId);
        if (!booking) throw new CareNowError("Booking not found.", "not_found");
        const doctor = db.doctors.find((d) => d.id === booking.doctorId);
        if (!doctor) throw new CareNowError("Doctor not found.", "not_found");

        const day = new Date(parseSlotDate(newSlotId));
        const slot = slotsForDay(doctor, day, new Date()).find((s) => s.id === newSlotId);
        if (!slot) throw new CareNowError("That slot is no longer offered.", "not_found");
        if (bookedSlots(bookingId).has(slot.id)) {
          throw new CareNowError("That slot was just taken.", "slot_taken");
        }

        mutate((d) => {
          const b = d.bookings.find((x) => x.id === bookingId)!;
          b.slotId = slot.id;
          b.startsAt = slot.startsAt;
          b.durationMins = slot.durationMins;
          b.reminders.scheduledFor = new Date(new Date(slot.startsAt).getTime() - 30 * 60_000).toISOString();
          b.reminders.sentAt = undefined;
          b.status = b.payment.status === "paid" ? "confirmed" : "pending_payment";
          d.audit.push(
            auditEntry("patient", session.id, "booking_rescheduled", "booking", bookingId, timeLabel(slot.startsAt)),
          );
        });
      },

      /* ---------------- Consultation ---------------- */

      /** Called when the patient enters the room. Mints a room URL on first use. */
      startConsult(bookingId: string): string {
        const booking = db.bookings.find((b) => b.id === bookingId);
        if (!booking) throw new CareNowError("Booking not found.", "not_found");
        if (booking.payment.status !== "paid") {
          throw new CareNowError("Payment is still pending.", "not_allowed", "Pay to unlock the room.");
        }
        const existing = booking.roomUrl;
        if (existing) return existing;

        const room = `https://carenow.daily.co/${booking.reference.toLowerCase()}`;
        mutate((d) => {
          const b = d.bookings.find((x) => x.id === bookingId)!;
          b.roomUrl = room;
          if (b.status === "confirmed") b.status = "in_progress";
          d.audit.push(
            auditEntry(
              session ? "patient" : "system",
              session?.id ?? "system",
              "consult_started",
              "booking",
              bookingId,
            ),
          );
        });
        return room;
      },

      endConsult(bookingId: string): void {
        mutate((d) => {
          const b = d.bookings.find((x) => x.id === bookingId);
          if (!b) return;
          b.status = b.payment.status === "paid" ? "completed" : b.status;
          b.endedAt = new Date().toISOString();
          d.audit.push(auditEntry("doctor", b.doctorId, "consult_ended", "booking", bookingId));
        });
      },

      /** Any joined consult for this patient — drives the resume-consult banner. */
      activeBooking(): BookingView | null {
        return this.upcomingBookings().find((b) => b.joinable) ?? null;
      },

      /* ---------------- Prescriptions ---------------- */

      myPrescriptions(): (Prescription & { doctor: Doctor | null; booking: Booking | null })[] {
        if (!session) return [];
        return db.prescriptions
          .filter((p) => p.patientId === session.id)
          .map((p) => ({
            ...p,
            doctor: db.doctors.find((d) => d.id === p.doctorId) ?? null,
            booking: db.bookings.find((b) => b.id === p.bookingId) ?? null,
          }))
          .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
      },

      getPrescription(id: string) {
        const p = db.prescriptions.find((x) => x.id === id);
        if (!p) return null;
        // Client-side mirror of the row-level security policy in
        // supabase/schema.sql: a prescription is readable by its patient and by
        // the doctor who signed it, and by nobody else.
        if (!canReadPrescription(p, { patientId: session?.id ?? null, doctorId: db.doctorSession?.doctorId ?? null })) {
          return null;
        }
        return {
          ...p,
          doctor: db.doctors.find((d) => d.id === p.doctorId) ?? null,
          booking: db.bookings.find((b) => b.id === p.bookingId) ?? null,
          patient: db.patients.find((pt) => pt.id === p.patientId) ?? null,
        };
      },

      ratingsFor(doctorId: string): Rating[] {
        return db.ratings.filter((r) => r.doctorId === doctorId);
      },

      rateBooking(bookingId: string, stars: number, comment?: string): void {
        if (!session) throw new CareNowError("Sign in first.", "not_signed_in");
        const booking = db.bookings.find((b) => b.id === bookingId);
        if (!booking) throw new CareNowError("Booking not found.", "not_found");
        if (db.ratings.some((r) => r.bookingId === bookingId)) {
          throw new CareNowError("You've already rated this consultation.", "not_allowed");
        }
        const rating = {
          id: uid("rt"),
          bookingId,
          patientId: session.id,
          doctorId: booking.doctorId,
          stars,
          comment,
          createdAt: new Date().toISOString(),
        };
        mutate((d) => {
          d.ratings.push(rating);
          // Keep the doctor's aggregate in step, the way a DB trigger would.
          const doctor = d.doctors.find((x) => x.id === booking.doctorId);
          if (doctor) {
            const total = doctor.rating * doctor.ratingCount + stars;
            doctor.ratingCount += 1;
            doctor.rating = Math.round((total / doctor.ratingCount) * 10) / 10;
          }
          d.audit.push(auditEntry("patient", session.id, "rating_submitted", "booking", bookingId, `${stars}★`));
        });
      },

      hasRated(bookingId: string): boolean {
        return db.ratings.some((r) => r.bookingId === bookingId);
      },

      /* ---------------- Clinician side ---------------- */

      doctorQueue(doctorId: string): BookingView[] {
        return db.bookings
          .filter((b) => b.doctorId === doctorId)
          .filter((b) => b.status === "confirmed" || b.status === "in_progress" || b.status == "pending_payment")
          .map(decorate)
          .filter((b): b is BookingView => Boolean(b))
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      },

      doctorHistory(doctorId: string): BookingView[] {
        return db.bookings
          .filter((b) => b.doctorId === doctorId)
          .filter((b) => b.status === "completed" || b.status === "no_show" || b.status === "cancelled")
          .map(decorate)
          .filter((b): b is BookingView => Boolean(b))
          .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
      },

      patientFor(patientId: string): PatientProfile | null {
        return db.patients.find((p) => p.id === patientId) ?? null;
      },

      issuePrescription(args: {
        bookingId: string;
        diagnosis: string;
        medications: Medication[];
        advice: string;
        followUpInDays: number;
        sickNote?: Prescription["sickNote"];
        doctorNotes?: string;
      }): Prescription {
        const doctorId = db.doctorSession?.doctorId;
        if (!doctorId) throw new CareNowError("Sign in as a doctor first.", "not_signed_in");
        const booking = db.bookings.find((b) => b.id === args.bookingId);
        if (!booking) throw new CareNowError("Booking not found.", "not_found");
        if (booking.doctorId !== doctorId) {
          throw new CareNowError("That consultation isn't yours.", "not_allowed");
        }
        const draft: PrescriptionDraft = {
          diagnosis: args.diagnosis,
          medications: args.medications,
          advice: args.advice,
          doctorNotes: args.doctorNotes,
        };
        // Last line of defence: a prescription a pharmacist can't fill is a
        // patient-safety incident, so the store refuses to persist one.
        const check = validatePrescription(draft);
        if (!check.valid) {
          throw new CareNowError(
            "The prescription is incomplete.",
            "not_allowed",
            Object.values(check.errors)[0],
          );
        }

        const rx: Prescription = {
          id: uid("rx"),
          bookingId: args.bookingId,
          patientId: booking.patientId,
          doctorId,
          issuedAt: new Date().toISOString(),
          diagnosis: args.diagnosis.trim(),
          medications: args.medications,
          advice: args.advice.trim(),
          followUpInDays: args.followUpInDays,
          sickNote: args.sickNote,
          doctorNotes: args.doctorNotes,
        };
        mutate((d) => {
          d.prescriptions.push(rx);
          const b = d.bookings.find((x) => x.id === args.bookingId)!;
          b.status = "completed";
          b.endedAt = b.endedAt ?? new Date().toISOString();
          d.audit.push(
            auditEntry("doctor", doctorId, "prescription_issued", "prescription", rx.id, booking.reference),
          );
        });
        return rx;
      },

      prescriptionForBooking(bookingId: string): Prescription | null {
        return db.prescriptions.find((p) => p.bookingId === bookingId) ?? null;
      },

      /** Clinician roster for the sign-in picker. */
      verifiedDoctors(): Doctor[] {
        return db.doctors.filter((d) => d.verified);
      },

      unverifiedDoctors(): Doctor[] {
        return db.doctors.filter((d) => !d.verified);
      },

      /* ---------------- Misc ---------------- */

      reset(): void {
        resetStore();
      },

      auditLog(): AuditEntry[] {
        return [...db.audit].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      },

      rotaFor(doctorId: string) {
        const doctor = db.doctors.find((d) => d.id === doctorId);
        return doctor ? rota(doctor) : null;
      },

      todayISO(): string {
        return toISODate(new Date());
      },
    };
}

export type StoreApi = ReturnType<typeof createStoreApi>;

export function useStore(): StoreApi {
  const { db, ready } = useCareNow();
  // Rebuilt whenever the snapshot changes, which is what keeps the closures over
  // `db` and `session` from going stale between mutations.
  return useMemo(() => createStoreApi(db, ready), [db, ready]);
}

export type DoctorView = {
  doctor: Doctor;
  next: NextAvailability | null;
  initials: string;
  specialtyLabel: string;
};

export const CONSENT_VERSION = "2026-02-01";

/** Search matches name, specialty, or a symptom keyword. */
function matches(d: Doctor, q: string): boolean {
  const specialty = SPECIALTIES.find((s) => s.id === d.specialty);
  const haystack = [
    d.fullName,
    d.qualifications,
    specialty?.label ?? "",
    specialty?.clinical ?? "",
    ...(specialty?.keywords ?? []),
    ...d.languages,
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

/** Slot ids carry their own date so the creator can re-derive the slot. */
function parseSlotDate(slotId: string): string {
  const m = slotId.match(/_(\d{4})-(\d{2})-(\d{2})_/);
  if (!m) return new Date().toISOString();
  return `${m[1]}-${m[2]}-${m[3]}T00:00:00`;
}

function nameFromIdentity(email?: string, phone?: string): string {
  if (email) {
    const local = email.split("@")[0].replace(/[._-]+/g, " ");
    return local.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return phone ? "New patient" : "New patient";
}

function seedFallback(): PatientProfile {
  // The demo record is always present after seeding; this guards a wiped store.
  resetStore();
  return readDB().patients.find((p) => p.email === DEMO_PATIENT_EMAIL)!;
}

/** Convenience for screens that just need initials for the header avatar. */
export function useInitials(name?: string | null): string {
  return useMemo(() => (name ? initialsOf(name) : "?"), [name]);
}

export { initialsOf, accentFor, timeLabel, toISODate };
export type { Doctor, BookingView as BookingRow };
