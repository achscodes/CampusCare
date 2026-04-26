-- =============================================================================
-- MANUAL ONLY — Run in Supabase Dashboard → SQL Editor when you want to wipe
-- Discipline Office data. This file is NOT a migration (it does not auto-run).
--
-- Clears:
--   • public.discipline_case_conferences
--   • public.discipline_sanctions
--   • public.discipline_referrals
--   • public.discipline_student_records
--   • public.discipline_document_requests
--   • public.discipline_cases
--   • public.inter_office_document_requests rows where DO is requesting or target
--     office (keys: discipline / health / development). Other offices’ inter-office
--     rows are kept.
--
-- WARNING: Irreversible. Review in a branch/staging first if unsure.
-- =============================================================================

begin;

-- Break optional links between unified doc requests and DO referrals (shared FKs).
update public.inter_office_document_requests
set discipline_referral_id = null
where discipline_referral_id is not null;

update public.discipline_referrals
set inter_office_document_request_id = null
where inter_office_document_request_id is not null;

-- Remove document requests involving the Discipline Office (shared table).
delete from public.inter_office_document_requests
where requesting_office = 'discipline'
   or target_office = 'discipline';

-- All discipline_* tables in one truncate (FKs satisfied in a single operation).
truncate table
  public.discipline_case_conferences,
  public.discipline_sanctions,
  public.discipline_referrals,
  public.discipline_student_records,
  public.discipline_document_requests,
  public.discipline_cases
restart identity cascade;

commit;

-- Optional: reload PostgREST schema cache if your project requires it.
-- notify pgrst, 'reload schema';
