-- File attachments for physician chart (labs, imaging, referrals). Metadata stored on medical_records; binaries in Storage.

alter table public.medical_records
  add column if not exists physician_documents_attachments jsonb not null default '[]'::jsonb;

comment on column public.medical_records.physician_documents_attachments is
  'Array of { name, url, path, uploadedAt } for Supabase Storage objects in physician-chart-documents bucket.';

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
