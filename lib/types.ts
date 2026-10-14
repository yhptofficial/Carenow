/**
 * CareNow domain types.
 *
 * These mirror the Supabase schema in `supabase/schema.sql` one-for-one, so the
 * local adapter and a real Supabase adapter can satisfy the same interface.
 */

export type Role = "patient" | "doctor" | "admin";

/**
 * An admin seat.
 *
 * One role, one set of powers: anyone holding a seat can do everything the
 * console does — verify credentials, read the audit trail, and hand out or
 * revoke seats. An earlier revision split seats into `owner` and `verifier`
 * scopes; that has been removed, so there is no longer any in-app privilege
 * ladder to escalate.
 *
 * What that costs, stated plainly: a seat is now equivalent to being able to
 * mint more seats, so `admins` is the highest-value table in the system. Grant
 * it the way you would hand over a master key rather than a staff badge — and
 * note that `guard_profile_role()` in `supabase/admin_setup.sql` is what stops
 * a profile granting the role to itself.
 *
 * `id` is the profile id the seat belongs to, matching `profiles.id` in
 * `supabase/schema.sql` — an admin there is a `profiles` row with
 * `role = 'admin'`, and the same profile can hold bookings. Staff who exist
 * only to run the console (`baseRole: "staff"`) have no patient or doctor
 * record, exactly like a Supabase profile with no `patient_health` row.
 */
export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  /** What the account is *without* its admin seat. Revoking returns them here. */
  baseRole: "patient" | "doctor" | "staff";
  grantedAt: string;
  /** Email of the admin who handed out the seat. Absent for founding staff. */
  grantedBy?: string;
  lastSignedInAt?: string;
}

/**
 * A credential decision, recorded once and never edited.
 *
 * Doctor rows are re-taken from `lib/catalog.ts` on every page load, so a
 * verification made in the browser would not survive a refresh if it lived on
 * the doctor. Decisions are therefore append-only here and replayed on load —
 * the same shape a `doctor_verifications` table would have in Postgres, where
 * `doctors.verified_at` is the durable column and this is the trail behind it.
 */
export interface DoctorVerification {
  id: string;
  doctorId: string;
  decision: "approved" | "rejected";
  /** The MDCN number the reviewer actually checked. Required to approve. */
  licenceNumber: string;
  /** Why an application was turned down. Required to reject. */
  reason?: string;
  decidedAt: string;
  decidedBy: string;
  adminId: string;
}

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
  /** Where the clinician is registered and practises from. */
  city: string;
  /** e.g. "MBBS, FMCP (Dermatology)" */
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

/** NGN is the currency CareNow prices in; the union keeps room for other markets. */
export type Currency = "NGN" | "INR" | "USD";

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
  /**
   * One-way hash of the patient's password — never the password itself.
   * Accounts created before passwords were introduced have none; they set
   * one the next time they sign in. Kept off the session copy (see store).
   */
  passwordHash?: string;
  /**
   * Which auth system owns this account. `"supabase"` profiles are mirrors of
   * a Supabase Auth user (the id is the Supabase user id) and carry no local
   * password; `"local"` (or absent) is the prototype adapter's own account.
   */
  authProvider?: "local" | "supabase";
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
  actorType: "patient" | "doctor" | "system" | "admin";
  actorId: string;
  action:
    | "sign_up"
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
    | "rating_submitted"
    | "doctor_verified"
    | "doctor_rejected"
    | "admin_granted"
    | "admin_revoked";
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
  /** Admin seats. Keyed by profile id — see `AdminUser`. */
  admins: AdminUser[];
  /** Append-only credential decisions replayed onto `doctors` on load. */
  verifications: DoctorVerification[];
  /** Points at `patients[].id`. Null until sign-in completes. */
  session: PatientSession | null;
  /** Clinician-side session, kept separate from the patient one. */
  doctorSession: { doctorId: string } | null;
  /** Operations-side session, kept separate from both. */
  adminSession: { adminId: string } | null;
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
