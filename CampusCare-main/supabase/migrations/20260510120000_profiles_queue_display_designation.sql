-- Allow HSO "Patient Queue Display" kiosk accounts (TV waiting-room monitor).

alter table public.profiles
  drop constraint if exists profiles_designation_check;

alter table public.profiles
  add constraint profiles_designation_check
  check (
    designation is null
    or designation in ('nurse', 'physician', 'dentist', 'admin', 'queue_display')
  );

comment on column public.profiles.designation is
  'HSO staff designation: nurse, physician, dentist, admin, or queue_display (waiting-room TV).';

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
begin
  r := coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'Staff');
  office_key := coalesce(nullif(trim(new.raw_user_meta_data->>'office'), ''), 'health');
  designation_key := lower(coalesce(nullif(trim(new.raw_user_meta_data->>'designation'), ''), ''));

  if r = 'Super Admin' then
    st := 'approved';
  elsif office_key = 'health' and (designation_key = 'admin' or lower(r) = 'admin') then
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
      when office_key = 'health'
        and designation_key in ('nurse', 'physician', 'dentist', 'admin', 'queue_display')
      then designation_key
      else null
    end,
    new.email
  );
  return new;
end;
$$;

notify pgrst, 'reload schema';
