-- Migration: Standardize SDAO referrals receiving_office values
-- Created: 2026-05-13
-- Purpose: Fix SDAO referrals not showing in HSO by standardizing office values

-- ============================================
-- 1. STANDARDIZE receiving_office VALUES
-- ============================================

-- Map display text to enum values
UPDATE public.sdao_referrals
SET receiving_office = 'health'
WHERE receiving_office ILIKE '%Health%' 
  OR receiving_office ILIKE '%HSO%'
  OR receiving_office ILIKE '%health%'
  OR receiving_office = 'Health Services (inter-office)';

UPDATE public.sdao_referrals
SET receiving_office = 'discipline'
WHERE receiving_office ILIKE '%Discipline%'
  OR receiving_office ILIKE '%DO%'
  OR receiving_office = 'Discipline Office (inter-office)';

UPDATE public.sdao_referrals
SET receiving_office = 'sdao'
WHERE receiving_office ILIKE '%Development%'
  OR receiving_office ILIKE '%SDAO%'
  OR receiving_office ILIKE '%Student Development%';

UPDATE public.sdao_referrals
SET receiving_office = 'counseling'
WHERE receiving_office ILIKE '%Counseling%'
  OR receiving_office ILIKE '%Guidance%';

-- Standardize to lowercase
UPDATE public.sdao_referrals 
SET receiving_office = LOWER(TRIM(receiving_office))
WHERE receiving_office IS NOT NULL;

UPDATE public.sdao_referrals 
SET referring_office = LOWER(TRIM(referring_office))
WHERE referring_office IS NOT NULL;

-- ============================================
-- 2. ENSURE DISCIPLINE_REFERRALS OFFICE VALUES ALSO STANDARDIZED
-- ============================================

UPDATE public.discipline_referrals
SET target_office = 'health'
WHERE target_office ILIKE '%health%' OR target_office ILIKE '%hso%';

UPDATE public.discipline_referrals
SET target_office = 'sdao'
WHERE target_office ILIKE '%development%' OR target_office ILIKE '%sdao%';

UPDATE public.discipline_referrals
SET target_office = 'discipline'
WHERE target_office ILIKE '%discipline%' OR target_office ILIKE '%do%';

UPDATE public.discipline_referrals
SET target_office = 'counseling'
WHERE target_office ILIKE '%counseling%' OR target_office ILIKE '%guidance%';

-- Lowercase and trim
UPDATE public.discipline_referrals 
SET target_office = LOWER(TRIM(target_office))
WHERE target_office IS NOT NULL;

UPDATE public.discipline_referrals 
SET referring_office = LOWER(TRIM(referring_office))
WHERE referring_office IS NOT NULL;

-- ============================================
-- 3. CREATE INDEX FOR RECEIVING_OFFICE QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS sdao_referrals_receiving_office_idx 
  ON public.sdao_referrals(receiving_office);

CREATE INDEX IF NOT EXISTS sdao_referrals_receiving_office_date_idx 
  ON public.sdao_referrals(receiving_office, created_at DESC);

-- ============================================
-- 4. VERIFY STANDARDIZATION
-- ============================================

-- Check distinct values (should only show: health, discipline, sdao, counseling)
-- SELECT DISTINCT receiving_office FROM public.sdao_referrals;
-- SELECT DISTINCT target_office FROM public.discipline_referrals;
