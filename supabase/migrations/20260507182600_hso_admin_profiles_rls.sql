-- Allow approved HSO Admins to manage Health office profiles.
-- Required so nurse/physician/dentist pending signups are visible in HSO User Management.

create or replace function public.is_approved_hso_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.office = 'health'
      and p.account_status = 'approved'
      and (
        lower(coalesce(p.designation, '')) = 'admin'
        or lower(coalesce(p.role, '')) = 'admin'
      )
  );
$$;

revoke all on function public.is_approved_hso_admin() from public;
grant execute on function public.is_approved_hso_admin() to authenticated;

drop policy if exists profiles_hso_admin_select_health on public.profiles;
create policy profiles_hso_admin_select_health
  on public.profiles for select
  to authenticated
  using (
    public.is_approved_hso_admin()
    and profiles.office = 'health'
  );

drop policy if exists profiles_hso_admin_update_health on public.profiles;
create policy profiles_hso_admin_update_health
  on public.profiles for update
  to authenticated
  using (
    public.is_approved_hso_admin()
    and profiles.office = 'health'
  )
  with check (
    public.is_approved_hso_admin()
    and profiles.office = 'health'
  );

notify pgrst, 'reload schema';
