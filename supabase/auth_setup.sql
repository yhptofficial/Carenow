-- ============================================================================
-- CareNow — Supabase Auth setup
-- ============================================================================
--
-- Run this once in the Supabase SQL editor (or `supabase db push`) AFTER
-- `supabase/schema.sql`. It is idempotent — safe to run again.
--
-- What it does: every new Supabase Auth user automatically gets a `profiles`
-- row (and an empty `patient_health` row). The client cannot create that row
-- itself — `profiles` deliberately has no INSERT policy, so a patient can't
-- mint themselves a row with `role = 'doctor'`. A security-definer trigger
-- on `auth.users` is the safe place to do it.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email, phone)
  values (
    new.id,
    'patient',
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'patient'), '@', 1)
    ),
    new.email,
    new.phone
  )
  on conflict (id) do nothing;

  insert into public.patient_health (patient_id)
  values (new.id)
  on conflict (patient_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: auth users created before this trigger existed get their rows too.
insert into public.profiles (id, role, full_name, email, phone)
select
  u.id,
  'patient',
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(u.email, 'patient'), '@', 1)
  ),
  u.email,
  u.phone
from auth.users u
on conflict (id) do nothing;

insert into public.patient_health (patient_id)
select id from public.profiles where role = 'patient'
on conflict (patient_id) do nothing;
