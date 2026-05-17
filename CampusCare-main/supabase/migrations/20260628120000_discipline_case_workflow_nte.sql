-- Case workflow: NTE email fields, closure audit, expanded status values.

alter table public.discipline_cases
  drop constraint if exists discipline_cases_status_check;

alter table public.discipline_cases
  add constraint discipline_cases_status_check check (
    status in ('new', 'pending', 'ongoing', 'escalated', 'closed')
  );

alter table public.discipline_cases add column if not exists respondent_email text;
alter table public.discipline_cases add column if not exists nte_sent_at timestamptz;
alter table public.discipline_cases add column if not exists closure_summary text;
alter table public.discipline_cases add column if not exists closed_at timestamptz;
alter table public.discipline_cases add column if not exists closed_by_user_id uuid;
alter table public.discipline_cases add column if not exists escalated_at timestamptz;

comment on column public.discipline_cases.respondent_email is
  'Recipient for Notice To Explain (NTE); may be auto-generated from student name.';
comment on column public.discipline_cases.nte_sent_at is
  'When NTE notice email was successfully sent; case status typically becomes pending.';
comment on column public.discipline_cases.closure_summary is
  'Required summary when staff closes the case via Close Case flow.';

notify pgrst, 'reload schema';
