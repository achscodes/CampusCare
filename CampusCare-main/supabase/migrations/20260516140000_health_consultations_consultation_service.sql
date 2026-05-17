-- Optional label for visit type / service shown in patient timeline (separate from chief_complaint if needed later).

alter table public.health_consultations
  add column if not exists consultation_service text;

comment on column public.health_consultations.consultation_service is 'e.g. General Check-up — shown as Service in patient timeline.';

notify pgrst, 'reload schema';
