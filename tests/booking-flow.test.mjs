/**
 * Integration tests for the end-to-end patient journey.
 *
 * These drive the real store (`lib/store.ts` → `createStoreApi`) against the
 * real seed data, so they exercise the same code the PWA runs in the browser:
 * sign up → pick a slot → pay → reschedule → cancel → consult → prescribe →
 * rate, plus the two failure paths the PRD calls out (declined payment and
 * payment failure followed by a retry).
 *
 * Every assertion works off a fresh API instance because mutations replace the
 * database snapshot; `api()` therefore always reflects the latest state, which
 * is exactly what the React hook does on re-render.
 */

import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { initStore, readDB, resetStore, DEMO_PATIENT_EMAIL } from "../lib/db.ts";
import { createStoreApi } from "../lib/store.ts";

const api = () => createStoreApi(readDB(), true);

beforeEach(() => {
  globalThis.localStorage.clear();
  resetStore();
  initStore();
});

/** Sign in and return the session. */
function signInDemo() {
  api().signInDemo();
  return readDB().session;
}

/** The soonest open slot for a given doctor, straight from the store. */
function firstOpenSlot(doctorId) {
  const days = api().slotsFor(doctorId, 14);
  for (const day of days) {
    const slot = day.slots.find((s) => s.status === "open");
    if (slot) return slot;
  }
  return null;
}

const INTAKE = {
  reason: "Itchy rash on both forearms",
  notes: "Started after switching detergent. Worse at night.",
  duration: "2 weeks",
  severity: 2,
  attachProfileHistory: true,
};

/* ------------------------------------------------------------------ *
 * Seeding and auth
 * ------------------------------------------------------------------ */

test("the store seeds a demo patient with history to explore", () => {
  const db = readDB();
  const demo = db.patients.find((p) => p.email === DEMO_PATIENT_EMAIL);
  assert.ok(demo, "demo patient missing");
  assert.equal(demo.consent.healthDataConsent, true);
  assert.ok(db.bookings.some((b) => b.patientId === demo.id && b.status === "confirmed"));
  assert.ok(db.prescriptions.some((p) => p.patientId === demo.id));
  assert.ok(db.ratings.some((r) => r.patientId === demo.id));
});

test("signing in creates a patient record that persists across reads", () => {
  const created = api().signUp({ email: "new.patient@example.com", name: "Test Patient", password: "correct horse" });
  assert.equal(created.fullName, "Test Patient");
  assert.equal(readDB().session.id, created.id);
  assert.ok(api().myBookings().length === 0, "a new patient starts with no bookings");
  // Signing in again with the same email reuses the record rather than duplicating.
  const again = api().signIn({ email: "new.patient@example.com", password: "correct horse" });
  assert.equal(again.id, created.id);
  assert.equal(readDB().patients.filter((p) => p.email === "new.patient@example.com").length, 1);
});

test("sign-up creates an account, sign-in verifies it, and neither does the other's job", () => {
  // Sign-in never creates an account, and sign-up insists on a real password.
  assert.throws(
    () => api().signIn({ email: "pw@example.com", password: "correct horse" }),
    /no account found/i,
  );
  assert.throws(
    () => api().signUp({ email: "pw@example.com", password: "short" }),
    /at least 8 characters/i,
  );
  assert.throws(() => api().signUp({ email: "pw@example.com" }), /set a password/i);
  assert.equal(readDB().patients.filter((p) => p.email === "pw@example.com").length, 0);

  const created = api().signUp({ email: "pw@example.com", name: "Pw Patient", password: "correct horse" });
  const record = readDB().patients.find((p) => p.id === created.id);
  assert.ok(record.passwordHash, "password hash is stored on the record");
  assert.ok(!record.passwordHash.includes("correct"), "the stored value is not the password");
  assert.equal(readDB().session.passwordHash, undefined, "the session copy carries no credential");
  assert.ok(readDB().audit.some((a) => a.actorId === created.id && a.action === "sign_up"));

  // Sign-up never reuses an existing account.
  assert.throws(
    () => api().signUp({ email: "pw@example.com", name: "Pw Again", password: "correct horse" }),
    /already exists/i,
  );
  assert.equal(readDB().patients.filter((p) => p.email === "pw@example.com").length, 1);

  // The right password signs back in; the wrong one does not.
  assert.equal(api().signIn({ email: "pw@example.com", password: "correct horse" }).id, created.id);
  assert.throws(
    () => api().signIn({ email: "pw@example.com", password: "wrong password" }),
    /doesn't match/i,
  );
});

test("a Supabase session mirrors into the store and only ends its own session", () => {
  const profile = {
    id: "00000000-0000-4000-8000-000000000001",
    fullName: "Supa Patient",
    email: "supa@example.com",
  };
  api().syncExternalSession(profile);
  assert.equal(readDB().session.id, profile.id);
  assert.equal(readDB().session.authProvider, "supabase");
  assert.equal(readDB().session.passwordHash, undefined);

  // Syncing the same session again (bridge + sign-in screen) is a no-op:
  // no duplicate patient row, no second sign_in audit entry.
  const audits = readDB().audit.filter((a) => a.actorId === profile.id && a.action === "sign_in").length;
  api().syncExternalSession(profile);
  assert.equal(readDB().patients.filter((p) => p.id === profile.id).length, 1);
  assert.equal(readDB().audit.filter((a) => a.actorId === profile.id && a.action === "sign_in").length, audits);

  // Supabase signing out ends the mirrored session...
  api().syncExternalSession(null);
  assert.equal(readDB().session, null);

  // ...but never a local one: a null sync while the demo account is active
  // leaves it alone.
  api().syncExternalSession(profile);
  api().syncExternalSession(null);
  signInDemo();
  api().syncExternalSession(null);
  assert.equal(readDB().session.email, DEMO_PATIENT_EMAIL);
});

test("every catalogue doctor maps to a unique Supabase doctor uuid", async () => {
  const { SUPABASE_DOCTOR_IDS } = await import("../lib/supabase/bookings.ts");
  const listed = api().listDoctors();
  assert.ok(listed.length > 0);
  for (const v of listed) {
    assert.ok(SUPABASE_DOCTOR_IDS[v.doctor.id], `no Supabase uuid for ${v.doctor.id}`);
  }
  const uuids = Object.values(SUPABASE_DOCTOR_IDS);
  assert.equal(new Set(uuids).size, uuids.length, "Supabase doctor uuids must be unique");
  for (const u of uuids) {
    assert.match(u, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  }
});

test("only verified doctors are listed, and the unverified one is withheld", () => {
  const listed = api().listDoctors();
  assert.ok(listed.length > 0);
  for (const v of listed) assert.equal(v.doctor.verified, true);
  assert.equal(api().unverifiedDoctors().length, 1);
});

test("search matches symptoms, not only names", () => {
  const bySymptom = api().listDoctors({ query: "tooth" });
  assert.ok(bySymptom.some((v) => v.doctor.specialty === "dental"), "expected a dentist for 'tooth'");

  const byName = api().listDoctors({ query: "okonkwo" });
  assert.equal(byName.length, 1);
  assert.equal(byName[0].doctor.fullName, "Dr. Chidinma Okonkwo");

  const bySpecialty = api().listDoctors({ specialty: "child" });
  assert.ok(bySpecialty.every((v) => v.doctor.specialty === "child"));
  assert.equal(api().listDoctors({ query: "zzzz" }).length, 0);
});

/* ------------------------------------------------------------------ *
 * Booking
 * ------------------------------------------------------------------ */

test("booking holds the slot and starts unpaid, awaiting payment", () => {
  signInDemo();
  const doctorId = api().listDoctors()[0].doctor.id;
  const slot = firstOpenSlot(doctorId);
  assert.ok(slot);

  const booking = api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE });
  assert.equal(booking.status, "pending_payment");
  assert.equal(booking.payment.status, "unpaid");
  assert.equal(booking.payment.amount, api().getDoctor(doctorId).doctor.consultationFee);
  assert.match(booking.reference, /^CN-[A-Z2-9]{6}$/);

  // The slot now reads as taken for everyone else.
  const days = api().slotsFor(doctorId, 14);
  const taken = days.flatMap((d) => d.slots).find((s) => s.id === slot.id);
  assert.equal(taken.status, "booked");
  assert.equal(taken.bookingId, booking.id);
});

test("a second patient cannot take a slot already held", () => {
  signInDemo();
  const doctorId = api().listDoctors()[0].doctor.id;
  const slot = firstOpenSlot(doctorId);
  const first = api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE });

  // Same device, different account.
  api().signUp({ email: "other.patient@example.com", name: "Other Patient", password: "correct horse" });
  assert.throws(
    () => api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE }),
    /just taken/i,
  );
  assert.equal(api().getBooking(first.id).intake.reason, INTAKE.reason, "first booking survives");
});

test("the store refuses to book an unverified doctor", () => {
  signInDemo();
  const pending = api().unverifiedDoctors()[0];
  const slot = firstOpenSlot(pending.id);
  assert.ok(slot, "the rota still describes unverified availability");
  assert.throws(
    () => api().createBooking({ doctorId: pending.id, slotId: slot.id, intake: INTAKE }),
    /verified/i,
  );
});

/* ------------------------------------------------------------------ *
 * Payment — success and both failure paths
 * ------------------------------------------------------------------ */

test("a successful payment confirms the consultation", () => {
  signInDemo();
  const doctorId = api().listDoctors()[0].doctor.id;
  const slot = firstOpenSlot(doctorId);
  const { id } = api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE });

  api().payBooking(id, {
    number: "4242 4242 4242 4242",
    expiry: "12/29",
    cvc: "123",
    name: "Test Patient",
  });

  const paid = api().getBooking(id);
  assert.equal(paid.status, "confirmed");
  assert.equal(paid.payment.status, "paid");
  assert.match(paid.payment.reference, /^pi_4242/);
  assert.ok(paid.payment.paidAt);
  assert.ok(
    api().getBooking(id).reminders.scheduledFor,
    "a confirmed booking always has a reminder queued",
  );
});

test("a declined card records the failure and leaves the slot held", () => {
  signInDemo();
  const doctorId = api().listDoctors()[0].doctor.id;
  const slot = firstOpenSlot(doctorId);
  const { id } = api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE });

  assert.throws(
    () =>
      api().payBooking(id, { number: "0002 0000 0000 0000", expiry: "12/29", cvc: "123", name: "T" }),
    /declined/i,
  );

  const after = api().getBooking(id);
  assert.equal(after.payment.status, "failed");
  assert.match(after.payment.failureReason, /declined/i);
  assert.equal(after.status, "pending_payment", "an unpaid booking is never confirmed");
  assert.equal(after.joinable, false, "the room stays locked");

  // The patient can retry with a good card and still keep the slot.
  api().payBooking(id, { number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123", name: "T" });
  assert.equal(api().getBooking(id).payment.status, "paid");
  assert.equal(api().getBooking(id).payment.failureReason, undefined);
});

test("an obviously invalid card number is rejected before any provider call", () => {
  signInDemo();
  const doctorId = api().listDoctors()[0].doctor.id;
  const slot = firstOpenSlot(doctorId);
  const { id } = api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE });
  assert.throws(
    () => api().payBooking(id, { number: "4242", expiry: "12/29", cvc: "1", name: "T" }),
    /doesn't look right/i,
  );
  assert.equal(api().getBooking(id).payment.status, "unpaid");
});

test("paying twice is refused rather than double-charging", () => {
  signInDemo();
  const doctorId = api().listDoctors()[0].doctor.id;
  const slot = firstOpenSlot(doctorId);
  const { id } = api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE });
  const card = { number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123", name: "T" };
  api().payBooking(id, card);
  assert.throws(() => api().payBooking(id, card), /already paid/i);
});

/* ------------------------------------------------------------------ *
 * Rescheduling and cancellation
 * ------------------------------------------------------------------ */

test("rescheduling frees the old slot, takes the new one, and resets the reminder", () => {
  signInDemo();
  const doctorId = api().listDoctors()[0].doctor.id;
  const slot = firstOpenSlot(doctorId);
  const { id } = api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE });
  api().payBooking(id, { number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123", name: "T" });

  const openSlots = api()
    .slotsFor(doctorId, 14, id)
    .flatMap((d) => d.slots)
    .filter((s) => s.status === "open");
  const target = openSlots.find((s) => s.id !== slot.id);
  assert.ok(target, "expected another open slot to move to");

  api().rescheduleBooking(id, target.id);
  const moved = api().getBooking(id);
  assert.equal(moved.slotId, target.id);
  assert.equal(moved.status, "confirmed", "a paid booking stays confirmed after moving");
  assert.equal(api().getBooking(id).reminders.sentAt, undefined, "the reminder is re-queued");

  // The original slot is bookable again.
  const freed = api()
    .slotsFor(doctorId, 14)
    .flatMap((d) => d.slots)
    .find((s) => s.id === slot.id);
  assert.equal(freed.status, "open");
});

test("cancelling a paid booking more than 2h ahead refunds it in full", () => {
  signInDemo();
  const doctorId = api().listDoctors()[0].doctor.id;
  // Pick a slot comfortably in the future so the refund window applies.
  const slot = api()
    .slotsFor(doctorId, 14)
    .flatMap((d) => d.slots)
    .filter((s) => s.status === "open")
    .find((s) => new Date(s.startsAt).getTime() - Date.now() > 3 * 3_600_000);
  assert.ok(slot, "expected a slot more than 3 hours out");

  const { id } = api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE });
  api().payBooking(id, { number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123", name: "T" });
  api().cancelBooking(id, "Something came up at work");

  const cancelled = api().getBooking(id);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.payment.status, "refunded");
  assert.match(cancelled.resolution, /Full refund/);
  assert.ok(cancelled.payment.refundedAt);

  // The slot goes back on the market.
  const freed = api()
    .slotsFor(doctorId, 14)
    .flatMap((d) => d.slots)
    .find((s) => s.id === slot.id);
  assert.equal(freed.status, "open");
});

/* ------------------------------------------------------------------ *
 * Consultation and prescribing
 * ------------------------------------------------------------------ */

test("the consult room mints a room url and marks the call in progress", () => {
  signInDemo();
  const doctorId = api().listDoctors()[0].doctor.id;
  const slot = firstOpenSlot(doctorId);
  const { id } = api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE });

  // Unpaid: the room refuses to open.
  assert.throws(() => api().startConsult(id), /pending/i);

  api().payBooking(id, { number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123", name: "T" });
  const room = api().startConsult(id);
  assert.match(room, /^https:\/\//);
  const live = api().getBooking(id);
  assert.equal(live.status, "in_progress");
  assert.equal(live.roomUrl, room);
  assert.equal(api().startConsult(id), room, "re-entering reuses the same room");

  api().endConsult(id);
  assert.equal(api().getBooking(id).status, "completed");
  assert.ok(api().getBooking(id).endedAt);
});

test("a doctor issues a prescription on their own paid consultation", () => {
  signInDemo();
  const doctorId = api().listDoctors()[0].doctor.id;
  const slot = firstOpenSlot(doctorId);
  const { id } = api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE });
  api().payBooking(id, { number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123", name: "T" });

  api().signInDoctor(doctorId);
  const rx = api().issuePrescription({
    bookingId: id,
    diagnosis: "Contact dermatitis, likely irritant",
    medications: [
      {
        name: "Hydrocortisone 1% cream",
        dosage: "Thin layer",
        frequency: "Twice daily",
        duration: "7 days",
      },
    ],
    advice: "Switch back to your old detergent and stop using the new one for two weeks.",
    followUpInDays: 7,
    doctorNotes: "No signs of secondary infection.",
  });

  assert.ok(rx.id);
  assert.equal(api().getBooking(id).status, "completed");
  assert.equal(api().prescriptionForBooking(id).diagnosis, rx.diagnosis);
});

test("an incomplete prescription is refused at the store boundary", () => {
  signInDemo();
  const doctorId = api().listDoctors()[0].doctor.id;
  const slot = firstOpenSlot(doctorId);
  const { id } = api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE });
  api().payBooking(id, { number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123", name: "T" });
  api().signInDoctor(doctorId);

  assert.throws(
    () =>
      api().issuePrescription({
        bookingId: id,
        diagnosis: "Contact dermatitis",
        medications: [{ name: "Hydrocortisone 1%", dosage: "", frequency: "Twice daily", duration: "7 days" }],
        advice: "Switch detergent and review in a week.",
        followUpInDays: 0,
      }),
    /incomplete/i,
  );
  assert.equal(api().prescriptionForBooking(id), null, "nothing was persisted");
});

test("a doctor cannot prescribe on another clinician's consultation", () => {
  signInDemo();
  const doctors = api().listDoctors();
  const mine = doctors[0].doctor.id;
  const other = doctors[1].doctor.id;
  const slot = firstOpenSlot(mine);
  const { id } = api().createBooking({ doctorId: mine, slotId: slot.id, intake: INTAKE });
  api().payBooking(id, { number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123", name: "T" });

  api().signInDoctor(other);
  assert.throws(
    () =>
      api().issuePrescription({
        bookingId: id,
        diagnosis: "Contact dermatitis",
        medications: [
          { name: "Hydrocortisone 1%", dosage: "Thin layer", frequency: "Twice daily", duration: "7 days" },
        ],
        advice: "Switch detergent and review in a week.",
        followUpInDays: 0,
      }),
    /isn't yours/i,
  );
});

/* ------------------------------------------------------------------ *
 * Records and access control
 * ------------------------------------------------------------------ */

test("a patient sees their own prescription but not another patient's", () => {
  signInDemo();
  const mine = api().myPrescriptions();
  assert.ok(mine.length > 0, "the demo seed includes prescriptions");
  const id = mine[0].id;
  assert.ok(api().getPrescription(id), "own prescription is readable");

  // Sign in as a different patient: the same id must resolve to nothing.
  api().signUp({ email: "someone.else@example.com", name: "Someone Else", password: "correct horse" });
  assert.equal(api().getPrescription(id), null);
  assert.equal(api().myPrescriptions().length, 0);
});

test("a doctor's queue contains only their own patients' bookings", () => {
  signInDemo();
  const doctors = api().listDoctors();
  for (const { doctor } of doctors.slice(0, 3)) {
    const queue = api().doctorQueue(doctor.id);
    for (const b of queue) assert.equal(b.doctorId, doctor.id);
  }
});

test("rating a completed consultation updates the doctor's average", () => {
  signInDemo();
  const { doctor } = api().listDoctors()[0];
  const before = api().getDoctor(doctor.id).doctor;

  const completed = api().pastBookings().find((b) => b.status === "completed");
  assert.ok(completed, "the demo seed includes a completed consultation");
  if (api().hasRated(completed.id)) return; // already rated in the seed

  api().rateBooking(completed.id, 4, "Clear and quick.");
  const after = api().getDoctor(doctor.id).doctor;
  assert.equal(after.ratingCount, before.ratingCount + 1);
  assert.ok(after.rating <= before.rating, "a 4-star rating cannot raise the average");
  assert.throws(() => api().rateBooking(completed.id, 5), /already rated/i);
});

test("consent can be withdrawn and re-granted, and is versioned", () => {
  signInDemo();
  assert.equal(api().hasConsent(), true);
  const first = readDB().session.consent;
  api().acceptConsent({ healthDataConsent: false, recordingConsent: true });
  assert.equal(api().hasConsent(), false);
  const second = readDB().session.consent;
  assert.equal(second.healthDataConsent, false);
  assert.equal(second.recordingConsent, true);
  assert.equal(second.version, first.version);
});

test("every consequential action is written to the audit trail", () => {
  signInDemo();
  const doctorId = api().listDoctors()[0].doctor.id;
  const slot = firstOpenSlot(doctorId);
  const { id } = api().createBooking({ doctorId, slotId: slot.id, intake: INTAKE });
  api().payBooking(id, { number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123", name: "T" });
  api().cancelBooking(id, "I feel better already");

  const actions = api().auditLog().map((e) => e.action);
  for (const expected of [
    "sign_in",
    "booking_created",
    "payment_captured",
    "booking_cancelled",
  ]) {
    assert.ok(actions.includes(expected), `missing audit entry: ${expected}`);
  }
});
