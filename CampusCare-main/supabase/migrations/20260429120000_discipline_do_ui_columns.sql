-- Discipline Office UI: extra columns for cases, referrals, sanctions (safe to re-run).

alter table public.discipline_cases
  add column if not exists program text not null default '';

alter table public.discipline_cases
  add column if not exists school text not null default '';

alter table public.discipline_cases
  add column if not exists offense_type text not null default '';

alter table public.discipline_referrals
  add column if not exists referring_office text not null default 'discipline';

alter table public.discipline_referrals
  add column if not exists target_office text not null default '';

alter table public.discipline_sanctions
  add column if not exists hours numeric;

alter table public.discipline_sanctions
  add column if not exists corresponding_office text not null default '';

alter table public.discipline_sanctions
  add column if not exists corresponding_office_other text not null default '';

alter table public.discipline_sanctions
  add column if not exists community_service_detail text not null default '';

alter table public.discipline_sanctions
  add column if not exists completion_date text not null default '';

alter table public.discipline_sanctions
  add column if not exists program text not null default '';

alter table public.discipline_sanctions
  add column if not exists school text not null default '';

alter table public.discipline_sanctions
  add column if not exists offenses_summary text not null default '';

notify pgrst, 'reload schema';
