# Definition of Done — status against the PRD

Honest status for each line of the PRD's Definition of Done. "Shipped" means the
flow works end to end in this build; "needs credentials" means the code paths and
data model exist but point at a real provider account that this build does not
have.

| # | DoD item | Status | Where |
| --- | --- | --- | --- |
| 1 | A new patient can sign up, book, pay and complete a video consult end to end without help | **Shipped** (payment and video simulated) | `/onboarding` → `/find` → `/doctors/[id]` → `/book/[doctorId]` → `/checkout/[bookingId]` → `/bookings` → `/consult/[bookingId]` → `/records/[bookingId]` |
| 2 | A doctor can accept a booking, run the call and issue a prescription | **Shipped** | `/doctor` → `/doctor/dashboard` → `/doctor/consult/[bookingId]` |
| 3 | Patient data protected with RLS, no cross-user access | **Schema shipped**, enforced in the client adapter today | `supabase/schema.sql` (9 tables, 9 with RLS, 29 policies, 4 RPCs) + `lib/rules.ts` access checks |
| 4 | Video calls work on Chrome and Safari mobile on a typical 4G connection | **Needs a video provider** | Room lifecycle, join gate, device-permission handling and timers are real; the tile is a placeholder for Daily.co |
| 5 | Payment failures and no-shows handled (refund or reschedule flow) | **Shipped** | Declined card `0002…`, 3-D Secure `4000…`, cancel sheet with refund rules, no-show refund after 10 minutes, free reschedule |
| 6 | Doctors manually verified before appearing in listings | **Shipped** | `verified_at` gate in the store, the `public_doctors` view and `book_slot`; `doc-harish-balan` is the unverified fixture |
| 7 | Privacy policy, terms and patient consent screen live, reviewed against local health-data regulations | **Pages shipped**, legal review outstanding | `/legal/privacy`, `/legal/terms`, `/onboarding/consent`, `/profile/consent` |
| 8 | Tested with at least 10 real patients and 3 doctors, no critical bugs open | **Not done** — needs live users | Instrumentation is in place: `audit_log` records every consequential action |

---

## Core features

### 1. Auth and patient profile

- Email or phone sign-up with a persisted session (`lib/store.ts → signIn`).
- A new account can add age, allergies, conditions and current medication in
  `/profile/health`, with common-allergy and common-condition chips for fast input.
- Consent is versioned and timestamped, and is separate from accepting the terms.
- Demo account is one tap from `/onboarding`.

### 2. Doctor discovery and booking

- 11 verified doctors across 7 specialties, plus 1 unverified profile that is
  invisible in search.
- Search matches name, specialty, clinical specialty name, symptom keywords and
  language ("tooth", "panic", "tamil" all work).
- Filter chips: All, General, Skin, Heart, Child, Dental, Women, Mind.
- Availability: 14-day window, 20-minute slots (45 for psychiatry), today trimmed
  to a 20-minute lead time so a reminder can always be sent.
- Two-step intake — time, then the reason in the patient's own words, duration and
  a 1–5 severity scale.
- Reminder is queued 30 minutes before the start on the channels the patient
  chose; `/profile/notifications` manages them.

### 3. Video consultation

- Join window: opens 10 minutes before, closes 15 minutes after the slot ends.
- Payment is required first — the room refuses to open on an unpaid booking.
- Camera and microphone are requested on join; a blocked permission degrades to
  "join muted" with an explanation rather than a dead screen.
- Waiting-room escalation at 5 minutes, no-show refund available at 10.
- The clinician sees the intake brief, the shared health history and private
  notes, and the room shows a live call timer.
- A refresh during a call triggers the browser's leave-confirmation.

### 4. Payments

- A consultation is confirmed only once payment is captured — enforced in the
  store, in the `bookings_paid_before_confirm` constraint and in `book_slot`.
- Fee, platform fee and total are itemised; refund policy is stated before paying.
- Test cards: `4242…` succeeds, `4000…` triggers a simulated 3-D Secure sheet,
  `0002…` is declined with the reason surfaced and a retry path.
- Doctor-side: the queue shows paid vs unpaid, blocks starting an unpaid
  consultation, and reports monthly captured earnings.

### 5. Prescriptions and visit summary

- The prescription writer validates name, dose, frequency and duration per
  medicine, requires advice, and offers follow-up intervals and an optional
  fitness-for-work note.
- Private clinical notes are stored on the prescription but never rendered to the
  patient.
- The patient gets a printable document (`℞` letterhead, prescriber registration
  number, allergies, digital signature line) plus a full visit summary with a
  timeline.
- Anything is downloadable via the browser's print-to-PDF path, which is what
  works on iOS Safari.

---

## Out of scope in v1 — and enforced as such

The app actively tells patients what it cannot do rather than staying silent:
emergency banner in sign-up, home, search and consent; "what a video call can't
do" on the doctor profile; no pharmacy, insurance, triage, labs, wearables or
group accounts anywhere in the UI or the schema.

## Known gaps before launch

1. **Video provider.** Swap the placeholder tile for Daily.co (or Twilio/Agora).
   The room lifecycle around it is complete.
2. **Payment provider.** Replace the simulated card form with Stripe or Paystack
   hosted fields; `confirm_payment` already accepts a provider reference.
3. **Real auth.** Replace `signIn()` with Supabase Auth OTP; the session shape
   does not change.
4. **Supabase wiring.** `supabase/schema.sql` must be applied to a project and
   `lib/db.ts` replaced with `@supabase/supabase-js` calls behind the same API.
   The schema has not been executed against a live Postgres in this environment —
   run it once in a staging project first.
5. **Reminder Edge Function.** `due_reminders` exists; the sender does not.
6. **Legal review.** Both documents carry an explicit template warning and a
   placeholder grievance contact.
7. **Admin verification console.** Verification currently happens by editing the
   `doctors` row; the PRD implies a manual process, not necessarily a UI in v1.
8. **Accessibility audit.** Token contrast, labels and focus states were chosen
   deliberately, but there has been no screen-reader testing on a real device.
