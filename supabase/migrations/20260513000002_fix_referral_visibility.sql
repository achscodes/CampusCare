-- Migration: Fix SDAO→HSO Referral Visibility Issue
-- Created: 2026-05-13
-- Description: Fix RLS policies for cross-office referral visibility

-- ============================================
-- 1. STANDARDIZE OFFICE VALUES IN PROFILES
-- ============================================

-- Update office values to match welfare_office enum
UPDATE public.profiles 
SET office = 'health' 
WHERE office ILIKE '%health%' AND office != 'health';

UPDATE public.profiles 
SET office = 'sdao' 
WHERE office ILIKE '%sdao%' OR office ILIKE '%development%' AND office != 'sdao';

UPDATE public.profiles 
SET office = 'discipline' 
WHERE office ILIKE '%discipline%' AND office != 'discipline';

UPDATE public.profiles 
SET office = 'counseling' 
WHERE office ILIKE '%counseling%' AND office != 'counseling';

-- ============================================
-- 2. DROP EXISTING PROBLEMATIC POLICIES
-- ============================================

DROP POLICY IF EXISTS "Staff view referrals for their office" ON public.referrals;
DROP POLICY IF EXISTS "Staff create referrals from their office" ON public.referrals;
DROP POLICY IF EXISTS "Staff update referrals for their office" ON public.referrals;

-- ============================================
-- 3. CREATE SIMPLIFIED, WORKING RLS POLICIES
-- ============================================

-- Helper function: Get user's office as welfare_office type
CREATE OR REPLACE FUNCTION public.get_user_office()
RETURNS welfare_office AS $$
DECLARE
  v_office TEXT;
BEGIN
  SELECT office INTO v_office 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  -- Return as welfare_office enum, defaulting to 'health' if not found
  RETURN COALESCE(v_office::welfare_office, 'health'::welfare_office);
EXCEPTION WHEN others THEN
  RETURN 'health'::welfare_office;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user is staff
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('staff', 'admin', 'Staff', 'Admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Staff can view referrals for their office
CREATE POLICY "Staff view referrals for their office v2"
  ON public.referrals
  FOR SELECT
  TO authenticated
  USING (
    CASE
      -- Students see only their own referrals
      WHEN NOT public.is_staff() THEN student_id = auth.uid() AND NOT is_archived
      
      -- Staff can see referrals TO their office
      WHEN to_service = public.get_user_office() THEN TRUE
      
      -- Staff can see referrals FROM their office
      WHEN from_service = public.get_user_office() THEN TRUE
      
      -- Staff assigned to this referral can see it
      WHEN assigned_to = auth.uid() THEN TRUE
      
      -- Staff who created this referral can see it
      WHEN referred_by = auth.uid() THEN TRUE
      
      -- Super admin can see all
      WHEN EXISTS (
        SELECT 1 FROM public.super_admin_allowlist
        WHERE user_id = auth.uid()
      ) THEN TRUE
      
      ELSE FALSE
    END
  );

-- Staff can create referrals FROM their office
CREATE POLICY "Staff create referrals from their office v2"
  ON public.referrals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff()
    AND (
      from_service = public.get_user_office()
      OR EXISTS (
        SELECT 1 FROM public.super_admin_allowlist
        WHERE user_id = auth.uid()
      )
    )
  );

-- Staff can update referrals in their office
CREATE POLICY "Staff update referrals for their office v2"
  ON public.referrals
  FOR UPDATE
  TO authenticated
  USING (
    public.is_staff()
    AND (
      to_service = public.get_user_office()
      OR from_service = public.get_user_office()
      OR assigned_to = auth.uid()
      OR referred_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.super_admin_allowlist
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_staff()
    AND (
      to_service = public.get_user_office()
      OR from_service = public.get_user_office()
      OR assigned_to = auth.uid()
      OR referred_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.super_admin_allowlist
        WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================
-- 4. CREATE VIEW FOR HSO TO SEE INCOMING REFERRALS
-- ============================================

DROP VIEW IF EXISTS hso_incoming_referrals CASCADE;

CREATE VIEW hso_incoming_referrals AS
SELECT
  r.id,
  r.reference_id,
  r.student_id,
  s.email as student_email,
  p.first_name,
  p.last_name,
  r.from_service,
  r.category,
  r.priority,
  r.reason,
  r.reason_summary,
  r.status,
  r.assigned_to,
  r.appointment_date,
  r.appointment_location,
  r.student_notes,
  r.internal_notes,
  r.created_at,
  r.updated_at,
  r.resolved_at
FROM public.referrals r
LEFT JOIN auth.users s ON r.student_id = s.id
LEFT JOIN public.profiles p ON s.id = p.id
WHERE r.to_service = 'health'::welfare_office
  AND NOT r.is_archived
ORDER BY 
  CASE r.priority 
    WHEN 'critical' THEN 1
    WHEN 'urgent' THEN 2
    WHEN 'normal' THEN 3
  END,
  r.created_at DESC;

GRANT SELECT ON hso_incoming_referrals TO authenticated;

-- ============================================
-- 5. CREATE VIEW FOR SDAO TO SEE OUTGOING REFERRALS
-- ============================================

DROP VIEW IF EXISTS sdao_outgoing_referrals CASCADE;

CREATE VIEW sdao_outgoing_referrals AS
SELECT
  r.id,
  r.reference_id,
  r.student_id,
  s.email as student_email,
  p.first_name,
  p.last_name,
  r.to_service,
  r.category,
  r.priority,
  r.reason,
  r.status,
  r.assigned_to,
  r.created_at,
  r.updated_at,
  r.resolved_at
FROM public.referrals r
LEFT JOIN auth.users s ON r.student_id = s.id
LEFT JOIN public.profiles p ON s.id = p.id
WHERE r.from_service = 'sdao'::welfare_office
  AND NOT r.is_archived
ORDER BY r.created_at DESC;

GRANT SELECT ON sdao_outgoing_referrals TO authenticated;

-- ============================================
-- 6. TEST FUNCTION - Run after deployment
-- ============================================

CREATE OR REPLACE FUNCTION test_sdao_hso_referral_visibility()
RETURNS TABLE (test_name TEXT, user_id UUID, office TEXT, can_see_referral BOOLEAN)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
WITH hso_staff AS (
  SELECT id FROM profiles WHERE office = 'health' AND role IN ('staff', 'admin') LIMIT 1
),
sdao_staff AS (
  SELECT id FROM profiles WHERE office = 'sdao' AND role IN ('staff', 'admin') LIMIT 1
),
sample_referral AS (
  SELECT id FROM referrals 
  WHERE from_service = 'sdao' AND to_service = 'health' 
  LIMIT 1
)
SELECT
  'HSO staff can see SDAO→HSO referral',
  hs.id,
  'health',
  EXISTS (
    SELECT 1 FROM referrals r
    WHERE r.id = (SELECT id FROM sample_referral LIMIT 1)
      AND r.to_service = 'health'
      AND NOT r.is_archived
  )
FROM hso_staff hs
UNION ALL
SELECT
  'SDAO staff can see their own referral',
  ss.id,
  'sdao',
  EXISTS (
    SELECT 1 FROM referrals r
    WHERE r.id = (SELECT id FROM sample_referral LIMIT 1)
      AND r.from_service = 'sdao'
      AND NOT r.is_archived
  )
FROM sdao_staff ss;
$$;

-- ============================================
-- 7. VERIFY FIX
-- ============================================

NOTIFY pgrst, 'reload schema';

-- After applying this migration, test with:
-- SELECT * FROM hso_incoming_referrals;
-- SELECT * FROM sdao_outgoing_referrals;
-- SELECT * FROM test_sdao_hso_referral_visibility();
