-- Weekly staff availability: HSO (clinical) + DO/SDAO welfare staff.
-- One row per (profile, weekday); times use local TIME; day_of_week matches JS getDay() (0=Sun .. 6=Sat).

create table if not exists public.health_staff_availability (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day_of_week smallint not null check (day_of_week >= 0 and day_of_week <= 6),
  is_working boolean not null default false,
  start_time time without time zone,
  end_time time without time zone,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, day_of_week)
);

comment on table public.health_staff_availability is
  'HSO clinical staff weekly hours; surfaced in admin Staff Scheduling and readable on mobile for directory hours.';

create index if not exists health_staff_availability_profile_idx
  on public.health_staff_availability (profile_id);

create table if not exists public.welfare_staff_availability (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day_of_week smallint not null check (day_of_week >= 0 and day_of_week <= 6),
  is_working boolean not null default false,
  start_time time without time zone,
  end_time time without time zone,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, day_of_week)
);

comment on table public.welfare_staff_availability is
  'DO/SDAO staff weekly hours; same semantics as health_staff_availability.';

create index if not exists welfare_staff_availability_profile_idx
  on public.welfare_staff_availability (profile_id);

-- Touch updated_at
create or replace function public.touch_staff_availability_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_health_staff_availability_updated on public.health_staff_availability;
create trigger trg_health_staff_availability_updated
  before update on public.health_staff_availability
  for each row execute procedure public.touch_staff_availability_updated_at();

drop trigger if exists trg_welfare_staff_availability_updated on public.welfare_staff_availability;
create trigger trg_welfare_staff_availability_updated
  before update on public.welfare_staff_availability
  for each row execute procedure public.touch_staff_availability_updated_at();

alter table public.health_staff_availability enable row level security;
alter table public.welfare_staff_availability enable row level security;

-- Read schedules in student/mobile apps (anon) + any signed-in user
drop policy if exists health_staff_availability_select_anon on public.health_staff_availability;
create policy health_staff_availability_select_anon
  on public.health_staff_availability for select to anon using (true);

drop policy if exists health_staff_availability_select_auth on public.health_staff_availability;
create policy health_staff_availability_select_auth
  on public.health_staff_availability for select to authenticated using (true);

drop policy if exists health_staff_availability_write_hso_admin on public.health_staff_availability;
create policy health_staff_availability_write_hso_admin
  on public.health_staff_availability for insert to authenticated
  with check (public.is_approved_hso_admin());

drop policy if exists health_staff_availability_update_hso_admin on public.health_staff_availability;
create policy health_staff_availability_update_hso_admin
  on public.health_staff_availability for update to authenticated
  using (public.is_approved_hso_admin())
  with check (public.is_approved_hso_admin());

drop policy if exists health_staff_availability_delete_hso_admin on public.health_staff_availability;
create policy health_staff_availability_delete_hso_admin
  on public.health_staff_availability for delete to authenticated
  using (public.is_approved_hso_admin());

drop policy if exists welfare_staff_availability_select_anon on public.welfare_staff_availability;
create policy welfare_staff_availability_select_anon
  on public.welfare_staff_availability for select to anon using (true);

drop policy if exists welfare_staff_availability_select_auth on public.welfare_staff_availability;
create policy welfare_staff_availability_select_auth
  on public.welfare_staff_availability for select to authenticated using (true);

drop policy if exists welfare_staff_availability_insert_portal on public.welfare_staff_availability;
create policy welfare_staff_availability_insert_portal
  on public.welfare_staff_availability for insert to authenticated
  with check (
    public.is_do_sdao_welfare_portal_admin()
    and exists (
      select 1 from public.profiles p
      where p.id = welfare_staff_availability.profile_id
        and p.office in ('discipline', 'development')
    )
  );

drop policy if exists welfare_staff_availability_update_portal on public.welfare_staff_availability;
create policy welfare_staff_availability_update_portal
  on public.welfare_staff_availability for update to authenticated
  using (
    public.is_do_sdao_welfare_portal_admin()
    and exists (
      select 1 from public.profiles p
      where p.id = welfare_staff_availability.profile_id
        and p.office in ('discipline', 'development')
    )
  )
  with check (
    public.is_do_sdao_welfare_portal_admin()
    and exists (
      select 1 from public.profiles p
      where p.id = welfare_staff_availability.profile_id
        and p.office in ('discipline', 'development')
    )
  );

drop policy if exists welfare_staff_availability_delete_portal on public.welfare_staff_availability;
create policy welfare_staff_availability_delete_portal
  on public.welfare_staff_availability for delete to authenticated
  using (
    public.is_do_sdao_welfare_portal_admin()
    and exists (
      select 1 from public.profiles p
      where p.id = welfare_staff_availability.profile_id
        and p.office in ('discipline', 'development')
    )
  );

grant select on public.health_staff_availability to anon, authenticated;
grant insert, update, delete on public.health_staff_availability to authenticated;
grant select, insert, update, delete on public.health_staff_availability to service_role;

grant select on public.welfare_staff_availability to anon, authenticated;
grant insert, update, delete on public.welfare_staff_availability to authenticated;
grant select, insert, update, delete on public.welfare_staff_availability to service_role;

-- Legacy-compatible: mobile anon read + HSO facility admin can manage any row (OR with existing staff self policies).
drop policy if exists health_staff_availability_select_anon_cc on public.health_staff_availability;
create policy health_staff_availability_select_anon_cc
  on public.health_staff_availability for select to anon using (true);

drop policy if exists health_staff_availability_hso_admin_cc on public.health_staff_availability;
create policy health_staff_availability_hso_admin_cc
  on public.health_staff_availability for all to authenticated
  using (public.is_approved_hso_admin())
  with check (public.is_approved_hso_admin());

notify pgrst, 'reload schema';
