-- DO + SDAO welfare admins share one portal; allow them to select/update profiles for both offices
-- (pending approvals list uses .in('office', ['discipline','development'])).

drop policy if exists "profiles_super_admin_select_office" on public.profiles;
create policy "profiles_super_admin_select_office"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.super_admin_allowlist s
      where s.user_id = auth.uid()
        and s.office = profiles.office
    )
    or (
      profiles.office in ('discipline', 'development')
      and exists (
        select 1
        from public.super_admin_allowlist s
        where s.user_id = auth.uid()
          and s.office in ('discipline', 'development')
      )
    )
  );

drop policy if exists "profiles_super_admin_update_office" on public.profiles;
create policy "profiles_super_admin_update_office"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1
      from public.super_admin_allowlist s
      where s.user_id = auth.uid()
        and s.office = profiles.office
    )
    or (
      profiles.office in ('discipline', 'development')
      and exists (
        select 1
        from public.super_admin_allowlist s
        where s.user_id = auth.uid()
          and s.office in ('discipline', 'development')
      )
    )
  )
  with check (
    exists (
      select 1
      from public.super_admin_allowlist s
      where s.user_id = auth.uid()
        and s.office = profiles.office
    )
    or (
      profiles.office in ('discipline', 'development')
      and exists (
        select 1
        from public.super_admin_allowlist s
        where s.user_id = auth.uid()
          and s.office in ('discipline', 'development')
      )
    )
  );

notify pgrst, 'reload schema';
