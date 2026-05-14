-- Migration: Complete Referral System Fix for HSO, DO, SDAO
-- Created: 2026-05-13
-- Purpose: Consolidate all referral tables and fix visibility issues

-- ============================================
-- 1. VERIFY TABLE STRUCTURES
-- ============================================

-- Ensure discipline_referrals has all required columns
ALTER TABLE public.discipline_referrals
ADD COLUMN IF NOT EXISTS referring_office TEXT DEFAULT 'discipline',
ADD COLUMN IF NOT EXISTS target_office TEXT DEFAULT 'health',
ADD COLUMN IF NOT EXISTS inter_office_document_request_id UUID;

-- Ensure sdao_referrals has all required columns
ALTER TABLE public.sdao_referrals
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';

-- ============================================
-- 2. STANDARDIZE ALL OFFICE VALUES TO LOWERCASE
-- ============================================

-- For discipline_referrals
UPDATE public.discipline_referrals SET target_office = LOWER(COALESCE(NULLIF(target_office, ''), 'health'));
UPDATE public.discipline_referrals SET referring_office = LOWER(COALESCE(NULLIF(referring_office, ''), 'discipline'));

-- For sdao_referrals - map all variations to standard enum values
UPDATE public.sdao_referrals
SET receiving_office = 'health'
WHERE receiving_office ILIKE '%health%' OR receiving_office ILIKE '%hso%'
  OR receiving_office ILIKE '%Health Services%';

UPDATE public.sdao_referrals
SET receiving_office = 'discipline'
WHERE receiving_office ILIKE '%discipline%' OR receiving_office ILIKE '%do%'
  OR receiving_office ILIKE '%Discipline Office%';

UPDATE public.sdao_referrals
SET receiving_office = 'sdao'
WHERE receiving_office ILIKE '%sdao%' OR receiving_office ILIKE '%development%'
  OR receiving_office ILIKE '%Student Development%';

UPDATE public.sdao_referrals
SET receiving_office = 'counseling'
WHERE receiving_office ILIKE '%counseling%' OR receiving_office ILIKE '%guidance%';

-- Standardize to lowercase
UPDATE public.sdao_referrals SET receiving_office = LOWER(receiving_office)
  WHERE receiving_office IS NOT NULL;
UPDATE public.sdao_referrals SET referring_office = LOWER(referring_office)
  WHERE referring_office IS NOT NULL;

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS discipline_referrals_target_office_idx 
  ON public.discipline_referrals(target_office) 
  WHERE target_office IS NOT NULL;

CREATE INDEX IF NOT EXISTS sdao_referrals_receiving_office_idx 
  ON public.sdao_referrals(receiving_office) 
  WHERE receiving_office IS NOT NULL;

-- ============================================
-- 4. DROP OLD PROBLEMATIC VIEWS
-- ============================================

DROP VIEW IF EXISTS hso_incoming_referrals_unified CASCADE;
DROP VIEW IF EXISTS hso_incoming_sdao_referrals CASCADE;
DROP VIEW IF EXISTS hso_incoming_discipline_referrals CASCADE;
DROP VIEW IF EXISTS sdao_outgoing_referrals_unified CASCADE;
DROP VIEW IF EXISTS sdao_outgoing_to_hso CASCADE;
DROP VIEW IF EXISTS sdao_outgoing_to_discipline CASCADE;

-- ============================================
-- 5. CREATE SIMPLE, RELIABLE VIEWS
-- ============================================

-- HSO can see discipline referrals sent to health
CREATE VIEW public.hso_discipline_referrals AS
SELECT
  id,
  student_name,
  student_id,
  reason,
  status,
  'discipline' as source_office,
  target_office,
  referral_date as created_at,
  updated_at
FROM public.discipline_referrals
WHERE target_office = 'health'
  AND status NOT IN ('cancelled', 'rejected', 'declined', 'Cancelled', 'Rejected', 'Declined')
ORDER BY referral_date DESC;

GRANT SELECT ON public.hso_discipline_referrals TO authenticated;

-- HSO can see SDAO referrals received
CREATE VIEW public.hso_sdao_referrals AS
SELECT
  id,
  student_name,
  student_id,
  reason,
  status,
  'sdao' as source_office,
  receiving_office,
  created_at,
  updated_at
FROM public.sdao_referrals
WHERE receiving_office = 'health'
  AND status NOT IN ('cancelled', 'rejected', 'declined', 'Cancelled', 'Rejected', 'Declined')
ORDER BY created_at DESC;

GRANT SELECT ON public.hso_sdao_referrals TO authenticated;

-- SDAO can see their outgoing referrals
CREATE VIEW public.sdao_outgoing_referrals AS
SELECT
  id,
  student_name,
  student_id,
  reason,
  status,
  receiving_office as target_office,
  'sdao' as source_office,
  created_at,
  updated_at
FROM public.sdao_referrals
WHERE status NOT IN ('cancelled', 'rejected', 'declined', 'Cancelled', 'Rejected', 'Declined')
ORDER BY created_at DESC;

GRANT SELECT ON public.sdao_outgoing_referrals TO authenticated;

-- DO can see discipline referrals they sent
CREATE VIEW public.do_sent_referrals AS
SELECT
  id,
  student_name,
  student_id,
  reason,
  status,
  target_office,
  'discipline' as source_office,
  referral_date as created_at,
  updated_at
FROM public.discipline_referrals
WHERE referring_office = 'discipline'
  AND status NOT IN ('cancelled', 'rejected', 'declined', 'Cancelled', 'Rejected', 'Declined')
ORDER BY referral_date DESC;

GRANT SELECT ON public.do_sent_referrals TO authenticated;

-- ============================================
-- 6. VERIFICATION QUERIES (Run manually after migration)
-- ============================================

/*
SELECT 'Discipline referrals to health' as check_type, COUNT(*) as count 
FROM hso_discipline_referrals;

SELECT 'SDAO referrals to health' as check_type, COUNT(*) as count 
FROM hso_sdao_referrals;

SELECT 'SDAO outgoing referrals' as check_type, COUNT(*) as count 
FROM sdao_outgoing_referrals;

SELECT DISTINCT receiving_office FROM sdao_referrals WHERE receiving_office IS NOT NULL;
SELECT DISTINCT target_office FROM discipline_referrals WHERE target_office IS NOT NULL;
SELECT DISTINCT referring_office FROM discipline_referrals WHERE referring_office IS NOT NULL;
*/
