-- Migration: Complete Scholarship Management System
-- Created: 2026-04-26
-- Description: Tables for SDAO scholarship programs, applications, and ongoing scholar compliance

-- ============================================
-- 1. ENUM TYPES
-- ============================================

CREATE TYPE scholarship_status AS ENUM (
    'draft',        -- Program being configured, not visible
    'open',         -- Accepting applications
    'closed',       -- Deadline passed, processing applications
    'archived'      -- Past program, read-only
);

CREATE TYPE application_status AS ENUM (
    'draft',        -- Student started but not submitted
    'submitted',    -- Officially submitted for review
    'under_review', -- SDAO staff reviewing
    'needs_info',   -- Additional documents requested
    'approved',     -- Accepted to program
    'rejected',     -- Denied
    'withdrawn'     -- Student cancelled
);

CREATE TYPE scholar_status AS ENUM (
    'active',       -- In good standing
    'compliant',    -- Meeting requirements
    'at_risk',      -- Warning issued (e.g., GPA drop)
    'probation',    -- Conditional continuation
    'suspended',    -- Temporarily paused
    'terminated',   -- Scholarship ended
    'completed'     -- Graduated/Finished program
);

CREATE TYPE compliance_item_type AS ENUM (
    'grades',           -- Grade report submission
    'enrollment_proof', -- Certificate of enrollment
    'good_moral',       -- Certificate of good moral character
    'medical_clearance',-- Health clearance
    'community_service',-- Service hours documentation
    'interview',        -- Scheduled interview attendance
    'contract_signing', -- Scholarship contract
    'other'             -- Custom requirement
);

CREATE TYPE compliance_status AS ENUM (
    'pending',      -- Not yet submitted
    'submitted',    -- Uploaded, awaiting verification
    'verified',     -- Staff confirmed valid
    'rejected',     -- Staff rejected, needs resubmit
    'overdue',      -- Past deadline
    'waived'        -- Requirement excused
);

CREATE TYPE document_type AS ENUM (
    'report_card',
    'transcript',
    'certificate',
    'id_photo',
    'essay',
    'recommendation_letter',
    'proof_of_income',
    'medical_record',
    'contract',
    'other'
);

-- ============================================
-- 2. CORE TABLES
-- ============================================

-- --------------------------------------------
-- scholarship_programs: Scholarship offerings
-- --------------------------------------------
CREATE TABLE public.scholarship_programs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    code                TEXT NOT NULL UNIQUE,           -- e.g., 'WHITE-2025', 'GOLD-2025'
    name                TEXT NOT NULL,                  -- e.g., 'White Scholarship'
    short_description   TEXT NOT NULL,                  -- Card display text
    full_description    TEXT,                           -- Detailed description
    
    -- Status & Timing
    status              scholarship_status NOT NULL DEFAULT 'draft',
    application_open_date DATE NOT NULL,                -- When applications start
    application_close_date DATE NOT NULL,               -- When applications end
    academic_year       TEXT NOT NULL,                  -- e.g., '2025-2026'
    term                TEXT NOT NULL,                  -- e.g., '1st', '2nd', '3rd'
    
    -- Eligibility Criteria
    min_gpa             DECIMAL(3,2),                   -- Minimum GPA required
    max_gpa             DECIMAL(3,2),                   -- Maximum (if tiered)
    year_levels         TEXT[],                         -- ['1st', '2nd', '3rd', '4th']
    programs            TEXT[],                         -- Allowed courses/programs
    
    -- Financial Benefits
    tuition_discount_percent INTEGER NOT NULL DEFAULT 0, -- 0-100
    misc_discount_percent  INTEGER NOT NULL DEFAULT 0,  -- 0-100
    monthly_stipend     DECIMAL(10,2),                  -- If applicable
    
    -- Capacity
    total_slots         INTEGER NOT NULL DEFAULT 0,     -- Max scholars allowed
    filled_slots        INTEGER NOT NULL DEFAULT 0,     -- Current count
    
    -- Sponsor Info
    sponsor_name        TEXT NOT NULL,                  -- e.g., 'Doña Miguela M. Jhocon'
    sponsor_description TEXT,
    
    -- Admin Fields
    created_by          UUID REFERENCES auth.users(id),
    updated_by          UUID REFERENCES auth.users(id),
    
    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at        TIMESTAMPTZ,                    -- When made visible to students
    archived_at         TIMESTAMPTZ
);

COMMENT ON TABLE public.scholarship_programs IS 'Scholarship program definitions managed by SDAO staff';

-- --------------------------------------------
-- scholarship_requirements: Required docs per program
-- --------------------------------------------
CREATE TABLE public.scholarship_requirements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationship
    program_id          UUID NOT NULL REFERENCES public.scholarship_programs(id) ON DELETE CASCADE,
    
    -- Requirement Details
    item_type           compliance_item_type NOT NULL,
    name                TEXT NOT NULL,                  -- Display name
    description         TEXT,                         -- Instructions for student
    is_required         BOOLEAN NOT NULL DEFAULT true,  -- Required vs optional
    
    -- Document Specs
    allowed_file_types  TEXT[],                         -- ['pdf', 'jpg', 'png']
    max_file_size_mb    INTEGER DEFAULT 10,
    
    -- Ordering
    sort_order          INTEGER NOT NULL DEFAULT 0,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.scholarship_requirements IS 'Required documents/items for each scholarship program';

-- --------------------------------------------
-- scholarship_applications: Student submissions
-- --------------------------------------------
CREATE TABLE public.scholarship_applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    program_id          UUID NOT NULL REFERENCES public.scholarship_programs(id),
    student_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Application State
    status              application_status NOT NULL DEFAULT 'draft',
    reference_number    TEXT UNIQUE,                    -- e.g., 'APP-2025-001'
    
    -- Student Academic Info (at time of application)
    current_gpa         DECIMAL(3,2),
    current_year_level  TEXT,
    current_program     TEXT,
    enrollment_status   TEXT,                           -- 'enrolled', 'continuing'
    
    -- Financial Info (if needed)
    family_income_range TEXT,
    has_siblings_in_school BOOLEAN,
    
    -- Essay/Written Components
    personal_statement  TEXT,
    
    -- Staff Review Fields
    reviewed_by         UUID REFERENCES auth.users(id), -- SDAO staff member
    reviewed_at         TIMESTAMPTZ,
    review_notes        TEXT,                           -- Internal notes
    rejection_reason    TEXT,                           -- If rejected
    
    -- Scoring (if rubric-based)
    academic_score      INTEGER,                      -- 0-100
    financial_need_score INTEGER,                     -- 0-100
    interview_score     INTEGER,                      -- 0-100
    total_score         INTEGER,                      -- Computed
    
    -- Important Dates
    submitted_at        TIMESTAMPTZ,                  -- When status changed to submitted
    decided_at          TIMESTAMPTZ,                  -- When approved/rejected
    
    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.scholarship_applications IS 'Student applications for scholarship programs';

-- --------------------------------------------
-- application_documents: Uploaded files per requirement
-- --------------------------------------------
CREATE TABLE public.application_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    application_id      UUID NOT NULL REFERENCES public.scholarship_applications(id) ON DELETE CASCADE,
    requirement_id      UUID NOT NULL REFERENCES public.scholarship_requirements(id) ON DELETE CASCADE,
    
    -- File Info
    original_filename   TEXT NOT NULL,
    storage_path        TEXT NOT NULL,                -- Supabase Storage path
    file_type           document_type NOT NULL,
    file_size_bytes     INTEGER NOT NULL,
    mime_type           TEXT,
    
    -- Verification
    uploaded_by         UUID NOT NULL REFERENCES auth.users(id),
    verified_by         UUID REFERENCES auth.users(id), -- Staff who checked
    verified_at         TIMESTAMPTZ,
    verification_status compliance_status NOT NULL DEFAULT 'pending',
    rejection_reason    TEXT,                           -- If verification rejected
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.application_documents IS 'Documents uploaded by students for application requirements';

-- --------------------------------------------
-- scholar_enrollments: Active scholars
-- --------------------------------------------
CREATE TABLE public.scholar_enrollments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    program_id          UUID NOT NULL REFERENCES public.scholarship_programs(id),
    student_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id      UUID NOT NULL REFERENCES public.scholarship_applications(id),
    
    -- Enrollment Info
    status              scholar_status NOT NULL DEFAULT 'active',
    reference_number    TEXT UNIQUE,                    -- e.g., 'SCH-2025-001'
    
    -- Academic Year Tracking
    academic_year       TEXT NOT NULL,
    term                TEXT NOT NULL,
    year_level          TEXT NOT NULL,
    
    -- Current Academic Standing
    current_gpa         DECIMAL(3,2),
    gpa_last_updated    TIMESTAMPTZ,
    
    -- Contract/Agreement
    contract_signed_at  TIMESTAMPTZ,
    contract_signee_name TEXT,                         -- Who signed (student/parent)
    
    -- Staff Assignment
    assigned_counselor  UUID REFERENCES auth.users(id), -- SDAO staff
    
    -- Financial
    total_disbursed     DECIMAL(10,2) DEFAULT 0,      -- Total funds received
    last_disbursement_at TIMESTAMPTZ,
    
    -- Status History
    status_changed_at   TIMESTAMPTZ,
    status_changed_by   UUID REFERENCES auth.users(id),
    status_reason       TEXT,
    
    -- Important Dates
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expected_end_at     TIMESTAMPTZ,                  -- Expected graduation
    ended_at            TIMESTAMPTZ,                  -- If terminated/completed
    
    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.scholar_enrollments IS 'Active scholarship enrollments with ongoing compliance tracking';

-- --------------------------------------------
-- compliance_items: Ongoing requirements per enrollment
-- --------------------------------------------
CREATE TABLE public.compliance_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    enrollment_id       UUID NOT NULL REFERENCES public.scholar_enrollments(id) ON DELETE CASCADE,
    
    -- Requirement Spec
    item_type           compliance_item_type NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    
    -- Timing
    due_date            DATE NOT NULL,
    grace_period_days   INTEGER DEFAULT 0,          -- Days after due before marked overdue
    reminder_days_before INTEGER[] DEFAULT '{7,3,1}', -- Days before to send reminders
    
    -- Document Specs
    allowed_file_types  TEXT[],
    max_file_size_mb    INTEGER DEFAULT 10,
    
    -- Current State
    status              compliance_status NOT NULL DEFAULT 'pending',
    
    -- Staff Override
    waived_by           UUID REFERENCES auth.users(id),
    waived_at           TIMESTAMPTZ,
    waive_reason        TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.compliance_items IS 'Ongoing compliance requirements for active scholars';

-- --------------------------------------------
-- compliance_submissions: Documents for ongoing requirements
-- --------------------------------------------
CREATE TABLE public.compliance_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    item_id             UUID NOT NULL REFERENCES public.compliance_items(id) ON DELETE CASCADE,
    enrollment_id       UUID NOT NULL REFERENCES public.scholar_enrollments(id) ON DELETE CASCADE,
    
    -- File Info
    original_filename   TEXT NOT NULL,
    storage_path        TEXT NOT NULL,
    file_type           document_type NOT NULL,
    file_size_bytes     INTEGER NOT NULL,
    mime_type           TEXT,
    
    -- Submission State
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_by        UUID NOT NULL REFERENCES auth.users(id),
    
    -- Verification
    verified_by         UUID REFERENCES auth.users(id),
    verified_at         TIMESTAMPTZ,
    verification_status compliance_status NOT NULL DEFAULT 'submitted',
    staff_notes         TEXT,                         -- Feedback to student
    
    -- Resubmission Tracking
    is_resubmission     BOOLEAN DEFAULT false,
    previous_submission_id UUID REFERENCES public.compliance_submissions(id),
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.compliance_submissions IS 'Student submissions for ongoing compliance requirements';

-- --------------------------------------------
-- scholarship_approvals: Audit trail for decisions
-- --------------------------------------------
CREATE TABLE public.scholarship_approvals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What was acted on
    entity_type         TEXT NOT NULL CHECK (entity_type IN ('application', 'enrollment', 'compliance')),
    entity_id           UUID NOT NULL,
    
    -- Action Details
    action              TEXT NOT NULL,                -- 'approve', 'reject', 'request_info', 'suspend', etc.
    previous_status     TEXT,
    new_status          TEXT,
    
    -- Who & When
    actor_id            UUID NOT NULL REFERENCES auth.users(id),
    acted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Context
    notes               TEXT,                         -- Internal reason
    student_message     TEXT,                         -- Message shown to student
    
    -- Supporting Data (flexible JSON for different action types)
    metadata            JSONB DEFAULT '{}',
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.scholarship_approvals IS 'Audit trail of all SDAO staff decisions on scholarships';

-- ============================================
-- 3. INDEXES
-- ============================================

-- Programs
CREATE INDEX idx_programs_status ON public.scholarship_programs(status);
CREATE INDEX idx_programs_dates ON public.scholarship_programs(application_open_date, application_close_date);
CREATE INDEX idx_programs_year_term ON public.scholarship_programs(academic_year, term);

-- Applications
CREATE INDEX idx_applications_student ON public.scholarship_applications(student_id);
CREATE INDEX idx_applications_program ON public.scholarship_applications(program_id);
CREATE INDEX idx_applications_status ON public.scholarship_applications(status);
CREATE INDEX idx_applications_student_status ON public.scholarship_applications(student_id, status);

-- Documents
CREATE INDEX idx_app_docs_application ON public.application_documents(application_id);
CREATE INDEX idx_app_docs_requirement ON public.application_documents(requirement_id);

-- Enrollments
CREATE INDEX idx_enrollments_student ON public.scholar_enrollments(student_id);
CREATE INDEX idx_enrollments_status ON public.scholar_enrollments(status);
CREATE INDEX idx_enrollments_counselor ON public.scholar_enrollments(assigned_counselor);

-- Compliance
CREATE INDEX idx_compliance_enrollment ON public.compliance_items(enrollment_id);
CREATE INDEX idx_compliance_status ON public.compliance_items(status);
CREATE INDEX idx_compliance_due_date ON public.compliance_items(due_date);
CREATE INDEX idx_compliance_overdue ON public.compliance_items(due_date, status) WHERE status IN ('pending', 'overdue');

-- Submissions
CREATE INDEX idx_submissions_item ON public.compliance_submissions(item_id);
CREATE INDEX idx_submissions_status ON public.compliance_submissions(verification_status);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.scholarship_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholar_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_approvals ENABLE ROW LEVEL SECURITY;

-- Helper: Check if user is SDAO staff
CREATE OR REPLACE FUNCTION public.is_sdao_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND user_role IN ('staff', 'admin')
        AND office = 'sdao'
        AND account_status = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------
-- scholarship_programs policies
-- --------------------------------------------
-- Students: Only see published, open programs
CREATE POLICY "Students view open programs"
    ON public.scholarship_programs
    FOR SELECT
    TO authenticated
    USING (
        status = 'open'
        AND published_at IS NOT NULL
    );

-- SDAO staff: Full access to their programs
CREATE POLICY "SDAO staff manage programs"
    ON public.scholarship_programs
    FOR ALL
    TO authenticated
    USING (public.is_sdao_staff())
    WITH CHECK (public.is_sdao_staff());

-- --------------------------------------------
-- scholarship_requirements policies
-- --------------------------------------------
-- Students: See requirements for open programs
CREATE POLICY "Students view program requirements"
    ON public.scholarship_requirements
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scholarship_programs
            WHERE id = program_id
            AND status = 'open'
        )
    );

-- SDAO staff: Full access
CREATE POLICY "SDAO staff manage requirements"
    ON public.scholarship_requirements
    FOR ALL
    TO authenticated
    USING (public.is_sdao_staff())
    WITH CHECK (public.is_sdao_staff());

-- --------------------------------------------
-- scholarship_applications policies
-- --------------------------------------------
-- Students: Own applications only
CREATE POLICY "Students view own applications"
    ON public.scholarship_applications
    FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "Students create own applications"
    ON public.scholarship_applications
    FOR INSERT
    TO authenticated
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students update own drafts"
    ON public.scholarship_applications
    FOR UPDATE
    TO authenticated
    USING (
        student_id = auth.uid()
        AND status = 'draft'
    )
    WITH CHECK (student_id = auth.uid());

-- SDAO staff: View and update applications for their programs
CREATE POLICY "SDAO staff view all applications"
    ON public.scholarship_applications
    FOR SELECT
    TO authenticated
    USING (
        public.is_sdao_staff()
        OR EXISTS (
            SELECT 1 FROM public.scholar_enrollments
            WHERE assigned_counselor = auth.uid()
            AND student_id = scholarship_applications.student_id
        )
    );

CREATE POLICY "SDAO staff update applications"
    ON public.scholarship_applications
    FOR UPDATE
    TO authenticated
    USING (public.is_sdao_staff())
    WITH CHECK (public.is_sdao_staff());

-- --------------------------------------------
-- application_documents policies
-- --------------------------------------------
-- Students: Own documents only
CREATE POLICY "Students view own documents"
    ON public.application_documents
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scholarship_applications
            WHERE id = application_id
            AND student_id = auth.uid()
        )
    );

CREATE POLICY "Students upload own documents"
    ON public.application_documents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.scholarship_applications
            WHERE id = application_id
            AND student_id = auth.uid()
        )
    );

CREATE POLICY "Students delete own draft documents"
    ON public.application_documents
    FOR DELETE
    TO authenticated
    USING (
        uploaded_by = auth.uid()
        AND verification_status = 'pending'
    );

-- SDAO staff: Verify documents
CREATE POLICY "SDAO staff view all documents"
    ON public.application_documents
    FOR SELECT
    TO authenticated
    USING (
        public.is_sdao_staff()
        OR verified_by = auth.uid()
    );

CREATE POLICY "SDAO staff update verification"
    ON public.application_documents
    FOR UPDATE
    TO authenticated
    USING (public.is_sdao_staff())
    WITH CHECK (public.is_sdao_staff());

-- --------------------------------------------
-- scholar_enrollments policies
-- --------------------------------------------
-- Students: View own enrollment
CREATE POLICY "Students view own enrollment"
    ON public.scholar_enrollments
    FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

-- SDAO staff: Full access
CREATE POLICY "SDAO staff manage enrollments"
    ON public.scholar_enrollments
    FOR ALL
    TO authenticated
    USING (
        public.is_sdao_staff()
        OR assigned_counselor = auth.uid()
    )
    WITH CHECK (public.is_sdao_staff());

-- --------------------------------------------
-- compliance_items policies
-- --------------------------------------------
-- Students: View own compliance items
CREATE POLICY "Students view own compliance"
    ON public.compliance_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scholar_enrollments
            WHERE id = enrollment_id
            AND student_id = auth.uid()
        )
    );

-- SDAO staff: Manage compliance items
CREATE POLICY "SDAO staff manage compliance"
    ON public.compliance_items
    FOR ALL
    TO authenticated
    USING (public.is_sdao_staff())
    WITH CHECK (public.is_sdao_staff());

-- --------------------------------------------
-- compliance_submissions policies
-- --------------------------------------------
-- Students: View and submit own
CREATE POLICY "Students view own submissions"
    ON public.compliance_submissions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scholar_enrollments
            WHERE id = enrollment_id
            AND student_id = auth.uid()
        )
    );

CREATE POLICY "Students create submissions"
    ON public.compliance_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (submitted_by = auth.uid());

-- SDAO staff: Verify submissions
CREATE POLICY "SDAO staff manage submissions"
    ON public.compliance_submissions
    FOR ALL
    TO authenticated
    USING (public.is_sdao_staff())
    WITH CHECK (public.is_sdao_staff());

-- --------------------------------------------
-- scholarship_approvals policies (audit trail)
-- --------------------------------------------
-- Students: Read-only on their own records
CREATE POLICY "Students view own approval history"
    ON public.scholarship_approvals
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scholarship_applications
            WHERE id = entity_id
            AND student_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.scholar_enrollments
            WHERE id = entity_id
            AND student_id = auth.uid()
        )
    );

-- SDAO staff: Full access to audit trail
CREATE POLICY "SDAO staff view approval history"
    ON public.scholarship_approvals
    FOR ALL
    TO authenticated
    USING (public.is_sdao_staff())
    WITH CHECK (public.is_sdao_staff());

-- ============================================
-- 5. TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_scholarship_programs
    BEFORE UPDATE ON public.scholarship_programs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_scholarship_requirements
    BEFORE UPDATE ON public.scholarship_requirements
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_scholarship_applications
    BEFORE UPDATE ON public.scholarship_applications
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_application_documents
    BEFORE UPDATE ON public.application_documents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_scholar_enrollments
    BEFORE UPDATE ON public.scholar_enrollments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_compliance_items
    BEFORE UPDATE ON public.compliance_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_compliance_submissions
    BEFORE UPDATE ON public.compliance_submissions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Generate reference numbers
CREATE OR REPLACE FUNCTION public.generate_application_reference()
RETURNS TRIGGER AS $$
DECLARE
    year TEXT;
    next_num INTEGER;
BEGIN
    IF NEW.reference_number IS NULL THEN
        year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
        
        SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(reference_number, '^APP-' || year || '-', ''), '')), '0')::INTEGER + 1
        INTO next_num
        FROM public.scholarship_applications
        WHERE reference_number LIKE 'APP-' || year || '-%';
        
        NEW.reference_number := 'APP-' || year || '-' || LPAD(next_num::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_auto_reference
    BEFORE INSERT ON public.scholarship_applications
    FOR EACH ROW EXECUTE FUNCTION public.generate_application_reference();

CREATE OR REPLACE FUNCTION public.generate_scholar_reference()
RETURNS TRIGGER AS $$
DECLARE
    year TEXT;
    next_num INTEGER;
BEGIN
    IF NEW.reference_number IS NULL THEN
        year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
        
        SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(reference_number, '^SCH-' || year || '-', ''), '')), '0')::INTEGER + 1
        INTO next_num
        FROM public.scholar_enrollments
        WHERE reference_number LIKE 'SCH-' || year || '-%';
        
        NEW.reference_number := 'SCH-' || year || '-' || LPAD(next_num::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enrollments_auto_reference
    BEFORE INSERT ON public.scholar_enrollments
    FOR EACH ROW EXECUTE FUNCTION public.generate_scholar_reference();

-- Update slot counts when application approved
CREATE OR REPLACE FUNCTION public.update_program_slots()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        UPDATE public.scholarship_programs
        SET filled_slots = filled_slots + 1
        WHERE id = NEW.program_id;
    END IF;
    
    IF NEW.status != 'approved' AND OLD.status = 'approved' THEN
        UPDATE public.scholarship_programs
        SET filled_slots = filled_slots - 1
        WHERE id = NEW.program_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_update_slots
    AFTER UPDATE ON public.scholarship_applications
    FOR EACH ROW EXECUTE FUNCTION public.update_program_slots();

-- ============================================
-- 6. REALTIME SUBSCRIPTION SETUP
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.scholarship_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scholar_enrollments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.compliance_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.compliance_submissions;

-- ============================================
-- 7. NOTIFICATION TRIGGERS
-- ============================================

-- Notify on application status change
CREATE OR REPLACE FUNCTION public.notify_on_application_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status THEN
        INSERT INTO public.notifications (user_id, category, title, body, href)
        VALUES (
            NEW.student_id,
            'scholarships',
            CASE NEW.status
                WHEN 'under_review' THEN 'Application Under Review'
                WHEN 'needs_info' THEN 'Additional Information Needed'
                WHEN 'approved' THEN 'Scholarship Approved!'
                WHEN 'rejected' THEN 'Application Update'
                ELSE 'Application Status Update'
            END,
            CASE NEW.status
                WHEN 'under_review' THEN 'Your application ' || NEW.reference_number || ' is now being reviewed.'
                WHEN 'needs_info' THEN 'Please provide additional information for your application.'
                WHEN 'approved' THEN 'Congratulations! Your scholarship application has been approved.'
                WHEN 'rejected' THEN 'We regret to inform you that your application was not approved.'
                ELSE 'Your application status has been updated.'
            END,
            '/student-development-affairs/application/' || NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER applications_notify_changes
    AFTER UPDATE ON public.scholarship_applications
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_application_change();

-- Notify on compliance due date approaching
CREATE OR REPLACE FUNCTION public.notify_on_compliance_due()
RETURNS TRIGGER AS $$
DECLARE
    student_uuid UUID;
BEGIN
    -- Get student from enrollment
    SELECT student_id INTO student_uuid
    FROM public.scholar_enrollments
    WHERE id = NEW.enrollment_id;
    
    IF NEW.status = 'overdue' THEN
        INSERT INTO public.notifications (user_id, category, title, body, href)
        VALUES (
            student_uuid,
            'scholarships',
            'Overdue: ' || NEW.name,
            'Your ' || NEW.name || ' submission is overdue. Please submit immediately to avoid scholarship suspension.',
            '/my-scholarship'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER compliance_notify_overdue
    AFTER UPDATE ON public.compliance_items
    FOR EACH ROW
    WHEN (NEW.status = 'overdue' AND OLD.status != 'overdue')
    EXECUTE FUNCTION public.notify_on_compliance_due();

COMMENT ON TABLE public.scholarship_programs IS 'Complete scholarship management system for SDAO. Students apply via app, staff manage via web admin.';
