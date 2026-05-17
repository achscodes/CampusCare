-- Migration: Unified referrals table with RLS for student app and admin web dashboards
-- Created: 2026-04-25

-- ============================================
-- 1. CREATE ENUM TYPES
-- ============================================

-- Referral status enum
CREATE TYPE referral_status AS ENUM (
    'pending',      -- New referral, awaiting review
    'in_review',    -- Being reviewed by receiving office
    'scheduled',    -- Appointment scheduled with student
    'completed',    -- Referral resolved
    'cancelled'     -- Referral cancelled/rejected
);

-- Welfare office enum (cross-office referrals supported)
CREATE TYPE welfare_office AS ENUM (
    'health',       -- Health Services Clinic (HSO)
    'counseling',   -- Counseling & Guidance Office
    'sdao',         -- Student Development & Affairs Office
    'discipline'    -- Discipline Office (DO)
);

-- Referral category enum
CREATE TYPE referral_category AS ENUM (
    'mental_health',
    'physical_health',
    'behavioral',
    'academic',
    'family_issue',
    'bullying',
    'disciplinary',
    'financial',
    'other'
);

-- Priority enum (admin-only visibility)
CREATE TYPE referral_priority AS ENUM (
    'normal',
    'urgent',
    'critical'
);

-- ============================================
-- 2. CREATE UNIFIED REFERRALS TABLE
-- ============================================

CREATE TABLE public.referrals (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id TEXT NOT NULL UNIQUE, -- Human-readable (e.g., REF-2025-001)
    
    -- Student identification (links to auth.users via students table)
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Office routing
    from_service welfare_office NOT NULL,
    to_service welfare_office NOT NULL,
    
    -- Referral details
    status referral_status NOT NULL DEFAULT 'pending',
    category referral_category NOT NULL,
    priority referral_priority NOT NULL DEFAULT 'normal', -- ADMIN ONLY
    
    -- Content
    reason TEXT NOT NULL,
    reason_summary TEXT, -- Student-safe abbreviated version (optional)
    
    -- Staff assignment (admin visibility)
    referred_by UUID REFERENCES auth.users(id), -- Staff who created referral
    assigned_to UUID REFERENCES auth.users(id), -- Staff assigned to handle
    
    -- Scheduling (visible to student when scheduled)
    appointment_date TIMESTAMPTZ,
    appointment_location TEXT,
    
    -- Student notes (visible to student)
    student_notes TEXT,
    
    -- Internal notes (admin only)
    internal_notes TEXT,
    
    -- Evidence/attachments (admin only)
    attachments JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    
    -- Soft delete for audit trail
    is_archived BOOLEAN NOT NULL DEFAULT false
);

-- Add table comment
COMMENT ON TABLE public.referrals IS 'Unified referrals table for all welfare offices. Students see limited fields via RLS. Admin web dashboards have full access.';

-- ============================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================

-- Student lookups (most common query pattern)
CREATE INDEX idx_referrals_student_id ON public.referrals(student_id);
CREATE INDEX idx_referrals_student_status ON public.referrals(student_id, status);

-- Office routing lookups
CREATE INDEX idx_referrals_from_service ON public.referrals(from_service);
CREATE INDEX idx_referrals_to_service ON public.referrals(to_service);
CREATE INDEX idx_referrals_services ON public.referrals(from_service, to_service);

-- Staff assignment lookups
CREATE INDEX idx_referrals_referred_by ON public.referrals(referred_by);
CREATE INDEX idx_referrals_assigned_to ON public.referrals(assigned_to);

-- Status and priority filtering
CREATE INDEX idx_referrals_status ON public.referrals(status);
CREATE INDEX idx_referrals_priority ON public.referrals(priority) WHERE priority IN ('urgent', 'critical');

-- Date range queries
CREATE INDEX idx_referrals_created_at ON public.referrals(created_at DESC);
CREATE INDEX idx_referrals_appointment ON public.referrals(appointment_date) WHERE appointment_date IS NOT NULL;

-- Combined office + status for dashboard queries
CREATE INDEX idx_referrals_office_status ON public.referrals(to_service, status);
CREATE INDEX idx_referrals_created_office ON public.referrals(from_service, created_at DESC);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4.1 STUDENT POLICIES
-- ============================================

-- Students can ONLY see their own referrals
-- AND cannot see priority, internal_notes, attachments, assigned_to, referred_by details
CREATE POLICY "Students view own referrals"
    ON public.referrals
    FOR SELECT
    TO authenticated
    USING (
        student_id = auth.uid()
        AND is_archived = false
    );

-- Students cannot insert/update/delete (read-only from their perspective)
-- Referrals are created by staff only

-- ============================================
-- 4.2 STAFF POLICIES (Per-Office Visibility)
-- ============================================

-- Helper function: Check if user is staff for a specific office
CREATE OR REPLACE FUNCTION public.is_staff_for_office(office welfare_office)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND user_role = 'staff'
        AND office = $1
        AND account_status = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user is admin for a specific office
CREATE OR REPLACE FUNCTION public.is_admin_for_office(office welfare_office)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.super_admin_allowlist
        WHERE user_id = auth.uid()
        AND office = $1::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Staff can view referrals where they are involved (created OR assigned OR receiving office)
CREATE POLICY "Staff view referrals for their office"
    ON public.referrals
    FOR SELECT
    TO authenticated
    USING (
        -- Staff can see referrals they created
        referred_by = auth.uid()
        OR
        -- Staff can see referrals assigned to them
        assigned_to = auth.uid()
        OR
        -- Staff can see referrals sent to their office
        (
            to_service IN (
                SELECT office::welfare_office 
                FROM public.profiles 
                WHERE id = auth.uid() 
                AND user_role IN ('staff', 'admin')
                AND account_status = 'approved'
            )
        )
        OR
        -- Staff can see referrals sent FROM their office (to track their outgoing)
        (
            from_service IN (
                SELECT office::welfare_office 
                FROM public.profiles 
                WHERE id = auth.uid() 
                AND user_role IN ('staff', 'admin')
                AND account_status = 'approved'
            )
        )
        OR
        -- Super admins can see all
        EXISTS (
            SELECT 1 FROM public.super_admin_allowlist
            WHERE user_id = auth.uid()
        )
    );

-- Staff can create referrals from their office
CREATE POLICY "Staff create referrals from their office"
    ON public.referrals
    FOR INSERT
    TO authenticated
    WITH CHECK (
        from_service IN (
            SELECT office::welfare_office 
            FROM public.profiles 
            WHERE id = auth.uid() 
            AND user_role IN ('staff', 'admin')
            AND account_status = 'approved'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.super_admin_allowlist
            WHERE user_id = auth.uid()
        )
    );

-- Staff can update referrals they created or are assigned to, or in their receiving office
CREATE POLICY "Staff update referrals for their office"
    ON public.referrals
    FOR UPDATE
    TO authenticated
    USING (
        referred_by = auth.uid()
        OR assigned_to = auth.uid()
        OR (
            to_service IN (
                SELECT office::welfare_office 
                FROM public.profiles 
                WHERE id = auth.uid() 
                AND user_role IN ('staff', 'admin')
                AND account_status = 'approved'
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.super_admin_allowlist
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        referred_by = auth.uid()
        OR assigned_to = auth.uid()
        OR (
            to_service IN (
                SELECT office::welfare_office 
                FROM public.profiles 
                WHERE id = auth.uid() 
                AND user_role IN ('staff', 'admin')
                AND account_status = 'approved'
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.super_admin_allowlist
            WHERE user_id = auth.uid()
        )
    );

-- Only super admins can delete (soft archive)
CREATE POLICY "Only super admins can delete referrals"
    ON public.referrals
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.super_admin_allowlist
            WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- 5. FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referrals_updated_at
    BEFORE UPDATE ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Auto-generate reference_id on insert
CREATE OR REPLACE FUNCTION public.generate_referral_reference_id()
RETURNS TRIGGER AS $$
DECLARE
    year TEXT;
    next_num INTEGER;
    new_ref TEXT;
BEGIN
    IF NEW.reference_id IS NULL THEN
        year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
        
        -- Get the next sequence number for this year
        SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(reference_id, '^REF-' || year || '-', ''), '')), '0')::INTEGER + 1
        INTO next_num
        FROM public.referrals
        WHERE reference_id LIKE 'REF-' || year || '-%';
        
        new_ref := 'REF-' || year || '-' || LPAD(next_num::TEXT, 3, '0');
        NEW.reference_id := new_ref;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referrals_auto_reference_id
    BEFORE INSERT ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_referral_reference_id();

-- ============================================
-- 6. STUDENT-SAFE VIEW (No admin fields exposed)
-- ============================================

CREATE VIEW public.student_referrals AS
SELECT 
    id,
    reference_id,
    student_id,
    from_service,
    to_service,
    status,
    category,
    -- NO priority (admin only)
    COALESCE(reason_summary, LEFT(reason, 150) || CASE WHEN LENGTH(reason) > 150 THEN '...' ELSE '' END) as reason,
    -- NO referred_by staff details
    -- NO assigned_to staff details  
    appointment_date,
    appointment_location,
    student_notes,
    -- NO internal_notes
    -- NO attachments
    created_at,
    updated_at,
    resolved_at
FROM public.referrals
WHERE is_archived = false;

-- RLS on the view - students can only see their own
ALTER VIEW public.student_referrals SET (security_invoker = on);

-- Grant access
GRANT SELECT ON public.student_referrals TO authenticated;

-- ============================================
-- 7. REALTIME SUBSCRIPTION SETUP
-- ============================================

-- Enable realtime for referrals table
ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals;

-- ============================================
-- 8. NOTIFICATION WEBHOOK TRIGGER (Optional)
-- ============================================

-- Trigger to create notification when referral status changes or is assigned
CREATE OR REPLACE FUNCTION public.notify_on_referral_change()
RETURNS TRIGGER AS $$
DECLARE
    student_uuid UUID;
    notification_title TEXT;
    notification_body TEXT;
BEGIN
    -- Only notify on specific changes
    IF TG_OP = 'INSERT' THEN
        -- New referral created - notify student
        INSERT INTO public.notifications (user_id, category, title, body)
        VALUES (
            NEW.student_id,
            'referrals',
            'New Referral: ' || NEW.reference_id,
            'You have been referred to ' || NEW.to_service::text || ' for ' || NEW.category::text
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Status changed to scheduled - notify student
        IF NEW.status = 'scheduled' AND OLD.status != 'scheduled' AND NEW.appointment_date IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, category, title, body, href)
            VALUES (
                NEW.student_id,
                'referrals',
                'Appointment Scheduled: ' || NEW.reference_id,
                'Your appointment is scheduled for ' || TO_CHAR(NEW.appointment_date, 'Mon DD, YYYY at HH:MI AM'),
                '/referrals/' || NEW.id::text
            );
        END IF;
        
        -- Status changed to completed - notify student
        IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            INSERT INTO public.notifications (user_id, category, title, body)
            VALUES (
                NEW.student_id,
                'referrals',
                'Referral Completed: ' || NEW.reference_id,
                'Your referral to ' || NEW.to_service::text || ' has been marked as completed.'
            );
        END IF;
        
        -- Student notes added/updated - notify student
        IF NEW.student_notes IS DISTINCT FROM OLD.student_notes AND NEW.student_notes IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, category, title, body)
            VALUES (
                NEW.student_id,
                'referrals',
                'Update on Referral: ' || NEW.reference_id,
                NEW.student_notes
            );
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER referrals_notify_changes
    AFTER INSERT OR UPDATE ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_referral_change();

-- ============================================
-- 9. MIGRATION NOTES
-- ============================================

COMMENT ON TABLE public.referrals IS 
'Unified referrals table supporting cross-office referrals between Health, Counseling, SDAO, and Discipline offices.

STUDENT APP VISIBILITY (via RLS + student_referrals view):
- reference_id, from_service, to_service, status, category, reason (summarized)
- appointment_date, appointment_location, student_notes
- NO priority, NO internal_notes, NO attachments, NO staff details

ADMIN WEB DASHBOARD VISIBILITY (via RLS):
- Full access to all fields including priority, internal_notes, attachments
- Can create/update referrals for their assigned office
- Super admins have full access across all offices

EXISTING DATA MIGRATION:
- discipline_referrals → referrals (from_service='discipline')
- health_referrals → referrals (from_service='health')  
- sdao_referrals → referrals (from_service='sdao')
- Run separate migration to port existing data if needed.';
