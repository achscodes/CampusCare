-- Some databases have a legacy NOT NULL column appointment_id on health_queue_tickets while
-- app migrations only populated health_appointment_id — inserts then failed with:
-- "null value in column appointment_id ... violates not-null constraint".
-- Keep both columns equal to the same health_appointments.id everywhere.

alter table public.health_queue_tickets add column if not exists appointment_id uuid;

update public.health_queue_tickets
set appointment_id = health_appointment_id
where appointment_id is null and health_appointment_id is not null;

update public.health_queue_tickets
set health_appointment_id = appointment_id
where health_appointment_id is null and appointment_id is not null;

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
    insert into public.health_queue_tickets (
      health_appointment_id,
      appointment_id,
      ticket_code,
      queue_number,
      updated_at
    )
    values (new.id, new.id, code, new.queue_number, now())
    on conflict (ticket_code) do update
      set health_appointment_id = excluded.health_appointment_id,
          appointment_id = excluded.appointment_id,
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

create or replace function public.clear_health_queue_ticket_for_appointment(p_appt uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text;
  n int := 0;
begin
  select trim(coalesce(ha.check_in_code, ha.checkin_code, ''))
  into raw
  from public.health_appointments ha
  where ha.id = p_appt;

  delete from public.health_queue_tickets hqt
  where hqt.health_appointment_id = p_appt
     or hqt.appointment_id = p_appt
     or (
       raw <> ''
       and (
         hqt.ticket_code = raw
         or hqt.ticket_code = upper(raw)
         or hqt.ticket_code = lower(raw)
       )
     );

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

grant execute on function public.clear_health_queue_ticket_for_appointment(uuid) to authenticated;

notify pgrst, 'reload schema';
