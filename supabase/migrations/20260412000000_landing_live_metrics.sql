-- Live landing metrics: real monthly visit counts + auth user count (no client admin key).
-- Active students stay 0 in the app until you track students separately.

-- ---------------------------------------------------------------------------
-- Visit log (one row per landing page load; anon may insert only)
-- ---------------------------------------------------------------------------
create table if not exists public.landing_page_visits (
  id uuid primary key default gen_random_uuid(),
  visited_at timestamptz not null default now()
);

comment on table public.landing_page_visits is 'Anonymous landing page loads; used for calendar-month visit totals.';

create index if not exists landing_page_visits_visited_at_idx
  on public.landing_page_visits (visited_at);

alter table public.landing_page_visits enable row level security;

drop policy if exists "landing_page_visits_insert_public" on public.landing_page_visits;
create policy "landing_page_visits_insert_public"
  on public.landing_page_visits for insert
  to anon, authenticated
  with check (true);

grant insert on table public.landing_page_visits to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Count visits in the current UTC calendar month (includes the row just inserted)
-- ---------------------------------------------------------------------------
create or replace function public.get_landing_monthly_visit_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.landing_page_visits
  where visited_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc')
    and visited_at < ((date_trunc('month', now() at time zone 'utc') + interval '1 month')
      at time zone 'utc');
$$;

comment on function public.get_landing_monthly_visit_count() is 'UTC month-to-date count of landing_page_visits rows.';

grant execute on function public.get_landing_monthly_visit_count() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registered users count (replaced by 20260414000000_office_staff_count_profiles.sql for staff-only count).
-- ---------------------------------------------------------------------------
create or replace function public.get_auth_registered_user_count()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'deleted_at'
  ) then
    select count(*)::bigint into n from auth.users where deleted_at is null;
  else
    select count(*)::bigint into n from auth.users;
  end if;
  return n;
end;
$$;

comment on function public.get_auth_registered_user_count() is 'Superseded: use 20260414000000 migration (counts public.profiles for office staff).';

grant execute on function public.get_auth_registered_user_count() to anon, authenticated;
