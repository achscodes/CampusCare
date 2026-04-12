-- Program for student document requests (DO ↔ HSO ↔ SDAO workflow)
alter table public.discipline_document_requests
  add column if not exists program text;
