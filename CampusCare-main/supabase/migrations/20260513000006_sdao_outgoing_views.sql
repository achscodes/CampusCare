-- Migration: Create SDAO Outgoing Referrals views 
-- Created: 2026-05-13
-- Purpose: Simplify SDAO querying of outgoing cross-office referrals

-- ============================================
-- 1. SDAO OUTGOING REFERRALS TO HSO VIEW
-- ============================================

DROP VIEW IF EXISTS sdao_outgoing_to_hso CASCADE;

CREATE VIEW public.sdao_outgoing_to_hso AS
SELECT
  r.id,
  r.reference_id,
  r.student_id,
  r.student_name,
  r.email,
  r.phone,
  r.program,
  'health' as target_office,
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
  'hso' as referral_destination
FROM public.sdao_referrals r
WHERE r.receiving_office = 'health'
  AND r.status NOT IN ('cancelled', 'rejected', 'declined');

GRANT SELECT ON sdao_outgoing_to_hso TO authenticated;

-- ============================================
-- 2. SDAO OUTGOING REFERRALS TO DISCIPLINE VIEW
-- ============================================

DROP VIEW IF EXISTS sdao_outgoing_to_discipline CASCADE;

CREATE VIEW public.sdao_outgoing_to_discipline AS
SELECT
  r.id,
  r.reference_id,
  r.student_id,
  r.student_name,
  r.email,
  r.phone,
  r.program,
  'discipline' as target_office,
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
  'discipline' as referral_destination
FROM public.sdao_referrals r
WHERE r.receiving_office = 'discipline'
  AND r.status NOT IN ('cancelled', 'rejected', 'declined');

GRANT SELECT ON sdao_outgoing_to_discipline TO authenticated;

-- ============================================
-- 3. SDAO UNIFIED OUTGOING REFERRALS VIEW
-- ============================================

DROP VIEW IF EXISTS sdao_outgoing_referrals_unified CASCADE;

CREATE VIEW public.sdao_outgoing_referrals_unified AS
SELECT
  'Health Services' as destination_office,
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
FROM public.sdao_outgoing_to_hso r
UNION ALL
SELECT
  'Discipline Office' as destination_office,
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
FROM public.sdao_outgoing_to_discipline r
ORDER BY created_at DESC;

GRANT SELECT ON sdao_outgoing_referrals_unified TO authenticated;

-- ============================================
-- 4. VERIFICATION QUERIES
-- ============================================

-- Test with:
-- SELECT * FROM sdao_outgoing_to_hso;
-- SELECT * FROM sdao_outgoing_to_discipline;
-- SELECT * FROM sdao_outgoing_referrals_unified;
