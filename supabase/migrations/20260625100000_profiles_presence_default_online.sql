-- Presence defaults to online for new rows; directory treats blank as online.

alter table public.profiles
  alter column presence_status set default 'online';

create or replace function public.get_staff_presence_directory(p_office text default null)
returns table (
  id uuid,
  first_name text,
  middle_initial text,
  last_name text,
  office text,
  role text,
  presence_status text,
  last_active_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.first_name,
    p.middle_initial,
    p.last_name,
    p.office,
    p.role,
    coalesce(nullif(trim(p.presence_status), ''), 'online')::text as presence_status,
    p.last_active_at
  from public.profiles p
  where coalesce(p.account_status, 'approved') = 'approved'
    and lower(trim(coalesce(p.role, ''))) not in ('admin', 'super admin')
    and lower(trim(coalesce(p.office, ''))) in ('health', 'discipline', 'development')
    and (
      p_office is null
      or trim(p_office) = ''
      or lower(trim(p.office)) = lower(trim(p_office))
    );
$$;

revoke all on function public.get_staff_presence_directory(text) from public;
grant execute on function public.get_staff_presence_directory(text) to anon, authenticated;
