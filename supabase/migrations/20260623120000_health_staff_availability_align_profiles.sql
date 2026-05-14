-- Legacy health_staff_availability used staff_id -> health_staff(id). The app expects
-- profile_id -> profiles(id). Idempotent: only runs renames when staff_id still exists.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'health_staff_availability' and column_name = 'staff_id'
  ) then
    alter table public.health_staff_availability drop constraint if exists health_staff_availability_staff_id_fkey;
    delete from public.health_staff_availability;
    alter table public.health_staff_availability rename column staff_id to profile_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'health_staff_availability' and column_name = 'is_active'
  ) then
    alter table public.health_staff_availability rename column is_active to is_working;
  end if;
end;
$$;

alter table public.health_staff_availability drop constraint if exists health_staff_availability_profile_id_fkey;

alter table public.health_staff_availability
  add constraint health_staff_availability_profile_id_fkey
  foreign key (profile_id) references public.profiles (id) on delete cascade;

alter table public.health_staff_availability add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_health_staff_availability_updated on public.health_staff_availability;

create or replace function public.touch_staff_availability_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_health_staff_availability_updated
  before update on public.health_staff_availability
  for each row execute procedure public.touch_staff_availability_updated_at();

notify pgrst, 'reload schema';
