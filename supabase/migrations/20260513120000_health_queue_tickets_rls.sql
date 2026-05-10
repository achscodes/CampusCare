-- Allow authenticated HSO staff to read/write health_queue_tickets (e.g. rows inserted by a trigger on health_appointments).
-- Table may exist only on remote DB; this block runs only when the table is present.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'health_queue_tickets'
  ) then
    alter table public.health_queue_tickets enable row level security;

    drop policy if exists health_queue_tickets_auth_select on public.health_queue_tickets;
    create policy health_queue_tickets_auth_select
      on public.health_queue_tickets for select
      to authenticated
      using (true);

    drop policy if exists health_queue_tickets_auth_insert on public.health_queue_tickets;
    create policy health_queue_tickets_auth_insert
      on public.health_queue_tickets for insert
      to authenticated
      with check (true);

    drop policy if exists health_queue_tickets_auth_update on public.health_queue_tickets;
    create policy health_queue_tickets_auth_update
      on public.health_queue_tickets for update
      to authenticated
      using (true)
      with check (true);

    drop policy if exists health_queue_tickets_auth_delete on public.health_queue_tickets;
    create policy health_queue_tickets_auth_delete
      on public.health_queue_tickets for delete
      to authenticated
      using (true);

    grant select, insert, update, delete on table public.health_queue_tickets to authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';
