-- =============================================================================
-- CampusCare — public.profiles (staff rows linked to auth.users)
-- Paste the whole file into: Supabase Dashboard → SQL → New query → Run
-- Safe to run more than once (idempotent).
-- =============================================================================
-- Signup sends first_name, middle_initial, last_name, office, role in user_metadata;
-- handle_new_user() copies them into profiles on auth.users insert.
-- SigninPage reads: first_name, middle_initial, last_name, office, role.
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  middle_initial text not null default '',
  last_name text not null default '',
  office text not null default 'health',
  role text not null default 'Staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'CampusCare staff profile; one row per auth user.';

create index if not exists profiles_office_idx on public.profiles (office);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, update on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Auto-create profile when a new auth user is registered
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, middle_initial, last_name, office, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'middle_initial', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'office'), ''), 'health'),
    coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'Staff')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Backfill profiles for users created before this migration / trigger
-- ---------------------------------------------------------------------------
insert into public.profiles (id, first_name, middle_initial, last_name, office, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'first_name', ''),
  coalesce(u.raw_user_meta_data->>'middle_initial', ''),
  coalesce(u.raw_user_meta_data->>'last_name', ''),
  coalesce(nullif(trim(u.raw_user_meta_data->>'office'), ''), 'health'),
  coalesce(nullif(trim(u.raw_user_meta_data->>'role'), ''), 'Staff')
from auth.users u
on conflict (id) do nothing;
