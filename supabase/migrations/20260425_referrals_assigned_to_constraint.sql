-- Migration: Add constraint that assigned_to only works with scheduled status
-- Also adds explicit reference to profiles table

-- ============================================
-- 1. DROP EXISTING CONSTRAINT AND UPDATE COLUMN
-- ============================================

-- Remove existing FK if it exists (to recreate)
ALTER TABLE public.referrals 
    DROP CONSTRAINT IF EXISTS referrals_assigned_to_fkey;

-- Add explicit reference to profiles table
-- Note: profiles.id IS auth.users.id, so data integrity is maintained
ALTER TABLE public.referrals 
    ADD CONSTRAINT referrals_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) 
    ON DELETE SET NULL;

-- ============================================
-- 2. ADD CONSTRAINT: assigned_to only when status = 'scheduled'
-- ============================================

ALTER TABLE public.referrals 
    DROP CONSTRAINT IF EXISTS check_assigned_to_requires_scheduled;

ALTER TABLE public.referrals 
    ADD CONSTRAINT check_assigned_to_requires_scheduled 
    CHECK (
        (assigned_to IS NULL) OR 
        (assigned_to IS NOT NULL AND status = 'scheduled')
    );

-- ============================================
-- 3. TRIGGER: Auto-clear assigned_to if status changes away from scheduled
-- ============================================

CREATE OR REPLACE FUNCTION public.clear_assigned_on_unschedule()
RETURNS TRIGGER AS $$
BEGIN
    -- If status is changing FROM 'scheduled' TO something else
    -- AND assigned_to is set, clear it
    IF OLD.status = 'scheduled' AND NEW.status != 'scheduled' AND NEW.assigned_to IS NOT NULL THEN
        NEW.assigned_to := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clear_assigned_on_unschedule ON public.referrals;

CREATE TRIGGER trigger_clear_assigned_on_unschedule
    BEFORE UPDATE ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.clear_assigned_on_unschedule();

-- ============================================
-- 4. COMMENTS
-- ============================================

COMMENT ON COLUMN public.referrals.referred_by IS 'Staff member who created the referral (references auth.users)';
COMMENT ON COLUMN public.referrals.assigned_to IS 'Staff member assigned to handle the case. Can ONLY be set when status = scheduled. References profiles table.';

-- ============================================
-- SUMMARY
-- ============================================
-- 
-- How it works:
-- 
-- 1. REFERRAL CREATED:
--    - referred_by = Staff who created it (set automatically)
--    - assigned_to = NULL (can't assign until scheduled)
--    - status = 'pending' or 'in_review'
-- 
-- 2. ADMIN SCHEDULES APPOINTMENT:
--    - status = 'scheduled' 
--    - assigned_to = Counselor/Staff who will handle it (MUST be set now)
--    - appointment_date = When the meeting is
--    - appointment_location = Where
-- 
-- 3. IF STATUS CHANGES (e.g., back to pending):
--    - Trigger automatically clears assigned_to
--    - Prevents having an assigned staff on non-scheduled referrals
--
-- This ensures data integrity: you can ONLY assign staff when 
-- there's actually a scheduled appointment.
