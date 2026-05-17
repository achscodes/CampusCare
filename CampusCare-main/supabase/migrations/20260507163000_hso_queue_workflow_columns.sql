-- HSO queue workflow extension: appointment/check-in/nurse/provider states.
-- Safe to run multiple times.

alter table public.health_appointments
  add column if not exists designation text,
  add column if not exists consultation_type text,
  add column if not exists additional_comments text,
  add column if not exists workflow_status text not null default 'booked',
  add column if not exists checkin_code text,
  add column if not exists checkin_valid_from timestamptz,
  add column if not exists checkin_valid_until timestamptz,
  add column if not exists checked_in_at timestamptz,
  add column if not exists queue_number integer,
  add column if not exists provider_queue text,
  add column if not exists nurse_vitals jsonb,
  add column if not exists nurse_assessment_completed_at timestamptz,
  add column if not exists consultation_started_at timestamptz,
  add column if not exists consultation_completed_at timestamptz;

create index if not exists health_appointments_workflow_status_idx
  on public.health_appointments (workflow_status);

create index if not exists health_appointments_checkin_code_idx
  on public.health_appointments (checkin_code);

notify pgrst, 'reload schema';
