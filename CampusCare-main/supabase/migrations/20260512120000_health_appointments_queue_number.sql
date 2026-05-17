-- Queue ticket assigned when nurse confirms check-in; exposed to mobile via health_appointments.queue_number.

alter table public.health_appointments
  add column if not exists queue_number integer;

comment on column public.health_appointments.queue_number is
  'Set when the nurse confirms check-in; mobile can read this with the appointment row.';

create index if not exists health_appointments_queue_number_idx
  on public.health_appointments (queue_number desc nulls last);

notify pgrst, 'reload schema';
