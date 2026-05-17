-- Repair / ensure physician chart columns exist (fixes PostgREST "could not find column in schema cache"
-- when earlier migrations were not applied on this database). Safe to re-run.

alter table public.medical_records
  add column if not exists physician_medical_history text,
  add column if not exists physician_physical_examination text,
  add column if not exists physician_prescription_notes text,
  add column if not exists physician_documents_notes text,
  add column if not exists physician_medical_history_json jsonb,
  add column if not exists physician_physical_examination_json jsonb,
  add column if not exists physician_documents_attachments jsonb;

-- Backfill defaults where columns were just added (jsonb without NOT NULL from older partial state)
update public.medical_records
set physician_medical_history_json = coalesce(physician_medical_history_json, '{}'::jsonb)
where physician_medical_history_json is null;

update public.medical_records
set physician_physical_examination_json = coalesce(physician_physical_examination_json, '{}'::jsonb)
where physician_physical_examination_json is null;

update public.medical_records
set physician_documents_attachments = coalesce(physician_documents_attachments, '[]'::jsonb)
where physician_documents_attachments is null;

alter table public.medical_records
  alter column physician_medical_history_json set default '{}'::jsonb,
  alter column physician_physical_examination_json set default '{}'::jsonb,
  alter column physician_documents_attachments set default '[]'::jsonb;

alter table public.medical_records
  alter column physician_medical_history_json set not null,
  alter column physician_physical_examination_json set not null,
  alter column physician_documents_attachments set not null;

alter table public.health_consultations
  add column if not exists certificate_reason text,
  add column if not exists certificate_period text,
  add column if not exists certificate_status text default 'issued',
  add column if not exists prescription_detail text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('physician-chart-documents', 'physician-chart-documents', true, 52428800)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "physician_chart_docs_select" on storage.objects;
create policy "physician_chart_docs_select"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'physician-chart-documents');

drop policy if exists "physician_chart_docs_insert" on storage.objects;
create policy "physician_chart_docs_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'physician-chart-documents');

drop policy if exists "physician_chart_docs_update" on storage.objects;
create policy "physician_chart_docs_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'physician-chart-documents')
  with check (bucket_id = 'physician-chart-documents');

drop policy if exists "physician_chart_docs_delete" on storage.objects;
create policy "physician_chart_docs_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'physician-chart-documents');

notify pgrst, 'reload schema';
