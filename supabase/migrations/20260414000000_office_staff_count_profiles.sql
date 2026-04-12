-- Office Staff on the landing page: count public.profiles (staff who have a CampusCare row)
-- instead of auth.users. The Auth UI can filter the list while SQL still has an extra row
-- (e.g. unconfirmed, or an old test account), which made get_auth_registered_user_count() return 4.

create or replace function public.get_auth_registered_user_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint from public.profiles;
$$;

comment on function public.get_auth_registered_user_count() is 'Count of public.profiles (registered staff); matches app signups 1:1 via handle_new_user trigger.';
