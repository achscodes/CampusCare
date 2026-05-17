-- Rate-limit password recovery emails (Edge Function password-recovery-otp).
create table if not exists public.password_recovery_send_log (
  id bigint generated always as identity primary key,
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists password_recovery_send_log_email_created_idx
  on public.password_recovery_send_log (email, created_at desc);

alter table public.password_recovery_send_log enable row level security;

comment on table public.password_recovery_send_log is
  'Cooldown log for password-recovery-otp Edge Function; service role only.';
