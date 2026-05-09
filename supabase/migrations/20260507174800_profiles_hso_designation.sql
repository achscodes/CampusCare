-- Add HSO designation to profiles for role-based health routing.
-- Safe to run multiple times.

alter table public.profiles
  add column if not exists designation text;

alter table public.profiles
  drop constraint if exists profiles_designation_check;

alter table public.profiles
  add constraint profiles_designation_check
  check (designation is null or designation in ('nurse', 'physician', 'dentist', 'admin'));

update public.profiles
set designation = case
  when lower(role) like '%nurse%' then 'nurse'
  when lower(role) like '%dentist%' then 'dentist'
  when lower(role) like '%physician%' or lower(role) like '%doctor%' then 'physician'
  when lower(role) like '%admin%' then 'admin'
  else 'admin'
end
where office = 'health'
  and (designation is null or designation = '');

comment on column public.profiles.designation is
  'HSO staff designation used for role-scoped navigation and queue workflow (nurse, physician, dentist, admin).';

notify pgrst, 'reload schema';
