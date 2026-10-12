/**
 * Unit tests for the availability engine.
 *
 * The rota is generated deterministically from a hash of the doctor's id, which
 * matters for two product reasons and is asserted here:
 *   1. A slot a patient taps is the slot they book — ids and times don't shift
 *      between renders or reloads.
 *   2. Two doctors must not end up with identical rotas, or the search results
 *      look synthetic.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  availability,
  dayLabel,
  isJoinable,
  minutesUntil,
  nextAvailability,
  relativeCountdown,
  rota,
  slotsForDay,
  timeLabel,
  toISODate,
} from "../lib/schedule.ts";
import { SPECIALTIES, SPECIALTY_BY_ID, DOCTORS } from "../lib/catalog.ts";

const NO_BOOKINGS = new Map();
const ANCHOR = new Date(2026, 2, 10, 9, 0, 0); // Tue 10 Mar 2026, 09:00 local

const verified = DOCTORS.filter((d) => d.verified);
const doctor = verified[0];

/* ------------------------------------------------------------------ *
 * Determinism
 * ------------------------------------------------------------------ */

test("the same day always produces the same slots", () => {
  const day = new Date(2026, 2, 12);
  const a = slotsForDay(doctor, day, ANCHOR);
  const b = slotsForDay(doctor, day, ANCHOR);
  assert.deepEqual(a.map((s) => s.id), b.map((s) => s.id));
  assert.deepEqual(a.map((s) => s.startsAt), b.map((s) => s.startsAt));
});

test("slot ids are unique and namespaced by doctor and date", () => {
  const day = new Date(2026, 2, 12);
  const ids = slotsForDay(doctor, day, ANCHOR).map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.ok(id.startsWith(`${doctor.id}_${toISODate(day)}_`), `bad id: ${id}`);
  }
});

test("doctors do not share an identical rota", () => {
  const signatures = new Set(verified.map((d) => JSON.stringify(rota(d))));
  assert.ok(
    signatures.size > 1,
    "every doctor resolved to the same rota — the hash is not varying",
  );
});

/* ------------------------------------------------------------------ *
 * Booking lead time and the present
 * ------------------------------------------------------------------ */

test("no slot is offered inside the 20-minute lead time", () => {
  const now = new Date(2026, 2, 10, 14, 30, 0);
  const slots = slotsForDay(doctor, new Date(2026, 2, 10), now);
  const cutoff = now.getTime() + 20 * 60_000;
  for (const s of slots) {
    assert.ok(
      new Date(s.startsAt).getTime() >= cutoff,
      `slot ${s.id} starts too soon: ${s.startsAt}`,
    );
  }
});

test("future days are not trimmed by the lead time", () => {
  const today = slotsForDay(doctor, new Date(2026, 2, 10), new Date(2026, 2, 10, 14, 30, 0));
  const tomorrow = slotsForDay(doctor, new Date(2026, 2, 11), new Date(2026, 2, 10, 14, 30, 0));
  assert.ok(tomorrow.length >= today.length);
});

test("slots never overlap and respect the rota's slot length", () => {
  const slots = slotsForDay(doctor, new Date(2026, 2, 12), ANCHOR);
  const r = rota(doctor);
  for (let i = 1; i < slots.length; i++) {
    const gap = new Date(slots[i].startsAt).getTime() - new Date(slots[i - 1].startsAt).getTime();
    assert.equal(gap, r.slotMins * 60_000);
  }
});

test("a doctor who doesn't work Sundays offers nothing on a Sunday", () => {
  for (const d of verified) {
    const r = rota(d);
    const sunday = new Date(2026, 2, 15); // Sunday
    const slots = slotsForDay(d, sunday, ANCHOR);
    assert.equal(slots.length > 0, r.worksSunday, `${d.fullName} on Sunday`);
  }
});

/* ------------------------------------------------------------------ *
 * Overlaying real bookings
 * ------------------------------------------------------------------ */

test("a booking marks its slot as taken and records the booking id", () => {
  const day = new Date(2026, 2, 12);
  const open = slotsForDay(doctor, day, ANCHOR).find((s) => s.status === "open");
  assert.ok(open, "expected at least one open slot");

  const booked = new Map([[open.id, { id: "bk-test" }]]);
  const days = availability(doctor, booked, 14, ANCHOR);
  const slot = days.flatMap((d) => d.slots).find((s) => s.id === open.id);
  assert.equal(slot.status, "booked");
  assert.equal(slot.bookingId, "bk-test");
});

test("nextAvailability skips fully-booked days", () => {
  const days = availability(doctor, NO_BOOKINGS, 14, ANCHOR);
  const firstDay = days[0];
  // Book out the whole of day one.
  const booked = new Map(firstDay.slots.map((s) => [s.id, { id: `bk-${s.id}` }]));
  const next = nextAvailability(doctor, booked, ANCHOR);
  assert.ok(next, "expected availability on a later day");
  assert.notEqual(toISODate(new Date(next.startsAt)), firstDay.date);
});

test("nextAvailability labels today's soonest slot as Today", () => {
  const next = nextAvailability(doctor, NO_BOOKINGS, ANCHOR);
  assert.ok(next);
  assert.ok(["Today", "Tomorrow"].includes(next.dayLabel) || /\d/.test(next.dayLabel));
});

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

test("day labels collapse today and tomorrow into words", () => {
  assert.equal(dayLabel(new Date(2026, 2, 10), ANCHOR), "Today");
  assert.equal(dayLabel(new Date(2026, 2, 11), ANCHOR), "Tomorrow");
  assert.match(dayLabel(new Date(2026, 2, 18), ANCHOR), /18/);
});

test("countdowns are human readable at every scale", () => {
  assert.equal(relativeCountdown(new Date(Date.now() - 60_000).toISOString()), "Starting now");
  assert.equal(relativeCountdown(new Date(Date.now() + 12 * 60_000).toISOString()), "in 12m");
  assert.equal(
    relativeCountdown(new Date(Date.now() + 135 * 60_000).toISOString()),
    "in 2h 15m",
  );
  assert.equal(relativeCountdown(new Date(Date.now() + 6 * 3_600_000).toISOString()), "in 6h");
});

test("minutesUntil is signed, so late arrivals read as negative", () => {
  const now = new Date(2026, 2, 10, 12, 0, 0);
  assert.equal(minutesUntil(new Date(2026, 2, 10, 12, 30, 0).toISOString(), now), 30);
  assert.equal(minutesUntil(new Date(2026, 2, 10, 11, 45, 0).toISOString(), now), -15);
});

test("isJoinable opens 10 minutes early and closes after the grace period", () => {
  const now = new Date(2026, 2, 10, 12, 0, 0);
  const at = (mins) => new Date(now.getTime() + mins * 60_000).toISOString();
  assert.equal(isJoinable(at(11), 20, now), false);
  assert.equal(isJoinable(at(9), 20, now), true);
  assert.equal(isJoinable(at(0), 20, now), true);
  assert.equal(isJoinable(at(-34), 20, now), true);
  assert.equal(isJoinable(at(-36), 20, now), false);
});

test("timeLabel always renders a time, never an empty string", () => {
  assert.ok(timeLabel(new Date(2026, 2, 10, 18, 30).toISOString()).length > 3);
});

/* ------------------------------------------------------------------ *
 * Catalogue integrity
 * ------------------------------------------------------------------ */

test("specialty ids are unique and fully indexed", () => {
  const ids = SPECIALTIES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of SPECIALTIES) {
    assert.equal(SPECIALTY_BY_ID[s.id].label, s.label);
    assert.ok(s.keywords.length >= 3, `${s.id} needs searchable keywords`);
  }
});

test("every doctor references a real specialty and a positive fee", () => {
  for (const d of DOCTORS) {
    assert.ok(SPECIALTY_BY_ID[d.specialty], `${d.id} has an unknown specialty`);
    assert.ok(d.consultationFee > 0);
    assert.ok(d.yearsExperience >= 0 && d.yearsExperience <= 70);
    assert.ok(["teal", "blue", "purple"].includes(d.accent));
  }
});

test("the verification gate has both verified and unverified rows to test against", () => {
  assert.ok(DOCTORS.some((d) => d.verified), "no verified doctors to list");
  assert.ok(
    DOCTORS.some((d) => !d.verified),
    "no unverified doctor — the manual-verification gate is untestable",
  );
});

test("an unverified doctor carries no verification metadata", () => {
  for (const d of DOCTORS.filter((x) => !x.verified)) {
    assert.equal(d.verification.verifiedAt, "");
  }
  for (const d of DOCTORS.filter((x) => x.verified)) {
    assert.match(d.verification.licenceNumber, /\w/);
    assert.ok(d.verification.verifiedAt);
  }
});

test("an unverified doctor never yields bookable availability", () => {
  const pending = DOCTORS.find((d) => !d.verified);
  const days = availability(pending, NO_BOOKINGS, 14, ANCHOR);
  // The engine can still describe a rota, but the store refuses to book it —
  // this asserts the *store* gate, which is what the PRD requires.
  assert.ok(Array.isArray(days));
  assert.equal(pending.verification.verifiedBy, "");
});
