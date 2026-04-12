-- Health Services Office: consultations base table + medical records, appointments, referrals, document requests.
-- Safe to run in the Supabase SQL Editor even if earlier repo migrations were never applied.
-- Idempotent: uses IF NOT EXISTS / OR REPLACE where appropriate.

-- ── Shared updated_at trigger helper (also used by discipline office migrations) ──
create or replace function public.touch_discipline_office_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Student visits / consultations (same as 20260417000000_health_consultations.sql) ──
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

-- Extra columns used by the HSO UI (safe on existing DBs)
alter table public.health_consultations
  add column if not exists attended_by text;

alter table public.health_consultations
  add column if not exists visit_date date;

-- ── Medical records ─────────────────────────────────────────────────────────
create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  student_id text not null,
  program text,
  blood_type text,
  allergies text,
  last_checkup date,
  email text,
  phone text,
  emergency_contact text,
  chronic_conditions text,
  medications text,
  vaccinations text,
  weight_kg text,
  height_cm text,
  blood_pressure text,
  notes text,
  badges text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medical_records_student_id_idx on public.medical_records (student_id);
create index if not exists medical_records_updated_idx on public.medical_records (updated_at desc);

drop trigger if exists medical_records_updated_at on public.medical_records;
create trigger medical_records_updated_at
  before update on public.medical_records
  for each row execute procedure public.touch_discipline_office_updated_at();

-- ── Appointments ────────────────────────────────────────────────────────────
create table if not exists public.health_appointments (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  student_id text not null,
  student_email text,
  student_phone text,
  appointment_date date not null,
  appointment_time text,
  room text,
  service text,
  doctor text,
  duration text,
  status text not null default 'pending',
  purpose text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists health_appointments_date_idx on public.health_appointments (appointment_date desc);

drop trigger if exists health_appointments_updated_at on public.health_appointments;
create trigger health_appointments_updated_at
  before update on public.health_appointments
  for each row execute procedure public.touch_discipline_office_updated_at();

-- ── HSO referrals ───────────────────────────────────────────────────────────
create table if not exists public.health_referrals (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null,
  student_name text not null,
  student_id text not null,
  program text,
  student_email text,
  student_phone text,
  receiving_office text not null,
  referring_office text not null default 'Health Services Office',
  reason text,
  health_observations text,
  recommended_action text,
  status text not null default 'Sent',
  urgent boolean not null default false,
  created_by_name text,
  referral_date date,
  attachments jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_referrals_reference_id_key unique (reference_id)
);

create index if not exists health_referrals_date_idx on public.health_referrals (referral_date desc nulls last);

drop trigger if exists health_referrals_updated_at on public.health_referrals;
create trigger health_referrals_updated_at
  before update on public.health_referrals
  for each row execute procedure public.touch_discipline_office_updated_at();

-- ── Document requests ───────────────────────────────────────────────────────
create table if not exists public.health_document_requests (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  student_name text not null,
  student_id text not null,
  program text,
  document_type text not null,
  priority text not null,
  status text not null default 'Pending',
  notes text,
  requested_by text,
  pending_since text,
  status_banner text,
  request_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_document_requests_external_id_key unique (external_id)
);

create index if not exists health_document_requests_created_idx on public.health_document_requests (created_at desc);

drop trigger if exists health_document_requests_updated_at on public.health_document_requests;
create trigger health_document_requests_updated_at
  before update on public.health_document_requests
  for each row execute procedure public.touch_discipline_office_updated_at();

-- ── RLS (new HSO tables) ────────────────────────────────────────────────────
alter table public.medical_records enable row level security;
alter table public.health_appointments enable row level security;
alter table public.health_referrals enable row level security;
alter table public.health_document_requests enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'medical_records',
    'health_appointments',
    'health_referrals',
    'health_document_requests'
  ]
  loop
    execute format('drop policy if exists "%1$s_auth_select" on public.%1$s', t);
    execute format('create policy "%1$s_auth_select" on public.%1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists "%1$s_auth_insert" on public.%1$s', t);
    execute format('create policy "%1$s_auth_insert" on public.%1$s for insert to authenticated with check (true)', t);
    execute format('drop policy if exists "%1$s_auth_update" on public.%1$s', t);
    execute format('create policy "%1$s_auth_update" on public.%1$s for update to authenticated using (true) with check (true)', t);
    execute format('drop policy if exists "%1$s_auth_delete" on public.%1$s', t);
    execute format('create policy "%1$s_auth_delete" on public.%1$s for delete to authenticated using (true)', t);
    execute format('grant select, insert, update, delete on table public.%1$s to authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
