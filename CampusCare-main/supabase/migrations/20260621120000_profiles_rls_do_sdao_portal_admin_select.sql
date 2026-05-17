-- DO/SDAO welfare User Management loads profiles with .in('office', ['discipline','development']).
-- RLS previously relied on super_admin_allowlist, which is only populated when account_status = 'approved'
-- (see sync_super_admin_allowlist). Pending welfare Admins could create staff via Edge Function (service role)
-- but could not SELECT those rows in the app — the list stayed empty.
--
-- Add a separate SELECT policy so any non-rejected DO/SDAO welfare portal Admin can read profiles in both offices.

create or replace function public.is_do_sdao_welfare_portal_admin()
returns boolean
language sql
security definer
set search_path = public
set row_security = off
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.office in ('discipline', 'development')
      and coalesce(lower(trim(p.account_status)), '') <> 'rejected'
      and (p.role = 'Super Admin' or p.role = 'Admin')
  );
$$;

comment on function public.is_do_sdao_welfare_portal_admin() is
  'True when the current user is a DO or SDAO welfare portal Admin (or legacy Super Admin), not rejected. Used for profiles SELECT so User Management can list staff before account_status is approved.';

revoke all on function public.is_do_sdao_welfare_portal_admin() from public;
grant execute on function public.is_do_sdao_welfare_portal_admin() to authenticated;

drop policy if exists "profiles_do_sdao_welfare_portal_select" on public.profiles;
create policy "profiles_do_sdao_welfare_portal_select"
  on public.profiles for select
  to authenticated
  using (
    profiles.office in ('discipline', 'development')
    and public.is_do_sdao_welfare_portal_admin()
  );

-- Pending portal admins can update/delete only non–welfare-admin staff rows (same offices).
drop policy if exists "profiles_do_sdao_welfare_portal_update_staff" on public.profiles;
create policy "profiles_do_sdao_welfare_portal_update_staff"
  on public.profiles for update
  to authenticated
  using (
    profiles.office in ('discipline', 'development')
    and public.is_do_sdao_welfare_portal_admin()
    and coalesce(profiles.role, '') not in ('Admin', 'Super Admin')
  )
  with check (
    profiles.office in ('discipline', 'development')
    and public.is_do_sdao_welfare_portal_admin()
    and coalesce(profiles.role, '') not in ('Admin', 'Super Admin')
  );

drop policy if exists "profiles_do_sdao_welfare_portal_delete_staff" on public.profiles;
create policy "profiles_do_sdao_welfare_portal_delete_staff"
  on public.profiles for delete
  to authenticated
  using (
    profiles.office in ('discipline', 'development')
    and public.is_do_sdao_welfare_portal_admin()
    and coalesce(profiles.role, '') not in ('Admin', 'Super Admin')
  );

notify pgrst, 'reload schema';
