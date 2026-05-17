-- Ephemeral OTP storage for authenticated password changes (service role via Edge Functions only).

create table if not exists public.password_change_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_change_otp_challenges_user_active_idx
  on public.password_change_otp_challenges (user_id, created_at desc)
  where consumed_at is null;

alter table public.password_change_otp_challenges enable row level security;

revoke all on public.password_change_otp_challenges from public;
revoke all on public.password_change_otp_challenges from anon, authenticated;
grant select, insert, update, delete on public.password_change_otp_challenges to service_role;

comment on table public.password_change_otp_challenges is
  'Hashed OTP for profile password change; accessed only by Edge Functions (service role).';

notify pgrst, 'reload schema';
