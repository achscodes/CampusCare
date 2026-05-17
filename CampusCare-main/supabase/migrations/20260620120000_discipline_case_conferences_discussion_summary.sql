-- Officers complete hearings with a written discussion summary; optional student delivery via notifications.

do $body$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'discipline_case_conferences'
  ) then
    alter table public.discipline_case_conferences
      add column if not exists discussion_summary text not null default '';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'students'
  ) then
    alter table public.students
      add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

    create index if not exists students_auth_user_id_idx
      on public.students (auth_user_id)
      where auth_user_id is not null;
  end if;
end $body$;

notify pgrst, 'reload schema';
