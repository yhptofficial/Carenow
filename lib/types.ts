/**
 * CareNow domain types.
 *
 * These mirror the Supabase schema in `supabase/schema.sql` one-for-one, so the
 * local adapter and a real Supabase adapter can satisfy the same interface.
 */

export type Role = "patient" | "doctor";

export type SpecialtyId =
  | "general"
  | "skin"
  | "heart"
  | "child"
  | "dental"
  | "womens-health"
  | "mental-health";

export interface Specialty {
  id: SpecialtyId;
  /** Chip label, e.g. "Skin" */
  label: string;
  /** Full clinical name used on doctor profiles, e.g. "Dermatology" */
  clinical: string;
  /** Keywords that make the search bar's free-text matching useful */
  keywords: string[];
}

export interface Doctor {
  id: string;
  /** Set once an admin has verified credentials. Only verified doctors are listed. */
  verified: boolean;
  verification: {
    /** Medical council / licence number, shown on the profile as proof. */
    licenceNumber: string;
    verifiedAt: string;
    verifiedBy: string;
  };
  fullName: string;
  specialty: SpecialtyId;
  /** e.g. "MBBS, MD (Dermatology)" */
  qualifications: string;
  yearsExperience: number;
  bio: string;
  languages: string[];
  consultationFee: number;
  currency: Currency;
  /** Average of completed-visit ratings, 0–5. */
  rating: number;
  ratingCount: number;
  /** Which avatar accent this doctor's initials use. */
  accent: AvatarAccent;
  /** Clinician-side sign-in identity. */
  email: string;
}

export type AvatarAccent = "teal" | "blue" | "purple";

export interface Slot {
  id: string;
  doctorId: string;
  /** ISO 8601 instants so the client can render in the device timezone. */
  startsAt: string;
  durationMins: number;
  status: "open" | "booked";
  bookingId?: string;
}

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentStatus = "unpaid" | "paid" | "refunded" | "failed";

export interface Intake {
  /** Chief complaint, one line. */
  reason: string;
  /** Free text the doctor reads before the call. */
  notes: string;
  /** How long the patient has had the complaint. */
  duration: string;
  /** Patient-declared severity, 1–5. */
  severity: number;
  /** Anything the patient attaches from their profile. */
  attachProfileHistory: boolean;
}

export interface Booking {
  id: string;
  reference: string;
  patientId: string;
  doctorId: string;
  slotId: string;
  startsAt: string;
  durationMins: number;
  status: BookingStatus;
  intake: Intake;
  payment: {
    status: PaymentStatus;
    provider: PaymentProviderId;
    /** Provider reference; used for refunds. */
    reference?: string;
    amount: number;
    currency: Currency;
    paidAt?: string;
    failureReason?: string;
    refundedAt?: string;
  };
  /** Populated when the call starts. Null until then. */
  roomUrl?: string;
  reminders: {
    /** When the email/SMS reminder is queued to fire. */
    scheduledFor: string;
    sentAt?: string;
    channels: ReminderChannel[];
  };
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: string;
  /** Patient-facing explanation after a no-show or refund. */
  resolution?: string;
  /** Minutes the patient actually waited in the room. */
  doctorJoinedAt?: string;
  endedAt?: string;
}

export type ReminderChannel = "email" | "sms" | "push";

export type Currency = "INR" | "NGN" | "USD";

export type PaymentProviderId = "stripe" | "paystack";

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  bookingId: string;
  patientId: string;
  doctorId: string;
  issuedAt: string;
  /** One-line assessment shown at the top of the prescription. */
  diagnosis: string;
  medications: Medication[];
  advice: string;
  /** Days until the doctor wants to see the patient again; 0 = no follow-up. */
  followUpInDays: number;
  /** Optional "fit for work" note, minted on request. */
  sickNote?: {
    fromDate: string;
    toDate: string;
    reason: string;
  };
  /** Private clinician notes, never shown to the patient. */
  doctorNotes?: string;
}

export interface PatientProfile {
  id: string;
  role: "patient";
  fullName: string;
  email?: string;
  phone?: string;
  /** Free-text location used for the header context label. */
  location: string;
  dateOfBirth?: string;
  /** Derived from dateOfBirth; kept explicit so edit forms stay simple. */
  age?: number;
  gender?: "female" | "male" | "other" | "undisclosed";
  allergies: string[];
  conditions: string[];
  currentMedications: string[];
  accent: AvatarAccent;
  consent?: ConsentRecord;
  reminderChannels: ReminderChannel[];
  createdAt: string;
}

export interface ConsentRecord {
  /** Version of the terms/privacy bundle the patient agreed to. */
  version: string;
  acceptedAt: string;
  /** Separate, explicit consent for processing health data. */
  healthDataConsent: boolean;
  /** Separate, explicit consent for recording the consultation. */
  recordingConsent: boolean;
}

export interface Rating {
  id: string;
  bookingId: string;
  patientId: string;
  doctorId: string;
  stars: number;
  comment?: string;
  createdAt: string;
}

/** Append-only trail. Every read of another person's health record lands here. */
export interface AuditEntry {
  id: string;
  at: string;
  actorType: "patient" | "doctor" | "system";
  actorId: string;
  action:
    | "sign_in"
    | "consent_accepted"
    | "profile_updated"
    | "booking_created"
    | "payment_captured"
    | "payment_failed"
    | "refund_issued"
    | "booking_cancelled"
    | "booking_rescheduled"
    | "record_viewed"
    | "consult_started"
    | "consult_ended"
    | "prescription_issued"
    | "rating_submitted";
  /** Which record the action touched. */
  subjectType: "booking" | "patient" | "doctor" | "prescription" | "session";
  subjectId: string;
  detail?: string;
}

/**
 * Everything the local adapter persists, under one key.
 *
 * Note that `slots` are *derived* — the rota comes from `lib/schedule.ts` and
 * real bookings are overlaid on top — so only the durable rows are stored here.
 * This is the same shape a Supabase project would hold in `public.*` tables.
 */
export interface Database {
  version: number;
  doctors: Doctor[];
  patients: PatientProfile[];
  bookings: Booking[];
  prescriptions: Prescription[];
  ratings: Rating[];
  audit: AuditEntry[];
  /** Points at `patients[].id`. Null until sign-in completes. */
  session: PatientSession | null;
  /** Clinician-side session, kept separate from the patient one. */
  doctorSession: { doctorId: string } | null;
  onboardingSeen: boolean;
}

/** The signed-in patient, denormalised out of `patients` for convenience. */
export type PatientSession = PatientProfile;

export interface DoctorAvailabilityDay {
  /** ISO date (YYYY-MM-DD) in the device timezone. */
  date: string;
  label: string;
  weekday: string;
  slots: Slot[];
}

/** A doctor card's headline availability, e.g. "Today · 6:30 PM". */
export interface NextAvailability {
  slotId: string;
  startsAt: string;
  /** "Today" | "Tomorrow" | "Fri 18 Oct" */
  dayLabel: string;
  timeLabel: string;
  /** True when the slot starts within the next 2 hours. */
  soon: boolean;
}
