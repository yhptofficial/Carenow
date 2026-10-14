-- ============================================================================
-- CareNow — booking sync setup (doctors seed + booking RPCs)
-- ============================================================================
--
-- Run AFTER carenow_schema.sql and grant_access.sql:
--   Supabase dashboard → SQL Editor → New query → paste → Run
-- Safe to re-run.
--
-- Why doctors need seeding: `bookings.doctor_id` references `doctors(id)`,
-- and every doctor is first an auth user + profile (the app catalogue's
-- string ids like "doc-zainab-bello" don't exist in Postgres). This script
-- creates one auth user per catalogue doctor with a FIXED uuid — the app
-- maps its local ids to these uuids in `lib/supabase/bookings.ts`, so both
-- sides must stay in sync. The doctors never sign in through Supabase Auth
-- (the clinician side still uses the local picker), so their generated
-- password is a placeholder; rotate it before any doctor-facing launch.
-- ============================================================================

-- 1. One auth user per doctor (fires the profile-creation trigger) ----------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('d0000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'chidinma.okonkwo@carenow.health', extensions.crypt('CareNow-Doctor-2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Dr. Chidinma Okonkwo'), now(), now()),
  ('d0000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'adebayo.oyeleke@carenow.health', extensions.crypt('CareNow-Doctor-2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Dr. Adebayo Oyeleke'), now(), now()),
  ('d0000000-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'zainab.bello@carenow.health', extensions.crypt('CareNow-Doctor-2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Dr. Zainab Bello'), now(), now()),
  ('d0000000-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'emeka.nwachukwu@carenow.health', extensions.crypt('CareNow-Doctor-2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Dr. Emeka Nwachukwu'), now(), now()),
  ('d0000000-0000-4000-8000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'aisha.suleiman@carenow.health', extensions.crypt('CareNow-Doctor-2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Dr. Aisha Suleiman'), now(), now()),
  ('d0000000-0000-4000-8000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'eghosa.omoregie@carenow.health', extensions.crypt('CareNow-Doctor-2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Dr. Eghosa Omoregie'), now(), now()),
  ('d0000000-0000-4000-8000-000000000007'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'ngozi.umeh@carenow.health', extensions.crypt('CareNow-Doctor-2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Dr. Ngozi Umeh'), now(), now()),
  ('d0000000-0000-4000-8000-000000000008'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'ibrahim.danjuma@carenow.health', extensions.crypt('CareNow-Doctor-2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Dr. Ibrahim Danjuma'), now(), now()),
  ('d0000000-0000-4000-8000-000000000009'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'folake.adeyemi@carenow.health', extensions.crypt('CareNow-Doctor-2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Dr. Folake Adeyemi'), now(), now()),
  ('d0000000-0000-4000-8000-000000000010'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'uche.obi@carenow.health', extensions.crypt('CareNow-Doctor-2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Dr. Uche Obi'), now(), now()),
  ('d0000000-0000-4000-8000-000000000011'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'halima.yusuf@carenow.health', extensions.crypt('CareNow-Doctor-2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Dr. Halima Yusuf'), now(), now()),
  ('d0000000-0000-4000-8000-000000000012'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'haruna.bala@carenow.health', extensions.crypt('CareNow-Doctor-2026!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Dr. Haruna Bala'), now(), now())
on conflict (id) do nothing;

-- 2. Promote those profiles to doctors --------------------------------------
update profiles set role = 'doctor' where id in ('d0000000-0000-4000-8000-000000000001'::uuid, 'd0000000-0000-4000-8000-000000000002'::uuid, 'd0000000-0000-4000-8000-000000000003'::uuid, 'd0000000-0000-4000-8000-000000000004'::uuid, 'd0000000-0000-4000-8000-000000000005'::uuid, 'd0000000-0000-4000-8000-000000000006'::uuid, 'd0000000-0000-4000-8000-000000000007'::uuid, 'd0000000-0000-4000-8000-000000000008'::uuid, 'd0000000-0000-4000-8000-000000000009'::uuid, 'd0000000-0000-4000-8000-000000000010'::uuid, 'd0000000-0000-4000-8000-000000000011'::uuid, 'd0000000-0000-4000-8000-000000000012'::uuid);

-- 3. Doctor directory rows (verified_at null = hidden, i.e. Dr. Haruna Bala) -
insert into doctors (
  id, specialty, city, qualifications, years_experience, bio, languages,
  consultation_fee, currency, licence_number, verified_at, verified_by,
  rating, rating_count, is_accepting
) values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'skin', 'Lagos', 'MBBS, FMCP (Dermatology)', 12, 'Treats acne, pigmentation and hair loss with a conservative, evidence-first approach. Sees a lot of skincare damage from mixing unregulated creams, and will tell you exactly which ones to stop. Sends a photo-review follow-up two weeks after every course of treatment.', array['English', 'Igbo', 'Nigerian Pidgin']::text[], 10000, 'NGN', 'MDCN/R/41208', '2026-01-14T09:12:00.000Z'::timestamptz, 'd0000000-0000-4000-8000-000000000001'::uuid, 4.9, 218, true),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'general', 'Ibadan', 'MBBS, DFM', 9, 'Family physician for everyday illness — fevers, malaria, infections, travel advice and long-term blood-pressure reviews. Keeps prescriptions short and explains every drug he sends, including what it will cost you at the pharmacy.', array['English', 'Yoruba', 'Nigerian Pidgin']::text[], 5000, 'NGN', 'MDCN/R/31190', '2026-01-09T11:40:00.000Z'::timestamptz, 'd0000000-0000-4000-8000-000000000002'::uuid, 4.8, 402, true),
  ('d0000000-0000-4000-8000-000000000003'::uuid, 'child', 'Kano', 'MBBS, FMCPaed', 15, 'Newborn to teen care, feeding and growth concerns, and childhood rashes. Comfortable talking a worried parent through a 2am fever over video, and quick to say when a child needs to be seen in person instead.', array['English', 'Hausa', 'Fulfulde']::text[], 8000, 'NGN', 'MDCN/R/52744', '2026-02-02T15:05:00.000Z'::timestamptz, 'd0000000-0000-4000-8000-000000000003'::uuid, 5.0, 164, true),
  ('d0000000-0000-4000-8000-000000000004'::uuid, 'heart', 'Enugu', 'MBBS, FWACP (Cardiology)', 18, 'Reads your home BP log and recent ECG on camera and adjusts medication without a clinic visit. Special interest in cholesterol, heart failure follow-up and blood pressure that has been ''almost controlled'' for years.', array['English', 'Igbo', 'Nigerian Pidgin']::text[], 20000, 'NGN', 'MDCN/R/60931', '2026-01-21T08:30:00.000Z'::timestamptz, 'd0000000-0000-4000-8000-000000000004'::uuid, 4.7, 131, true),
  ('d0000000-0000-4000-8000-000000000005'::uuid, 'womens-health', 'Abuja', 'MBBS, FMCOG', 11, 'Postnatal recovery, breastfeeding problems, contraception and irregular cycles. A large share of her patients are nursing mothers who can''t leave the house, so she runs evening slots deliberately.', array['English', 'Hausa', 'Nupe']::text[], 12000, 'NGN', 'MDCN/R/44087', '2026-01-30T10:00:00.000Z'::timestamptz, 'd0000000-0000-4000-8000-000000000005'::uuid, 4.9, 187, true),
  ('d0000000-0000-4000-8000-000000000006'::uuid, 'dental', 'Benin City', 'BDS, FMCDS', 8, 'Assessment of toothache, gum bleeding and post-extraction pain over video, with a clear answer on whether you can wait until morning or need a clinic tonight. Blunt about what a video call can''t fix — a tooth that needs drilling needs a chair.', array['English', 'Edo', 'Nigerian Pidgin']::text[], 6000, 'NGN', 'MDCN/R/27815', '2026-02-06T13:20:00.000Z'::timestamptz, 'd0000000-0000-4000-8000-000000000006'::uuid, 4.6, 96, true),
  ('d0000000-0000-4000-8000-000000000007'::uuid, 'mental-health', 'Lagos', 'MBBS, FWACP (Psychiatry)', 10, 'Anxiety, burnout and insomnia — particularly in students, bankers and shift workers. First session is a 45-minute assessment; she books evening slots so you don''t have to explain yourself at work.', array['English', 'Igbo', 'Nigerian Pidgin']::text[], 15000, 'NGN', 'MDCN/R/71330', '2026-02-11T09:45:00.000Z'::timestamptz, 'd0000000-0000-4000-8000-000000000007'::uuid, 4.9, 143, true),
  ('d0000000-0000-4000-8000-000000000008'::uuid, 'general', 'Kaduna', 'MBBS, FMCP, MPH', 14, 'Internal medicine for adults: diabetes reviews, thyroid, fatigue and infections that haven''t settled. Order-first approach — sends lab requests to a centre near you so you arrive at the next call with data instead of guesses.', array['English', 'Hausa', 'Kanuri']::text[], 8000, 'NGN', 'MDCN/R/39562', '2026-01-18T16:10:00.000Z'::timestamptz, 'd0000000-0000-4000-8000-000000000008'::uuid, 4.7, 311, true),
  ('d0000000-0000-4000-8000-000000000009'::uuid, 'skin', 'Lagos', 'MBBS, DDVL', 7, 'Fungal infections, acne and pigmentation. Works fast — most patients leave the call with a prescription the same evening, and she''ll check whether what you''re already using is genuine or a repackaged product.', array['English', 'Yoruba']::text[], 8000, 'NGN', 'MDCN/R/88204', '2026-02-09T12:00:00.000Z'::timestamptz, 'd0000000-0000-4000-8000-000000000009'::uuid, 4.8, 127, true),
  ('d0000000-0000-4000-8000-000000000010'::uuid, 'child', 'Port Harcourt', 'MBBS, FWACP (Paediatrics)', 6, 'Childhood fevers, coughs, rashes and feeding issues — including the malaria cases that come with the rains. Patient with first-time parents and happy to repeat anything you missed.', array['English', 'Igbo', 'Nigerian Pidgin']::text[], 7000, 'NGN', 'MDCN/R/15673', '2026-01-26T14:35:00.000Z'::timestamptz, 'd0000000-0000-4000-8000-000000000010'::uuid, 4.6, 88, true),
  ('d0000000-0000-4000-8000-000000000011'::uuid, 'womens-health', 'Abuja', 'MBBS, FWACP (OBGYN)', 13, 'Antenatal advice, PCOS and menopause care. Reviews your scan results on camera and explains what they actually mean, in plain language, without rushing you off the call.', array['English', 'Hausa']::text[], 10000, 'NGN', 'MDCN/R/93471', '2026-02-14T09:00:00.000Z'::timestamptz, 'd0000000-0000-4000-8000-000000000011'::uuid, 4.8, 205, true),
  ('d0000000-0000-4000-8000-000000000012'::uuid, 'dental', 'Kano', 'BDS', 4, 'Newly registered on CareNow. Credentials submitted to MDCN records and under review.', array['English', 'Hausa']::text[], 5000, 'NGN', null, null, 'd0000000-0000-4000-8000-000000000012'::uuid, 0, 0, true)
on conflict (id) do update set
  specialty = excluded.specialty, city = excluded.city,
  qualifications = excluded.qualifications,
  years_experience = excluded.years_experience, bio = excluded.bio,
  languages = excluded.languages, consultation_fee = excluded.consultation_fee,
  licence_number = excluded.licence_number, verified_at = excluded.verified_at,
  verified_by = excluded.verified_by, rating = excluded.rating,
  rating_count = excluded.rating_count;

-- 4. book_appointment: create the slot on demand, then book it --------------
-- The app generates availability locally, so slot rows don't pre-exist in
-- Postgres. This wrapper materialises the slot (unique per doctor+time)
-- and delegates to book_slot, which locks it and does the real booking.

create or replace function book_appointment(
  p_doctor_id     uuid,
  p_starts_at     timestamptz,
  p_duration_mins int,
  p_reason        text,
  p_notes         text,
  p_duration      text,
  p_severity      int,
  p_share_history boolean
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_slot_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into slots (doctor_id, starts_at, duration_mins)
  values (p_doctor_id, p_starts_at, p_duration_mins)
  on conflict (doctor_id, starts_at) do nothing;

  select id into v_slot_id
    from slots
   where doctor_id = p_doctor_id and starts_at = p_starts_at;

  return book_slot(v_slot_id, p_reason, p_notes, p_duration, p_severity, p_share_history);
end;
$$;

-- 5. reschedule_booking: move a booking to a new slot atomically ------------

create or replace function reschedule_booking(
  p_booking_id      uuid,
  p_new_starts_at   timestamptz,
  p_new_duration_mins int
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings;
  v_slot_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  if v_booking.patient_id <> auth.uid() then
    raise exception 'not_your_booking' using errcode = '42501';
  end if;
  if v_booking.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'booking_not_reschedulable' using errcode = 'P0001';
  end if;

  insert into slots (doctor_id, starts_at, duration_mins)
  values (v_booking.doctor_id, p_new_starts_at, p_new_duration_mins)
  on conflict (doctor_id, starts_at) do nothing;

  select id into v_slot_id
    from slots
   where doctor_id = v_booking.doctor_id and starts_at = p_new_starts_at;

  if v_slot_id <> v_booking.slot_id then
    if exists (
      select 1 from bookings
       where slot_id = v_slot_id and id <> p_booking_id
         and status not in ('cancelled')
    ) then
      raise exception 'slot_taken' using errcode = 'P0001';
    end if;

    update slots set status = 'open', held_until = null where id = v_booking.slot_id;
    update slots set status = 'booked', held_until = null where id = v_slot_id;

    update bookings
       set slot_id = v_slot_id,
           starts_at = p_new_starts_at,
           duration_mins = p_new_duration_mins,
           reminder_due_at = p_new_starts_at - interval '30 minutes',
           reminder_sent_at = null
     where id = p_booking_id
    returning * into v_booking;
  end if;

  insert into audit_log (actor_id, actor_type, action, subject_type, subject_id, detail)
  values (auth.uid(), 'patient', 'booking_rescheduled', 'booking', p_booking_id, null);

  return v_booking;
end;
$$;

grant execute on function book_appointment, reschedule_booking to authenticated;
