-- ============================================================
-- CONSOLIDATED REFERRAL FIX - Run all at once in Supabase
-- ============================================================
-- This script fixes all referral visibility issues

-- ============================================================
-- STEP 1: Add missing columns to discipline_referrals
-- ============================================================
ALTER TABLE public.discipline_referrals
ADD COLUMN IF NOT EXISTS referring_office TEXT DEFAULT 'discipline',
ADD COLUMN IF NOT EXISTS target_office TEXT DEFAULT 'health',
ADD COLUMN IF NOT EXISTS inter_office_document_request_id UUID;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS discipline_referrals_target_office_idx 
  ON public.discipline_referrals(target_office);

CREATE INDEX IF NOT EXISTS sdao_referrals_receiving_office_idx 
  ON public.sdao_referrals(receiving_office);

-- ============================================================
-- STEP 2: Standardize ALL office values to lowercase enum
-- ============================================================

-- For discipline_referrals table
UPDATE public.discipline_referrals 
SET target_office = LOWER(TRIM(COALESCE(target_office, 'health')))
WHERE target_office IS NOT NULL;

UPDATE public.discipline_referrals
SET target_office = 'health'
WHERE target_office IS NULL OR target_office = '';

UPDATE public.discipline_referrals 
SET referring_office = LOWER(TRIM(COALESCE(referring_office, 'discipline')));

-- For sdao_referrals table - CRITICAL FIX
-- Map all variations to standard enum values

-- Map "Health Services..." to 'health'
UPDATE public.sdao_referrals
SET receiving_office = 'health'
WHERE receiving_office ILIKE '%health%' 
   OR receiving_office ILIKE '%hso%'
   OR receiving_office ILIKE '%Health Services%';

-- Map "development", "sdao", "Student Development..." to 'sdao'
UPDATE public.sdao_referrals
SET receiving_office = 'sdao'
WHERE receiving_office ILIKE '%sdao%' 
   OR receiving_office ILIKE '%development%'
   OR receiving_office ILIKE '%Student Development%';

-- Map "discipline", "DO", "Discipline Office..." to 'discipline'
UPDATE public.sdao_referrals
SET receiving_office = 'discipline'
WHERE receiving_office ILIKE '%discipline%' 
   OR receiving_office ILIKE '%do%'
   OR receiving_office ILIKE '%Discipline Office%';

-- Map "counseling", "guidance" to 'counseling'
UPDATE public.sdao_referrals
SET receiving_office = 'counseling'
WHERE receiving_office ILIKE '%counseling%' 
   OR receiving_office ILIKE '%guidance%';

-- Ensure all office values are lowercase
UPDATE public.sdao_referrals SET receiving_office = LOWER(receiving_office)
WHERE receiving_office IS NOT NULL;

UPDATE public.sdao_referrals SET referring_office = LOWER(referring_office)
WHERE referring_office IS NOT NULL;

UPDATE public.discipline_referrals SET referring_office = LOWER(referring_office)
WHERE referring_office IS NOT NULL;

-- ============================================================
-- STEP 3: Create views for easy cross-office queries
-- ============================================================

-- Drop old views if they exist
DROP VIEW IF EXISTS hso_discipline_referrals CASCADE;
DROP VIEW IF EXISTS hso_sdao_referrals CASCADE;
DROP VIEW IF EXISTS sdao_incoming_from_do CASCADE;
DROP VIEW IF EXISTS do_outgoing_referrals CASCADE;

-- HSO can see discipline referrals sent to them
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

-- HSO can see SDAO referrals sent to them - THIS IS THE KEY FIX
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

-- SDAO can see incoming referrals from Discipline Office
CREATE VIEW public.sdao_incoming_from_do AS
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
WHERE target_office = 'sdao'
  AND status NOT IN ('cancelled', 'rejected', 'declined', 'Cancelled', 'Rejected', 'Declined')
ORDER BY referral_date DESC;

GRANT SELECT ON public.sdao_incoming_from_do TO authenticated;

-- DO can see referrals they sent
CREATE VIEW public.do_outgoing_referrals AS
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

GRANT SELECT ON public.do_outgoing_referrals TO authenticated;

-- ============================================================
-- VERIFICATION QUERIES (Run these to check it worked)
-- ============================================================
/*
-- Check 1: Verify office values are standardized
SELECT 'SDAO referrals - office values' as check_type, 
       ARRAY_AGG(DISTINCT receiving_office ORDER BY receiving_office) as values
FROM sdao_referrals 
WHERE receiving_office IS NOT NULL;

SELECT 'DO referrals - target values' as check_type,
       ARRAY_AGG(DISTINCT target_office ORDER BY target_office) as values
FROM discipline_referrals
WHERE target_office IS NOT NULL;

-- Check 2: Verify HSO can see SDAO referrals
SELECT COUNT(*) as sdao_referrals_to_hso
FROM sdao_referrals
WHERE receiving_office = 'health';

-- Check 3: Verify SDAO can see DO referrals
SELECT COUNT(*) as do_referrals_to_sdao
FROM discipline_referrals
WHERE target_office = 'sdao';

-- Check 4: Verify views exist and return data
SELECT COUNT(*) as count FROM hso_sdao_referrals;
SELECT COUNT(*) as count FROM hso_discipline_referrals;
SELECT COUNT(*) as count FROM sdao_incoming_from_do;
*/

-- ============================================================
-- Done! Migrations complete.
-- ============================================================
