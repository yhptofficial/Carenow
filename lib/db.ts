import { DOCTORS } from "./catalog";
import { slotsForDay, toISODate, timeLabel } from "./schedule";
import type {
  AuditEntry,
  Booking,
  Database,
  Doctor,
  Medication,
  PatientProfile,
  Prescription,
  ReminderChannel,
  Slot,
} from "./types";

export const DB_VERSION = 1;
export const DB_KEY = "carenow.db";

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

let idCounter = 0;
/** Short, readable ids — good enough for a single-device local store. */
export function uid(prefix: string): string {
  idCounter += 1;
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${t}${idCounter.toString(36)}${r}`;
}

/** Human-facing booking reference, e.g. "CN-7F3K92". */
export function bookingReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `CN-${out}`;
}

export function initialsOf(name: string): string {
  const parts = name
    .replace(/^Dr\.?\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const ACCENTS = ["teal", "blue", "purple"] as const;

/** Stable accent so a person's avatar colour never changes between screens. */
export function accentFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

/* ------------------------------------------------------------------ *
 * Seeding
 * ------------------------------------------------------------------ */

const emptyDB = (): Database => ({
  version: DB_VERSION,
  doctors: DOCTORS,
  patients: [],
  bookings: [],
  prescriptions: [],
  ratings: [],
  audit: [],
  session: null,
  doctorSession: null,
  onboardingSeen: false,
});

const EMPTY_DB = emptyDB();

/** The patient the "Use demo account" button signs in as. */
export const DEMO_PATIENT_EMAIL = "ananya@example.com";

function patient(overrides: Partial<PatientProfile> & Pick<PatientProfile, "id" | "fullName">): PatientProfile {
  return {
    role: "patient",
    location: "Coimbatore",
    allergies: [],
    conditions: [],
    currentMedications: [],
    accent: accentFor(overrides.id),
    reminderChannels: ["email", "sms"],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Take the first genuinely-open slot on a given day offset, so seeded bookings
 * always line up with the availability grid the patient sees.
 */
function takeSlot(
  doctor: Doctor,
  dayOffset: number,
  taken: Set<string>,
  now: Date,
): Slot | null {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  const slot = slotsForDay(doctor, day, now).find((s) => s.status === "open" && !taken.has(s.id));
  if (slot) taken.add(slot.id);
  return slot ?? null;
}

function makeBooking(args: {
  doctor: Doctor;
  slot: Slot;
  patientId: string;
  status: Booking["status"];
  paid: boolean;
  intake: Booking["intake"];
  now: Date;
  reminderSent?: boolean;
}): Booking {
  const { doctor, slot, patientId, status, paid, intake, now, reminderSent } = args;
  const start = new Date(slot.startsAt);
  const reminderAt = new Date(start.getTime() - 30 * 60_000);
  const channels: ReminderChannel[] = ["email", "sms"];
  return {
    id: uid("bk"),
    reference: bookingReference(),
    patientId,
    doctorId: doctor.id,
    slotId: slot.id,
    startsAt: slot.startsAt,
    durationMins: slot.durationMins,
    status,
    intake,
    payment: {
      status: paid ? "paid" : "unpaid",
      provider: "stripe",
      reference: paid ? `pi_${Math.random().toString(36).slice(2, 12)}` : undefined,
      amount: doctor.consultationFee,
      currency: doctor.currency,
      paidAt: paid ? new Date(start.getTime() - 86_400_000).toISOString() : undefined,
    },
    roomUrl: undefined,
    reminders: {
      scheduledFor: reminderAt.toISOString(),
      sentAt: reminderSent ? reminderAt.toISOString() : undefined,
      channels,
    },
    createdAt: new Date(Math.min(now.getTime(), start.getTime() - 86_400_000)).toISOString(),
    doctorJoinedAt: status === "completed" ? new Date(start.getTime() + 60_000).toISOString() : undefined,
    endedAt: status === "completed" ? new Date(start.getTime() + 17 * 60_000).toISOString() : undefined,
  };
}

function meds(list: Medication[]) {
  return list;
}

function makePrescription(args: {
  booking: Booking;
  issuedAt: Date;
  diagnosis: string;
  medications: Medication[];
  advice: string;
  followUpInDays: number;
  sickNote?: Prescription["sickNote"];
}): Prescription {
  const { booking, issuedAt, ...rest } = args;
  return {
    id: uid("rx"),
    bookingId: booking.id,
    patientId: booking.patientId,
    doctorId: booking.doctorId,
    issuedAt: issuedAt.toISOString(),
    ...rest,
  };
}

/** Builds the seeded world: a demo patient with history, plus a clinician queue. */
export function seedDB(now = new Date()): Database {
  const db = emptyDB();
  const taken = new Set<string>();
  const byId = (id: string) => db.doctors.find((d) => d.id === id)!;

  const asha = byId("doc-asha-menon");
  const ravi = byId("doc-ravi-iyer");
  const priya = byId("doc-priya-raman");
  const fatima = byId("doc-fatima-sheikh");
  const meera = byId("doc-meera-krishnan");

  // ---- People -------------------------------------------------------
  const ananya: PatientProfile = patient({
    id: "pt-ananya",
    fullName: "Ananya Sharma",
    email: DEMO_PATIENT_EMAIL,
    phone: "+91 98430 11234",
    dateOfBirth: "1997-04-18",
    age: 29,
    gender: "female",
    allergies: ["Penicillin"],
    conditions: ["PCOS (diagnosed 2023)"],
    currentMedications: ["Folic acid 5mg"],
    accent: "teal",
    consent: {
      version: "2026-02-01",
      acceptedAt: new Date(now.getTime() - 40 * 86_400_000).toISOString(),
      healthDataConsent: true,
      recordingConsent: false,
    },
    createdAt: new Date(now.getTime() - 40 * 86_400_000).toISOString(),
  });

  const anita = patient({
    id: "pt-anita",
    fullName: "Anita Joseph",
    email: "anita.joseph@example.com",
    phone: "+91 90031 55210",
    age: 34,
    gender: "female",
    allergies: ["Sulfa drugs"],
    conditions: ["Hypothyroidism"],
    accent: "purple",
    createdAt: new Date(now.getTime() - 21 * 86_400_000).toISOString(),
  });

  const rahul = patient({
    id: "pt-rahul",
    fullName: "Rahul Verma",
    email: "rahul.verma@example.com",
    phone: "+91 99400 77123",
    age: 41,
    gender: "male",
    allergies: [],
    conditions: ["Hypertension", "Type 2 diabetes"],
    currentMedications: ["Telmisartan 40mg", "Metformin 500mg"],
    accent: "blue",
    createdAt: new Date(now.getTime() - 60 * 86_400_000).toISOString(),
  });

  const meena = patient({
    id: "pt-meena",
    fullName: "Meena Kumari",
    email: "meena.k@example.com",
    age: 8,
    gender: "female",
    allergies: [],
    conditions: [],
    createdAt: new Date(now.getTime() - 3 * 86_400_000).toISOString(),
  });

  db.patients = [ananya, anita, rahul, meena];

  // ---- Upcoming, joinable consult for the demo patient ---------------
  // Two days out, paid, confirmed — this is the booking the demo lands on.
  const soon = takeSlot(fatima, 2, taken, now);
  if (soon) {
    const b = makeBooking({
      doctor: fatima,
      slot: soon,
      patientId: ananya.id,
      status: "confirmed",
      paid: true,
      now,
      reminderSent: false,
      intake: {
        reason: "Postnatal check and breastfeeding pain",
        notes:
          "Six weeks after delivery. Sharp pain on the left side during feeds since Tuesday. " +
          "No fever. Already trying a warm compress.",
        duration: "5 days",
        severity: 3,
        attachProfileHistory: true,
      },
    });
    db.bookings.push(b);
    db.audit.push(audit(now, "patient", ananya.id, "booking_created", "booking", b.id));
    db.audit.push(audit(now, "system", "system", "payment_captured", "booking", b.id));
  }

  // ---- The clinician's queue (other people's bookings) ---------------
  const queueSlot = takeSlot(asha, 0, taken, now);
  if (queueSlot) {
    const b = makeBooking({
      doctor: asha,
      slot: queueSlot,
      patientId: anita.id,
      status: "confirmed",
      paid: true,
      now,
      reminderSent: true,
      intake: {
        reason: "Recurring rash on both forearms",
        notes:
          "Started after switching laundry detergent. Itchy at night, no weeping or fever. " +
          "Tried an over-the-counter antihistamine.",
        duration: "2 weeks",
        severity: 2,
        attachProfileHistory: true,
      },
    });
    db.bookings.push(b);
  }

  const queueSlot2 = takeSlot(ravi, 1, taken, now);
  if (queueSlot2) {
    const b = makeBooking({
      doctor: ravi,
      slot: queueSlot2,
      patientId: rahul.id,
      status: "confirmed",
      paid: true,
      now,
      intake: {
        reason: "Blood pressure review",
        notes: "Home readings averaging 148/92 this month. No headaches or chest pain.",
        duration: "1 month",
        severity: 1,
        attachProfileHistory: true,
      },
    });
    db.bookings.push(b);
  }

  const unpaidSlot = takeSlot(ravi, 2, taken, now);
  if (unpaidSlot) {
    db.bookings.push(
      makeBooking({
        doctor: ravi,
        slot: unpaidSlot,
        patientId: meena.id,
        status: "pending_payment",
        paid: false,
        now,
        intake: {
          reason: "Fever for two days",
          notes: "Temperature 101.4°F at home. Drinking fluids normally, playful between fevers.",
          duration: "2 days",
          severity: 3,
          attachProfileHistory: false,
        },
      }),
    );
  }

  // ---- Completed history, so Records has something real --------------
  const pastRavi = takeSlot(ravi, -12, taken, now);
  if (pastRavi) {
    const b = makeBooking({
      doctor: ravi,
      slot: pastRavi,
      patientId: ananya.id,
      status: "completed",
      paid: true,
      now,
      reminderSent: true,
      intake: {
        reason: "Sore throat and mild fever",
        notes: "Onset two days ago, painful swallowing, no cough.",
        duration: "2 days",
        severity: 2,
        attachProfileHistory: true,
      },
    });
    db.bookings.push(b);
    db.prescriptions.push(
      makePrescription({
        booking: b,
        issuedAt: new Date(new Date(b.startsAt).getTime() + 22 * 60_000),
        diagnosis: "Acute pharyngitis, likely viral",
        medications: meds([
          {
            name: "Paracetamol 650mg",
            dosage: "1 tablet",
            frequency: "Three times a day after food",
            duration: "3 days",
            notes: "Stop once fever has been gone for 24 hours.",
          },
          {
            name: "Benzydamine 0.15% gargle",
            dosage: "10 ml diluted in 30 ml water",
            frequency: "Twice a day",
            duration: "5 days",
          },
        ]),
        advice:
          "Warm salt-water gargles, 2.5–3 litres of fluids a day. Rest the voice. " +
          "Return if the fever crosses 102°F or swallowing becomes impossible.",
        followUpInDays: 0,
      }),
    );
    db.ratings.push({
      id: uid("rt"),
      bookingId: b.id,
      patientId: ananya.id,
      doctorId: ravi.id,
      stars: 5,
      comment: "Explained everything clearly and the prescription arrived before I got up.",
      createdAt: new Date(new Date(b.startsAt).getTime() + 2 * 86_400_000).toISOString(),
    });
  }

  const pastAsha = takeSlot(asha, -34, taken, now);
  if (pastAsha) {
    const b = makeBooking({
      doctor: asha,
      slot: pastAsha,
      patientId: ananya.id,
      status: "completed",
      paid: true,
      now,
      reminderSent: true,
      intake: {
        reason: "Acne flare-up along the jawline",
        notes: "Worse in the week before my period. Using a salicylic face wash.",
        duration: "3 months",
        severity: 2,
        attachProfileHistory: true,
      },
    });
    db.bookings.push(b);
    db.prescriptions.push(
      makePrescription({
        booking: b,
        issuedAt: new Date(new Date(b.startsAt).getTime() + 19 * 60_000),
        diagnosis: "Hormonal acne, mild to moderate",
        medications: meds([
          {
            name: "Adapalene 0.1% gel",
            dosage: "Pea-sized amount",
            frequency: "Once at night on dry skin",
            duration: "8 weeks",
            notes: "Expect dryness for the first two weeks. Use sunscreen daily.",
          },
          {
            name: "Clindamycin 1% gel",
            dosage: "Thin layer",
            frequency: "Once every morning",
            duration: "8 weeks",
          },
        ]),
        advice:
          "Stop the salicylic wash while you use adapalene — together they irritate the skin. " +
          "Photographs in two weeks would help me judge progress.",
        followUpInDays: 14,
        sickNote: undefined,
      }),
    );
    db.ratings.push({
      id: uid("rt"),
      bookingId: b.id,
      patientId: ananya.id,
      doctorId: asha.id,
      stars: 5,
      comment: "Followed up on chat without charging again.",
      createdAt: new Date(new Date(b.startsAt).getTime() + 86_400_000).toISOString(),
    });
  }

  // A second opinion the demo patient can rebook from her visit history.
  const pastMeera = takeSlot(meera, -6, taken, now);
  if (pastMeera) {
    const b = makeBooking({
      doctor: meera,
      slot: pastMeera,
      patientId: rahul.id,
      status: "completed",
      paid: true,
      now,
      reminderSent: true,
      intake: {
        reason: "Trouble sleeping and work stress",
        notes: "Waking at 3am most nights for the past three weeks.",
        duration: "3 weeks",
        severity: 3,
        attachProfileHistory: true,
      },
    });
    db.bookings.push(b);
    db.prescriptions.push(
      makePrescription({
        booking: b,
        issuedAt: new Date(new Date(b.startsAt).getTime() + 48 * 60_000),
        diagnosis: "Adjustment disorder with insomnia",
        medications: meds([
          {
            name: "Melatonin 3mg",
            dosage: "1 tablet",
            frequency: "Once, 30 minutes before bed",
            duration: "14 days",
            notes: "Not a sedative — it only helps you fall asleep, not stay asleep.",
          },
        ]),
        advice:
          "Fixed wake time, screens off 45 minutes before bed, no caffeine after 2pm. " +
          "Log your sleep for two weeks; we will review whether talking therapy helps more.",
        followUpInDays: 14,
      }),
    );
  }

  // A no-show that was refunded — exercises the PRD's failure handling path.
  const noShowSlot = takeSlot(priya, -3, taken, now);
  if (noShowSlot) {
    const b = makeBooking({
      doctor: priya,
      slot: noShowSlot,
      patientId: meena.id,
      status: "no_show",
      paid: true,
      now,
      reminderSent: true,
      intake: {
        reason: "Rash behind both knees",
        notes: "Itchy, worse after play.",
        duration: "1 week",
        severity: 2,
        attachProfileHistory: false,
      },
    });
    b.resolution =
      "Nobody joined within 10 minutes, so the doctor closed the room and we refunded the full fee to your original payment method.";
    b.payment.status = "refunded";
    b.payment.refundedAt = new Date(new Date(b.startsAt).getTime() + 20 * 60_000).toISOString();
    db.bookings.push(b);
    db.audit.push(audit(now, "system", "system", "refund_issued", "booking", b.id, "Patient did not join"));
  }

  return db;
}

function audit(
  at: Date,
  actorType: AuditEntry["actorType"],
  actorId: string,
  action: AuditEntry["action"],
  subjectType: AuditEntry["subjectType"],
  subjectId: string,
  detail?: string,
): AuditEntry {
  return { id: uid("au"), at: at.toISOString(), actorType, actorId, action, subjectType, subjectId, detail };
}

/* ------------------------------------------------------------------ *
 * The store
 * ------------------------------------------------------------------ */

type Snapshot = { db: Database; ready: boolean };

/**
 * Server-rendered HTML and the first client render must agree, so both see this
 * constant. `ready` flips to true once localStorage has been read.
 */
const SERVER_SNAPSHOT: Snapshot = { db: EMPTY_DB, ready: false };

let db: Database = EMPTY_DB;
let ready = false;
let snapshot: Snapshot = SERVER_SNAPSHOT;
let persisted = "";

const listeners = new Set<() => void>();

function publish() {
  snapshot = { db, ready };
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    const next = JSON.stringify(db);
    if (next === persisted) return;
    window.localStorage.setItem(DB_KEY, next);
    persisted = next;
  } catch {
    // Quota or private-mode failure: the session still works in memory.
  }
}

/** Loads persisted state, migrating or reseeding when the shape has changed. */
export function initStore(): void {
  if (typeof window === "undefined" || ready) return;
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed?.version === DB_VERSION) {
        db = parsed;
        // Always take the newest catalogue definition (fees, bios, verification).
        db.doctors = DOCTORS;
      } else {
        db = seedDB();
        persisted = raw; // force a write of the migrated shape
      }
    } else {
      db = seedDB();
    }
  } catch {
    db = seedDB();
  }
  ready = true;
  persist();
  publish();
}

export function getSnapshot(): Snapshot {
  return snapshot;
}

export function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Applies a change, writes it through, and notifies subscribers. */
export function mutate(fn: (draft: Database) => void): void {
  if (!ready) return;
  // Structured clone keeps accidental aliasing out of the store.
  const draft: Database = JSON.parse(JSON.stringify(db));
  fn(draft);
  db = draft;
  persist();
  publish();
}

/** Wipes local state and rebuilds the seed. Used by "Reset demo data". */
export function resetStore(): void {
  const fresh = seedDB();
  db = fresh;
  persisted = "";
  persist();
  publish();
}

export function readDB(): Database {
  return db;
}

export { EMPTY_DB, timeLabel, toISODate };
