-- Remote schemas may require NOT NULL queue_position while repo triggers only set queue_number.
-- Mirror queue_number into queue_position on insert/update.

alter table public.health_queue_tickets add column if not exists queue_position integer;

update public.health_queue_tickets
set queue_position = coalesce(queue_position, queue_number, 0)
where queue_position is null;

create or replace function public.health_appointments_sync_queue_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  qn int;
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

  qn := coalesce(new.queue_number, 0);

  if new_ws = 'queued_for_nurse' and old_ws is distinct from new_ws then
    insert into public.health_queue_tickets (
      health_appointment_id,
      appointment_id,
      ticket_code,
      queue_number,
      queue_position,
      updated_at
    )
    values (new.id, new.id, code, qn, qn, now())
    on conflict (ticket_code) do update
      set health_appointment_id = excluded.health_appointment_id,
          appointment_id = excluded.appointment_id,
          queue_number = excluded.queue_number,
          queue_position = excluded.queue_position,
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
