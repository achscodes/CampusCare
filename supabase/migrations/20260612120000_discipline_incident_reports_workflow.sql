-- Discipline Office workflow: incident triage → linked discipline_cases (per DO review pipeline).

-- ── Incident reports ────────────────────────────────────────────────────────
create table if not exists public.discipline_incident_reports (
  id text primary key,
  status text not null default 'submitted',
  subject text,
  incident_type text,
  statement_of_incident text,
  description text,
  location text,
  incident_at timestamptz,
  reviewed_at timestamptz,
  involved_parties jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  staff_notes text not null default '',
  converted_case_id text,
  complainant_notified_at timestamptz,
  complainant_id uuid references public.students (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discipline_incident_reports_status_check check (
    status in ('submitted', 'under_review', 'escalated', 'rejected', 'converted_to_case')
  )
);

comment on table public.discipline_incident_reports is
  'Incident filings: submitted → rejected (reason + complainant notification timestamp) or converted_to_case (creates discipline_cases + link).';

alter table public.discipline_incident_reports
  add column if not exists incident_type text;

alter table public.discipline_incident_reports
  add column if not exists statement_of_incident text;

alter table public.discipline_incident_reports
  add column if not exists complainant_notified_at timestamptz;

alter table public.discipline_incident_reports
  add column if not exists complainant_id uuid;

comment on column public.discipline_incident_reports.complainant_id is
  'Foreign key to public.students.id; display from students.first_name, last_name, or full_name.';

create index if not exists discipline_incident_reports_complainant_id_idx
  on public.discipline_incident_reports (complainant_id)
  where complainant_id is not null;

create index if not exists discipline_incident_reports_status_idx
  on public.discipline_incident_reports (status);

create index if not exists discipline_incident_reports_created_idx
  on public.discipline_incident_reports (created_at desc);

create or replace function public.touch_discipline_incident_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists discipline_incident_reports_updated_at on public.discipline_incident_reports;
create trigger discipline_incident_reports_updated_at
  before update on public.discipline_incident_reports
  for each row execute procedure public.touch_discipline_incident_reports_updated_at();

alter table public.discipline_incident_reports enable row level security;

drop policy if exists "discipline_incident_reports_select_auth" on public.discipline_incident_reports;
create policy "discipline_incident_reports_select_auth"
  on public.discipline_incident_reports for select
  to authenticated
  using (true);

drop policy if exists "discipline_incident_reports_insert_auth" on public.discipline_incident_reports;
create policy "discipline_incident_reports_insert_auth"
  on public.discipline_incident_reports for insert
  to authenticated
  with check (true);

drop policy if exists "discipline_incident_reports_update_auth" on public.discipline_incident_reports;
create policy "discipline_incident_reports_update_auth"
  on public.discipline_incident_reports for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "discipline_incident_reports_delete_auth" on public.discipline_incident_reports;
create policy "discipline_incident_reports_delete_auth"
  on public.discipline_incident_reports for delete
  to authenticated
  using (true);

grant select, insert, update, delete on table public.discipline_incident_reports to authenticated;

-- ── Cases: link to originating incident ─────────────────────────────────────
alter table public.discipline_cases
  add column if not exists source_incident_report_id text;

create index if not exists discipline_cases_source_incident_report_id_idx
  on public.discipline_cases (source_incident_report_id)
  where source_incident_report_id is not null;

notify pgrst, 'reload schema';
