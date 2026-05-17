-- Auto-approve HSO Admin signups.
-- Nurse, physician, and dentist remain pending for approval.

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

  insert into public.profiles (id, first_name, middle_initial, last_name, office, role, account_status, designation)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'middle_initial', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    office_key,
    r,
    st,
    case
      when office_key = 'health' and designation_key in ('nurse', 'physician', 'dentist', 'admin') then designation_key
      else null
    end
  );
  return new;
end;
$$;

update public.profiles
set account_status = 'approved'
where office = 'health'
  and account_status = 'pending'
  and (
    lower(coalesce(designation, '')) = 'admin'
    or lower(coalesce(role, '')) = 'admin'
  );

update public.profiles
set designation = 'admin'
where office = 'health'
  and lower(coalesce(role, '')) = 'admin'
  and (designation is null or designation = '');

notify pgrst, 'reload schema';
