-- Public bucket for inter-office document request files (requester + accepting-office uploads).

insert into storage.buckets (id, name, public, file_size_limit)
values ('inter-office-documents', 'inter-office-documents', true, 52428800)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "inter_office_docs_select" on storage.objects;
create policy "inter_office_docs_select"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'inter-office-documents');

drop policy if exists "inter_office_docs_insert" on storage.objects;
create policy "inter_office_docs_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'inter-office-documents');

drop policy if exists "inter_office_docs_update" on storage.objects;
create policy "inter_office_docs_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'inter-office-documents')
  with check (bucket_id = 'inter-office-documents');

drop policy if exists "inter_office_docs_delete" on storage.objects;
create policy "inter_office_docs_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'inter-office-documents');

notify pgrst, 'reload schema';
