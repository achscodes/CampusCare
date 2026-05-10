-- SECURITY DEFINER RPC so the nurse app can clear stuck rows even when direct DELETE is blocked or misses variants.

alter table public.health_queue_tickets add column if not exists health_appointment_id uuid;

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
