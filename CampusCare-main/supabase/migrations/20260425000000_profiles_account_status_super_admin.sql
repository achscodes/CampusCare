-- Staff approval workflow + Super Admin RLS on profiles.
-- New signups: account_status = pending until a Super Admin for that office approves.

alter table public.profiles
  add column if not exists account_status text;

update public.profiles
set account_status = 'approved'
where account_status is null;

alter table public.profiles
  alter column account_status set default 'pending';

alter table public.profiles
  alter column account_status set not null;

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('pending', 'approved', 'rejected'));

comment on column public.profiles.account_status is
  'pending: awaiting Super Admin approval; approved: can sign in; rejected: signup denied.';

create index if not exists profiles_office_account_status_idx
  on public.profiles (office, account_status);

-- New users: pending unless role Super Admin (manually created admins).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  st text;
begin
  r := coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'Staff');
  if r = 'Super Admin' then
    st := 'approved';
  else
    st := 'pending';
  end if;

  insert into public.profiles (id, first_name, middle_initial, last_name, office, role, account_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'middle_initial', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'office'), ''), 'health'),
    r,
    st
  );
  return new;
end;
$$;

-- Super Admins: list/update profiles in their office (for user management)
drop policy if exists "profiles_super_admin_select_office" on public.profiles;
create policy "profiles_super_admin_select_office"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles su
      where su.id = auth.uid()
        and su.role = 'Super Admin'
        and su.account_status = 'approved'
        and su.office = profiles.office
    )
  );

drop policy if exists "profiles_super_admin_update_office" on public.profiles;
create policy "profiles_super_admin_update_office"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles su
      where su.id = auth.uid()
        and su.role = 'Super Admin'
        and su.account_status = 'approved'
        and su.office = profiles.office
    )
  )
  with check (
    exists (
      select 1
      from public.profiles su
      where su.id = auth.uid()
        and su.role = 'Super Admin'
        and su.account_status = 'approved'
        and su.office = profiles.office
    )
  );

notify pgrst, 'reload schema';
