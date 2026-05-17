-- Rename welfare portal role Super Admin → Admin; keep HSO facility desk admins distinct (designation = admin).

-- 1) Allow welfare_admin on HSO welfare-admin accounts (not facility desk admin).
alter table public.profiles
  drop constraint if exists profiles_designation_check;

alter table public.profiles
  add constraint profiles_designation_check
  check (
    designation is null
    or designation in ('nurse', 'physician', 'dentist', 'admin', 'queue_display', 'welfare_admin')
  );

comment on column public.profiles.designation is
  'HSO: nurse, physician, dentist, admin (facility), queue_display, welfare_admin (institution admin for HSO portal).';

-- 2) Former HSO Super Admins → role Admin + designation welfare_admin (facility admins stay designation admin).
update public.profiles
set designation = 'welfare_admin'
where role = 'Super Admin'
  and office = 'health'
  and coalesce(lower(trim(designation)), '') is distinct from 'admin';

update public.profiles
set role = 'Admin'
where role = 'Super Admin';

-- 3) RLS helper: approved welfare admin for an office (excludes HSO facility desk admin: health + admin designation).
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
      and p.account_status = 'approved'
      and p.office = office_key
      and (
        p.role = 'Super Admin'
        or (
          p.role = 'Admin'
          and not (
            p.office = 'health'
            and lower(trim(coalesce(p.designation, ''))) = 'admin'
          )
        )
      )
  );
$$;

comment on function public.is_approved_super_admin_for_office(text) is
  'True when the current user is an approved welfare (institution) Admin for the office; HSO facility desk admins (designation admin) are excluded.';

-- 4) Allowlist sync for welfare admins only
create or replace function public.sync_super_admin_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_welfare boolean;
begin
  if tg_op = 'DELETE' then
    delete from public.super_admin_allowlist where user_id = old.id;
    return old;
  end if;

  is_welfare := new.account_status = 'approved'
    and (
      new.role = 'Super Admin'
      or (
        new.role = 'Admin'
        and not (
          new.office = 'health'
          and lower(trim(coalesce(new.designation, ''))) = 'admin'
        )
      )
    );

  if is_welfare then
    insert into public.super_admin_allowlist (user_id, office)
    values (new.id, new.office)
    on conflict (user_id) do update set office = excluded.office, created_at = now();
  else
    delete from public.super_admin_allowlist where user_id = new.id;
  end if;
  return new;
end;
$$;

-- 5) Rebuild allowlist from profiles
delete from public.super_admin_allowlist;

insert into public.super_admin_allowlist (user_id, office)
select id, office
from public.profiles
where account_status = 'approved'
  and (
    role = 'Super Admin'
    or (
      role = 'Admin'
      and not (
        office = 'health'
        and lower(trim(coalesce(designation, ''))) = 'admin'
      )
    )
  )
on conflict (user_id) do update set office = excluded.office, created_at = now();

-- 6) Auth trigger: auto-approve welfare admins and HSO facility admins
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  office_key text;
  designation_key text;
  st text;
begin
  r := coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'Staff');
  office_key := coalesce(nullif(trim(new.raw_user_meta_data->>'office'), ''), 'health');
  designation_key := lower(coalesce(nullif(trim(new.raw_user_meta_data->>'designation'), ''), ''));

  if r = 'Super Admin' or (r = 'Admin' and not (office_key = 'health' and designation_key = 'admin')) then
    st := 'approved';
  elsif office_key = 'health' and designation_key = 'admin' then
    st := 'approved';
  else
    st := 'pending';
  end if;

  insert into public.profiles (id, first_name, middle_initial, last_name, office, role, account_status, designation, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'middle_initial', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    office_key,
    r,
    st,
    case
      when office_key = 'health' and designation_key in ('nurse', 'physician', 'dentist', 'admin', 'queue_display', 'welfare_admin')
        then designation_key
      else null
    end,
    new.email
  );
  return new;
end;
$$;

notify pgrst, 'reload schema';
