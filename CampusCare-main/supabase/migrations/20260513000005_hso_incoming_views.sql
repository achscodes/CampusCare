-- Migration: Create HSO Incoming Referrals views from all offices
-- Created: 2026-05-13
-- Purpose: Simplify HSO querying of cross-office referrals

-- ============================================
-- 1. HSO INCOMING REFERRALS FROM SDAO VIEW
-- ============================================

DROP VIEW IF EXISTS hso_incoming_sdao_referrals CASCADE;

CREATE VIEW public.hso_incoming_sdao_referrals AS
SELECT
  r.id,
  r.reference_id,
  r.student_id,
  r.student_name,
  r.email,
  r.phone,
  r.program,
  r.receiving_office as target_office,
  'sdao' as from_office,
  r.reason,
  r.development_details as details,
  r.urgency as priority,
  r.status,
  r.status_detail,
  r.created_by as referred_by,
  r.created_at,
  r.updated_at,
  r.attachments,
  'sdao' as referral_source
FROM public.sdao_referrals r
WHERE r.receiving_office = 'health'
  AND r.status NOT IN ('cancelled', 'rejected', 'declined');

GRANT SELECT ON hso_incoming_sdao_referrals TO authenticated;

-- ============================================
-- 2. HSO INCOMING REFERRALS FROM DISCIPLINE VIEW
-- ============================================

DROP VIEW IF EXISTS hso_incoming_discipline_referrals CASCADE;

CREATE VIEW public.hso_incoming_discipline_referrals AS
SELECT
  r.id,
  r.reference_id::text,
  r.student_id::uuid,
  r.student_name,
  null::text as email,
  null::text as phone,
  null::text as program,
  r.target_office,
  'discipline' as from_office,
  r.reason,
  r.evidence::jsonb as details,
  r.status::text as priority,
  r.status,
  null::text as status_detail,
  null::uuid as referred_by,
  r.created_at,
  r.updated_at,
  r.evidence as attachments,
  'discipline' as referral_source
FROM public.discipline_referrals r
WHERE r.target_office = 'health'
  AND r.status NOT IN ('Cancelled', 'Rejected', 'Declined');

GRANT SELECT ON hso_incoming_discipline_referrals TO authenticated;

-- ============================================
-- 3. HSO UNIFIED INCOMING REFERRALS VIEW
-- ============================================

DROP VIEW IF EXISTS hso_incoming_referrals_unified CASCADE;

CREATE VIEW public.hso_incoming_referrals_unified AS
SELECT
  'SDAO' as source_office,
  r.id,
  r.reference_id,
  r.student_id,
  r.student_name,
  r.email,
  r.phone,
  r.program,
  r.reason,
  r.details,
  r.priority,
  r.status,
  r.created_at,
  r.updated_at
FROM public.hso_incoming_sdao_referrals r
UNION ALL
SELECT
  'Discipline Office' as source_office,
  r.id::text,
  r.reference_id,
  r.student_id,
  r.student_name,
  r.email,
  r.phone,
  r.program,
  r.reason,
  r.details,
  r.priority,
  r.status,
  r.created_at,
  r.updated_at
FROM public.hso_incoming_discipline_referrals r
ORDER BY created_at DESC;

GRANT SELECT ON hso_incoming_referrals_unified TO authenticated;

-- ============================================
-- 4. VERIFICATION QUERY
-- ============================================

-- After running this migration, test with:
-- SELECT * FROM hso_incoming_sdao_referrals;
-- SELECT * FROM hso_incoming_discipline_referrals;
-- SELECT * FROM hso_incoming_referrals_unified;
