/**
 * Unit tests for CareNow's business rules.
 *
 * Run with: npm test   (Node's built-in test runner; no extra dependencies.)
 *
 * Node 22 strips the TypeScript type annotations on import, so these tests
 * exercise the exact modules the app ships rather than a re-implementation.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { formatMoney, DEFAULT_CURRENCY, CURRENCY_SYMBOL } from "../lib/currency.ts";
import {
  FREE_CANCELLATION_HOURS,
  NO_SHOW_GRACE_MINS,
  ageFromDOB,
  canBookSlot,
  canJoinConsultation,
  canReadPrescription,
  cancellationOutcome,
  doctorMayReadHealth,
  followUpDate,
  isNoShowResolvable,
  isRefundableOnCancel,
  isValidBookingReference,
  isValidCardNumber,
  isValidEmail,
  isValidPhone,
  joinState,
  last4,
  paymentOutcomeFor,
  slotBlockReason,
  statusAfterPayment,
  validatePrescription,
} from "../lib/rules.ts";

const NOW = new Date("2026-03-10T10:00:00.000Z");
const at = (isoOffsetMins) =>
  new Date(NOW.getTime() + isoOffsetMins * 60_000).toISOString();

/* ------------------------------------------------------------------ *
 * Slot booking
 * ------------------------------------------------------------------ */

test("a slot inside the 20-minute lead time cannot be booked", () => {
  assert.equal(slotBlockReason({ startsAt: at(10), durationMins: 20 }, NOW), "too_soon");
  assert.equal(canBookSlot({ startsAt: at(19), durationMins: 20 }, NOW), false);
  assert.equal(canBookSlot({ startsAt: at(21), durationMins: 20 }, NOW), true);
});

test("an already-booked slot reports as taken, not missing", () => {
  const booked = { startsAt: at(120), durationMins: 20, status: "booked" };
  assert.equal(slotBlockReason(booked, NOW), "taken");
});

test("a missing slot is distinguished from an unavailable one", () => {
  assert.equal(slotBlockReason(null, NOW), "missing");
  assert.equal(slotBlockReason(undefined, NOW), "missing");
});

/* ------------------------------------------------------------------ *
 * Payment
 * ------------------------------------------------------------------ */

test("test cards map onto the three checkout paths", () => {
  assert.equal(paymentOutcomeFor("4242 4242 4242 4242"), "paid");
  assert.equal(paymentOutcomeFor("4000 0000 0000 0001"), "requires_3ds");
  assert.equal(paymentOutcomeFor("0002 0000 0000 0000"), "declined");
});

test("card numbers are validated on digits, ignoring spacing", () => {
  assert.equal(isValidCardNumber("4242 4242 4242 4242"), true);
  assert.equal(isValidCardNumber("4242424242424242"), true);
  assert.equal(isValidCardNumber("4242 4242 4242"), false);
  assert.equal(isValidCardNumber(""), false);
});

test("only the last four digits are ever surfaced", () => {
  assert.equal(last4("4242 4242 4242 9193"), "9193");
});

test("a booking is confirmed only once payment is captured", () => {
  assert.equal(statusAfterPayment("paid"), "confirmed");
  assert.equal(statusAfterPayment("unpaid"), null);
  assert.equal(statusAfterPayment("failed"), null);
});

/* ------------------------------------------------------------------ *
 * Cancellation and refunds  (PRD: payment failures and no-shows handled)
 * ------------------------------------------------------------------ */

test(`cancelling more than ${FREE_CANCELLATION_HOURS}h ahead is refundable`, () => {
  const booking = { startsAt: at(180), payment: { status: "paid", amount: 10000, currency: "NGN" } };
  assert.equal(isRefundableOnCancel(booking, NOW), true);
  const outcome = cancellationOutcome(booking, NOW);
  assert.equal(outcome.refunded, true);
  assert.match(outcome.message, /Full refund of ₦10,000/);
});

test("cancelling inside the window keeps the fee but offers a reschedule", () => {
  const booking = { startsAt: at(60), payment: { status: "paid", amount: 10000, currency: "NGN" } };
  assert.equal(isRefundableOnCancel(booking, NOW), false);
  const outcome = cancellationOutcome(booking, NOW);
  assert.equal(outcome.refunded, false);
  assert.match(outcome.message, /isn't refundable/);
  assert.match(outcome.message, /reschedule/);
});

test("an unpaid booking cancels without any refund language", () => {
  const booking = { startsAt: at(180), payment: { status: "unpaid", amount: 5000, currency: "NGN" } };
  const outcome = cancellationOutcome(booking, NOW);
  assert.equal(outcome.refunded, false);
  assert.match(outcome.message, /No payment was taken/);
});

test("a no-show cannot be resolved before the grace period elapses", () => {
  const booking = { startsAt: at(5), status: "confirmed" };
  assert.equal(isNoShowResolvable(booking, NOW), false);
  const later = { startsAt: at(-NO_SHOW_GRACE_MINS), status: "confirmed" };
  assert.equal(isNoShowResolvable(later, NOW), true);
});

test("an already-cancelled booking is never resold as a no-show", () => {
  const booking = { startsAt: at(-60), status: "cancelled" };
  assert.equal(isNoShowResolvable(booking, NOW), false);
});

/* ------------------------------------------------------------------ *
 * Joining a consultation
 * ------------------------------------------------------------------ */

const paidConfirmed = (startsAt, durationMins = 20) => ({
  startsAt,
  durationMins,
  status: "confirmed",
  payment: { status: "paid" },
});

test("the room opens 10 minutes before the slot", () => {
  assert.equal(joinState(paidConfirmed(at(11)), NOW).reason, "too_early");
  assert.equal(joinState(paidConfirmed(at(10)), NOW).canJoin, true);
  assert.equal(joinState(paidConfirmed(at(0)), NOW).canJoin, true);
});

test("the room stays open into the slot and closes after the grace period", () => {
  assert.equal(canJoinConsultation(paidConfirmed(at(0), 20), NOW), true);
  // 20-minute slot + 15-minute grace = closed at +35 minutes.
  assert.equal(joinState(paidConfirmed(at(0), 20), new Date(NOW.getTime() + 36 * 60_000)).reason, "closed");
});

test("an unpaid consultation can never be joined", () => {
  const unpaid = { ...paidConfirmed(at(0)), payment: { status: "unpaid" } };
  const state = joinState(unpaid, NOW);
  assert.equal(state.canJoin, false);
  assert.equal(state.reason, "unpaid");
});

test("a cancelled or missed consultation cannot be re-entered", () => {
  for (const status of ["cancelled", "no_show"]) {
    assert.equal(joinState({ ...paidConfirmed(at(0)), status }, NOW).canJoin, false);
  }
});

/* ------------------------------------------------------------------ *
 * Prescribing  (safety-critical)
 * ------------------------------------------------------------------ */

const completeMed = {
  name: "Amoxicillin 500mg",
  dosage: "1 capsule",
  frequency: "Three times a day",
  duration: "5 days",
};

test("a complete prescription validates", () => {
  const result = validatePrescription({
    diagnosis: "Acute bacterial pharyngitis",
    medications: [completeMed],
    advice: "Finish the full course even if you feel better by day three.",
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test("a medicine missing any of name, dose, frequency or duration is rejected", () => {
  for (const field of ["name", "dosage", "frequency", "duration"]) {
    const result = validatePrescription({
      diagnosis: "Acute pharyngitis",
      medications: [{ ...completeMed, [field]: "  " }],
      advice: "Warm saltwater gargles twice daily.",
    });
    assert.equal(result.valid, false, `expected ${field} to be required`);
    assert.ok(result.errors["medications.0"], `expected an error for ${field}`);
  }
});

test("an empty medicine list and short advice are both rejected", () => {
  const result = validatePrescription({
    diagnosis: "Acute pharyngitis",
    medications: [],
    advice: "Rest",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.medications);
  assert.ok(result.errors.advice);
});

test("a diagnosis shorter than 3 characters is rejected", () => {
  const result = validatePrescription({
    diagnosis: "ok",
    medications: [completeMed],
    advice: "Plenty of fluids and rest for two days.",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.diagnosis);
});

test("follow-up dates are derived from the interval, never typed", () => {
  const from = "2026-03-10T10:00:00.000Z";
  assert.equal(followUpDate(from, 0), null);
  assert.equal(followUpDate(from, 14), new Date("2026-03-24T10:00:00.000Z").toISOString());
});

/* ------------------------------------------------------------------ *
 * Access control — the client mirror of the RLS policies
 * ------------------------------------------------------------------ */

test("a prescription is readable only by its patient or its doctor", () => {
  const rx = { patientId: "pt-1", doctorId: "doc-1" };
  assert.equal(canReadPrescription(rx, { patientId: "pt-1", doctorId: null }), true);
  assert.equal(canReadPrescription(rx, { patientId: null, doctorId: "doc-1" }), true);
  assert.equal(canReadPrescription(rx, { patientId: "pt-2", doctorId: null }), false);
  assert.equal(canReadPrescription(rx, { patientId: null, doctorId: "doc-2" }), false);
  assert.equal(canReadPrescription(rx, { patientId: null, doctorId: null }), false);
});

test("a doctor reads health history only for a paid booking of theirs", () => {
  const paid = [
    { patientId: "pt-1", doctorId: "doc-1", status: "completed", paymentStatus: "paid" },
  ];
  assert.equal(doctorMayReadHealth(paid, "doc-1", "pt-1"), true);
  // A different doctor, or a different patient, gets nothing.
  assert.equal(doctorMayReadHealth(paid, "doc-2", "pt-1"), false);
  assert.equal(doctorMayReadHealth(paid, "doc-1", "pt-2"), false);
});

test("an unpaid or cancelled booking grants no history access", () => {
  const unpaid = [
    { patientId: "pt-1", doctorId: "doc-1", status: "pending_payment", paymentStatus: "unpaid" },
  ];
  const cancelled = [
    { patientId: "pt-1", doctorId: "doc-1", status: "cancelled", paymentStatus: "paid" },
  ];
  assert.equal(doctorMayReadHealth(unpaid, "doc-1", "pt-1"), false);
  assert.equal(doctorMayReadHealth(cancelled, "doc-1", "pt-1"), false);
});

/* ------------------------------------------------------------------ *
 * Form rules
 * ------------------------------------------------------------------ */

test("sign-up requires a plausible email or phone", () => {
  assert.equal(isValidEmail("adaeze.nwosu@example.com"), true);
  assert.equal(isValidEmail("adaeze@example"), false);
  assert.equal(isValidEmail("adaeze"), false);
  assert.equal(isValidPhone("+234 803 412 7788"), true);
  assert.equal(isValidPhone("98430"), false);
});

test("age is derived from date of birth and bounded sensibly", () => {
  assert.equal(ageFromDOB("1997-04-18", new Date("2026-04-18T00:00:00Z")), 29);
  assert.equal(ageFromDOB("1997-04-18", new Date("2026-04-17T00:00:00Z")), 28);
  assert.equal(ageFromDOB(""), undefined);
  assert.equal(ageFromDOB("1180-01-01"), undefined);
});

test("booking references are validated against the generated alphabet", () => {
  assert.equal(isValidBookingReference("CN-7F3K92"), true);
  // I, O, 0 and 1 are excluded so a reference can be read over the phone.
  assert.equal(isValidBookingReference("CN-7FIK92"), false);
  assert.equal(isValidBookingReference("CN-7F3K9"), false);
  assert.equal(isValidBookingReference("XX-7F3K92"), false);
});
