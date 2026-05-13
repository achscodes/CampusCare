-- Repair partial / legacy `public.discipline_cases` so DO inserts match PostgREST (student_name, etc.).
-- Safe to re-run: only adds columns that are missing. Skips entirely if the table does not exist.

do $body$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'discipline_cases'
  ) then
    return;
  end if;

  alter table public.discipline_cases add column if not exists student_name text;
  alter table public.discipline_cases add column if not exists student_id text;
  alter table public.discipline_cases add column if not exists case_type text;
  alter table public.discipline_cases add column if not exists status text;
  alter table public.discipline_cases add column if not exists reporting_officer text;
  alter table public.discipline_cases add column if not exists description text;
  alter table public.discipline_cases add column if not exists evidence jsonb;
  alter table public.discipline_cases add column if not exists reported_at timestamptz;
  alter table public.discipline_cases add column if not exists created_at timestamptz not null default now();
  alter table public.discipline_cases add column if not exists updated_at timestamptz not null default now();
  alter table public.discipline_cases add column if not exists program text;
  alter table public.discipline_cases add column if not exists school text;
  alter table public.discipline_cases add column if not exists offense_type text;
  alter table public.discipline_cases add column if not exists source_incident_report_id text;

  update public.discipline_cases
  set student_name = coalesce(nullif(trim(student_name), ''), 'Unknown')
  where student_name is null;

  update public.discipline_cases
  set student_id = coalesce(nullif(trim(student_id), ''), 'UNKNOWN')
  where student_id is null;

  update public.discipline_cases
  set case_type = coalesce(nullif(trim(case_type), ''), 'Code of Conduct Violation')
  where case_type is null;

  update public.discipline_cases
  set status = coalesce(nullif(trim(status), ''), 'new')
  where status is null;

  update public.discipline_cases
  set reporting_officer = coalesce(nullif(trim(reporting_officer), ''), 'Discipline Office')
  where reporting_officer is null;

  update public.discipline_cases
  set description = coalesce(description, '')
  where description is null;

  update public.discipline_cases
  set evidence = coalesce(evidence, '[]'::jsonb)
  where evidence is null;

  update public.discipline_cases
  set reported_at = coalesce(reported_at, created_at, now())
  where reported_at is null;

  update public.discipline_cases
  set program = coalesce(program, '')
  where program is null;

  update public.discipline_cases
  set school = coalesce(school, '')
  where school is null;

  update public.discipline_cases
  set offense_type = coalesce(offense_type, '')
  where offense_type is null;
end $body$;

notify pgrst, 'reload schema';
