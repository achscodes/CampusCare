-- Idempotent sync from health_appointments → health_queue_tickets:
-- - Only runs when workflow_status transitions INTO queued_for_nurse (not on every update).
-- - INSERT ... ON CONFLICT (ticket_code) DO UPDATE avoids duplicate ticket_code errors.

create table if not exists public.health_queue_tickets (
  id uuid primary key default gen_random_uuid(),
  health_appointment_id uuid references public.health_appointments (id) on delete cascade,
  ticket_code text not null,
  queue_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_queue_tickets_ticket_code_key unique (ticket_code)
);

-- Existing tables may predate these columns — add BEFORE any index/function references them.
alter table public.health_queue_tickets add column if not exists health_appointment_id uuid;
alter table public.health_queue_tickets add column if not exists queue_number integer;
alter table public.health_queue_tickets add column if not exists created_at timestamptz;
alter table public.health_queue_tickets add column if not exists updated_at timestamptz;

create index if not exists health_queue_tickets_appt_idx on public.health_queue_tickets (health_appointment_id);

-- Drop legacy triggers that INSERT into health_queue_tickets (often caused duplicate ticket_code on repeat updates).
do $$
declare
  r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'health_appointments'
      and not t.tgisinternal
      and pg_get_triggerdef(t.oid) ilike '%health_queue_tickets%'
  loop
    execute format('drop trigger if exists %I on public.health_appointments;', r.tgname);
  end loop;
end $$;

create or replace function public.health_appointments_sync_queue_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  old_ws text := lower(trim(coalesce(old.workflow_status, '')));
  new_ws text := lower(trim(coalesce(new.workflow_status, '')));
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  code := nullif(trim(coalesce(new.check_in_code, new.checkin_code, '')), '');
  if code is null then
    return new;
  end if;

  -- Only on transition into nurse queue (avoids duplicate inserts when row is updated again while already queued).
  if new_ws = 'queued_for_nurse' and old_ws is distinct from new_ws then
    insert into public.health_queue_tickets (health_appointment_id, ticket_code, queue_number, updated_at)
    values (new.id, code, new.queue_number, now())
    on conflict (ticket_code) do update
      set health_appointment_id = excluded.health_appointment_id,
          queue_number = excluded.queue_number,
          updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists health_appointments_sync_queue_ticket on public.health_appointments;
create trigger health_appointments_sync_queue_ticket
  after update on public.health_appointments
  for each row execute function public.health_appointments_sync_queue_ticket();

-- Policies if this migration created the table after 20260513120000 ran without it.
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
