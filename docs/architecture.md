# CareNow architecture

## Shape of the app

```
Next.js 16 (App Router) PWA
├── app/                    route segments (patient, clinician, operations)
├── components/             design-system primitives
├── lib/
│   ├── types.ts            domain types — mirror supabase/schema.sql 1:1
│   ├── catalog.ts          the v1 doctor catalogue + specialty index
│   ├── schedule.ts         deterministic availability engine
│   ├── rules.ts            every business rule, as pure functions
│   ├── db.ts               persistence adapter + seed data
│   └── store.ts            the command API screens actually call
├── supabase/               production schema, RLS, RPCs, storage,
│                           admin access control (admin_setup.sql)
├── tests/                  unit + integration tests (Node test runner)
└── public/                 icons, service worker
```

The layering rule: **screens never touch persistence.** A screen calls
`useStore()`, which returns a command API (`createBooking`, `payBooking`,
`cancelBooking`, `issuePrescription`, …). That API applies rules from
`lib/rules.ts` and writes through `lib/db.ts`. Swapping the storage adapter is
therefore a change in one file, not a change in 25 screens.

## Why there is a local adapter

The PRD specifies Supabase for DB, auth and storage. Supabase is a hosted service
and this build has no project credentials, so shipping code that calls it would
mean shipping an app where nothing works — you could not sign up, book, pay or
open a room. Instead:

- `lib/db.ts` persists to `localStorage` behind a `Database` interface that is a
  faithful projection of the Postgres schema (same tables, same columns, same
  enums).
- `lib/store.ts` enforces exactly the rules the RLS policies and RPC functions
  enforce server-side — no cross-user reads, no unpaid consultations, no
  prescription without a name/dose/frequency/duration.
- `supabase/schema.sql` is the real production data layer, written to be applied
  as-is with `supabase db push`.

Integration points and their current stand-ins:

| Concern | Production | This build | Where to swap |
| --- | --- | --- | --- |
| Auth | Supabase Auth (email + password) — **live when configured** | Supabase when `NEXT_PUBLIC_SUPABASE_*` is set, local `signIn()`/`signUp()` otherwise; the Supabase session is mirrored into the local store by `components/SupabaseAuthBridge.tsx` | `lib/supabase/` |
| Auth (mobile) | Supabase phone auth (needs an SMS provider) | Mobile tab stays on the local adapter; hidden when Supabase is configured | `app/onboarding/page.tsx` |
| Database | Postgres + RLS | localStorage `carenow.db` | `lib/db.ts` |
| Video | Daily.co (or Twilio/Agora) | `startConsult()` mints a room URL; the stage is a placeholder tile | `app/consult/[bookingId]`, `app/doctor/consult/[bookingId]` |
| Payments | Stripe / Paystack hosted fields | simulated provider in `lib/rules.ts → paymentOutcomeFor` | `app/checkout/[bookingId]` |
| Notifications | Supabase Edge Function polling `due_reminders` + Resend/Termii | reminders are scheduled on the booking and displayed | `supabase/schema.sql → due_reminders` |
| Storage | Supabase Storage bucket `patient-records` | not needed (no uploads in v1 UI) | `supabase/schema.sql` |

## The availability engine

`lib/schedule.ts` derives each doctor's weekly rota from an FNV-1a hash of their
id, then lays 20-minute slots across it (45 minutes for psychiatry). The result is
deterministic: the same inputs always produce the same slot ids and times.

That determinism is a correctness requirement, not a convenience. A booking is
created from a slot id, and the store re-derives the slot from that id rather
than trusting the caller — which is what makes the "slot just taken" case
testable without a server. Real bookings are then overlaid on top of the rota as
`booked`, so a slot a patient holds disappears for everyone else immediately.

Slot ids carry their own date (`doc-chidinma-okonkwo_2026-03-12_1830`), so the
creator can always re-derive the slot it refers to.

## The rules layer

`lib/rules.ts` holds every policy as a pure function, and both the UI copy and the
store call it. This is what keeps the refund promise in the checkout screen
identical to the code that decides whether a refund happens:

- `FREE_CANCELLATION_HOURS = 2`, `NO_SHOW_GRACE_MINS = 10`,
  `MIN_BOOKING_LEAD_MINS = 20`, `JOIN_OPENS_MINS_BEFORE = 10`,
  `JOIN_CLOSES_MINS_AFTER = 15`
- `validatePrescription()` — a prescription that a pharmacist cannot fill is a
  patient-safety incident, so name, dose, frequency and duration are all mandatory
- `joinState()` — the single definition of when a room is open, shared by the
  patient room and the clinician dashboard
- `canReadPrescription()` / `doctorMayReadHealth()` — the client-side mirror of the
  RLS policies

## Security model

`supabase/schema.sql` defines 9 tables, enables RLS on all 9, and ships 29
policies. The important ones:

- **Profiles** — a patient reads only their own row. A doctor reads a patient's
  name only when they have a booking with them.
- **`patient_health`** — readable by its owner and by a doctor via
  `doctor_may_read_health()`, which requires a *paid* booking in
  `confirmed | in_progress | completed`. A cancelled booking revokes access.
- **Prescriptions** — readable by the patient and the signing doctor. Insert
  requires `is_treating_doctor(booking_id)` and a paid booking. There is
  deliberately **no UPDATE policy**: a signed prescription is immutable, and a
  correction is a new row.
- **Doctors** — patients never select from the `doctors` or `profiles` tables
  directly. The `public_doctors` view (RLS bypassed via `security_invoker = off`)
  exposes exactly the directory fields for **verified** rows only.
- **Storage** — files are stored at `{patient_id}/{filename}`; the first path
  segment is the only thing that decides access.
- **Audit** — every consequential action is appended to `audit_log`, including
  reads of another person's record. The patient can read their own trail.

Writes go through RPCs rather than broad table grants, so each is a single
auditable transaction: `book_slot` (locks the slot row with `FOR UPDATE`, so two
patients cannot buy the same slot), `confirm_payment`, `cancel_booking` (refunds
when >2h notice, reopens the slot), `resolve_no_show` (refunds after the 10-minute
grace period).

The verification gate is enforced in three places: the `public_doctors` view, the
`book_slot` function, and the client store — so an unverified doctor is invisible,
unbookable, and untestable through the UI.

### Admin seats

One role, no tiers. Anyone holding the admin role gets the whole console:
verify clinician credentials, read the audit trail, and grant or revoke seats.
An earlier revision split seats into `owner` and `verifier` scopes; that has been
removed, so there is no longer an in-app privilege ladder — and therefore no rung
to escalate up.

What that means in practice, stated plainly: **a seat can mint more seats**, so
the admin role is the highest-value permission in the product. Grant it the way
you would hand over a master key, not a staff badge.

Two rules survive, and both protect the platform rather than restricting a person:

- **A profile cannot change its own role.** Row-level security filters rows, not
  columns, so the base schema's `update own profile` policy would let any
  signed-in patient run `update profiles set role = 'admin'` and read every
  health record on the platform. `guard_profile_role()` in
  `supabase/admin_setup.sql` closes that. An admin granting the role to somebody
  else is allowed — that is the console working as designed.
- **The last seat cannot be given up or deleted.** A single mis-click would
  otherwise leave a platform with nobody able to administer it and no in-app way
  back. `isLastAdmin()` in `lib/rules.ts` decides it in the console; the same
  trigger decides it in the database.

The rule is enforced in both layers from one place per layer: the store checks
with the command, not in the button that renders it, so a screen cannot widen its
own access by calling a command directly.

The console shows **accounts, not records**. An admin technically has access to
clinical data; the dashboard surfaces names, roles and credential decisions,
which is the data-minimisation position the privacy policy commits to under the
NDPA.

Credential decisions are stored separately from the doctor rows
(`Database.verifications`; a `doctor_verifications` table in production) because
`initStore` re-takes `lib/catalog.ts` on every load. They replay through
`applyVerifications()`, ordered by when the decision was made.

## Rendering and data flow

- Screens are client components reading a `useSyncExternalStore` snapshot.
- SSR renders an empty snapshot (`{db: EMPTY_DB, ready: false}`), so the server
  HTML and the first client render agree; localStorage is read in the subscribe
  callback, one commit later. No hydration mismatch, no flash of "no bookings".
- `RequireAuth` gates every signed-in route and redirects to
  `/onboarding?next=<path>` preserving the query string.
- The four tab screens live in the `(app)` route group, which owns the floating
  bottom nav. Detail and flow screens sit outside it, so the consult room is
  distraction-free.

## PWA

- `app/manifest.ts` — standalone display, portrait lock, maskable icon, three
  shortcuts (Find a doctor, My bookings, My prescriptions).
- `public/sw.js` — static build output is cache-first (content-addressed and
  immutable); navigations are network-first with an `/offline` fallback; anything
  that could carry personal data (`/api/`, Supabase, Daily, Stripe, Paystack) is
  never cached.
- Registration is deferred to the `load` event and skipped entirely in
  development.

## Testing

`npm test` runs 69 tests on Node's built-in runner — no extra dependencies. Node
22 strips the TypeScript types natively, and `tests/register.mjs` supplies an ESM
resolver hook (for the app's extensionless imports) plus a `localStorage` shim.
The tests therefore import and drive the real modules.

- `tests/rules.test.mjs` — refund windows, no-show resolution, join windows, card
  outcomes, prescription validation, access control
- `tests/schedule.test.mjs` — determinism, lead times, rota variety, booking
  overlay, catalogue integrity
- `tests/booking-flow.test.mjs` — the full journey against the real store:
  sign-up → search → book → pay → reschedule → cancel → consult → prescribe →
  rate, plus declined payment, double payment, cross-doctor prescribing and
  cross-patient record access

## Deployment

Vercel, with no environment variables needed for this build. To go live against
real infrastructure:

1. `supabase db push` (or paste `supabase/schema.sql` into the SQL editor).
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see
   `.env.example`). Auth goes live on Supabase immediately — run
   `supabase/auth_setup.sql` so each `auth.users` row gets a `profiles` row,
   and decide the email-confirmation setting (Authentication → Providers →
   Email) to match the sign-up UX. Data still runs locally until `lib/db.ts`
   is replaced with `@supabase/supabase-js` calls behind the same
   `createStoreApi` surface.
2b. Run `supabase/admin_setup.sql` **before** letting anyone into `/admin` — it
   adds the policies the console writes through (an admin updating a clinician's
   verification, in particular) and the trigger that stops a profile promoting
   itself. Then mint the first admin seat from the SQL editor:
   `select public.grant_admin('you@example.com');`
3. Add the video provider's key and swap the placeholder tile in
   `app/consult/[bookingId]` for its SDK component.
4. Add the payment provider's keys and replace the card form with hosted fields.
5. Deploy the reminder Edge Function against `due_reminders` on a one-minute
   schedule.
