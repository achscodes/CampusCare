-- =============================================================================
-- Super Admin access without self-joining public.profiles in RLS (no recursion,
-- no row_security-off hacks). Also re-apply demo email identity fix (idempotent).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) Allowlist: one row per approved Super Admin — policies reference THIS table
--    instead of subquerying profiles (avoids infinite recursion + schema issues).
-- ---------------------------------------------------------------------------
create table if not exists public.super_admin_allowlist (
  user_id uuid primary key references auth.users (id) on delete cascade,
  office text not null,
  created_at timestamptz not null default now()
);

create index if not exists super_admin_allowlist_office_idx
  on public.super_admin_allowlist (office);

comment on table public.super_admin_allowlist is
  'Mirrors which auth users are approved Super Admins for an office; used only for RLS (no self-join on profiles).';

alter table public.super_admin_allowlist enable row level security;

drop policy if exists "super_admin_allowlist_select_own" on public.super_admin_allowlist;
create policy "super_admin_allowlist_select_own"
  on public.super_admin_allowlist for select
  to authenticated
  using (auth.uid() = user_id);

grant select on table public.super_admin_allowlist to authenticated;

-- Sync allowlist when profiles change (security definer — bypasses RLS on both tables)
create or replace function public.sync_super_admin_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.super_admin_allowlist where user_id = old.id;
    return old;
  end if;
  if new.role = 'Super Admin' and new.account_status = 'approved' then
    insert into public.super_admin_allowlist (user_id, office)
    values (new.id, new.office)
    on conflict (user_id) do update set office = excluded.office, created_at = now();
  else
    delete from public.super_admin_allowlist where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_super_admin_allowlist on public.profiles;
create trigger trg_profiles_sync_super_admin_allowlist
  after insert or delete or update of role, office, account_status
  on public.profiles
  for each row
  execute procedure public.sync_super_admin_allowlist();

-- Backfill from existing profiles
insert into public.super_admin_allowlist (user_id, office)
select id, office
from public.profiles
where role = 'Super Admin'
  and account_status = 'approved'
on conflict (user_id) do update set office = excluded.office;

-- Drop old Super Admin policies + helper (from 20260427000000)
drop policy if exists "profiles_super_admin_select_office" on public.profiles;
drop policy if exists "profiles_super_admin_update_office" on public.profiles;
drop function if exists public.is_approved_super_admin_for_office(text);

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
  );

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
  )
  with check (
    exists (
      select 1
      from public.super_admin_allowlist s
      where s.user_id = auth.uid()
        and s.office = profiles.office
    )
  );

-- ---------------------------------------------------------------------------
-- B) Email identities: provider_id must be auth.users.id (text), not email
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
