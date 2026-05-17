-- Hosted DBs may require NOT NULL expires_at on health_queue_tickets; repo trigger must set it.
-- Use appointment check-in window end when present; otherwise 24h from now.

alter table public.health_queue_tickets add column if not exists expires_at timestamptz;

update public.health_queue_tickets
set expires_at = coalesce(expires_at, updated_at + interval '24 hours', now() + interval '24 hours')
where expires_at is null;

create or replace function public.health_appointments_sync_queue_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  qn int;
  exp_at timestamptz;
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
  exp_at := coalesce(new.checkin_valid_until, now() + interval '24 hours');

  if new_ws = 'queued_for_nurse' and old_ws is distinct from new_ws then
    insert into public.health_queue_tickets (
      health_appointment_id,
      appointment_id,
      ticket_code,
      queue_number,
      queue_position,
      expires_at,
      updated_at
    )
    values (new.id, new.id, code, qn, qn, exp_at, now())
    on conflict (ticket_code) do update
      set health_appointment_id = excluded.health_appointment_id,
          appointment_id = excluded.appointment_id,
          queue_number = excluded.queue_number,
          queue_position = excluded.queue_position,
          expires_at = excluded.expires_at,
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
