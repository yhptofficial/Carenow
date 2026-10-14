-- ============================================================================
-- CareNow — Admin console: access control and credential verification
-- ============================================================================
--
-- Run this once in the Supabase SQL editor AFTER `supabase/schema.sql` and
-- `supabase/auth_setup.sql`. It is idempotent — safe to run again.
--
-- Admin seats write in the dashboard require this file. Without it the console
-- renders but every command fails against a real project, because two things
-- the UI depends on do not exist in the base schema:
--
--   1. No policy lets an admin update a *clinician's* `doctors` row. The only
--      UPDATE policy is `doctor manages own record`, scoped to
--      `id = auth.uid()`, so credential verification has nowhere to write.
--   2. `profiles.role` is writable by its owner. Row-level security filters
--      rows, not columns, so `update own profile`
--      (`using (id = auth.uid())` in schema.sql) lets any signed-in patient run
--         update profiles set role = 'admin' where id = auth.uid();
--      and read every health record on the platform. The guard trigger below
--      closes that.
--
-- There is one admin role and it is not tiered: any seat may verify a clinician,
-- read the trail, and grant or revoke seats. That is enforced the same way the
-- app enforces it — the `is_admin()` check below — with the one exception being
-- the last seat standing, which cannot be given up. See section 3.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Seat scope — removed
--
-- An earlier revision of this file added `profiles.admin_scope` and split seats
-- into 'owner' and 'verifier'. The product now has a single admin role, so the
-- column is dropped. Doing that removes the check constraint with it.
--
-- If you applied the earlier revision, `admin_scope` may hold 'owner' for the
-- seat you bootstrapped. Nothing reads it after this runs, so the drop only
-- removes the finished handover: every seat becomes equal, as intended.
-- ----------------------------------------------------------------------------

alter table public.profiles drop column if exists admin_scope;

drop function if exists public.is_admin_owner();


-- ----------------------------------------------------------------------------
-- 2. Guard trigger — a profile cannot promote itself
--
-- One rule, and it is the only boundary left now that seats are flat: an account
-- may not change its own `role`. Without this, the base schema's
-- `update own profile` policy lets any signed-in patient run
--
--     update profiles set role = 'admin' where id = auth.uid();
--
-- and read every health record on the platform. An existing admin granting the
-- role to somebody else is allowed — that is the console working as designed.
--
-- The last admin seat also cannot be given up or deleted: a single mis-click
-- would otherwise lock everybody out permanently, with no way back in short of
-- running the bootstrap in section 5. That is a footgun rather than a privilege
-- boundary, and it applies to every seat equally.
--
-- Backend operations are deliberately exempt: SQL editor, migrations and
-- service_role have no end-user JWT, so `auth.uid()` is null and the trigger
-- steps aside. That is what keeps the bootstrap path working.
-- ----------------------------------------------------------------------------

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admins_left int;
begin
  -- No end-user session: a backend operation. Not ours to police.
  if auth.uid() is null then
    return new;
  end if;

  -- Not an access change: name, phone, location and the rest stay editable by
  -- their owner, exactly as `update own profile` intends.
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- Handing the role out is the console's job, and any seat may do it. Taking
  -- it away from yourself is not.
  if new.role = 'admin' then
    if not public.is_admin() then
      raise exception 'Only an admin may grant the admin role'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Demoting an admin: allowed for any admin, except the last one.
  if old.role = 'admin' then
    if not public.is_admin() then
      raise exception 'Only an admin may change a profile role'
        using errcode = '42501';
    end if;

    select count(*) into admins_left
      from public.profiles
     where role = 'admin' and id <> old.id;

    if admins_left = 0 then
      raise exception 'The last admin seat cannot be given up — grant another admin first'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Deletes go through the same check: removing the last admin row has the same
-- effect as demoting it.
create or replace function public.guard_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admins_left int;
begin
  if auth.uid() is null then
    return old;
  end if;

  if old.role = 'admin' then
    select count(*) into admins_left
      from public.profiles
     where role = 'admin' and id <> old.id;

    if admins_left = 0 then
      raise exception 'The last admin seat cannot be deleted — grant another admin first'
        using errcode = '42501';
    end if;
  end if;

  return old;
end;
$$;

drop trigger if exists profiles_guard_delete on public.profiles;

create trigger profiles_guard_delete
  before delete on public.profiles
  for each row execute function public.guard_profile_delete();


-- ----------------------------------------------------------------------------
-- 4. Policies the console writes through
-- ----------------------------------------------------------------------------

-- Credential verification: an admin records the decision on the clinician's
-- row. This is the policy the base schema was missing — without it, approving
-- anybody from the dashboard is a silent no-op.
drop policy if exists "admin verifies doctors" on public.doctors;
create policy "admin verifies doctors"
  on public.doctors for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin adds doctors" on public.doctors;
create policy "admin adds doctors"
  on public.doctors for insert to authenticated
  with check (public.is_admin());

-- The console's account directory is `select * from profiles`, so admins need
-- to read every row. `read own profile` in schema.sql already grants
-- `id = auth.uid() or is_admin()`, so this is a no-op today and is restated
-- only so the dependency is visible in one place.
drop policy if exists "admin reads every profile" on public.profiles;
create policy "admin reads every profile"
  on public.profiles for select to authenticated
  using (public.is_admin());

-- An admin records its own decisions. `patient reads own audit trail` already
-- covers the read side.
drop policy if exists "admin writes audit" on public.audit_log;
create policy "admin writes audit"
  on public.audit_log for insert to authenticated
  with check (public.is_admin());

-- Found while writing this file, and worth fixing in the same pass: the base
-- schema's insert policy on the audit trail is `with check (true)`, so any
-- signed-in user can append an entry attributing an action to somebody else —
-- in a table whose whole purpose is to be trustworthy. Narrowed to "your own
-- actions", which is all the app ever writes. Drop this block if a deployment
-- has a backend that writes audit rows for other actors.
drop policy if exists "system writes audit" on public.audit_log;
create policy "own actions are audited"
  on public.audit_log for insert to authenticated
  with check (actor_id = auth.uid() or actor_id is null);


-- ----------------------------------------------------------------------------
-- 5. Bootstrapping a seat
--
-- The one operation that cannot be done from the console: the very first admin,
-- when there is nobody holding a seat to sign in as. Run this from the SQL
-- editor, which has no end-user JWT and therefore passes the guard trigger
-- above.
--
--   select public.grant_admin('you@example.com');
--
-- After that the console looks after itself: any seat can grant and revoke.
--
-- Executable by service_role and the postgres role only. It is revoked from
-- `authenticated` on purpose: an RPC an admin could call would be a second,
-- unguarded way to hand out the very role the guard trigger is protecting.
-- ----------------------------------------------------------------------------

create or replace function public.grant_admin(p_email citext)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.profiles where email = p_email;

  if v_id is null then
    raise exception 'No profile found for %', p_email using errcode = 'P0002';
  end if;

  update public.profiles
     set role = 'admin',
         updated_at = now()
   where id = v_id;

  insert into public.audit_log (actor_id, actor_type, action, subject_type, subject_id, detail)
  values (null, 'system', 'admin_granted', 'patient', v_id, 'bootstrap');

  return v_id;
end;
$$;

-- Drop the two-argument form an earlier revision shipped, so an old grant cannot
-- linger as a second way in.
drop function if exists public.grant_admin(citext, text);

revoke all on function public.grant_admin(citext) from public, anon, authenticated;
grant execute on function public.grant_admin(citext) to service_role;


-- ----------------------------------------------------------------------------
-- 6. Verification, in one query
--
-- What the console sends when an admin approves a clinician, kept here so the
-- same statement can be run by hand during an incident. All three fields are
-- set together because `doctors_verified_fields` in schema.sql requires it:
-- a listing is verified by somebody, against a number, or not at all.
--
--   update public.doctors
--      set licence_number = 'MDCN/R/41208',
--          verified_at    = now(),
--          verified_by    = auth.uid()
--    where id = '<doctor uuid>'
--      and public.is_admin();
--
-- The MDCN number lives on the `doctors` row in production; the local adapter
-- keeps the same three fields on `Doctor.verification`.
-- ----------------------------------------------------------------------------
