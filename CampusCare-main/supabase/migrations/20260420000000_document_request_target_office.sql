-- Partner office that should fulfill the request (DO or SDAO); not Admissions.
alter table public.health_document_requests
  add column if not exists target_office text;

alter table public.discipline_document_requests
  add column if not exists target_office text;
