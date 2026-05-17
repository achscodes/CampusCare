-- Student directory for HSO check-in display; ensure health_appointments.checked_in_at exists for PostgREST.

alter table public.health_appointments
  add column if not exists checked_in_at timestamptz;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  full_name text,
  first_name text,
  last_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_student_id_key unique (student_id)
);

create index if not exists students_student_id_idx on public.students (student_id);

comment on table public.students is 'Student roster; health_appointments.student_id matches students.student_id for display names.';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'updated_at'
  ) then
    drop trigger if exists students_updated_at on public.students;
    create trigger students_updated_at
      before update on public.students
      for each row execute procedure public.touch_discipline_office_updated_at();
  end if;
end $$;

alter table public.students enable row level security;

drop policy if exists students_auth_select on public.students;
create policy students_auth_select
  on public.students for select
  to authenticated
  using (true);

drop policy if exists students_auth_insert on public.students;
create policy students_auth_insert
  on public.students for insert
  to authenticated
  with check (true);

drop policy if exists students_auth_update on public.students;
create policy students_auth_update
  on public.students for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists students_auth_delete on public.students;
create policy students_auth_delete
  on public.students for delete
  to authenticated
  using (true);

grant select, insert, update, delete on table public.students to authenticated;

notify pgrst, 'reload schema';
