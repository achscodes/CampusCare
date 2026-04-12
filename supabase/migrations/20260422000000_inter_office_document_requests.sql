-- Unified inter-office document requests: visible to requesting office AND target office.
-- Rules: DO→SDAO|HSO, HSO→SDAO|DO, SDAO→HSO|DO (keys: discipline, health, development).

create table if not exists public.inter_office_document_requests (
  id text primary key,
  requesting_office text not null,
  target_office text not null,
  student_name text not null,
  student_id text not null,
  program text not null default '',
  document_type text not null,
  priority text not null default 'medium',
  status text not null default 'Pending',
  description text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  notes text,
  requested_by text,
  requested_at timestamptz not null default now(),
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inter_office_doc_req_distinct_offices check (requesting_office <> target_office),
  constraint inter_office_doc_req_pair_check check (
    (requesting_office = 'discipline' and target_office in ('development', 'health'))
    or (requesting_office = 'health' and target_office in ('development', 'discipline'))
    or (requesting_office = 'development' and target_office in ('health', 'discipline'))
  ),
  constraint inter_office_doc_req_office_keys check (
    requesting_office in ('discipline', 'health', 'development')
    and target_office in ('discipline', 'health', 'development')
  )
);

create index if not exists inter_office_doc_req_created_idx
  on public.inter_office_document_requests (created_at desc);

create index if not exists inter_office_doc_req_requesting_idx
  on public.inter_office_document_requests (requesting_office);

create index if not exists inter_office_doc_req_target_idx
  on public.inter_office_document_requests (target_office);

drop trigger if exists inter_office_document_requests_updated_at on public.inter_office_document_requests;
create trigger inter_office_document_requests_updated_at
  before update on public.inter_office_document_requests
  for each row execute procedure public.touch_discipline_office_updated_at();

alter table public.inter_office_document_requests enable row level security;

drop policy if exists "inter_office_document_requests_auth_select" on public.inter_office_document_requests;
create policy "inter_office_document_requests_auth_select" on public.inter_office_document_requests
  for select to authenticated using (true);

drop policy if exists "inter_office_document_requests_auth_insert" on public.inter_office_document_requests;
create policy "inter_office_document_requests_auth_insert" on public.inter_office_document_requests
  for insert to authenticated with check (true);

drop policy if exists "inter_office_document_requests_auth_update" on public.inter_office_document_requests;
create policy "inter_office_document_requests_auth_update" on public.inter_office_document_requests
  for update to authenticated using (true) with check (true);

drop policy if exists "inter_office_document_requests_auth_delete" on public.inter_office_document_requests;
create policy "inter_office_document_requests_auth_delete" on public.inter_office_document_requests
  for delete to authenticated using (true);

grant select, insert, update, delete on table public.inter_office_document_requests to authenticated;

notify pgrst, 'reload schema';
