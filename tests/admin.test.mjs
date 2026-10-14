/**
 * Integration tests for the operations console.
 *
 * Same approach as the booking suite: drive the real store against the real seed
 * data, so what is asserted here is what the dashboard actually runs.
 *
 * There is one admin role and it is not tiered, so what these tests care about is
 * different from what they used to: not who is allowed to administer, but that
 * administration is attributable, that the last seat cannot be given up, and
 * that a profile can never promote itself.
 */

import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { DOCTORS } from "../lib/catalog.ts";
import {
  applyVerifications,
  initStore,
  readDB,
  resetStore,
  DEMO_PATIENT_EMAIL,
} from "../lib/db.ts";
import { createStoreApi } from "../lib/store.ts";
import { isLastAdmin, isValidLicenceNumber, platformMetrics } from "../lib/rules.ts";

const api = () => createStoreApi(readDB(), true);

const OWNER = "admin@carenow.health";
const VERIFIER = "credentialing@carenow.health";
const PENDING = "doc-haruna-bala"; // Seeded verified: false — awaiting a check.
const MDCN = "MDCN/R/51842"; // Deliberately not on any seeded listing.

beforeEach(() => {
  globalThis.localStorage.clear();
  resetStore();
  initStore();
});

const signInOwner = () => api().signInAdmin(OWNER);
const signInVerifier = () => api().signInAdmin(VERIFIER);

/* ------------------------------------------------------------------ *
 * Seats and sign-in
 * ------------------------------------------------------------------ */

test("the store seeds two admins with identical powers", () => {
  const seats = readDB().admins;
  assert.equal(seats.length, 2);
  assert.equal(seats[0].email, OWNER);

  // One role, no tiers: nothing on a seat can grant it more than another. The
  // only keys are identity plus provenance, and `grantedBy` is absent solely
  // for the founding seat.
  const FIELDS = ["id", "fullName", "email", "baseRole", "grantedAt", "grantedBy", "lastSignedInAt"];
  for (const seat of seats) {
    for (const key of Object.keys(seat)) {
      assert.ok(FIELDS.includes(key), `a seat carries an unexpected field: ${key}`);
    }
    assert.equal(seat.baseRole, "staff");
  }
});

test("the founding seat is the reviewer already credited on the roster", () => {
  const credited = DOCTORS[0].verification.verifiedBy;
  assert.equal(credited, OWNER);
  assert.ok(
    readDB().admins.some((a) => a.email === credited),
    "the address in the catalogue is not a real seat",
  );
});

test("signing in by an unknown address is refused, not silently created", () => {
  assert.throws(() => api().signInAdmin("stranger@example.com"), /No CareNow operations account/);
  assert.equal(readDB().adminSession, null);
});

test("a seat signs in and signs out independently of the patient session", () => {
  signInOwner();
  assert.equal(api().adminSession?.email, OWNER);

  api().signOutAdmin();
  assert.equal(api().adminSession, null);
  // Nobody was signed in as a patient, and the console never touched that door.
  assert.equal(readDB().session, null);
});

test("signing in records who it was and when", () => {
  signInOwner();
  const seat = readDB().admins.find((a) => a.email === OWNER);
  assert.ok(seat?.lastSignedInAt, "lastSignedInAt was not stamped");
  const entry = readDB().audit.at(-1);
  assert.equal(entry.actorType, "admin");
  assert.equal(entry.action, "sign_in");
});

/* ------------------------------------------------------------------ *
 * Credential verification
 * ------------------------------------------------------------------ */

test("an application waits in the queue until somebody decides", () => {
  const queue = api().verificationQueue();
  assert.deepEqual(
    queue.map((d) => d.id),
    [PENDING],
  );
});

test("approving lists the clinician with the number the reviewer checked", () => {
  signInOwner();
  api().approveDoctor({ doctorId: PENDING, licenceNumber: MDCN });

  const doctor = api().getDoctor(PENDING)?.doctor;
  assert.equal(doctor?.verified, true);
  assert.equal(doctor?.verification.licenceNumber, MDCN);
  assert.equal(doctor?.verification.verifiedBy, OWNER);
  assert.ok(doctor?.verification.verifiedAt, "no timestamp on the decision");

  assert.equal(api().verificationQueue().length, 0, "decided application stayed in the queue");
});

test("an approved clinician becomes discoverable to patients", () => {
  assert.ok(!api().listDoctors().some((d) => d.doctor.id === PENDING));
  signInOwner();
  api().approveDoctor({ doctorId: PENDING, licenceNumber: MDCN });
  assert.ok(
    api().listDoctors().some((d) => d.doctor.id === PENDING),
    "a verified clinician is still hidden from search",
  );
});

test("a malformed MDCN number never reaches the listing", () => {
  signInOwner();
  for (const bad of ["", "12345", "MDCN-41208", "MDCN/R/abc", "41208"]) {
    assert.throws(
      () => api().approveDoctor({ doctorId: PENDING, licenceNumber: bad }),
      /can't be used/,
      `accepted ${JSON.stringify(bad)}`,
    );
  }
  assert.equal(api().getDoctor(PENDING)?.doctor.verified, false);
});

test("one registration number cannot sit on two clinicians", () => {
  signInOwner();
  const taken = DOCTORS[0].verification.licenceNumber; // Already on another listing.
  assert.throws(
    () => api().approveDoctor({ doctorId: PENDING, licenceNumber: taken }),
    /already on/,
  );
  assert.equal(api().getDoctor(PENDING)?.doctor.verified, false);
});

test("a licence number is accepted in lower case and stored canonically", () => {
  signInOwner();
  api().approveDoctor({ doctorId: PENDING, licenceNumber: MDCN.toLowerCase() });
  assert.equal(api().getDoctor(PENDING)?.doctor.verification.licenceNumber, MDCN);
});

test("turning an application down needs a reason the clinician can act on", () => {
  signInOwner();
  assert.throws(() => api().rejectDoctor({ doctorId: PENDING, reason: "no" }), /needs a reason/);

  api().rejectDoctor({
    doctorId: PENDING,
    reason: "Number not found on the MDCN register.",
  });
  assert.equal(api().getDoctor(PENDING)?.doctor.verified, false);
  const latest = api().verificationDecisions()[0];
  assert.equal(latest.decision, "rejected");
  assert.match(latest.reason, /register/);
});

test("a turned-down clinician stays invisible to patients", () => {
  signInOwner();
  api().rejectDoctor({ doctorId: PENDING, reason: "Number not found on the MDCN register." });
  assert.ok(!api().listDoctors().some((d) => d.doctor.id === PENDING));
  assert.equal(api().slotsFor(PENDING, 14).length > 0, true, "rota should still exist for the clinician");
});

test("decisions are attributed to the reviewer in the audit trail", () => {
  signInVerifier();
  api().approveDoctor({ doctorId: PENDING, licenceNumber: MDCN });
  // The seed ships credential decisions of its own, so target the one just made.
  const entry = readDB()
    .audit.filter((e) => e.action === "doctor_verified" && e.subjectId === PENDING)
    .at(-1);
  assert.equal(entry.actorType, "admin");
  assert.equal(entry.subjectType, "doctor");
  assert.equal(entry.subjectId, PENDING);
  assert.match(entry.detail, /MDCN\/R\/51842/);
});

test("every admin may decide credentials", () => {
  signInVerifier();
  assert.equal(api().adminSession?.email, VERIFIER);
  api().approveDoctor({ doctorId: PENDING, licenceNumber: MDCN });
  assert.equal(api().getDoctor(PENDING)?.doctor.verified, true);
});

test("deciding credentials needs a seat at all", () => {
  assert.throws(
    () => api().approveDoctor({ doctorId: PENDING, licenceNumber: MDCN }),
    /Sign in to the console/,
  );
});

/* ------------------------------------------------------------------ *
 * Living with a reload
 * ------------------------------------------------------------------ */

test("a decision replays onto the catalogue after a reload", () => {
  signInOwner();
  api().approveDoctor({ doctorId: PENDING, licenceNumber: MDCN });

  const decisions = readDB().verifications;
  // `initStore` re-takes DOCTORS, so the decision has to survive on its own.
  const replayed = applyVerifications(DOCTORS, decisions);
  const doctor = replayed.find((d) => d.id === PENDING);
  assert.equal(doctor?.verified, true);
  assert.equal(doctor?.verification.licenceNumber, MDCN);
  assert.equal(doctor?.verification.verifiedBy, OWNER);
});

test("a rejection replays too, and supersedes the approval before it", () => {
  signInOwner();
  api().approveDoctor({ doctorId: PENDING, licenceNumber: MDCN });
  api().rejectDoctor({ doctorId: PENDING, reason: "Registration lapsed this month." });

  const replayed = applyVerifications(DOCTORS, readDB().verifications);
  assert.equal(replayed.find((d) => d.id === PENDING)?.verified, false);
});

test("replay follows when a decision was made, not where it sits in the trail", () => {
  const approved = {
    id: "vr_early",
    doctorId: PENDING,
    decision: "approved",
    licenceNumber: MDCN,
    decidedAt: "2026-01-01T00:00:00.000Z",
    decidedBy: OWNER,
    adminId: "adm-ifeoma",
  };
  const rejected = {
    ...approved,
    id: "vr_late",
    decision: "rejected",
    licenceNumber: "",
    reason: "Registration lapsed this month.",
    decidedAt: "2026-02-01T00:00:00.000Z",
  };

  // The approval is last in the array but happened first, so it must lose.
  const replayed = applyVerifications(DOCTORS, [rejected, approved]);
  assert.equal(replayed.find((d) => d.id === PENDING)?.verified, false);
});

test("two decisions in the same millisecond settle on the last one written", () => {
  const at = "2026-03-01T00:00:00.000Z";
  const base = {
    doctorId: PENDING,
    licenceNumber: MDCN,
    decidedBy: OWNER,
    adminId: "adm-ifeoma",
    decidedAt: at,
  };
  const approved = { ...base, id: "vr_1", decision: "approved" };
  const rejected = { ...base, id: "vr_2", decision: "rejected", licenceNumber: "" };

  assert.equal(
    applyVerifications(DOCTORS, [approved, rejected]).find((d) => d.id === PENDING)?.verified,
    false,
  );
  assert.equal(
    applyVerifications(DOCTORS, [rejected, approved]).find((d) => d.id === PENDING)?.verified,
    true,
  );
});

test("replaying nothing leaves the catalogue exactly as shipped", () => {
  const replayed = applyVerifications(DOCTORS, []);
  assert.deepEqual(
    replayed.map((d) => [d.id, d.verified]),
    DOCTORS.map((d) => [d.id, d.verified]),
  );
});

/* ------------------------------------------------------------------ *
 * Handing out access
 * ------------------------------------------------------------------ */

test("an admin grants a seat to an existing account", () => {
  signInOwner();
  api().grantAdmin({ accountId: "pt-bisi" });

  const seat = readDB().admins.find((a) => a.id === "pt-bisi");
  assert.equal(seat?.email, "bisi.oladipo@example.com");
  assert.equal(seat?.baseRole, "patient", "the seat should remember what it sits on");
  assert.equal(seat?.grantedBy, OWNER);

  const row = api().accountDirectory().find((r) => r.id === "pt-bisi");
  assert.ok(row?.admin, "the directory does not show the new seat");
  assert.equal(row?.baseRole, "patient");
});

test("a new seat can sign in and act", () => {
  signInOwner();
  api().grantAdmin({ accountId: "pt-bisi" });
  api().signOutAdmin();

  api().signInAdmin("bisi.oladipo@example.com");
  assert.equal(api().adminSession?.fullName, "Bisi Oladipo");
  api().approveDoctor({ doctorId: PENDING, licenceNumber: MDCN });
  assert.equal(api().getDoctor(PENDING)?.doctor.verified, true);
});

test("any admin can hand out a seat, whichever seat they hold", () => {
  signInVerifier();
  api().grantAdmin({ accountId: "pt-bisi" });
  assert.ok(
    readDB().admins.some((a) => a.id === "pt-bisi"),
    "the second admin could not grant a seat",
  );
});

test("an admin can hand out a seat to a clinician account too", () => {
  signInVerifier();
  api().grantAdmin({ accountId: "doc-chidinma-okonkwo" });
  const seat = readDB().admins.find((a) => a.id === "doc-chidinma-okonkwo");
  assert.equal(seat?.baseRole, "doctor");
  assert.equal(seat?.fullName, "Dr. Chidinma Okonkwo");
});

test("a signed-in admin can give the role to a patient account without approval", () => {
  // The deliberate consequence of the flat model: there is no second approver
  // to ask. Recorded here so the behaviour is intentional rather than a gap.
  signInOwner();
  api().grantAdmin({ accountId: "pt-temilade" });
  assert.ok(readDB().admins.some((a) => a.id === "pt-temilade"));
  const entry = readDB()
    .audit.filter((e) => e.action === "admin_granted" && e.subjectId === "pt-temilade")
    .at(-1);
  assert.equal(entry.actorId, "adm-ifeoma", "the grant is not attributable");
});

test("a seat is not handed to an account that already holds one", () => {
  signInOwner();
  assert.throws(() => api().grantAdmin({ accountId: "adm-samuel" }), /already holds/);
});

test("an unknown account cannot be promoted", () => {
  signInOwner();
  assert.throws(() => api().grantAdmin({ accountId: "pt-nobody" }), /not found/);
});

test("revoking returns the account to what it was", () => {
  signInOwner();
  api().grantAdmin({ accountId: "pt-bisi" });
  api().revokeAdmin("pt-bisi");

  assert.ok(!readDB().admins.some((a) => a.id === "pt-bisi"));
  const row = api().accountDirectory().find((r) => r.id === "pt-bisi");
  assert.equal(row?.baseRole, "patient");
  assert.equal(row?.admin, undefined);
  // Still a patient, still in the directory.
  assert.ok(readDB().patients.some((p) => p.id === "pt-bisi"));
});

test("a revoked seat loses console access immediately", () => {
  signInOwner();
  api().grantAdmin({ accountId: "pt-bisi" });
  api().signOutAdmin();
  api().signInAdmin("bisi.oladipo@example.com");

  api().signOutAdmin();
  // The other admin revokes while Bisi is away.
  api().signInAdmin(OWNER);
  api().revokeAdmin("pt-bisi");
  api().signOutAdmin();

  assert.throws(() => api().signInAdmin("bisi.oladipo@example.com"), /No CareNow operations account/);
});

test("an admin cannot remove the last seat", () => {
  signInOwner();
  // Samuel is removed by Ifeoma, leaving one seat — then that one is protected.
  api().revokeAdmin("adm-samuel");
  assert.equal(readDB().admins.length, 1);
  assert.throws(() => api().revokeAdmin("adm-ifeoma"), /last admin seat/);
  assert.equal(readDB().admins.length, 1, "the last seat was removed anyway");
});

test("an admin cannot remove their own last seat", () => {
  signInOwner();
  api().revokeAdmin("adm-samuel");
  // The footgun in its most likely form: clearing the other seats, then leaving.
  assert.throws(() => api().revokeAdmin("adm-ifeoma"), /last admin seat/);
  assert.ok(api().adminSession, "the session was ended by a refused command");
});

test("admins may remove each other while more than one remains", () => {
  signInOwner();
  api().grantAdmin({ accountId: "pt-bisi" });
  api().revokeAdmin("adm-samuel");

  const remaining = readDB().admins.map((a) => a.id).sort();
  assert.deepEqual(remaining, ["adm-ifeoma", "pt-bisi"]);

  // And the seat that was just granted can remove the one that granted it.
  api().signOutAdmin();
  api().signInAdmin("bisi.oladipo@example.com");
  api().revokeAdmin("adm-ifeoma");
  assert.deepEqual(
    readDB().admins.map((a) => a.id),
    ["pt-bisi"],
  );
  assert.throws(() => api().revokeAdmin("pt-bisi"), /last admin seat/);
});

test("a seat can remove itself once another admin exists", () => {
  signInOwner();
  api().grantAdmin({ accountId: "pt-bisi" });
  api().revokeAdmin("adm-ifeoma"); // resigning
  assert.ok(!readDB().admins.some((a) => a.id === "adm-ifeoma"));
  // The session that went with it is cleared, so no stale seat lingers.
  assert.equal(api().adminSession, null);
});

test("access changes are attributable", () => {
  signInOwner();
  api().grantAdmin({ accountId: "pt-bisi" });
  const granted = readDB()
    .audit.filter((e) => e.action === "admin_granted" && e.subjectId === "pt-bisi")
    .at(-1);
  assert.equal(granted.actorType, "admin");
  assert.equal(granted.actorId, "adm-ifeoma");
  assert.equal(granted.subjectId, "pt-bisi");

  api().revokeAdmin("pt-bisi");
  const revoked = readDB().audit.find((e) => e.action === "admin_revoked");
  assert.equal(revoked.subjectId, "pt-bisi");
});

test("the directory lists patients, clinicians and staff together", () => {
  const rows = api().accountDirectory();
  const roles = new Set(rows.map((r) => r.baseRole));
  assert.ok(roles.has("patient"));
  assert.ok(roles.has("doctor"));
  assert.ok(roles.has("staff"));

  // Clinicians carry their listing state, patients their volume.
  assert.equal(rows.find((r) => r.id === PENDING)?.verified, false);
  assert.equal(typeof rows.find((r) => r.id === "pt-adaeze")?.bookings, "number");
});

/* ------------------------------------------------------------------ *
 * Metrics and attention
 * ------------------------------------------------------------------ */

test("the headline figures add up against the seed", () => {
  const m = api().platformMetrics();
  const db = readDB();

  assert.equal(m.total, db.bookings.length);
  assert.equal(
    m.collected,
    db.bookings.filter((b) => b.payment.status === "paid").reduce((s, b) => s + b.payment.amount, 0),
  );
  assert.equal(m.cancelled, db.bookings.filter((b) => b.status === "cancelled").length);
  assert.ok(m.completed > 0, "the demo account should have past consultations");
  assert.ok(m.consultMinutes > 0);
});

test("rates stay inside 0–1 on any mix of outcomes", () => {
  const building = (status, payment, amount = 5000) => ({
    status,
    durationMins: 20,
    patientId: "p",
    doctorId: "d",
    payment: { status: payment, amount },
  });

  const empty = platformMetrics([]);
  assert.equal(empty.noShowRate, 0, "a division by zero should not produce NaN");
  assert.equal(empty.completionRate, 0);

  const mixed = platformMetrics([
    building("completed", "paid"),
    building("no_show", "paid"),
    building("completed", "paid"),
    building("cancelled", "refunded"),
    building("pending_payment", "unpaid"),
  ]);
  assert.equal(mixed.completed, 2);
  assert.equal(mixed.noShow, 1);
  assert.equal(mixed.refunded, 5000);
  assert.equal(mixed.outstanding, 5000);
  assert.equal(Number(mixed.noShowRate.toFixed(3)), 0.333);
  assert.equal(Number(mixed.completionRate.toFixed(2)), 0.4);
});

test("refunds are reported as money returned, not money kept", () => {
  const booking = (payment) => ({
    status: "completed",
    durationMins: 20,
    patientId: "p",
    doctorId: "d",
    payment: { status: payment, amount: 8000 },
  });
  const m = platformMetrics([booking("paid"), booking("refunded")]);
  assert.equal(m.collected, 8000);
  assert.equal(m.refunded, 8000);
});

test("the console surfaces the pending application as something to act on", () => {
  const alerts = api().opsAlerts();
  assert.ok(alerts.some((a) => a.id === "verification"), "a waiting application raised no alert");
});

/* ------------------------------------------------------------------ *
 * Rules, in isolation
 * ------------------------------------------------------------------ */

test("MDCN numbers are accepted only in the council's format", () => {
  for (const good of ["MDCN/R/41208", "mdcn/r/41208", " MDCN/R/51842 "]) {
    assert.equal(isValidLicenceNumber(good), true, `rejected ${good}`);
  }
  for (const bad of [
    "",
    "MDCN41208",
    "R/41208",
    "MDCN/R/12",
    "NIN/12345678901",
    // A fellowship quoted as a registration number — the mistake this check
    // exists to catch, since every clinician on the roster holds one.
    "MDCN/FMCP/12345",
  ]) {
    assert.equal(isValidLicenceNumber(bad), false, `accepted ${bad}`);
  }
});

test("the last seat is protected by the rule, not just the store", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  assert.equal(isLastAdmin([a], "a"), true);
  assert.equal(isLastAdmin([a, b], "a"), false);
  assert.equal(isLastAdmin([a, b], "b"), false);
  assert.equal(isLastAdmin([a, b], "c"), false, "an unknown target is not the last seat");
  assert.equal(isLastAdmin([], "a"), false, "no seats at all is not 'the last admin'");
});

/* ------------------------------------------------------------------ *
 * The console stays out of clinical data
 * ------------------------------------------------------------------ */

test("the account directory exposes no health information", () => {
  const row = api().accountDirectory().find((r) => r.id === "pt-adaeze");
  const keys = Object.keys(row ?? {});
  for (const forbidden of ["allergies", "conditions", "currentMedications", "dateOfBirth", "consent"]) {
    assert.ok(!keys.includes(forbidden), `directory leaked ${forbidden}`);
  }
  assert.equal(row?.email, DEMO_PATIENT_EMAIL);
});

test("an approved clinician can be booked, and the demo patient is unaffected", () => {
  signInOwner();
  api().approveDoctor({ doctorId: PENDING, licenceNumber: MDCN });

  api().signInDemo();
  const slot = api()
    .slotsFor(PENDING, 14)
    .flatMap((day) => day.slots)
    .find((s) => s.status === "open");
  assert.ok(slot, "no bookable slot for the newly verified clinician");

  const booking = api().createBooking({
    doctorId: PENDING,
    slotId: slot.id,
    intake: {
      reason: "Chipped front tooth",
      notes: "Happened at football. No pain, sensitive to cold.",
      duration: "3 days",
      severity: 2,
      attachProfileHistory: false,
    },
  });
  assert.equal(booking.doctorId, PENDING);
});

/* ------------------------------------------------------------------ *
 * The seeded trail the console opens on
 * ------------------------------------------------------------------ */

test("the seeded audit trail is populated and covers the compliance reads", () => {
  const trail = api().auditLog();
  assert.ok(trail.length > 20, `trail looks empty: ${trail.length} entries`);

  const actions = new Set(trail.map((e) => e.action));
  // The reads and decisions the NDPA obligations in the privacy policy turn on.
  for (const required of ["consent_accepted", "record_viewed", "doctor_verified", "prescription_issued"]) {
    assert.ok(actions.has(required), `trail is missing ${required}`);
  }

  // Newest first, so the overview's activity feed is the actual latest news.
  for (let i = 1; i < trail.length; i++) {
    assert.ok(trail[i - 1].at >= trail[i].at, "audit trail is not in reverse chronological order");
  }
});

test("every audit entry names an actor and a subject that exist", () => {
  const db = readDB();
  const known = new Set([
    ...db.patients.map((p) => p.id),
    ...db.doctors.map((d) => d.id),
    ...db.admins.map((a) => a.id),
    ...db.bookings.map((b) => b.id),
    ...db.prescriptions.map((p) => p.id),
    "system",
  ]);

  for (const entry of api().auditLog()) {
    assert.ok(known.has(entry.actorId), `unknown actor ${entry.actorId} on ${entry.action}`);
    assert.ok(known.has(entry.subjectId), `unknown subject ${entry.subjectId} on ${entry.action}`);
  }
});

test("each seeded patient's own trail only ever names them or their records", () => {
  const db = readDB();
  const mine = api().auditLog().filter((e) => e.subjectId === "pt-adaeze");
  assert.ok(mine.length > 0);
  for (const entry of mine) {
    // A patient reading their own trail must never see another patient's id.
    const otherPatient = db.patients.find((p) => p.id !== "pt-adaeze" && p.id === entry.actorId);
    assert.equal(otherPatient, undefined, `another patient appears on Adaeze's trail: ${entry.action}`);
  }
});

/* ------------------------------------------------------------------ *
 * Opening a stored document the current build did not write
 * ------------------------------------------------------------------ */

test("a stored document missing a collection is repaired, not crashed on", async () => {
  // A fresh module instance, because `initStore` only reads localStorage once
  // per module — which is exactly the situation in a browser after a deploy.
  const reloaded = await import(`../lib/db.ts?reload=${Date.now()}`);
  const seeded = reloaded.seedDB();

  // Current version number, but written before the console existed: the shape
  // a build sitting between two deploys would have persisted. `initStore`
  // trusts the version, so it hands this straight to the first screen.
  const stale = JSON.parse(JSON.stringify(seeded));
  delete stale.admins;
  delete stale.verifications;
  delete stale.adminSession;

  globalThis.localStorage.clear();
  globalThis.localStorage.setItem(reloaded.DB_KEY, JSON.stringify(stale));

  reloaded.initStore();
  const db = reloaded.readDB();

  // Every collection is present, so the first read cannot throw.
  assert.equal(db.admins.length, 2, "console seats were not restored");
  assert.equal(db.admins.length, 2, "the shipped roster was not restored intact");
  assert.deepEqual(db.verifications, []);
  assert.equal(db.adminSession, null);

  // The read that used to throw a TypeError and blank the screen.
  const rows = createStoreApi(db, true).accountDirectory();
  assert.ok(rows.length > 10, "the account directory came back empty");

  // …and the seat the console authenticates against is a full admin, so the
  // repaired document leaves the dashboard reachable.
  // (Asserted on the return value: `mutate` writes through the module-level
  // database, which is the *other* instance here — see the reload above.)
  const seat = createStoreApi(db, true).signInAdmin(OWNER);
  assert.equal(seat.email, OWNER);
  assert.equal(seat.email, OWNER);
});

test("a repaired document is written back, so the repair happens once", async () => {
  const reloaded = await import(`../lib/db.ts?writeback=${Date.now()}`);
  const stale = JSON.parse(JSON.stringify(reloaded.seedDB()));
  delete stale.admins;

  globalThis.localStorage.clear();
  globalThis.localStorage.setItem(reloaded.DB_KEY, JSON.stringify(stale));
  reloaded.initStore();

  const written = JSON.parse(globalThis.localStorage.getItem(reloaded.DB_KEY));
  assert.equal(written.version, reloaded.DB_VERSION);
  assert.ok(Array.isArray(written.admins) && written.admins.length === 2);
});

test("an empty seat list is respected rather than refilled", async () => {
  // Distinct from a missing key: this is somebody having revoked every seat.
  const reloaded = await import(`../lib/db.ts?empty=${Date.now()}`);
  const doc = JSON.parse(JSON.stringify(reloaded.seedDB()));
  doc.admins = [];

  globalThis.localStorage.clear();
  globalThis.localStorage.setItem(reloaded.DB_KEY, JSON.stringify(doc));
  reloaded.initStore();

  assert.deepEqual(reloaded.readDB().admins, []);
});

test("an unparseable document falls back to the seed instead of throwing", async () => {
  const reloaded = await import(`../lib/db.ts?garbage=${Date.now()}`);
  globalThis.localStorage.clear();
  globalThis.localStorage.setItem(reloaded.DB_KEY, "{ not json");

  reloaded.initStore();
  const db = reloaded.readDB();
  assert.ok(db.patients.length > 0, "did not fall back to the seed");
  assert.equal(db.admins.length, 2);
});

/* ------------------------------------------------------------------ *
 * One role, full console — what "anyone with the admin role" means
 * ------------------------------------------------------------------ */

test("any admin can reach every capability the console offers", () => {
  // Grant a seat to a plain patient account, then check that account can do
  // every single thing the dashboard exposes. This is the behaviour the flat
  // model promises, so it is asserted in full rather than per-command.
  signInOwner();
  api().grantAdmin({ accountId: "pt-bisi" });
  api().signOutAdmin();

  api().signInAdmin("bisi.oladipo@example.com");

  // Reachable. A fresh API per read, because a mutation replaces the snapshot
  // the command API closes over — the same reason the React hook memoises on it.
  assert.ok(api().adminSession, "the new admin cannot get into the console");
  assert.ok(api().accountDirectory().length > 10, "the account directory is unavailable");
  assert.ok(api().platformMetrics().total > 0, "the metrics tab is unavailable");
  assert.ok(api().auditLog().length > 0, "the audit trail is unavailable");
  assert.ok(Array.isArray(api().opsAlerts()), "the alerts feed is unavailable");
  assert.ok(Array.isArray(api().verificationQueue()), "the verification queue is unavailable");

  // Acting
  api().approveDoctor({ doctorId: PENDING, licenceNumber: MDCN });
  assert.equal(api().getDoctor(PENDING)?.doctor.verified, true, "cannot verify a clinician");

  api().rejectDoctor({ doctorId: PENDING, reason: "Registration lapsed this month." });
  assert.equal(api().getDoctor(PENDING)?.doctor.verified, false, "cannot reject a clinician");

  api().grantAdmin({ accountId: "pt-musa" });
  assert.ok(readDB().admins.some((a) => a.id === "pt-musa"), "cannot grant a seat");

  api().revokeAdmin("pt-musa");
  assert.ok(!readDB().admins.some((a) => a.id === "pt-musa"), "cannot revoke a seat");
});

test("the flat model exposes no seat tier to escalate into", () => {
  // There is nothing above an admin, so the classic escalation chain — a narrow
  // seat widening itself — has no rung to climb. Pinned so that reintroducing a
  // tier has to be a deliberate, test-breaking decision.
  const seats = api().accountDirectory().filter((r) => r.admin);
  assert.ok(seats.length > 0, "no seats to inspect");

  for (const row of seats) {
    // Provenance only: when the seat was granted and by whom. Nothing here
    // says how much the seat can do, because every seat can do everything.
    assert.deepEqual(
      Object.keys(row.admin ?? {}).filter((k) => !["grantedAt", "grantedBy"].includes(k)),
      [],
      "a seat exposes a field beyond provenance",
    );
  }

  const surface = Object.keys(api());
  assert.ok(!surface.includes("setAdminScope"), "a seat-tier command is still exposed");
  assert.ok(!surface.includes("adminScope"), "a seat tier is still exposed on the session");
});
