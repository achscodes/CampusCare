-- Migration: Add missing office columns to discipline_referrals
-- Created: 2026-05-13
-- Purpose: Fix DO→SDAO referral creation by adding target_office and referring_office columns

-- Add missing columns to discipline_referrals table
ALTER TABLE public.discipline_referrals
ADD COLUMN IF NOT EXISTS referring_office TEXT DEFAULT 'discipline',
ADD COLUMN IF NOT EXISTS target_office TEXT,
ADD COLUMN IF NOT EXISTS inter_office_document_request_id UUID;

-- Add comment
COMMENT ON COLUMN public.discipline_referrals.referring_office IS 'Office that created the referral (default: discipline)';
COMMENT ON COLUMN public.discipline_referrals.target_office IS 'Office receiving the referral (e.g., development, health)';
COMMENT ON COLUMN public.discipline_referrals.inter_office_document_request_id IS 'Optional FK to inter-office document request';

-- Create index for target_office lookups
CREATE INDEX IF NOT EXISTS discipline_referrals_target_office_idx 
  ON public.discipline_referrals (target_office);

CREATE INDEX IF NOT EXISTS discipline_referrals_office_date_idx 
  ON public.discipline_referrals (referring_office, target_office, referral_date DESC);

-- Standardize existing office values to match enum values
UPDATE public.discipline_referrals 
SET target_office = LOWER(TRIM(target_office))
WHERE target_office IS NOT NULL;

-- Populate missing target_office values (assume old referrals were to health if not specified)
UPDATE public.discipline_referrals
SET target_office = 'health'
WHERE target_office IS NULL OR target_office = '';
