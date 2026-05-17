-- Clear all rows in health_queue_tickets (stale / stuck tickets). New rows are created on the next check-in when workflow moves to nurse queue.
-- CASCADE is required when health_vital_signs (or others) has an FK to health_queue_tickets — those child rows are truncated too.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'health_queue_tickets'
  ) then
    truncate table public.health_queue_tickets cascade;
  end if;
end $$;

notify pgrst, 'reload schema';
