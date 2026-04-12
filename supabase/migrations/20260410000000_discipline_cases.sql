-- =============================================================================
-- Discipline Office — public.discipline_cases
-- If the app shows: "Could not find the table 'public.discipline_cases' in the schema cache"
-- paste this ENTIRE file into: Supabase → SQL → New query → Run.
-- Then hard-refresh the DO dashboard. If the error persists ~1 min, run the NOTIFY line at the bottom again.
-- Realtime (optional): Dashboard → Database → Publications → supabase_realtime → add discipline_cases.
-- =============================================================================

create table if not exists public.discipline_cases (
  id text primary key,
  student_name text not null,
  student_id text not null,
  case_type text not null,
  status text not null,
  priority text not null,
  reported_at timestamptz not null default now(),
  reporting_officer text not null default 'Discipline Office',
  description text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discipline_cases_status_check check (
    status in ('new', 'ongoing', 'pending', 'closed')
  ),
  constraint discipline_cases_priority_check check (
    priority in ('low', 'medium', 'high')
  )
);

comment on table public.discipline_cases is 'Disciplinary case records for CampusCare DO dashboards.';

create index if not exists discipline_cases_reported_at_idx
  on public.discipline_cases (reported_at desc);

create index if not exists discipline_cases_status_idx
  on public.discipline_cases (status);

create or replace function public.touch_discipline_cases_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists discipline_cases_updated_at on public.discipline_cases;
create trigger discipline_cases_updated_at
  before update on public.discipline_cases
  for each row
  execute procedure public.touch_discipline_cases_updated_at();

alter table public.discipline_cases enable row level security;

drop policy if exists "discipline_cases_select_auth" on public.discipline_cases;
create policy "discipline_cases_select_auth"
  on public.discipline_cases for select
  to authenticated
  using (true);

drop policy if exists "discipline_cases_insert_auth" on public.discipline_cases;
create policy "discipline_cases_insert_auth"
  on public.discipline_cases for insert
  to authenticated
  with check (true);

drop policy if exists "discipline_cases_update_auth" on public.discipline_cases;
create policy "discipline_cases_update_auth"
  on public.discipline_cases for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "discipline_cases_delete_auth" on public.discipline_cases;
create policy "discipline_cases_delete_auth"
  on public.discipline_cases for delete
  to authenticated
  using (true);

grant select, insert, update, delete on table public.discipline_cases to authenticated;

-- No demo seed — cases are created from the DO dashboard only.

-- Refresh API schema cache (ignore error if not permitted on your plan)
notify pgrst, 'reload schema';
