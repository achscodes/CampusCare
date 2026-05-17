-- Single link to complainant: `complainant_id` = `public.students.id` (UUID).
-- Drops legacy `complainant_student_id` after backfill; adds FK for integrity.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discipline_incident_reports'
      and column_name = 'complainant_student_id'
  ) then
    execute $backfill$
      update public.discipline_incident_reports ir
      set complainant_id = s.id
      from public.students s
      where ir.complainant_id is null
        and ir.complainant_student_id is not null
        and btrim(ir.complainant_student_id) <> ''
        and s.student_id = btrim(ir.complainant_student_id)
    $backfill$;
    drop index if exists public.discipline_incident_reports_complainant_student_id_idx;
    alter table public.discipline_incident_reports
      drop column complainant_student_id;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where c.conname = 'discipline_incident_reports_complainant_id_fkey'
      and t.relname = 'discipline_incident_reports'
      and t.relnamespace = (select oid from pg_namespace where nspname = 'public')
  ) then
    alter table public.discipline_incident_reports
      add constraint discipline_incident_reports_complainant_id_fkey
      foreign key (complainant_id) references public.students (id) on delete set null;
  end if;
end $$;

notify pgrst, 'reload schema';
