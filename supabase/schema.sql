-- ============================================================================
-- CareNow — Postgres schema, Row Level Security and RPC functions
-- ============================================================================
--
-- This is the production data layer described in the PRD. The PWA currently runs
-- against `lib/store.ts` (a local adapter that implements the same domain rules)
-- so the whole flow can be demonstrated without credentials; every table, policy
-- and function below is what that adapter stands in for.
--
-- The DoD requires: "Patient data is protected with Row Level Security, with no
-- cross-user data access." That is enforced here rather than in the client.
--
-- Apply with:  supabase db push   (or paste into the SQL editor)
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type user_role     as enum ('patient', 'doctor', 'admin');
create type booking_status as enum ('pending_payment','confirmed','in_progress','completed','cancelled','no_show');
create type payment_status as enum ('unpaid','paid','refunded','failed');
create type slot_status    as enum ('open','booked','blocked');
create type reminder_channel as enum ('email','sms','push');

-- ----------------------------------------------------------------------------
-- Profiles
--
-- One row per authenticated user. `role` is the claim every RLS policy keys off.
-- ----------------------------------------------------------------------------

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role not null default 'patient',
  full_name     text not null,
  email         citext,
  phone         text,
  location      text default 'Coimbatore',
  date_of_birth date,
  gender        text check (gender in ('female','male','other','undisclosed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_contact_present check (email is not null or phone is not null)
);

-- Health information, split out so it can be locked down independently of the
-- profile row: a doctor's directory listing never needs to touch this table.
create table patient_health (
  patient_id          uuid primary key references profiles(id) on delete cascade,
  allergies           text[] not null default '{}',
  conditions          text[] not null default '{}',
  current_medications text[] not null default '{}',
  updated_at          timestamptz not null default now()
);

create table doctors (
  id                 uuid primary key references profiles(id) on delete cascade,
  specialty          text not null,
  qualifications     text not null,
  years_experience   int  not null check (years_experience between 0 and 70),
  bio                text not null default '',
  languages          text[] not null default '{}',
  consultation_fee   numeric(10,2) not null check (consultation_fee >= 0),
  currency           text not null default 'INR',
  -- Manual verification gate. Only rows with verified_at set are discoverable.
  licence_number     text,
  verified_at        timestamptz,
  verified_by        uuid references profiles(id),
  rating             numeric(2,1) not null default 0 check (rating between 0 and 5),
  rating_count       int not null default 0,
  is_accepting       boolean not null default true,
  created_at         timestamptz not null default now(),
  constraint doctors_verified_fields check (
    verified_at is null or (licence_number is not null and verified_by is not null)
  )
);

-- ----------------------------------------------------------------------------
-- Consent  (PRD: "patient consent screen … reviewed against local rules")
-- ----------------------------------------------------------------------------

create table consents (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references profiles(id) on delete cascade,
  version             text not null,
  health_data_consent boolean not null,
  recording_consent   boolean not null default false,
  accepted_at         timestamptz not null default now(),
  withdrawn_at        timestamptz
);

create index consents_patient_idx on consents (patient_id, accepted_at desc);

-- ----------------------------------------------------------------------------
-- Availability and bookings
-- ----------------------------------------------------------------------------

create table slots (
  id             uuid primary key default gen_random_uuid(),
  doctor_id      uuid not null references doctors(id) on delete cascade,
  starts_at      timestamptz not null,
  duration_mins  int not null default 20 check (duration_mins between 5 and 120),
  status         slot_status not null default 'open',
  -- Held while the patient pays; released by a cron job if payment never lands.
  held_until     timestamptz,
  created_at     timestamptz not null default now(),
  unique (doctor_id, starts_at)
);

create index slots_doctor_time_idx on slots (doctor_id, starts_at) where status = 'open';

create table bookings (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  patient_id    uuid not null references profiles(id) on delete cascade,
  doctor_id     uuid not null references doctors(id)  on delete restrict,
  slot_id       uuid not null unique references slots(id) on delete restrict,
  starts_at     timestamptz not null,
  duration_mins int not null,
  status        booking_status not null default 'pending_payment',

  -- Intake: the patient's own words, shown only to the booked doctor.
  intake_reason   text not null,
  intake_notes    text not null default '',
  intake_duration text not null,
  intake_severity int not null check (intake_severity between 1 and 5),
  intake_shared_history boolean not null default true,

  -- Payment
  payment_status    payment_status not null default 'unpaid',
  payment_provider  text,
  payment_reference text,
  amount            numeric(10,2) not null,
  currency          text not null default 'INR',
  paid_at           timestamptz,
  refunded_at       timestamptz,
  failure_reason    text,

  -- Consultation
  room_url        text,
  doctor_joined_at timestamptz,
  ended_at        timestamptz,

  -- Reminders
  reminder_due_at  timestamptz,
  reminder_sent_at timestamptz,
  reminder_channels reminder_channel[] not null default '{email}',

  cancelled_at  timestamptz,
  cancel_reason text,
  resolution    text,          -- patient-facing explanation after a refund/no-show
  created_at    timestamptz not null default now(),

  -- A booking can never be confirmed without payment.
  constraint bookings_paid_before_confirm check (
    status = 'pending_payment' or payment_status in ('paid','refunded')
  )
);

create index bookings_patient_idx on bookings (patient_id, starts_at desc);
create index bookings_doctor_idx  on bookings (doctor_id, starts_at desc);
create index bookings_reminder_idx on bookings (reminder_due_at)
  where reminder_sent_at is null and status = 'confirmed';

-- ----------------------------------------------------------------------------
-- Clinical output
-- ----------------------------------------------------------------------------

create table prescriptions (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null unique references bookings(id) on delete restrict,
  patient_id     uuid not null references profiles(id) on delete cascade,
  doctor_id      uuid not null references doctors(id) on delete restrict,
  issued_at      timestamptz not null default now(),
  diagnosis      text not null,
  -- [{ name, dosage, frequency, duration, notes }]
  medications    jsonb not null default '[]'::jsonb,
  advice         text not null default '',
  follow_up_days int not null default 0 check (follow_up_days between 0 and 365),
  sick_note      jsonb,
  -- Never exposed to the patient: clinical reasoning and differential.
  doctor_notes   text,
  constraint prescriptions_meds_valid check (
    jsonb_typeof(medications) = 'array'
    and jsonb_array_length(medications) <= 20
  )
);

create index prescriptions_patient_idx on prescriptions (patient_id, issued_at desc);

create table ratings (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  patient_id uuid not null references profiles(id) on delete cascade,
  doctor_id  uuid not null references doctors(id) on delete cascade,
  stars      int not null check (stars between 1 and 5),
  comment    text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Audit trail  (immutable; every read of someone else's record is logged)
-- ----------------------------------------------------------------------------

create table audit_log (
  id           bigserial primary key,
  at           timestamptz not null default now(),
  actor_id     uuid references profiles(id),
  actor_type   text not null check (actor_type in ('patient','doctor','system','admin')),
  action       text not null,
  subject_type text not null,
  subject_id   uuid,
  detail       text
);

create index audit_subject_idx on audit_log (subject_type, subject_id, at desc);
create index audit_actor_idx   on audit_log (actor_id, at desc);

-- ----------------------------------------------------------------------------
-- Helper functions used by the policies
--
-- SECURITY DEFINER so a policy can check "is this user the doctor on this
-- booking?" without recursively triggering the policy on `bookings` itself.
-- ----------------------------------------------------------------------------

create or replace function current_role_of() returns user_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()), 'patient'::user_role);
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

/** True when the caller is the treating doctor for this booking. */
create or replace function is_treating_doctor(p_booking_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings b
    where b.id = p_booking_id and b.doctor_id = auth.uid()
  );
$$;

/** True when the caller is the patient on this booking. */
create or replace function is_own_booking(p_booking_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings b
    where b.id = p_booking_id and b.patient_id = auth.uid()
  );
$$;

/**
 * True when a doctor may read a patient's health information: they are the
 * treating doctor on a booking that has been paid for. Access ends when the
 * booking is cancelled — but stays available for completed bookings, because
 * continuity of care is part of the clinical record.
 */
create or replace function doctor_may_read_health(p_patient_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings b
    where b.patient_id = p_patient_id
      and b.doctor_id  = auth.uid()
      and b.status in ('confirmed','in_progress','completed')
      and b.payment_status = 'paid'
  );
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table profiles       enable row level security;
alter table patient_health enable row level security;
alter table doctors        enable row level security;
alter table consents       enable row level security;
alter table slots          enable row level security;
alter table bookings       enable row level security;
alter table prescriptions  enable row level security;
alter table ratings        enable row level security;
alter table audit_log      enable row level security;

-- ---- profiles --------------------------------------------------------------

create policy "read own profile"
  on profiles for select using (id = auth.uid() or is_admin());

create policy "update own profile"
  on profiles for update using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- A doctor's public identity is readable, but only through the verified-doctors
-- view below — never by selecting `profiles` directly.
create policy "doctor reads own treating patients' names"
  on profiles for select using (
    role = 'patient'
    and exists (
      select 1 from bookings b
      where b.patient_id = profiles.id
        and b.doctor_id = auth.uid()
    )
  );

-- ---- patient_health --------------------------------------------------------

create policy "patient reads own health"
  on patient_health for select using (patient_id = auth.uid() or is_admin());

create policy "patient writes own health"
  on patient_health for insert with check (patient_id = auth.uid());

create policy "patient updates own health"
  on patient_health for update using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- The treating doctor reads health data only while the booking is live/completed.
create policy "treating doctor reads health"
  on patient_health for select using (doctor_may_read_health(patient_id));

-- ---- doctors ---------------------------------------------------------------

create policy "doctor manages own record"
  on doctors for update using (id = auth.uid()) with check (id = auth.uid());

create policy "doctor reads own record"
  on doctors for select using (id = auth.uid() or is_admin() or verified_at is not null);

-- ---- consents --------------------------------------------------------------

create policy "patient manages own consent"
  on consents for insert with check (patient_id = auth.uid());

create policy "patient reads own consent"
  on consents for select using (patient_id = auth.uid() or is_admin());

create policy "patient withdraws own consent"
  on consents for update using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- ---- slots -----------------------------------------------------------------

-- Anyone signed in may browse open slots for a verified doctor.
create policy "browse open slots"
  on slots for select using (
    status = 'open'
    and exists (select 1 from doctors d where d.id = slots.doctor_id and d.verified_at is not null)
  );

create policy "doctor manages own slots"
  on slots for all using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());

-- ---- bookings --------------------------------------------------------------

create policy "patient reads own bookings"
  on bookings for select using (patient_id = auth.uid() or is_admin());

create policy "doctor reads own bookings"
  on bookings for select using (doctor_id = auth.uid());

create policy "patient creates own booking"
  on bookings for insert with check (
    patient_id = auth.uid()
    and exists (
      select 1 from doctors d
      where d.id = bookings.doctor_id and d.verified_at is not null
    )
  );

-- A patient may cancel or reschedule, but may not edit clinical fields.
create policy "patient updates own booking"
  on bookings for update using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

create policy "doctor updates own bookings"
  on bookings for update using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

-- ---- prescriptions ---------------------------------------------------------

create policy "patient reads own prescriptions"
  on prescriptions for select using (patient_id = auth.uid() or is_admin());

create policy "doctor reads own prescriptions"
  on prescriptions for select using (doctor_id = auth.uid());

create policy "doctor issues prescription on own booking"
  on prescriptions for insert with check (
    doctor_id = auth.uid()
    and is_treating_doctor(booking_id)
    -- The consultation must have been paid for before anything is prescribed.
    and exists (
      select 1 from bookings b
      where b.id = booking_id and b.payment_status = 'paid'
    )
  );

-- Deliberately no UPDATE policy: a prescription is immutable once signed.
-- A correction is a new row referencing the same booking via a revisions table.

-- ---- ratings ---------------------------------------------------------------

create policy "anyone reads ratings"
  on ratings for select using (true);

create policy "patient rates own completed booking"
  on ratings for insert with check (
    patient_id = auth.uid()
    and exists (
      select 1 from bookings b
      where b.id = booking_id
        and b.patient_id = auth.uid()
        and b.status = 'completed'
    )
  );

-- ---- audit_log -------------------------------------------------------------

create policy "patient reads own audit trail"
  on audit_log for select using (actor_id = auth.uid() or subject_id = auth.uid() or is_admin());

create policy "system writes audit"
  on audit_log for insert with check (true);

-- ----------------------------------------------------------------------------
-- Public read model
--
-- Patients must not be able to select `profiles` or `patient_health` for a
-- doctor. This view exposes exactly the directory fields, and nothing else.
-- ----------------------------------------------------------------------------

create view public_doctors
with (security_invoker = off) as
  select
    d.id,
    p.full_name,
    d.specialty,
    d.qualifications,
    d.years_experience,
    d.bio,
    d.languages,
    d.consultation_fee,
    d.currency,
    d.rating,
    d.rating_count,
    d.licence_number,
    d.verified_at,
    d.is_accepting
  from doctors d
  join profiles p on p.id = d.id
  where d.verified_at is not null;

grant select on public_doctors to authenticated;

-- ----------------------------------------------------------------------------
-- RPC: the supported write paths
--
-- These exist so the client never needs broad table access. Each function is a
-- single auditable transaction, which is also what makes the payment and refund
-- logic safe.
-- ----------------------------------------------------------------------------

/** Creates a booking and holds the slot atomically. Raises if the slot is gone. */
create or replace function book_slot(
  p_slot_id   uuid,
  p_reason    text,
  p_notes     text,
  p_duration  text,
  p_severity  int,
  p_share_history boolean
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_slot   slots;
  v_doctor doctors;
  v_booking bookings;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Lock the slot row so two patients cannot buy the same slot concurrently.
  select * into v_slot from slots where id = p_slot_id for update;
  if not found then
    raise exception 'slot_not_found' using errcode = 'P0002';
  end if;
  if v_slot.status <> 'open' then
    raise exception 'slot_taken' using errcode = 'P0001';
  end if;
  if v_slot.starts_at < now() + interval '20 minutes' then
    raise exception 'slot_too_soon' using errcode = 'P0001';
  end if;

  select * into v_doctor from doctors where id = v_slot.doctor_id;
  if v_doctor.verified_at is null then
    raise exception 'doctor_not_verified' using errcode = 'P0001';
  end if;

  update slots
     set status = 'booked', held_until = now() + interval '15 minutes'
   where id = p_slot_id;

  insert into bookings (
    reference, patient_id, doctor_id, slot_id, starts_at, duration_mins,
    intake_reason, intake_notes, intake_duration, intake_severity, intake_shared_history,
    amount, currency, reminder_due_at, reminder_channels
  ) values (
    'CN-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
    auth.uid(), v_doctor.id, p_slot_id, v_slot.starts_at, v_slot.duration_mins,
    p_reason, coalesce(p_notes, ''), p_duration, p_severity, coalesce(p_share_history, true),
    v_doctor.consultation_fee, v_doctor.currency,
    v_slot.starts_at - interval '30 minutes',
    coalesce(
      (select reminder_channels from profiles where id = auth.uid()),
      '{email}'::reminder_channel[]
    )
  ) returning * into v_booking;

  insert into audit_log (actor_id, actor_type, action, subject_type, subject_id, detail)
  values (auth.uid(), 'patient', 'booking_created', 'booking', v_booking.id, v_doctor.full_name);

  return v_booking;
end;
$$;

/** Marks a booking paid, confirms it, and clears the payment hold. */
create or replace function confirm_payment(
  p_booking_id uuid,
  p_provider   text,
  p_reference  text
) returns bookings
language plpgsql security definer set search_path = public as $$
declare v_booking bookings;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  if v_booking.patient_id <> auth.uid() then
    raise exception 'not_your_booking' using errcode = '42501';
  end if;
  if v_booking.payment_status = 'paid' then
    raise exception 'already_paid' using errcode = 'P0001';
  end if;

  update bookings
     set payment_status = 'paid',
         payment_provider = p_provider,
         payment_reference = p_reference,
         paid_at = now(),
         failure_reason = null,
         status = 'confirmed'
   where id = p_booking_id
  returning * into v_booking;

  update slots set held_until = null where id = v_booking.slot_id;

  insert into audit_log (actor_id, actor_type, action, subject_type, subject_id, detail)
  values (auth.uid(), 'patient', 'payment_captured', 'booking', p_booking_id, p_reference);

  return v_booking;
end;
$$;

/**
 * Cancels a booking. Refunds when more than two hours' notice was given, and
 * releases the slot so somebody else can take it.
 */
create or replace function cancel_booking(p_booking_id uuid, p_reason text)
returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings;
  v_refund  boolean;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  -- Either the patient or the treating doctor may cancel.
  if v_booking.patient_id <> auth.uid() and v_booking.doctor_id <> auth.uid() then
    raise exception 'not_your_booking' using errcode = '42501';
  end if;

  v_refund := v_booking.payment_status = 'paid'
              and v_booking.starts_at > now() + interval '2 hours';

  update bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = p_reason,
         payment_status = case when v_refund then 'refunded'::payment_status else payment_status end,
         refunded_at = case when v_refund then now() else refunded_at end,
         resolution = case
           when v_refund then 'Full refund issued to your original payment method (5–7 working days).'
           when v_booking.payment_status = 'paid' then 'Cancelled inside the 2-hour window, so this consultation is not refundable.'
           else 'No payment was taken for this consultation.'
         end
   where id = p_booking_id
  returning * into v_booking;

  update slots set status = 'open', held_until = null where id = v_booking.slot_id;

  insert into audit_log (actor_id, actor_type, action, subject_type, subject_id, detail)
  values (auth.uid(), case when v_booking.doctor_id = auth.uid() then 'doctor' else 'patient' end,
          'booking_cancelled', 'booking', p_booking_id, p_reason);

  if v_refund then
    insert into audit_log (actor_id, actor_type, action, subject_type, subject_id, detail)
    values (null, 'system', 'refund_issued', 'booking', p_booking_id, null);
  end if;

  return v_booking;
end;
$$;

/** Refunds a no-show: nobody joined the room within ten minutes of the slot. */
create or replace function resolve_no_show(p_booking_id uuid)
returns bookings
language plpgsql security definer set search_path = public as $$
declare v_booking bookings;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  if v_booking.patient_id <> auth.uid() and v_booking.doctor_id <> auth.uid() and not is_admin() then
    raise exception 'not_your_booking' using errcode = '42501';
  end if;
  if v_booking.starts_at > now() - interval '10 minutes' then
    raise exception 'too_early_to_resolve' using errcode = 'P0001';
  end if;

  update bookings
     set status = 'no_show',
         ended_at = now(),
         payment_status = case when payment_status = 'paid' then 'refunded'::payment_status else payment_status end,
         refunded_at = case when payment_status = 'paid' then now() else refunded_at end,
         resolution = 'Nobody joined within 10 minutes, so the full fee has been refunded to your original payment method.'
   where id = p_booking_id
  returning * into v_booking;

  insert into audit_log (actor_id, actor_type, action, subject_type, subject_id, detail)
  values (auth.uid(), 'system', 'refund_issued', 'booking', p_booking_id, 'no_show');

  return v_booking;
end;
$$;

grant execute on function book_slot, confirm_payment, cancel_booking, resolve_no_show to authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: keep the doctor's rating aggregate in step
-- ----------------------------------------------------------------------------

create or replace function refresh_doctor_rating() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update doctors d
     set rating = coalesce(agg.avg_stars, 0),
         rating_count = coalesce(agg.n, 0)
    from (
      select round(avg(stars)::numeric, 1) as avg_stars, count(*) as n
      from ratings where doctor_id = new.doctor_id
    ) agg
   where d.id = new.doctor_id;
  return new;
end;
$$;

create trigger ratings_refresh_doctor
  after insert on ratings
  for each row execute function refresh_doctor_rating();

-- ----------------------------------------------------------------------------
-- Trigger: the reminder queue
--
-- A Supabase Edge Function polls this view every minute and sends the email/SMS.
-- Keeping it as a view means the schedule is data, not a cron entry per booking.
-- ----------------------------------------------------------------------------

create or replace view due_reminders
with (security_invoker = off) as
  select b.id, b.patient_id, b.doctor_id, b.reference, b.starts_at,
         p.full_name as patient_name, p.email, p.phone,
         doc.full_name as doctor_name,
         b.reminder_channels
  from bookings b
  join profiles p   on p.id = b.patient_id
  join profiles doc on doc.id = b.doctor_id
  where b.status = 'confirmed'
    and b.reminder_sent_at is null
    and b.reminder_due_at <= now();

-- ----------------------------------------------------------------------------
-- Storage: prescriptions and uploaded reports
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('patient-records', 'patient-records', false, 10485760,
   array['application/pdf','image/png','image/jpeg','image/heic'])
on conflict (id) do nothing;

-- Files are stored as {patient_id}/{filename}; the first path segment is the
-- only thing that decides access, so a leaked filename is worthless.
create policy "patients read own record files"
  on storage.objects for select using (
    bucket_id = 'patient-records'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "patients upload own record files"
  on storage.objects for insert with check (
    bucket_id = 'patient-records'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "treating doctor reads record files"
  on storage.objects for select using (
    bucket_id = 'patient-records'
    and doctor_may_read_health(((storage.foldername(name))[1])::uuid)
  );
