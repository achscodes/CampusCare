-- Derive profiles.office from signup dropdown (signup_office_raw) so DO/SDAO institution admins
-- are never stored as health when metadata is incomplete or mismatched.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  office_key text;
  designation_key text;
  st text;
  raw_signup_office text;
begin
  r := coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'Staff');
  raw_signup_office := lower(trim(coalesce(new.raw_user_meta_data->>'signup_office_raw', '')));

  office_key := coalesce(
    case raw_signup_office
      when 'discipline_super_admin' then 'discipline'
      when 'development_super_admin' then 'development'
      when 'health_super_admin' then 'health'
      else null
    end,
    nullif(trim(new.raw_user_meta_data->>'office'), ''),
    'health'
  );

  designation_key := lower(coalesce(nullif(trim(new.raw_user_meta_data->>'designation'), ''), ''));

  if r = 'Super Admin' or (r = 'Admin' and not (office_key = 'health' and designation_key = 'admin')) then
    st := 'approved';
  elsif office_key = 'health' and designation_key = 'admin' then
    st := 'approved';
  else
    st := 'pending';
  end if;

  insert into public.profiles (id, first_name, middle_initial, last_name, office, role, account_status, designation, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'middle_initial', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    office_key,
    r,
    st,
    case
      when office_key = 'health' and designation_key in ('nurse', 'physician', 'dentist', 'admin', 'queue_display', 'welfare_admin')
        then designation_key
      else null
    end,
    new.email
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates profiles from auth.users; office from signup_office_raw (institution admin options) then user_metadata.office, else health.';

notify pgrst, 'reload schema';
