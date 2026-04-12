-- Health Services: consultations recorded from the Student Visits dashboard
-- RLS: authenticated read/write (same pattern as discipline office tables).

create table if not exists public.health_consultations (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  student_id text not null,
  visit_type text not null,
  visit_time text,
  chief_complaint text,
  blood_pressure text,
  temperature_c text,
  heart_rate_bpm text,
  diagnosis text,
  treatment text,
  status text not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists health_consultations_created_idx
  on public.health_consultations (created_at desc);

drop trigger if exists health_consultations_updated_at on public.health_consultations;
create trigger health_consultations_updated_at
  before update on public.health_consultations
  for each row execute procedure public.touch_discipline_office_updated_at();

alter table public.health_consultations enable row level security;

drop policy if exists "health_consultations_auth_select" on public.health_consultations;
create policy "health_consultations_auth_select" on public.health_consultations
  for select to authenticated using (true);

drop policy if exists "health_consultations_auth_insert" on public.health_consultations;
create policy "health_consultations_auth_insert" on public.health_consultations
  for insert to authenticated with check (true);

drop policy if exists "health_consultations_auth_update" on public.health_consultations;
create policy "health_consultations_auth_update" on public.health_consultations
  for update to authenticated using (true) with check (true);

drop policy if exists "health_consultations_auth_delete" on public.health_consultations;
create policy "health_consultations_auth_delete" on public.health_consultations
  for delete to authenticated using (true);

grant select, insert, update, delete on table public.health_consultations to authenticated;

notify pgrst, 'reload schema';
