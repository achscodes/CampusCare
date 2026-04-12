-- =============================================================================
-- Foreign keys: inter-office document requests ↔ referrals, plus related FKs.
-- Run in Supabase → SQL after prior migrations. Idempotent where possible.
--
-- Design:
-- - inter_office_document_requests can optionally point to ONE originating referral
--   (SDAO, HSO, or DO referral row).
-- - sdao_referrals / health_referrals / discipline_referrals can optionally point back
--   to the unified inter_office_document_requests row when a document request was
--   created in tandem (app should keep both sides in sync when linking).
-- - discipline_case_conferences.case_id references discipline_cases(id).
-- - sdao_scholarship_applications.beneficiary_id references sdao_beneficiaries(id).
-- =============================================================================

-- ── 1) inter_office_document_requests: optional referral origin (at most one) ─
alter table public.inter_office_document_requests
  add column if not exists sdao_referral_id uuid,
  add column if not exists health_referral_id uuid,
  add column if not exists discipline_referral_id text;

comment on column public.inter_office_document_requests.sdao_referral_id is
  'Optional FK to sdao_referrals when this request was spawned from or tied to an SDAO referral.';
comment on column public.inter_office_document_requests.health_referral_id is
  'Optional FK to health_referrals when tied to an HSO referral.';
comment on column public.inter_office_document_requests.discipline_referral_id is
  'Optional FK to discipline_referrals when tied to a DO referral.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inter_office_doc_req_sdao_referral_fk'
  ) then
    alter table public.inter_office_document_requests
      add constraint inter_office_doc_req_sdao_referral_fk
      foreign key (sdao_referral_id) references public.sdao_referrals (id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'inter_office_doc_req_health_referral_fk'
  ) then
    alter table public.inter_office_document_requests
      add constraint inter_office_doc_req_health_referral_fk
      foreign key (health_referral_id) references public.health_referrals (id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'inter_office_doc_req_discipline_referral_fk'
  ) then
    alter table public.inter_office_document_requests
      add constraint inter_office_doc_req_discipline_referral_fk
      foreign key (discipline_referral_id) references public.discipline_referrals (id) on delete set null;
  end if;
end $$;

-- Only one referral pointer may be set (cross-office exclusivity)
alter table public.inter_office_document_requests
  drop constraint if exists inter_office_doc_req_single_referral_source;

alter table public.inter_office_document_requests
  add constraint inter_office_doc_req_single_referral_source check (
    (case when sdao_referral_id is not null then 1 else 0 end)
    + (case when health_referral_id is not null then 1 else 0 end)
    + (case when discipline_referral_id is not null then 1 else 0 end) <= 1
  );

create index if not exists inter_office_doc_req_sdao_referral_idx
  on public.inter_office_document_requests (sdao_referral_id)
  where sdao_referral_id is not null;

create index if not exists inter_office_doc_req_health_referral_idx
  on public.inter_office_document_requests (health_referral_id)
  where health_referral_id is not null;

create index if not exists inter_office_doc_req_discipline_referral_idx
  on public.inter_office_document_requests (discipline_referral_id)
  where discipline_referral_id is not null;

-- ── 2) Referral tables: optional link to inter-office document request row ───
alter table public.sdao_referrals
  add column if not exists inter_office_document_request_id text;

comment on column public.sdao_referrals.inter_office_document_request_id is
  'Optional FK to inter_office_document_requests when a document request is paired with this referral.';

alter table public.health_referrals
  add column if not exists inter_office_document_request_id text;

comment on column public.health_referrals.inter_office_document_request_id is
  'Optional FK to inter_office_document_requests when paired with a document request.';

alter table public.discipline_referrals
  add column if not exists inter_office_document_request_id text;

comment on column public.discipline_referrals.inter_office_document_request_id is
  'Optional FK to inter_office_document_requests when paired with a document request.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sdao_referrals_inter_office_doc_req_fk'
  ) then
    alter table public.sdao_referrals
      add constraint sdao_referrals_inter_office_doc_req_fk
      foreign key (inter_office_document_request_id) references public.inter_office_document_requests (id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'health_referrals_inter_office_doc_req_fk'
  ) then
    alter table public.health_referrals
      add constraint health_referrals_inter_office_doc_req_fk
      foreign key (inter_office_document_request_id) references public.inter_office_document_requests (id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'discipline_referrals_inter_office_doc_req_fk'
  ) then
    alter table public.discipline_referrals
      add constraint discipline_referrals_inter_office_doc_req_fk
      foreign key (inter_office_document_request_id) references public.inter_office_document_requests (id) on delete set null;
  end if;
end $$;

create index if not exists sdao_referrals_inter_office_doc_idx
  on public.sdao_referrals (inter_office_document_request_id)
  where inter_office_document_request_id is not null;

create index if not exists health_referrals_inter_office_doc_idx
  on public.health_referrals (inter_office_document_request_id)
  where inter_office_document_request_id is not null;

create index if not exists discipline_referrals_inter_office_doc_idx
  on public.discipline_referrals (inter_office_document_request_id)
  where inter_office_document_request_id is not null;

-- ── 3) Discipline: case conferences must reference a real case ─────────────
-- If this fails, delete orphans then re-run:
-- delete from public.discipline_case_conferences c
-- where not exists (select 1 from public.discipline_cases k where k.id = c.case_id);
alter table public.discipline_case_conferences
  drop constraint if exists discipline_case_conferences_case_id_fkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'discipline_case_conferences_case_id_fkey'
  ) then
    alter table public.discipline_case_conferences
      add constraint discipline_case_conferences_case_id_fkey
      foreign key (case_id) references public.discipline_cases (id) on delete cascade;
  end if;
end $$;

-- ── 4) SDAO: applications may reference a beneficiary row (optional) ────────
alter table public.sdao_scholarship_applications
  add column if not exists beneficiary_id uuid;

comment on column public.sdao_scholarship_applications.beneficiary_id is
  'Optional FK to sdao_beneficiaries when the application is tied to an existing scholar record.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sdao_scholarship_applications_beneficiary_fk'
  ) then
    alter table public.sdao_scholarship_applications
      add constraint sdao_scholarship_applications_beneficiary_fk
      foreign key (beneficiary_id) references public.sdao_beneficiaries (id) on delete set null;
  end if;
end $$;

create index if not exists sdao_app_beneficiary_idx
  on public.sdao_scholarship_applications (beneficiary_id)
  where beneficiary_id is not null;

-- ── 5) HSO: consultation can optionally reference a medical record row ───────
alter table public.health_consultations
  add column if not exists medical_record_id uuid;

comment on column public.health_consultations.medical_record_id is
  'Optional FK to medical_records when this visit is linked to a chart row.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'health_consultations_medical_record_fk'
  ) then
    alter table public.health_consultations
      add constraint health_consultations_medical_record_fk
      foreign key (medical_record_id) references public.medical_records (id) on delete set null;
  end if;
end $$;

create index if not exists health_consultations_medical_record_idx
  on public.health_consultations (medical_record_id)
  where medical_record_id is not null;

notify pgrst, 'reload schema';
