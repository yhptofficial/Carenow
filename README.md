# CareNow

**Book and attend a video consultation with a licensed doctor from your phone,
without leaving home.**

A mobile-first telemedicine PWA: patient and clinician sides in one Next.js app,
built to the CareNow style guide and the v1 PRD, and set up for the Nigerian
market — doctors registered with the Medical and Dental Council of Nigeria
(MDCN), fees quoted in naira, and legal copy written against the Nigeria Data
Protection Act 2023.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 69 unit + integration tests, no extra dependencies
npm run build        # production build
```

**Want to look around immediately?** Open `/onboarding` and tap
*Use demo account* — you land as Adaeze Nwosu, a patient with a confirmed
consultation, past visits, prescriptions and a no-show refund to inspect. The
clinician side is at `/doctor`.

---

## What's here

| Screen | Route | What it does |
| --- | --- | --- |
| Home | `/` | Next appointment, live-consult banner, latest prescription, rebook, safety notice |
| Find a doctor | `/find` | Symptom/name/specialty search, filter chips, soonest-available ordering |
| Doctor profile | `/doctors/[id]` | Credentials, verification badge, 14-day slot picker, reviews |
| Book | `/book/[doctorId]` | Slot hold, then intake: reason, duration, severity, history sharing |
| Checkout | `/checkout/[bookingId]` | Itemised fee, card form with real failure and 3-D Secure paths |
| Bookings | `/bookings` | Upcoming and past, join, reschedule, cancel with refund rules, rate |
| Consult room | `/consult/[bookingId]` | Join gate, device checks, call timer, prep notes, leave flow |
| Visit summary | `/records/[bookingId]` | Printable clinical record with a visit timeline |
| Prescription | `/prescriptions/[id]` | Pharmacy-ready `℞` document, print to PDF |
| Profile | `/profile` … | Health information, records, consent, reminders, sign out |
| Consent | `/onboarding/consent` | Explicit, separate health-data and recording consent |
| Legal | `/legal/privacy`, `/legal/terms` | Privacy policy and terms |
| Clinician | `/doctor`, `/doctor/dashboard` | Sign-in, today's queue, pre-call brief, earnings |
| Consult desk | `/doctor/consult/[bookingId]` | Call bar, private notes, prescription writer |
| Offline | `/offline` | Served by the service worker when a screen isn't cached |

## Try the flows that matter

1. **The happy path.** Demo account → `/find` → any doctor → pick a time → fill in
   the intake → pay with `4242 4242 4242 4242` → the booking is confirmed with a
   reminder queued 30 minutes before.
2. **A declined payment.** Pay with `0002 0000 0000 0000`: the bank declines, the
   reason is shown, the slot stays held and you can retry.
3. **3-D Secure.** Pay with `4000 0000 0000 0001` for the bank-approval sheet.
4. **Refunds.** Cancel a booking more than 2 hours out for a full refund; try
   inside 2 hours and the app tells you it isn't refundable and offers a free
   reschedule instead.
5. **The clinician side.** `/doctor` → pick a clinician → open a queue item →
   *Brief* → *Start consultation* → call bar → private notes → issue a
   prescription, then check it as the patient in `/profile/prescriptions`.
6. **No-shows.** The demo account includes a consultation where nobody joined;
   the refund appears on the booking and in the visit timeline.

## Architecture, in one paragraph

Screens never touch persistence. They call `useStore()`, which returns a command
API; that API applies the pure rules in `lib/rules.ts` and writes through
`lib/db.ts`. The PRD's production stack is Supabase, but a hosted project needs
credentials this build does not have — shipping code that called it would mean an
app where nothing works. So the local adapter implements the same domain rules
(including the access-control checks), and `supabase/schema.sql` holds the real
production schema: 9 tables, RLS on all of them, 29 policies, and RPCs for
booking, payment, cancellation and no-shows. Swapping it in is a change to one
file.

More detail: [`docs/architecture.md`](docs/architecture.md) ·
[`docs/design-system.md`](docs/design-system.md) ·
[`docs/definition-of-done.md`](docs/definition-of-done.md)

## Project layout

```
app/                    route segments — patient, clinician, legal, offline
  (app)/                the four tab screens, which own the bottom nav
components/             design-system primitives + icons
lib/                    types, catalogue, availability, rules, store, db
supabase/schema.sql     production schema, RLS, RPCs, storage policies
tests/                  Node test runner suites
docs/                   design system, architecture, definition of done
public/                 icons, service worker
```

## Design system

The style guide lives in code, not in a document that drifts:
[`tailwind.config.ts`](tailwind.config.ts) holds every colour, radius, shadow and
type scale as a named token, and
[`docs/design-system.md`](docs/design-system.md) maps each token back to its role.

- Teal `#1FA390` is the only accent, on a pale mint canvas `#F3F8F7`.
- Cards: 20px radius, no border, soft diffused shadow. Bottom nav: floating
  28px-radius pill with a stronger shadow, inset from the screen edges.
- Plus Jakarta Sans, self-hosted, with an SF Pro fallback stack.
- Active states are fill changes, never underlines; every card press scales down
  slightly.
- Icons are a hand-built 1.5px outline set; the star in the rating badge is the
  one filled glyph.

## Market settings

| Setting | Value | Where |
| --- | --- | --- |
| Currency | NGN (₦), formatted by `formatMoney()` | `lib/currency.ts` |
| Doctor registration | MDCN numbers, e.g. `MDCN/R/41208` | `lib/catalog.ts` |
| Clinical qualifications | Nigerian/West African fellowships — FMCP, FWACP, FMCOG, FMCDS, DFM | `lib/catalog.ts` |
| Language coverage | English, Yoruba, Igbo, Hausa, Nigerian Pidgin, Edo, Fulfulde, Kanuri, Nupe | `lib/catalog.ts` |
| Doctor cities | Lagos, Abuja, Ibadan, Kano, Enugu, Kaduna, Benin City, Port Harcourt | `lib/catalog.ts` |
| Patient location label | Lagos | `lib/db.ts`, `app/(app)/*` |
| Regulatory framing | Nigeria Data Protection Act 2023, NDPC | `app/legal/*` |

Changing market is deliberately cheap: fees carry their own currency on the
doctor and booking records, so a screen never assumes a symbol, and the
catalogue is one file.

## Technology

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript in strict mode |
| Styling | Tailwind CSS 3.4 with the design tokens above |
| Data | local adapter now; Supabase (Postgres + RLS) in production |
| Auth | Supabase Auth (email + password) when `NEXT_PUBLIC_SUPABASE_*` is set (see `.env.example` + `supabase/auth_setup.sql`); local accounts + demo user otherwise |
| Video | provider-agnostic room lifecycle; Daily.co recommended by the PRD |
| Payments | simulated provider now; Stripe or Paystack in production |
| Hosting | Vercel; ships as an installable PWA with an offline fallback |
| Tests | Node's built-in test runner — no test framework dependency |

## Deployment

Vercel needs no environment variables for this build. To go live on real
infrastructure, see the deployment section of
[`docs/architecture.md`](docs/architecture.md) — apply `supabase/schema.sql`,
then swap the four adapters (auth, data, video, payments) behind the existing
interfaces.

## Testing

```bash
npm test
```

69 tests: refund and no-show policy, join windows, card outcomes, prescription
validation, availability determinism, catalogue integrity, access control, and
the full booking journey against the real store (including declined payments,
double payment, cross-doctor prescribing and cross-patient record access).

## Safety and regulation

CareNow is not for emergencies, and the app says so on every entry point. It
does not handle ambulance dispatch, in-person procedures, controlled substances
or pharmacy ordering. The privacy policy and terms are shipped as reviewed
templates, written against the Nigeria Data Protection Act 2023, and must still be
checked by a Nigerian lawyer before launch — including naming a Data Protection
Officer and registering with the Nigeria Data Protection Commission.
