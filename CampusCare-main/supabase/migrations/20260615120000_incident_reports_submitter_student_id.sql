-- Mobile / student apps often omit complainant_id. Resolve from:
--   (a) auth.users.raw_user_meta_data student_id / studentId (logged-in student insert), or
--   (b) discipline_incident_reports.submitter_student_id (e.g. service-role insert with explicit NU id).

alter table public.discipline_incident_reports
  add column if not exists submitter_student_id text;

comment on column public.discipline_incident_reports.submitter_student_id is
  'School student_id (matches public.students.student_id) for who filed; mobile may send when complainant_id is unknown.';

create index if not exists discipline_incident_reports_submitter_student_id_idx
  on public.discipline_incident_reports (submitter_student_id)
  where submitter_student_id is not null;

create or replace function public.discipline_incident_reports_set_filer_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  pname text;
  sid uuid;
  uemail text;
  meta_sid text;
  has_student_email boolean;
  roster_nm text;
begin
  uid := coalesce(NEW.filed_by_user_id, auth.uid());
  NEW.filed_by_user_id := uid;

  if uid is not null then
    select trim(both from concat_ws(
      ' ',
      nullif(trim(p.first_name), ''),
      nullif(trim(p.last_name), '')
    ))
    into pname
    from public.profiles p
    where p.id = uid;

    if pname is not null and length(trim(pname)) > 0 then
      if NEW.filer_display_name is null or trim(NEW.filer_display_name) = '' then
        NEW.filer_display_name := pname;
      end if;
    end if;

    select lower(trim(coalesce(u.email, ''))) into uemail
    from auth.users u
    where u.id = uid;

    select exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'students'
        and c.column_name = 'email'
    ) into has_student_email;

    if has_student_email and uemail is not null and length(uemail) > 0 and NEW.complainant_id is null then
      select s.id into sid
      from public.students s
      where lower(trim(coalesce(s.email, ''))) = uemail
      limit 1;
      if sid is not null then
        NEW.complainant_id := sid;
      end if;
    end if;

    -- Student mobile: student_id often lives in auth metadata, not necessarily same as students.email
    if NEW.complainant_id is null then
      select trim(both from coalesce(
        nullif(trim(u.raw_user_meta_data->>'student_id'), ''),
        nullif(trim(u.raw_user_meta_data->>'studentId'), ''),
        nullif(trim(u.raw_user_meta_data->>'school_student_id'), ''),
        nullif(trim(u.raw_user_meta_data->>'schoolStudentId'), '')
      ))
      into meta_sid
      from auth.users u
      where u.id = uid;

      if meta_sid is not null and length(meta_sid) > 0 then
        if NEW.submitter_student_id is null or trim(NEW.submitter_student_id) = '' then
          NEW.submitter_student_id := meta_sid;
        end if;
        select s.id into sid from public.students s where s.student_id = meta_sid limit 1;
        if sid is not null then
          NEW.complainant_id := sid;
        end if;
      end if;
    end if;
  end if;

  -- Explicit school id on row (common when insert bypasses auth.uid)
  if NEW.complainant_id is null
    and NEW.submitter_student_id is not null
    and trim(NEW.submitter_student_id) <> '' then
    select s.id into sid
    from public.students s
    where s.student_id = trim(NEW.submitter_student_id)
    limit 1;
    if sid is not null then
      NEW.complainant_id := sid;
    end if;
  end if;

  -- Prefer roster display (matches students table) when complainant resolved but snapshot still empty
  if NEW.complainant_id is not null
    and (NEW.filer_display_name is null or trim(NEW.filer_display_name) = '') then
    select coalesce(
      nullif(trim(s.full_name), ''),
      trim(both from concat_ws(
        ' ',
        nullif(trim(s.first_name), ''),
        nullif(trim(s.last_name), '')
      ))
    )
    into roster_nm
    from public.students s
    where s.id = NEW.complainant_id
    limit 1;
    if roster_nm is not null and length(trim(roster_nm)) > 0 then
      NEW.filer_display_name := roster_nm;
    end if;
  end if;

  return NEW;
end;
$$;

-- Backfill existing rows where we know the auth user and their metadata maps to students.student_id
update public.discipline_incident_reports ir
set
  submitter_student_id = coalesce(
    nullif(trim(ir.submitter_student_id), ''),
    trim(both from coalesce(
      nullif(trim(u.raw_user_meta_data->>'student_id'), ''),
      nullif(trim(u.raw_user_meta_data->>'studentId'), ''),
      nullif(trim(u.raw_user_meta_data->>'school_student_id'), ''),
      nullif(trim(u.raw_user_meta_data->>'schoolStudentId'), '')
    ))
  ),
  complainant_id = coalesce(ir.complainant_id, s.id),
  filer_display_name = case
    when ir.filer_display_name is not null and trim(ir.filer_display_name) <> '' then ir.filer_display_name
    else coalesce(
      nullif(trim(s.full_name), ''),
      trim(both from concat_ws(
        ' ',
        nullif(trim(s.first_name), ''),
        nullif(trim(s.last_name), '')
      ))
    )
  end
from auth.users u
join public.students s
  on s.student_id = trim(both from coalesce(
    nullif(trim(u.raw_user_meta_data->>'student_id'), ''),
    nullif(trim(u.raw_user_meta_data->>'studentId'), ''),
    nullif(trim(u.raw_user_meta_data->>'school_student_id'), ''),
    nullif(trim(u.raw_user_meta_data->>'schoolStudentId'), '')
  ))
where ir.filed_by_user_id = u.id
  and trim(both from coalesce(
    nullif(trim(u.raw_user_meta_data->>'student_id'), ''),
    nullif(trim(u.raw_user_meta_data->>'studentId'), ''),
    nullif(trim(u.raw_user_meta_data->>'school_student_id'), ''),
    nullif(trim(u.raw_user_meta_data->>'schoolStudentId'), '')
  )) <> ''
  and (
    ir.complainant_id is null
    or ir.filer_display_name is null
    or trim(ir.filer_display_name) = ''
    or ir.submitter_student_id is null
    or trim(ir.submitter_student_id) = ''
  );

notify pgrst, 'reload schema';
