-- ============================================================================
-- CareNow — grant the app access to your Supabase project
-- ============================================================================
--
-- Paste into: Supabase dashboard → SQL Editor → New query → Run.
-- Safe to re-run (grants are idempotent; policies are dropped & recreated).
--
-- Two layers control access in Supabase, and BOTH are required:
--   1. GRANTs (this file) — can the API roles touch the table at all?
--   2. RLS policies (this file + schema.sql) — which ROWS can they touch?
--
-- The app connects with the anon key from Vercel and then acts as the
-- signed-in user ("authenticated"). It never uses service_role.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Schema + table privileges
-- ----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

-- Signed-in users: full DML, but Row Level Security (below) restricts every
-- statement to their own rows.
grant select, insert, update, delete
  on profiles, patient_health, doctors, consents,
     slots, bookings, prescriptions, ratings, audit_log
  to authenticated;

-- The audit trail uses a bigserial id; sequences need their own grant.
grant usage, select on all sequences in schema public to authenticated;

-- Signed-out visitors: read-only, and only the public doctor directory.
grant select on public_doctors to anon, authenticated;

-- Booking/payment RPCs (already granted in schema.sql; repeated so this
-- file works even if it is run on its own).
grant execute on function book_slot, confirm_payment, cancel_booking, resolve_no_show
  to authenticated;

-- service_role bypasses RLS by design — keep it server-side only, never in
-- a NEXT_PUBLIC_ variable or the browser.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ----------------------------------------------------------------------------
-- 2. Row Level Security — switch on (idempotent)
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

-- ----------------------------------------------------------------------------
-- 3. Policies — profiles & health (the auth-critical ones)
-- ----------------------------------------------------------------------------

drop policy if exists "read own profile" on profiles;
create policy "read own profile"
  on profiles for select to authenticated
  using (id = auth.uid() or is_admin());

-- Fallback insert: the handle_new_user trigger normally creates this row,
-- but if it ever misses, a user may create ONLY their own patient profile.
drop policy if exists "insert own profile" on profiles;
create policy "insert own profile"
  on profiles for insert to authenticated
  with check (id = auth.uid() and role = 'patient');

drop policy if exists "update own profile" on profiles;
create policy "update own profile"
  on profiles for update to authenticated
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

drop policy if exists "patient reads own health" on patient_health;
create policy "patient reads own health"
  on patient_health for select to authenticated
  using (patient_id = auth.uid() or is_admin());

drop policy if exists "patient writes own health" on patient_health;
create policy "patient writes own health"
  on patient_health for insert to authenticated
  with check (patient_id = auth.uid());

drop policy if exists "patient updates own health" on patient_health;
create policy "patient updates own health"
  on patient_health for update to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

drop policy if exists "patient manages own consent" on consents;
create policy "patient manages own consent"
  on consents for insert to authenticated
  with check (patient_id = auth.uid());

drop policy if exists "patient reads own consent" on consents;
create policy "patient reads own consent"
  on consents for select to authenticated
  using (patient_id = auth.uid() or is_admin());

-- ----------------------------------------------------------------------------
-- 4. Policies — doctors, slots, bookings, prescriptions, ratings, audit
-- ----------------------------------------------------------------------------

drop policy if exists "doctor reads own record" on doctors;
create policy "doctor reads own record"
  on doctors for select to authenticated
  using (id = auth.uid() or is_admin() or verified_at is not null);

drop policy if exists "browse open slots" on slots;
create policy "browse open slots"
  on slots for select to authenticated
  using (
    status = 'open'
    and exists (select 1 from doctors d where d.id = slots.doctor_id and d.verified_at is not null)
  );

drop policy if exists "patient reads own bookings" on bookings;
create policy "patient reads own bookings"
  on bookings for select to authenticated
  using (patient_id = auth.uid() or is_admin());

drop policy if exists "doctor reads own bookings" on bookings;
create policy "doctor reads own bookings"
  on bookings for select to authenticated
  using (doctor_id = auth.uid());

drop policy if exists "patient creates own booking" on bookings;
create policy "patient creates own booking"
  on bookings for insert to authenticated
  with check (
    patient_id = auth.uid()
    and exists (
      select 1 from doctors d
      where d.id = bookings.doctor_id and d.verified_at is not null
    )
  );

drop policy if exists "patient updates own booking" on bookings;
create policy "patient updates own booking"
  on bookings for update to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

drop policy if exists "patient reads own prescriptions" on prescriptions;
create policy "patient reads own prescriptions"
  on prescriptions for select to authenticated
  using (patient_id = auth.uid() or is_admin());

drop policy if exists "anyone reads ratings" on ratings;
create policy "anyone reads ratings"
  on ratings for select to authenticated
  using (true);

drop policy if exists "system writes audit" on audit_log;
create policy "system writes audit"
  on audit_log for insert to authenticated
  with check (true);

drop policy if exists "patient reads own audit trail" on audit_log;
create policy "patient reads own audit trail"
  on audit_log for select to authenticated
  using (actor_id = auth.uid() or subject_id = auth.uid() or is_admin());

-- ----------------------------------------------------------------------------
-- 5. New tables created later should inherit the same access automatically
-- ----------------------------------------------------------------------------

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
