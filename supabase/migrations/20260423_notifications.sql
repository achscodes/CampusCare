-- ─────────────────────────────────────────────────────────────
--  Notifications + device tokens
-- ─────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null check (category in ('health','discipline','scholarships','referrals','campus')),
  title       text not null,
  body        text not null,
  href        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- Only service role can insert (prevents users writing their own fake notifications).
-- If you want users to create their own, add an "insert_own" policy.

-- ─────────────────────────────────────────────────────────────

create table if not exists public.device_tokens (
  user_id       uuid not null references auth.users(id) on delete cascade,
  device_id     text not null,
  expo_token    text not null,
  platform      text not null check (platform in ('ios','android','web')),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  primary key (user_id, device_id)
);

create index if not exists device_tokens_user_idx
  on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_own_all" on public.device_tokens;
create policy "device_tokens_own_all"
  on public.device_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
--  Trigger: when a notification is inserted, fire push webhook
--  (we'll use a Database Webhook in the dashboard → Edge Function,
--   so no trigger needed here. Left here for reference only.)
-- ─────────────────────────────────────────────────────────────
