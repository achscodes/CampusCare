-- SDAO (Scholarship / Student Development) — empty tables; app owns all rows (no demo seed).
-- RLS: authenticated staff (same pattern as discipline / HSO).

create table if not exists public.sdao_beneficiaries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  student_id text not null,
  program text not null default '',
  year_level text not null default '',
  scholarship_type text not null default '',
  gpa text,
  email text,
  contact text,
  scholar_status text not null default 'active',
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sdao_beneficiaries_student_id_key unique (student_id),
  constraint sdao_beneficiaries_status_check check (scholar_status in ('active', 'probation', 'inactive'))
);

create index if not exists sdao_beneficiaries_created_idx on public.sdao_beneficiaries (created_at desc);

create table if not exists public.sdao_scholarship_applications (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  student_id text not null,
  degree text not null default '',
  scholarship_type text not null,
  gpa text,
  submitted_at date,
  status text not null default 'pending',
  documents jsonb not null default '[]'::jsonb,
  document_presentation text,
  disbursed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sdao_app_status_check check (status in ('pending', 'validated', 'declined', 'disbursed'))
);

create index if not exists sdao_app_student_idx on public.sdao_scholarship_applications (student_id);
create index if not exists sdao_app_created_idx on public.sdao_scholarship_applications (created_at desc);

create table if not exists public.sdao_clearance_records (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  student_id text not null,
  program text not null default '',
  year_level text not null default '',
  scholarship text not null default '',
  progress int not null default 0,
  status_key text not null default 'pending',
  requirements jsonb not null default '[]'::jsonb,
  progress_label text,
  footer_message text,
  footer_variant text,
  pending_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sdao_clearance_status_check check (status_key in ('completed', 'incomplete', 'pending')),
  constraint sdao_clearance_progress_check check (progress >= 0 and progress <= 100)
);

create index if not exists sdao_clearance_student_idx on public.sdao_clearance_records (student_id);

create table if not exists public.sdao_document_requests (
  id text primary key,
  student_name text not null,
  student_id text not null,
  program text not null default '',
  target_office text not null,
  document_type text not null,
  priority text not null,
  status text not null,
  requested_at timestamptz not null default now(),
  uploaded_at timestamptz,
  notes text,
  requested_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sdao_doc_req_created_idx on public.sdao_document_requests (created_at desc);

create table if not exists public.sdao_referrals (
  id uuid primary key default gen_random_uuid(),
  reference_id text unique,
  student_name text not null,
  student_id text not null,
  email text,
  phone text,
  program text,
  receiving_office text not null,
  referring_office text not null default 'SDAO',
  reason text,
  development_details text,
  recommended_action text,
  urgency text not null default 'normal',
  status text not null default 'sent',
  status_detail text,
  created_by text,
  attachments jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sdao_ref_created_idx on public.sdao_referrals (created_at desc);

drop trigger if exists sdao_beneficiaries_updated_at on public.sdao_beneficiaries;
create trigger sdao_beneficiaries_updated_at
  before update on public.sdao_beneficiaries
  for each row execute procedure public.touch_discipline_office_updated_at();

drop trigger if exists sdao_scholarship_applications_updated_at on public.sdao_scholarship_applications;
create trigger sdao_scholarship_applications_updated_at
  before update on public.sdao_scholarship_applications
  for each row execute procedure public.touch_discipline_office_updated_at();

drop trigger if exists sdao_clearance_records_updated_at on public.sdao_clearance_records;
create trigger sdao_clearance_records_updated_at
  before update on public.sdao_clearance_records
  for each row execute procedure public.touch_discipline_office_updated_at();

drop trigger if exists sdao_document_requests_updated_at on public.sdao_document_requests;
create trigger sdao_document_requests_updated_at
  before update on public.sdao_document_requests
  for each row execute procedure public.touch_discipline_office_updated_at();

drop trigger if exists sdao_referrals_updated_at on public.sdao_referrals;
create trigger sdao_referrals_updated_at
  before update on public.sdao_referrals
  for each row execute procedure public.touch_discipline_office_updated_at();

alter table public.sdao_beneficiaries enable row level security;
alter table public.sdao_scholarship_applications enable row level security;
alter table public.sdao_clearance_records enable row level security;
alter table public.sdao_document_requests enable row level security;
alter table public.sdao_referrals enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'sdao_beneficiaries',
    'sdao_scholarship_applications',
    'sdao_clearance_records',
    'sdao_document_requests',
    'sdao_referrals'
  ]
  loop
    execute format('drop policy if exists "%1$s_auth_select" on public.%1$s', t);
    execute format('create policy "%1$s_auth_select" on public.%1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists "%1$s_auth_insert" on public.%1$s', t);
    execute format('create policy "%1$s_auth_insert" on public.%1$s for insert to authenticated with check (true)', t);
    execute format('drop policy if exists "%1$s_auth_update" on public.%1$s', t);
    execute format('create policy "%1$s_auth_update" on public.%1$s for update to authenticated using (true) with check (true)', t);
    execute format('drop policy if exists "%1$s_auth_delete" on public.%1$s', t);
    execute format('create policy "%1$s_auth_delete" on public.%1$s for delete to authenticated using (true)', t);
    execute format('grant select, insert, update, delete on table public.%1$s to authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
