-- =============================================================================
-- Demo Super Admin accounts (HSO / DO / SDAO)
-- =============================================================================
-- Creates auth users + auth.identities (required for email sign-in) and relies
-- on trigger public.handle_new_user() to insert public.profiles.
-- If a user already exists (same email), updates password + metadata + profile.
--
-- Password (change after first login in production): faparina0207
--
-- Run via: supabase db push / migration, or paste into Dashboard → SQL → Run.
-- Safe to run more than once (idempotent by email).
-- =============================================================================

create extension if not exists pgcrypto;

do $$
declare
  inst uuid;
  epw text;
  r record;
  uid uuid;
  meta jsonb;
  id_new uuid;
begin
  -- Match existing project instance when possible (hosted Supabase); else local default.
  select coalesce(
    (select instance_id from auth.users limit 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) into inst;

  epw := crypt('faparina0207', gen_salt('bf'));

  for r in
    select * from (
      values
        ('hsosupport.campuscare@gmail.com'::text, 'health'::text, 'HSO'::text, 'Super Admin'::text),
        ('dosupport.campuscare@gmail.com', 'discipline', 'DO', 'Super Admin'),
        ('sdaosupport.campuscare@gmail.com', 'development', 'SDAO', 'Super Admin')
    ) as t(email, office, fn, ln)
  loop
    meta := jsonb_build_object(
      'first_name', r.fn,
      'last_name', r.ln,
      'middle_initial', '',
      'office', r.office,
      'role', 'Super Admin'
    );

    uid := null;
    select id into uid from auth.users where lower(email) = lower(r.email) limit 1;

    if uid is null then
      id_new := gen_random_uuid();

      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      ) values (
        inst,
        id_new,
        'authenticated',
        'authenticated',
        r.email,
        epw,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        meta,
        now(),
        now()
      );

      -- provider_id for email must be auth.users.id (UUID string), not the email address
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        gen_random_uuid(),
        id_new,
        jsonb_build_object('sub', id_new::text, 'email', r.email),
        'email',
        id_new::text,
        now(),
        now(),
        now()
      );
    else
      update auth.users
      set
        encrypted_password = epw,
        raw_user_meta_data = meta,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
      where id = uid;

      update public.profiles
      set
        first_name = r.fn,
        last_name = r.ln,
        middle_initial = '',
        office = r.office,
        role = 'Super Admin',
        account_status = 'approved',
        updated_at = now()
      where id = uid;

      if not exists (
        select 1 from auth.identities i where i.user_id = uid and i.provider = 'email'
      ) then
        insert into auth.identities (
          id,
          user_id,
          identity_data,
          provider,
          provider_id,
          last_sign_in_at,
          created_at,
          updated_at
        ) values (
          gen_random_uuid(),
          uid,
          jsonb_build_object('sub', uid::text, 'email', r.email),
          'email',
          uid::text,
          now(),
          now(),
          now()
        );
      end if;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
