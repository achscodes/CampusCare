-- Snapshot who filed each incident report (name + optional link to students.complainant_id).
-- RLS on public.profiles blocks staff from reading other users' rows client-side; this trigger
-- runs as SECURITY DEFINER at insert time so the DO dashboard can show the filer without extra joins.

alter table public.discipline_incident_reports
  add column if not exists filed_by_user_id uuid;

alter table public.discipline_incident_reports
  add column if not exists filer_display_name text;

comment on column public.discipline_incident_reports.filed_by_user_id is
  'auth.users id of the account that inserted this row (set by trigger if omitted).';

comment on column public.discipline_incident_reports.filer_display_name is
  'Display name copied from public.profiles at insert time (first + last name of who filed).';

-- Optional roster match for complainant_id when auth email matches students.email
alter table public.students
  add column if not exists email text;

-- If complainant_id already points at a student but UI had no snapshot, copy roster name once.
update public.discipline_incident_reports ir
set filer_display_name = coalesce(
  nullif(trim(s.full_name), ''),
  trim(both from concat_ws(' ', nullif(trim(s.first_name), ''), nullif(trim(s.last_name), '')))
)
from public.students s
where ir.complainant_id = s.id
  and (ir.filer_display_name is null or trim(ir.filer_display_name) = '');

create index if not exists discipline_incident_reports_filed_by_user_id_idx
  on public.discipline_incident_reports (filed_by_user_id)
  where filed_by_user_id is not null;

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
  has_student_email boolean;
begin
  uid := coalesce(NEW.filed_by_user_id, auth.uid());
  NEW.filed_by_user_id := uid;

  if uid is not null then
    select trim(both from concat_ws(' ',
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
  end if;

  return NEW;
end;
$$;

drop trigger if exists discipline_incident_reports_set_filer_snapshot on public.discipline_incident_reports;
create trigger discipline_incident_reports_set_filer_snapshot
  before insert on public.discipline_incident_reports
  for each row
  execute function public.discipline_incident_reports_set_filer_snapshot();

notify pgrst, 'reload schema';
