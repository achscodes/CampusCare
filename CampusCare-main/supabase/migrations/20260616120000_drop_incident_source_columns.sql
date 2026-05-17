-- Remove "investigation routing" / physical vs non-physical incident_source (reports + cases).

alter table public.discipline_incident_reports
  drop constraint if exists discipline_incident_reports_incident_source_check;

alter table public.discipline_incident_reports
  drop column if exists incident_source;

alter table public.discipline_cases
  drop constraint if exists discipline_cases_incident_source_check;

alter table public.discipline_cases
  drop column if exists incident_source;

notify pgrst, 'reload schema';
