-- =============================================================================
-- 1) Super Admin RLS: avoid infinite recursion on public.profiles
--    (EXISTS (SELECT ... FROM profiles ...) inside a policy on profiles loops).
-- 2) Demo Super Admin identities: provider_id for email must be auth.users.id
--    (UUID text), not the email — wrong value breaks signInWithPassword / GoTrue.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) SECURITY DEFINER helper — reads profiles without triggering RLS recursion
-- ---------------------------------------------------------------------------
create or replace function public.is_approved_super_admin_for_office(office_key text)
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
      and p.role = 'Super Admin'
      and p.account_status = 'approved'
      and p.office = office_key
  );
$$;

comment on function public.is_approved_super_admin_for_office(text) is
  'True when the current user is an approved Super Admin for the given office key (bypasses RLS recursion in policies).';

revoke all on function public.is_approved_super_admin_for_office(text) from public;
grant execute on function public.is_approved_super_admin_for_office(text) to authenticated;

drop policy if exists "profiles_super_admin_select_office" on public.profiles;
create policy "profiles_super_admin_select_office"
  on public.profiles for select
  to authenticated
  using (public.is_approved_super_admin_for_office(office));

drop policy if exists "profiles_super_admin_update_office" on public.profiles;
create policy "profiles_super_admin_update_office"
  on public.profiles for update
  to authenticated
  using (public.is_approved_super_admin_for_office(office))
  with check (public.is_approved_super_admin_for_office(office));

-- ---------------------------------------------------------------------------
-- B) Fix email identities created with provider_id = email (should be user UUID)
-- ---------------------------------------------------------------------------
update auth.identities i
set
  provider_id = u.id::text,
  identity_data = coalesce(i.identity_data, '{}'::jsonb) || jsonb_build_object(
    'sub', u.id::text,
    'email', u.email
  ),
  updated_at = now()
from auth.users u
where i.user_id = u.id
  and i.provider = 'email'
  and lower(u.email) in (
    'hsosupport.campuscare@gmail.com',
    'dosupport.campuscare@gmail.com',
    'sdaosupport.campuscare@gmail.com'
  )
  and i.provider_id is distinct from u.id::text;

notify pgrst, 'reload schema';
