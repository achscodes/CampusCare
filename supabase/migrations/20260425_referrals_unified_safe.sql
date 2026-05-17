-- Migration: Unified referrals table with RLS (Safe - handles existing objects)
-- Created: 2026-04-25

-- ============================================
-- 1. CREATE ENUM TYPES (IF NOT EXISTS)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_status') THEN
        CREATE TYPE referral_status AS ENUM (
            'pending', 'in_review', 'scheduled', 'completed', 'cancelled'
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'welfare_office') THEN
        CREATE TYPE welfare_office AS ENUM (
            'health', 'counseling', 'sdao', 'discipline'
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_category') THEN
        CREATE TYPE referral_category AS ENUM (
            'mental_health', 'physical_health', 'behavioral', 'academic', 
            'family_issue', 'bullying', 'disciplinary', 'financial', 'other'
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_priority') THEN
        CREATE TYPE referral_priority AS ENUM ('normal', 'urgent', 'critical');
    END IF;
END $$;

-- ============================================
-- 2. CREATE UNIFIED REFERRALS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id TEXT NOT NULL UNIQUE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    from_service welfare_office NOT NULL,
    to_service welfare_office NOT NULL,
    status referral_status NOT NULL DEFAULT 'pending',
    category referral_category NOT NULL,
    priority referral_priority NOT NULL DEFAULT 'normal',
    reason TEXT NOT NULL,
    reason_summary TEXT,
    referred_by UUID REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    appointment_date TIMESTAMPTZ,
    appointment_location TEXT,
    student_notes TEXT,
    internal_notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    is_archived BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE public.referrals IS 'Unified referrals table for all welfare offices. Students see limited fields via RLS.';

-- ============================================
-- 3. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_referrals_student_id ON public.referrals(student_id);
CREATE INDEX IF NOT EXISTS idx_referrals_student_status ON public.referrals(student_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_from_service ON public.referrals(from_service);
CREATE INDEX IF NOT EXISTS idx_referrals_to_service ON public.referrals(to_service);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_priority ON public.referrals(priority) WHERE priority IN ('urgent', 'critical');
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON public.referrals(created_at DESC);

-- ============================================
-- 4. ENABLE RLS
-- ============================================

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. DROP EXISTING POLICIES (to recreate safely)
-- ============================================

DROP POLICY IF EXISTS "Students view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Staff view referrals for their office" ON public.referrals;
DROP POLICY IF EXISTS "Staff create referrals from their office" ON public.referrals;
DROP POLICY IF EXISTS "Staff update referrals for their office" ON public.referrals;
DROP POLICY IF EXISTS "Only super admins can delete referrals" ON public.referrals;

-- ============================================
-- 6. CREATE RLS POLICIES
-- ============================================

-- Students: can only see their own active referrals
CREATE POLICY "Students view own referrals"
    ON public.referrals
    FOR SELECT
    TO authenticated
    USING (student_id = auth.uid() AND is_archived = false);

-- Staff: view referrals they created, are assigned to, or in their office
CREATE POLICY "Staff view referrals for their office"
    ON public.referrals
    FOR SELECT
    TO authenticated
    USING (
        referred_by = auth.uid()
        OR assigned_to = auth.uid()
        OR to_service IN (
            SELECT office::welfare_office FROM public.profiles 
            WHERE id = auth.uid() AND user_role IN ('staff', 'admin') AND account_status = 'approved'
        )
        OR from_service IN (
            SELECT office::welfare_office FROM public.profiles 
            WHERE id = auth.uid() AND user_role IN ('staff', 'admin') AND account_status = 'approved'
        )
        OR EXISTS (SELECT 1 FROM public.super_admin_allowlist WHERE user_id = auth.uid())
    );

-- Staff: create referrals from their office
CREATE POLICY "Staff create referrals from their office"
    ON public.referrals
    FOR INSERT
    TO authenticated
    WITH CHECK (
        from_service IN (
            SELECT office::welfare_office FROM public.profiles 
            WHERE id = auth.uid() AND user_role IN ('staff', 'admin') AND account_status = 'approved'
        )
        OR EXISTS (SELECT 1 FROM public.super_admin_allowlist WHERE user_id = auth.uid())
    );

-- Staff: update referrals in their scope
CREATE POLICY "Staff update referrals for their office"
    ON public.referrals
    FOR UPDATE
    TO authenticated
    USING (
        referred_by = auth.uid()
        OR assigned_to = auth.uid()
        OR to_service IN (
            SELECT office::welfare_office FROM public.profiles 
            WHERE id = auth.uid() AND user_role IN ('staff', 'admin') AND account_status = 'approved'
        )
        OR EXISTS (SELECT 1 FROM public.super_admin_allowlist WHERE user_id = auth.uid())
    )
    WITH CHECK (
        referred_by = auth.uid()
        OR assigned_to = auth.uid()
        OR to_service IN (
            SELECT office::welfare_office FROM public.profiles 
            WHERE id = auth.uid() AND user_role IN ('staff', 'admin') AND account_status = 'approved'
        )
        OR EXISTS (SELECT 1 FROM public.super_admin_allowlist WHERE user_id = auth.uid())
    );

-- Only super admins can delete
CREATE POLICY "Only super admins can delete referrals"
    ON public.referrals
    FOR DELETE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.super_admin_allowlist WHERE user_id = auth.uid()));

-- ============================================
-- 7. TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS referrals_updated_at ON public.referrals;
CREATE TRIGGER referrals_updated_at
    BEFORE UPDATE ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Auto-generate reference_id
CREATE OR REPLACE FUNCTION public.generate_referral_reference_id()
RETURNS TRIGGER AS $$
DECLARE
    year TEXT;
    next_num INTEGER;
    new_ref TEXT;
BEGIN
    IF NEW.reference_id IS NULL THEN
        year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
        SELECT COALESCE(
            MAX(NULLIF(REGEXP_REPLACE(reference_id, '^REF-' || year || '-', ''), '')), '0'
        )::INTEGER + 1
        INTO next_num
        FROM public.referrals
        WHERE reference_id LIKE 'REF-' || year || '-%';
        
        new_ref := 'REF-' || year || '-' || LPAD(next_num::TEXT, 3, '0');
        NEW.reference_id := new_ref;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS referrals_auto_reference_id ON public.referrals;
CREATE TRIGGER referrals_auto_reference_id
    BEFORE INSERT ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_referral_reference_id();

-- ============================================
-- 8. UPDATE STUDENT VIEW (DROP & RECREATE)
-- ============================================

DROP VIEW IF EXISTS public.student_referrals CASCADE;

CREATE VIEW public.student_referrals AS
SELECT 
    id,
    reference_id,
    student_id,
    from_service,
    to_service,
    status,
    category,
    COALESCE(reason_summary, LEFT(reason, 150) || CASE WHEN LENGTH(reason) > 150 THEN '...' ELSE '' END) as reason,
    appointment_date,
    appointment_location,
    student_notes,
    created_at,
    updated_at,
    resolved_at
FROM public.referrals
WHERE is_archived = false;

ALTER VIEW public.student_referrals SET (security_invoker = on);
GRANT SELECT ON public.student_referrals TO authenticated;

-- ============================================
-- 9. REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals;

-- ============================================
-- 10. NOTIFICATION TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_on_referral_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.notifications (user_id, category, title, body)
        VALUES (
            NEW.student_id, 'referrals', 
            'New Referral: ' || NEW.reference_id,
            'You have been referred to ' || NEW.to_service::text || ' for ' || NEW.category::text
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Scheduled notification
        IF NEW.status = 'scheduled' AND OLD.status != 'scheduled' AND NEW.appointment_date IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, category, title, body, href)
            VALUES (
                NEW.student_id, 'referrals',
                'Appointment Scheduled: ' || NEW.reference_id,
                'Your appointment is scheduled for ' || TO_CHAR(NEW.appointment_date, 'Mon DD, YYYY at HH:MI AM'),
                '/referrals/' || NEW.id::text
            );
        END IF;
        
        -- Completed notification
        IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            INSERT INTO public.notifications (user_id, category, title, body)
            VALUES (
                NEW.student_id, 'referrals',
                'Referral Completed: ' || NEW.reference_id,
                'Your referral to ' || NEW.to_service::text || ' has been marked as completed.'
            );
        END IF;
        
        -- Student notes updated
        IF NEW.student_notes IS DISTINCT FROM OLD.student_notes AND NEW.student_notes IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, category, title, body)
            VALUES (
                NEW.student_id, 'referrals',
                'Update on Referral: ' || NEW.reference_id,
                NEW.student_notes
            );
        END IF;
        
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS referrals_notify_changes ON public.referrals;
CREATE TRIGGER referrals_notify_changes
    AFTER INSERT OR UPDATE ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_referral_change();
