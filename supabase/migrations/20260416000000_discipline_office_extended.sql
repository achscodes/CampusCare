-- Discipline Office: student records, document requests, referrals, sanctions, case conferences
-- Run after discipline_cases migration. RLS: authenticated full access (same pattern as discipline_cases).

-- ── Student welfare records (per student) ─────────────────────────────────
create table if not exists public.discipline_student_records (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  student_id text not null,
  program text not null default '',
  status text not null default 'active',
  risk_level text not null default 'medium',
  notes text not null default '',
  open_cases_count int not null default 0,
  last_incident_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discipline_student_records_status_check check (
    status in ('active', 'good', 'closed')
  ),
  constraint discipline_student_records_risk_check check (
    risk_level in ('low', 'medium', 'high')
  )
);

create unique index if not exists discipline_student_records_student_id_key
  on public.discipline_student_records (student_id);

create index if not exists discipline_student_records_created_idx
  on public.discipline_student_records (created_at desc);

-- ── Document requests ────────────────────────────────────────────────────────
create table if not exists public.discipline_document_requests (
  id text primary key,
  student_name text not null,
  student_id text not null,
  document_type text not null,
  priority text not null,
  status text not null,
  description text not null,
  evidence jsonb not null default '[]'::jsonb,
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discipline_document_requests_priority_check check (
    priority in ('low', 'medium', 'high')
  )
);

create index if not exists discipline_document_requests_requested_idx
  on public.discipline_document_requests (requested_at desc);

-- ── Referrals ────────────────────────────────────────────────────────────────
create table if not exists public.discipline_referrals (
  id text primary key,
  student_name text not null,
  student_id text not null,
  referral_type text not null,
  reason text not null,
  status text not null,
  referral_date timestamptz not null default now(),
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discipline_referrals_date_idx
  on public.discipline_referrals (referral_date desc);

-- ── Sanctions ────────────────────────────────────────────────────────────────
create table if not exists public.discipline_sanctions (
  id text primary key,
  student_name text not null,
  student_id text not null,
  sanction_type text not null,
  status text not null,
  due_date text not null default '',
  notes text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discipline_sanctions_created_idx
  on public.discipline_sanctions (created_at desc);

-- ── Case conferences / hearings ─────────────────────────────────────────────
create table if not exists public.discipline_case_conferences (
  id text primary key,
  case_id text not null,
  student_name text not null,
  student_id text not null,
  case_title text not null,
  day_of_month int,
  date_label text not null,
  time_label text not null,
  duration_label text not null default '1 hour',
  location text not null,
  status text not null,
  attendees jsonb not null default '[]'::jsonb,
  notes text not null default '',
  presiding_officer text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discipline_case_conferences_status_check check (
    status in ('scheduled', 'completed', 'cancelled')
  )
);

create index if not exists discipline_case_conferences_case_idx
  on public.discipline_case_conferences (case_id);

-- ── updated_at triggers (reuse touch function if exists) ────────────────────
create or replace function public.touch_discipline_office_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists discipline_student_records_updated_at on public.discipline_student_records;
create trigger discipline_student_records_updated_at
  before update on public.discipline_student_records
  for each row execute procedure public.touch_discipline_office_updated_at();

drop trigger if exists discipline_document_requests_updated_at on public.discipline_document_requests;
create trigger discipline_document_requests_updated_at
  before update on public.discipline_document_requests
  for each row execute procedure public.touch_discipline_office_updated_at();

drop trigger if exists discipline_referrals_updated_at on public.discipline_referrals;
create trigger discipline_referrals_updated_at
  before update on public.discipline_referrals
  for each row execute procedure public.touch_discipline_office_updated_at();

drop trigger if exists discipline_sanctions_updated_at on public.discipline_sanctions;
create trigger discipline_sanctions_updated_at
  before update on public.discipline_sanctions
  for each row execute procedure public.touch_discipline_office_updated_at();

drop trigger if exists discipline_case_conferences_updated_at on public.discipline_case_conferences;
create trigger discipline_case_conferences_updated_at
  before update on public.discipline_case_conferences
  for each row execute procedure public.touch_discipline_office_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.discipline_student_records enable row level security;
alter table public.discipline_document_requests enable row level security;
alter table public.discipline_referrals enable row level security;
alter table public.discipline_sanctions enable row level security;
alter table public.discipline_case_conferences enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'discipline_student_records',
    'discipline_document_requests',
    'discipline_referrals',
    'discipline_sanctions',
    'discipline_case_conferences'
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
