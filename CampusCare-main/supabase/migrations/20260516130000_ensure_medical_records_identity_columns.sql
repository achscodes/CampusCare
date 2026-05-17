-- Ensure medical_records has student_id / student_name (fixes PostgREST "student_name not in schema cache"
-- when the table was created from an older or partial schema).

alter table public.medical_records
  add column if not exists student_id text,
  add column if not exists student_name text;

-- Older DBs may have public.students without full_name / first_name / last_name; add before join update.
do $students_cols$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'students'
  ) then
    execute 'alter table public.students add column if not exists full_name text';
    execute 'alter table public.students add column if not exists first_name text';
    execute 'alter table public.students add column if not exists last_name text';
  end if;
end $students_cols$;

-- Prefer roster names when student_id matches public.students
do $roster_backfill$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'students'
  )
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public' and table_name = 'students' and column_name = 'student_id'
     ) then
    update public.medical_records mr
    set student_name = btrim(
      coalesce(
        nullif(btrim(s.full_name), ''),
        nullif(btrim(concat_ws(' ', s.first_name, s.last_name)), ''),
        mr.student_name
      )
    )
    from public.students s
    where mr.student_id = s.student_id
      and (mr.student_name is null or btrim(mr.student_name) = '');
  end if;
end $roster_backfill$;

-- Fallback display name from student_id
update public.medical_records
set student_name = coalesce(nullif(btrim(student_name), ''), 'Student ID ' || btrim(student_id))
where student_name is null or btrim(student_name) = '';

-- Synthetic id for any orphan rows (should be rare)
update public.medical_records
set student_id = coalesce(nullif(btrim(student_id), ''), 'RECORD-' || replace(id::text, '-', ''))
where student_id is null or btrim(student_id) = '';

update public.medical_records
set student_name = coalesce(nullif(btrim(student_name), ''), 'Health record ' || id::text)
where student_name is null or btrim(student_name) = '';

alter table public.medical_records
  alter column student_id set not null,
  alter column student_name set not null;

notify pgrst, 'reload schema';
