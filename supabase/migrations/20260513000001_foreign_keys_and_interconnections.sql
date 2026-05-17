-- Migration: Missing Foreign Keys & Interconnection Constraints
-- Created: 2026-05-13
-- Description: Add missing relationships and constraints to ensure all tables are properly interconnected

-- ============================================
-- 1. HEALTH SERVICES INTERCONNECTIONS
-- ============================================

-- Link health appointments to profiles
ALTER TABLE health_appointments
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for appointment queries
CREATE INDEX IF NOT EXISTS health_appointments_date_idx 
ON health_appointments(appointment_date DESC) 
WHERE status NOT IN ('cancelled', 'no_show');

-- Link health consultations to appointments
ALTER TABLE health_consultations
ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES health_appointments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS health_consultations_appointment_idx 
ON health_consultations(appointment_id) 
WHERE appointment_id IS NOT NULL;

-- Link medical records to profiles
ALTER TABLE medical_records
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- 2. DISCIPLINE OFFICE INTERCONNECTIONS
-- ============================================

-- Link discipline cases to student profiles
ALTER TABLE discipline_cases
ADD COLUMN IF NOT EXISTS assigned_counselor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_action_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Link case conferences to profiles
ALTER TABLE discipline_case_conferences
ADD COLUMN IF NOT EXISTS facilitator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS documented_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS discipline_case_conf_facilitator_idx 
ON discipline_case_conferences(facilitator_id);

-- ============================================
-- 3. SCHOLARSHIP SYSTEM INTERCONNECTIONS
-- ============================================

-- Link scholarship programs to staff
ALTER TABLE scholarship_programs
ADD COLUMN IF NOT EXISTS program_manager UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Link compliance items to staff
ALTER TABLE compliance_items
ADD COLUMN IF NOT EXISTS assigned_reviewer UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS compliance_items_enrollment_idx 
ON compliance_items(enrollment_id) 
WHERE status NOT IN ('verified', 'waived');

-- Link compliance submissions to profiles
ALTER TABLE compliance_submissions
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS compliance_submissions_status_idx 
ON compliance_submissions(status);

-- ============================================
-- 4. REFERRAL SYSTEM INTERCONNECTIONS
-- ============================================

-- Enhance referral tables with additional connections
ALTER TABLE sdao_referrals
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

ALTER TABLE health_referrals
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

ALTER TABLE discipline_referrals
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- Create referral tracking indexes
CREATE INDEX IF NOT EXISTS sdao_referrals_assigned_idx ON sdao_referrals(assigned_to, status);
CREATE INDEX IF NOT EXISTS health_referrals_assigned_idx ON health_referrals(assigned_to, status);
CREATE INDEX IF NOT EXISTS discipline_referrals_assigned_idx ON discipline_referrals(assigned_to, status);

-- ============================================
-- 5. DOCUMENT REQUEST INTERCONNECTIONS
-- ============================================

-- Link document requests to staff
ALTER TABLE sdao_document_requests
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE health_document_requests
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE discipline_document_requests
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Create document request indexes
CREATE INDEX IF NOT EXISTS sdao_doc_req_status_idx ON sdao_document_requests(status);
CREATE INDEX IF NOT EXISTS health_doc_req_status_idx ON health_document_requests(status);
CREATE INDEX IF NOT EXISTS discipline_doc_req_status_idx ON discipline_document_requests(status);

-- ============================================
-- 6. NOTIFICATION SYSTEM ENHANCEMENTS
-- ============================================

-- Add context tracking to notifications
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS entity_id UUID,
ADD COLUMN IF NOT EXISTS action_required BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS notifications_unread_idx 
ON notifications(user_id, read_at) 
WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_action_idx 
ON notifications(user_id, action_required) 
WHERE action_required = TRUE;

-- ============================================
-- 7. PROFILE ENHANCEMENTS FOR INTERCONNECTION
-- ============================================

-- Add office assignment to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS assigned_office TEXT,
ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_office_idx ON profiles(assigned_office);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role, assigned_office);

-- ============================================
-- 8. TRACKING & AUDIT TABLES
-- ============================================

-- Create activity log table
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_actor_idx ON public.activity_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_entity_idx ON public.activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS activity_log_action_idx ON public.activity_log(action);

-- Create data sync log table
CREATE TABLE IF NOT EXISTS public.data_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL,
  target_table TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('SYNC', 'VALIDATE', 'REPAIR')),
  records_affected INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'partial')),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  details JSONB
);

CREATE INDEX IF NOT EXISTS data_sync_log_status_idx ON public.data_sync_log(status, completed_at DESC);

-- ============================================
-- 9. PERFORMANCE OPTIMIZATION INDEXES
-- ============================================

-- Critical query performance indexes
CREATE INDEX IF NOT EXISTS health_appointments_student_date_idx 
ON health_appointments(student_id, appointment_date DESC) 
WHERE status NOT IN ('cancelled', 'no_show');

CREATE INDEX IF NOT EXISTS discipline_cases_student_status_idx 
ON discipline_cases(student_id, status);

CREATE INDEX IF NOT EXISTS scholarship_applications_student_status_idx 
ON scholarship_applications(student_id, status::TEXT);

CREATE INDEX IF NOT EXISTS referrals_student_office_idx 
ON referrals(student_id, receiving_office, status);

CREATE INDEX IF NOT EXISTS inter_office_doc_student_idx 
ON inter_office_document_requests(student_id, status);

-- ============================================
-- 10. VIEW FOR INTERCONNECTED STUDENT RECORD
-- ============================================

-- Create view for easy student data access
CREATE OR REPLACE VIEW student_unified_record AS
SELECT
  p.id as student_id,
  au.email,
  p.first_name,
  p.last_name,
  p.student_number,
  p.program,
  p.year_level,
  p.created_at as profile_created,
  
  -- Discipline summary
  (SELECT COUNT(*) FROM discipline_cases WHERE student_id = p.id AND status NOT IN ('resolved', 'closed')) as active_discipline_cases,
  (SELECT COUNT(*) FROM discipline_cases WHERE student_id = p.id) as total_discipline_cases,
  
  -- Health summary
  (SELECT COUNT(*) FROM health_appointments WHERE student_id = p.id AND DATE(appointment_date) >= CURRENT_DATE) as upcoming_health_appointments,
  (SELECT COUNT(*) FROM health_appointments WHERE student_id = p.id) as total_health_appointments,
  
  -- Scholarship summary
  (SELECT COUNT(*) FROM scholar_enrollments WHERE student_id = p.id AND status = 'active') as active_scholarships,
  (SELECT COUNT(*) FROM scholarship_applications WHERE student_id = p.id) as scholarship_applications,
  
  -- Referral summary
  (SELECT COUNT(*) FROM referrals WHERE student_id = p.id AND status IN ('sent', 'acknowledged', 'in_progress')) as pending_referrals,
  (SELECT COUNT(*) FROM referrals WHERE student_id = p.id) as total_referrals,
  
  -- Document request summary
  (SELECT COUNT(*) FROM inter_office_document_requests WHERE student_id = p.id AND status NOT IN ('submitted', 'verified')) as pending_document_requests,
  
  p.updated_at as last_updated
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id;

-- ============================================
-- 11. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_modified_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers to main tables
DROP TRIGGER IF EXISTS health_appointments_modtime ON health_appointments;
CREATE TRIGGER health_appointments_modtime
BEFORE UPDATE ON health_appointments
FOR EACH ROW EXECUTE FUNCTION public.update_modified_timestamp();

DROP TRIGGER IF EXISTS discipline_cases_modtime ON discipline_cases;
CREATE TRIGGER discipline_cases_modtime
BEFORE UPDATE ON discipline_cases
FOR EACH ROW EXECUTE FUNCTION public.update_modified_timestamp();

DROP TRIGGER IF EXISTS scholarship_applications_modtime ON scholarship_applications;
CREATE TRIGGER scholarship_applications_modtime
BEFORE UPDATE ON scholarship_applications
FOR EACH ROW EXECUTE FUNCTION public.update_modified_timestamp();

DROP TRIGGER IF EXISTS referrals_modtime ON referrals;
CREATE TRIGGER referrals_modtime
BEFORE UPDATE ON referrals
FOR EACH ROW EXECUTE FUNCTION public.update_modified_timestamp();

-- ============================================
-- 12. GRANT NECESSARY PERMISSIONS
-- ============================================

GRANT SELECT ON public.student_unified_record TO authenticated;
GRANT SELECT ON public.audit_trail TO authenticated;
GRANT SELECT ON public.activity_log TO authenticated;
GRANT SELECT ON public.data_sync_log TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
