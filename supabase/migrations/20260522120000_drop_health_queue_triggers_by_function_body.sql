-- Previous migration dropped triggers only when pg_get_triggerdef contained 'health_queue_tickets'.
-- Trigger definitions look like "... EXECUTE FUNCTION foo()" — they do NOT include the function body,
-- so legacy INSERT triggers stayed attached and still caused duplicate ticket_code errors.

do $$
declare
  r record;
begin
  for r in
    select distinct t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'public'
      and c.relname = 'health_appointments'
      and not t.tgisinternal
      and (
        pg_get_functiondef(p.oid) ilike '%health_queue_tickets%'
        or coalesce(pg_get_triggerdef(t.oid), '') ilike '%health_queue_tickets%'
      )
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
