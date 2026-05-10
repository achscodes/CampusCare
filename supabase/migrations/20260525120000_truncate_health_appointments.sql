-- Destructive: removes every row in health_appointments.
-- CASCADE also truncates tables that reference health_appointments (e.g. queue tickets, vitals tied to visits — schema-dependent).
-- Use only for dev/reset; production should backup first.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'health_appointments'
  ) then
    truncate table public.health_appointments cascade;
  end if;
end $$;

notify pgrst, 'reload schema';
