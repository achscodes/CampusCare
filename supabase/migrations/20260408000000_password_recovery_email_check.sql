-- Allows the forgot-password screen to show "no account" instead of always succeeding.
-- Grants anon access only to this boolean check (email enumeration tradeoff per product UX).

create or replace function public.check_recovery_email_registered(user_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users
    where lower(btrim(email)) = lower(btrim(user_email))
  );
$$;

comment on function public.check_recovery_email_registered(text) is
  'True if auth.users has this email (for recovery flow UI). Security definer; use sparingly.';

revoke all on function public.check_recovery_email_registered(text) from public;
grant execute on function public.check_recovery_email_registered(text) to anon, authenticated;
