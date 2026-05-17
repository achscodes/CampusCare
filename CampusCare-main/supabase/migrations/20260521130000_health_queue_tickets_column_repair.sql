-- Repair: ensure columns exist before indexes/triggers reference health_appointment_id.
-- Safe if 20260521120000 failed mid-run or ran before column order was fixed.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'health_queue_tickets'
  ) then
    alter table public.health_queue_tickets add column if not exists health_appointment_id uuid;
    alter table public.health_queue_tickets add column if not exists queue_number integer;
    alter table public.health_queue_tickets add column if not exists created_at timestamptz;
    alter table public.health_queue_tickets add column if not exists updated_at timestamptz;
    create index if not exists health_queue_tickets_appt_idx on public.health_queue_tickets (health_appointment_id);
  end if;
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

notify pgrst, 'reload schema';
