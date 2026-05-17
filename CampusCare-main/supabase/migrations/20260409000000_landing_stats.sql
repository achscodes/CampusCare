-- =============================================================================
-- CampusCare — Landing page stats (Why CampusCare panel)
-- Paste the whole file into: Supabase Dashboard → SQL → New query → Run
-- Safe to run more than once (idempotent).
-- =============================================================================
--
-- Change numbers anytime (SQL Editor):
--
--   UPDATE public.landing_stats
--   SET active_students = 0,
--       monthly_visits = 120,
--       office_staff = 5,
--       updated_at = now()
--   WHERE id = 1;
--
-- Or use Table Editor → public.landing_stats → edit row id = 1.
-- =============================================================================

create table if not exists public.landing_stats (
  id smallint primary key default 1,
  constraint landing_stats_singleton check (id = 1),
  active_students integer not null default 0,
  monthly_visits integer not null default 0,
  office_staff integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.landing_stats is 'Single-row public stats for CampusCare landing page; readable by anon.';

comment on column public.landing_stats.active_students is 'Legacy; landing page forces 0 until student tracking exists.';
comment on column public.landing_stats.monthly_visits is 'Legacy; landing page uses landing_page_visits + get_landing_monthly_visit_count().';
comment on column public.landing_stats.office_staff is 'Legacy; landing page uses get_auth_registered_user_count().';

-- Defaults: no students in-app yet (0); visits from your analytics (0 until you set); staff matches registered office accounts (update as users join).
insert into public.landing_stats (id, active_students, monthly_visits, office_staff)
values (1, 0, 0, 3)
on conflict (id) do nothing;

alter table public.landing_stats enable row level security;

drop policy if exists "landing_stats_select_public" on public.landing_stats;
create policy "landing_stats_select_public"
  on public.landing_stats for select
  to anon, authenticated
  using (true);

grant select on table public.landing_stats to anon, authenticated;
