-- CampusCare staff job titles live in profiles.role; profiles.user_role is often still
-- 'student' for staff accounts. Storage RLS for discipline-incident-attachments uses
-- is_discipline_staff(), which previously only matched user_role in ('staff','admin').

create or replace function public.is_discipline_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.office = 'discipline'
      and p.account_status = 'approved'
      and (
        p.user_role in ('staff', 'admin')
        or p.designation = 'welfare_admin'
        or p.role in (
          'DO Coordinator',
          'DO Assistant',
          'Super Admin',
          'Admin'
        )
        or (
          nullif(trim(p.role), '') is not null
          and lower(p.role) not like '%student%'
          and coalesce(p.email, '') not ilike '%@students.%'
        )
      )
  );
$function$;

comment on function public.is_discipline_staff() is
  'True when the signed-in user is approved Discipline Office staff (used by incident attachment storage RLS).';

grant execute on function public.is_discipline_staff() to authenticated;

-- Align user_role with staff accounts so other policies stay consistent.
update public.profiles
set
  user_role = case
    when role in ('Super Admin', 'Admin') or designation = 'welfare_admin' then 'admin'
    else 'staff'
  end,
  updated_at = now()
where office in ('discipline', 'health', 'development')
  and account_status = 'approved'
  and coalesce(user_role, 'student') = 'student'
  and coalesce(email, '') not ilike '%@students.%'
  and nullif(trim(role), '') is not null
  and lower(role) not like '%student%';
