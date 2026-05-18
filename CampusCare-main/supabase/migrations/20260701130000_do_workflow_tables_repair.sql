-- Discipline Office workflow tables: idempotent repair for mobile/web handoff.
-- Safe to re-run: creates missing workflow tables/columns, constraints, policies, and indexes.

create table if not exists public.discipline_nte (
  id text primary key default public.next_discipline_id('NTE'),
  student_id text not null,
  case_type text not null,
  description text not null default '',
  issued_at timestamptz not null default now(),
  deadline_at timestamptz,
  status text not null default 'pending_response',
  response_text text,
  responded_at timestamptz,
  case_id text references public.discipline_cases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  response_attachments jsonb not null default '[]'::jsonb,
  escalated_at timestamptz,
  escalation_reason text not null default ''
);

alter table public.discipline_nte add column if not exists student_id text not null default '';
alter table public.discipline_nte add column if not exists case_type text not null default '';
alter table public.discipline_nte add column if not exists description text not null default '';
alter table public.discipline_nte add column if not exists issued_at timestamptz not null default now();
alter table public.discipline_nte add column if not exists deadline_at timestamptz;
alter table public.discipline_nte add column if not exists status text not null default 'pending_response';
alter table public.discipline_nte add column if not exists response_text text;
alter table public.discipline_nte add column if not exists responded_at timestamptz;
alter table public.discipline_nte add column if not exists case_id text;
alter table public.discipline_nte add column if not exists created_at timestamptz not null default now();
alter table public.discipline_nte add column if not exists updated_at timestamptz not null default now();
alter table public.discipline_nte add column if not exists response_attachments jsonb not null default '[]'::jsonb;
alter table public.discipline_nte add column if not exists escalated_at timestamptz;
alter table public.discipline_nte add column if not exists escalation_reason text not null default '';

alter table public.discipline_nte
  drop constraint if exists discipline_nte_status_check;

alter table public.discipline_nte
  add constraint discipline_nte_status_check
  check (status in ('pending_response', 'responded', 'waived', 'escalated'));

alter table public.discipline_sanctions add column if not exists case_id text;
alter table public.discipline_sanctions add column if not exists description text not null default '';
alter table public.discipline_sanctions add column if not exists progress jsonb;
alter table public.discipline_sanctions add column if not exists review_days_min int;
alter table public.discipline_sanctions add column if not exists review_days_max int;
alter table public.discipline_sanctions add column if not exists review_status_label text;
alter table public.discipline_sanctions add column if not exists completed_hours numeric not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'discipline_sanctions_case_id_fkey'
      and conrelid = 'public.discipline_sanctions'::regclass
  ) then
    alter table public.discipline_sanctions
      add constraint discipline_sanctions_case_id_fkey
      foreign key (case_id) references public.discipline_cases(id) on delete set null;
  end if;
end $$;

create table if not exists public.discipline_proof_submissions (
  id uuid primary key default gen_random_uuid(),
  sanction_id text not null references public.discipline_sanctions(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  time_in timestamptz,
  time_out timestamptz,
  computed_hours numeric,
  notes text not null default '',
  status text not null default 'pending_review',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text not null default '',
  submitted_at timestamptz not null default now()
);

alter table public.discipline_proof_submissions add column if not exists sanction_id text not null default '';
alter table public.discipline_proof_submissions add column if not exists submitted_by uuid;
alter table public.discipline_proof_submissions add column if not exists time_in timestamptz;
alter table public.discipline_proof_submissions add column if not exists time_out timestamptz;
alter table public.discipline_proof_submissions add column if not exists computed_hours numeric;
alter table public.discipline_proof_submissions add column if not exists notes text not null default '';
alter table public.discipline_proof_submissions add column if not exists status text not null default 'pending_review';
alter table public.discipline_proof_submissions add column if not exists reviewed_by uuid;
alter table public.discipline_proof_submissions add column if not exists reviewed_at timestamptz;
alter table public.discipline_proof_submissions add column if not exists rejection_reason text not null default '';
alter table public.discipline_proof_submissions add column if not exists submitted_at timestamptz not null default now();

alter table public.discipline_proof_submissions
  drop constraint if exists discipline_proof_submissions_status_check;

alter table public.discipline_proof_submissions
  add constraint discipline_proof_submissions_status_check
  check (status in ('pending_review', 'approved', 'rejected'));

create table if not exists public.discipline_proof_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.discipline_proof_submissions(id) on delete cascade,
  storage_bucket text not null default 'discipline-proofs',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

alter table public.discipline_proof_files add column if not exists submission_id uuid;
alter table public.discipline_proof_files add column if not exists storage_bucket text not null default 'discipline-proofs';
alter table public.discipline_proof_files add column if not exists storage_path text not null default '';
alter table public.discipline_proof_files add column if not exists file_name text not null default 'Attachment';
alter table public.discipline_proof_files add column if not exists mime_type text;
alter table public.discipline_proof_files add column if not exists size_bytes bigint;
alter table public.discipline_proof_files add column if not exists created_at timestamptz not null default now();

alter table public.discipline_cases add column if not exists respondent_user_id uuid references auth.users(id) on delete set null;
alter table public.discipline_cases add column if not exists respondent_email text;
alter table public.discipline_cases add column if not exists case_steps jsonb not null default '[]'::jsonb;
alter table public.discipline_cases add column if not exists progress_percent int not null default 0;
alter table public.discipline_cases add column if not exists current_step_index int not null default 0;

alter table public.discipline_cases
  drop constraint if exists discipline_cases_progress_percent_check;

alter table public.discipline_cases
  add constraint discipline_cases_progress_percent_check
  check (progress_percent >= 0 and progress_percent <= 100);

create index if not exists discipline_cases_student_id_idx on public.discipline_cases (student_id);
create index if not exists discipline_cases_respondent_user_id_idx on public.discipline_cases (respondent_user_id);
create index if not exists discipline_nte_case_id_idx on public.discipline_nte (case_id);
create index if not exists discipline_nte_student_id_idx on public.discipline_nte (student_id);
create index if not exists discipline_nte_status_idx on public.discipline_nte (status);
create index if not exists discipline_nte_issued_idx on public.discipline_nte (issued_at desc);
create index if not exists discipline_sanctions_case_id_idx on public.discipline_sanctions (case_id);
create index if not exists discipline_sanctions_student_id_idx on public.discipline_sanctions (student_id);
create index if not exists discipline_sanctions_status_idx on public.discipline_sanctions (status);
create index if not exists discipline_proof_submissions_sanction_id_idx on public.discipline_proof_submissions (sanction_id);
create index if not exists discipline_proof_submissions_status_idx on public.discipline_proof_submissions (status);
create index if not exists discipline_proof_submissions_submitted_at_idx on public.discipline_proof_submissions (submitted_at desc);
create index if not exists discipline_proof_files_submission_id_idx on public.discipline_proof_files (submission_id);
create index if not exists discipline_case_conferences_status_idx on public.discipline_case_conferences (status);

alter table public.discipline_nte enable row level security;
alter table public.discipline_proof_submissions enable row level security;
alter table public.discipline_proof_files enable row level security;

drop policy if exists "Staff can view all NTEs" on public.discipline_nte;
create policy "Staff can view all NTEs"
  on public.discipline_nte for select
  to authenticated
  using (true);

drop policy if exists "Staff can insert NTEs" on public.discipline_nte;
create policy "Staff can insert NTEs"
  on public.discipline_nte for insert
  to authenticated
  with check (true);

drop policy if exists "Staff can update NTEs" on public.discipline_nte;
create policy "Staff can update NTEs"
  on public.discipline_nte for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "students read own nte" on public.discipline_nte;
create policy "students read own nte"
  on public.discipline_nte for select
  using (
    exists (
      select 1
      from public.discipline_cases c
      where c.id = discipline_nte.case_id
        and c.respondent_user_id = auth.uid()
    )
  );

drop policy if exists "students submit nte response" on public.discipline_nte;
create policy "students submit nte response"
  on public.discipline_nte for update
  using (
    exists (
      select 1
      from public.discipline_cases c
      where c.id = discipline_nte.case_id
        and c.respondent_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.discipline_cases c
      where c.id = discipline_nte.case_id
        and c.respondent_user_id = auth.uid()
    )
  );

drop policy if exists "staff read all proofs" on public.discipline_proof_submissions;
create policy "staff read all proofs"
  on public.discipline_proof_submissions for select
  using (public.is_discipline_staff());

drop policy if exists "staff update proofs" on public.discipline_proof_submissions;
create policy "staff update proofs"
  on public.discipline_proof_submissions for update
  using (public.is_discipline_staff())
  with check (public.is_discipline_staff());

drop policy if exists "students insert own proofs" on public.discipline_proof_submissions;
create policy "students insert own proofs"
  on public.discipline_proof_submissions for insert
  with check (submitted_by = auth.uid());

drop policy if exists "students read own proofs" on public.discipline_proof_submissions;
create policy "students read own proofs"
  on public.discipline_proof_submissions for select
  using (submitted_by = auth.uid());

drop policy if exists "submission-scoped read files" on public.discipline_proof_files;
create policy "submission-scoped read files"
  on public.discipline_proof_files for select
  using (
    exists (
      select 1
      from public.discipline_proof_submissions s
      where s.id = discipline_proof_files.submission_id
        and (s.submitted_by = auth.uid() or public.is_discipline_staff())
    )
  );

drop policy if exists "students insert files on own submission" on public.discipline_proof_files;
create policy "students insert files on own submission"
  on public.discipline_proof_files for insert
  with check (
    exists (
      select 1
      from public.discipline_proof_submissions s
      where s.id = discipline_proof_files.submission_id
        and s.submitted_by = auth.uid()
    )
  );

grant select, insert, update on table public.discipline_nte to authenticated;
grant select, insert, update on table public.discipline_proof_submissions to authenticated;
grant select, insert on table public.discipline_proof_files to authenticated;

notify pgrst, 'reload schema';
