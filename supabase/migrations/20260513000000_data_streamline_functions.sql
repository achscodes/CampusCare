-- Migration: Data Streamline & Interconnection Functions
-- Created: 2026-05-13
-- Description: Comprehensive SQL functions to interconnect tables, unify data flow, and enable cross-office operations

-- ============================================
-- 1. AUDIT & LOGGING FUNCTIONS
-- ============================================

-- Drop function if exists (for idempotency)
DROP FUNCTION IF EXISTS public.log_audit_trail(
  p_table_name TEXT,
  p_operation TEXT,
  p_record_id UUID,
  p_user_id UUID,
  p_changes JSONB
) CASCADE;

-- Audit trail logging
CREATE OR REPLACE FUNCTION public.log_audit_trail(
  p_table_name TEXT,
  p_operation TEXT,
  p_record_id UUID,
  p_user_id UUID,
  p_changes JSONB
)
RETURNS TABLE(id UUID, table_name TEXT, operation TEXT, record_id UUID, user_id UUID, changes JSONB, logged_at TIMESTAMPTZ)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
INSERT INTO public.audit_trail (table_name, operation, record_id, user_id, changes, logged_at)
VALUES (p_table_name, p_operation, p_record_id, p_user_id, p_changes, NOW())
RETURNING audit_trail.id, audit_trail.table_name, audit_trail.operation, audit_trail.record_id, audit_trail.user_id, audit_trail.changes, audit_trail.logged_at;
$$;

-- ============================================
-- 2. STUDENT PROFILE UNIFICATION FUNCTIONS
-- ============================================

-- Get complete student profile across all offices
DROP FUNCTION IF EXISTS public.get_student_unified_profile(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_student_unified_profile(p_student_id UUID)
RETURNS TABLE(
  student_id UUID,
  user_email TEXT,
  first_name TEXT,
  last_name TEXT,
  student_number TEXT,
  program TEXT,
  year_level TEXT,
  discipline_case_count INTEGER,
  active_discipline_cases INTEGER,
  health_appointment_count INTEGER,
  upcoming_appointments INTEGER,
  scholarship_applications INTEGER,
  active_scholarships INTEGER,
  pending_clearances INTEGER,
  pending_referrals INTEGER,
  last_updated TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
SELECT
  p_student_id,
  au.email,
  pr.first_name,
  pr.last_name,
  pr.student_number,
  pr.program,
  pr.year_level,
  COALESCE(do_cases.total, 0)::INTEGER,
  COALESCE(do_cases.active, 0)::INTEGER,
  COALESCE(ha.total, 0)::INTEGER,
  COALESCE(ha.upcoming, 0)::INTEGER,
  COALESCE(sa.total, 0)::INTEGER,
  COALESCE(sa.active, 0)::INTEGER,
  COALESCE(sc.pending, 0)::INTEGER,
  COALESCE(ref.pending, 0)::INTEGER,
  GREATEST(
    pr.updated_at,
    COALESCE(do_cases.latest, NOW()),
    COALESCE(ha.latest, NOW()),
    COALESCE(sa.latest, NOW()),
    COALESCE(ref.latest, NOW())
  )
FROM
  auth.users au
  LEFT JOIN profiles pr ON au.id = pr.id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed', 'dismissed')) as active,
      MAX(updated_at) as latest
    FROM discipline_cases
    WHERE student_id = p_student_id
  ) do_cases ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE appointment_date >= CURRENT_DATE) as upcoming,
      MAX(updated_at) as latest
    FROM health_appointments
    WHERE student_id = p_student_id
  ) ha ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'active') as active,
      MAX(updated_at) as latest
    FROM scholar_enrollments
    WHERE student_id = p_student_id
  ) sa ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) as pending,
      MAX(updated_at) as latest
    FROM sdao_clearance_records
    WHERE student_id = p_student_id AND status_key != 'completed'
  ) sc ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) as pending,
      MAX(updated_at) as latest
    FROM referrals
    WHERE student_id = p_student_id AND status IN ('sent', 'acknowledged', 'in_progress')
  ) ref ON TRUE
WHERE au.id = p_student_id;
$$;

-- ============================================
-- 3. REFERRAL MANAGEMENT FUNCTIONS
-- ============================================

-- Create cross-office referral with auto-notification
DROP FUNCTION IF EXISTS public.create_cross_office_referral(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) CASCADE;

CREATE OR REPLACE FUNCTION public.create_cross_office_referral(
  p_student_id UUID,
  p_from_office TEXT,
  p_to_office TEXT,
  p_reason TEXT,
  p_urgency TEXT DEFAULT 'normal',
  p_details JSONB DEFAULT '{}'::JSONB,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE(
  referral_id UUID,
  reference_number TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_id UUID;
  v_reference_number TEXT;
  v_student_email TEXT;
  v_student_name TEXT;
  v_recipient_ids UUID[];
BEGIN
  -- Get student info
  SELECT email, CONCAT(pr.first_name, ' ', pr.last_name)
  INTO v_student_email, v_student_name
  FROM auth.users au
  LEFT JOIN profiles pr ON au.id = pr.id
  WHERE au.id = p_student_id;

  -- Generate reference number
  v_reference_number := 'REF-' || TO_CHAR(NOW(), 'YYYY-MM-DD') || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));

  -- Create unified referral
  INSERT INTO referrals (
    student_id, 
    referring_office, 
    receiving_office, 
    reason, 
    urgency, 
    status, 
    reference_number,
    additional_data,
    created_by
  ) VALUES (
    p_student_id,
    p_from_office,
    p_to_office,
    p_reason,
    p_urgency,
    'sent',
    v_reference_number,
    p_details,
    p_created_by
  )
  RETURNING referrals.id, referrals.reference_number, referrals.status, referrals.created_at
  INTO v_referral_id, v_reference_number, v_status, v_created_at;

  -- Get recipients (staff in receiving office)
  SELECT ARRAY_AGG(id)
  INTO v_recipient_ids
  FROM profiles
  WHERE office = p_to_office AND role IN ('staff', 'admin');

  -- Create notifications for receiving office staff
  IF v_recipient_ids IS NOT NULL AND ARRAY_LENGTH(v_recipient_ids, 1) > 0 THEN
    INSERT INTO notifications (user_id, category, title, body, href, created_at)
    SELECT
      uid,
      'referral',
      'New Referral: ' || p_reason,
      'Student ' || v_student_name || ' referred from ' || p_from_office || '. Urgency: ' || p_urgency,
      '/referrals/' || v_referral_id,
      NOW()
    FROM UNNEST(v_recipient_ids) AS uid;
  END IF;

  -- Log audit trail
  PERFORM log_audit_trail(
    'referrals',
    'CREATE',
    v_referral_id,
    p_created_by,
    jsonb_build_object(
      'from_office', p_from_office,
      'to_office', p_to_office,
      'reason', p_reason,
      'urgency', p_urgency
    )
  );

  RETURN QUERY SELECT v_referral_id, v_reference_number, 'sent'::TEXT, NOW();
END;
$$;

-- Link document request to referral
DROP FUNCTION IF EXISTS public.link_document_to_referral(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.link_document_to_referral(
  p_doc_request_id UUID,
  p_referral_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE inter_office_document_requests
  SET linked_referral_id = p_referral_id,
      updated_at = NOW()
  WHERE id = p_doc_request_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Document request not found'::TEXT;
  ELSE
    RETURN QUERY SELECT TRUE, 'Document linked to referral'::TEXT;
  END IF;
END;
$$;

-- ============================================
-- 4. SCHOLARSHIP MANAGEMENT FUNCTIONS
-- ============================================

-- Process scholar enrollment from application
DROP FUNCTION IF EXISTS public.process_scholar_enrollment(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.process_scholar_enrollment(
  p_application_id UUID
)
RETURNS TABLE(
  enrollment_id UUID,
  reference_number TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id UUID;
  v_reference_number TEXT;
  v_student_id UUID;
  v_program_id UUID;
BEGIN
  -- Get application details
  SELECT student_id, program_id
  INTO v_student_id, v_program_id
  FROM scholarship_applications
  WHERE id = p_application_id;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Generate enrollment reference
  v_reference_number := 'ENR-' || TO_CHAR(NOW(), 'YYYY-MM-DD') || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));

  -- Create enrollment
  INSERT INTO scholar_enrollments (
    program_id,
    student_id,
    application_id,
    reference_number,
    status,
    academic_year,
    term,
    year_level,
    started_at
  )
  SELECT
    p.id,
    v_student_id,
    p_application_id,
    v_reference_number,
    'active',
    p.academic_year,
    p.term,
    sa.current_year_level,
    NOW()
  FROM scholarship_programs p
  LEFT JOIN scholarship_applications sa ON sa.id = p_application_id
  WHERE p.id = v_program_id
  RETURNING scholar_enrollments.id INTO v_enrollment_id;

  -- Update application status
  UPDATE scholarship_applications
  SET status = 'approved'::application_status,
      decided_at = NOW()
  WHERE id = p_application_id;

  -- Create notification
  INSERT INTO notifications (user_id, category, title, body, href)
  VALUES (
    v_student_id,
    'scholarship',
    'Scholarship Approved!',
    'Your scholarship application has been approved. Welcome to the program!',
    '/my-scholarship/' || v_enrollment_id
  );

  RETURN QUERY SELECT v_enrollment_id, v_reference_number, 'active'::TEXT, NOW();
END;
$$;

-- Calculate overall compliance status for scholar
DROP FUNCTION IF EXISTS public.calculate_scholar_compliance_status(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_scholar_compliance_status(p_enrollment_id UUID)
RETURNS TABLE(
  enrollment_id UUID,
  compliance_status TEXT,
  total_items INTEGER,
  pending_items INTEGER,
  verified_items INTEGER,
  overdue_items INTEGER,
  completion_percentage DECIMAL
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
SELECT
  p_enrollment_id,
  CASE
    WHEN pending_count = 0 AND overdue_count = 0 THEN 'compliant'
    WHEN overdue_count > 0 THEN 'non_compliant'
    WHEN pending_count > 0 THEN 'in_progress'
    ELSE 'compliant'
  END,
  total_count,
  pending_count,
  verified_count,
  overdue_count,
  ROUND((verified_count::DECIMAL / NULLIF(total_count, 0)) * 100, 2)
FROM (
  SELECT
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'verified') as verified_count,
    COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count
  FROM compliance_items
  WHERE enrollment_id = p_enrollment_id
) stats;
$$;

-- ============================================
-- 5. HEALTH SERVICES FUNCTIONS
-- ============================================

-- Get student health summary
DROP FUNCTION IF EXISTS public.get_student_health_summary(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_student_health_summary(p_student_id UUID)
RETURNS TABLE(
  student_id UUID,
  total_appointments INTEGER,
  completed_appointments INTEGER,
  upcoming_appointments INTEGER,
  last_consultation TIMESTAMPTZ,
  active_referrals INTEGER,
  pending_documents INTEGER
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
SELECT
  p_student_id,
  COALESCE(COUNT(DISTINCT ha.id), 0)::INTEGER,
  COALESCE(COUNT(DISTINCT ha.id) FILTER (WHERE DATE(ha.appointment_date) < CURRENT_DATE), 0)::INTEGER,
  COALESCE(COUNT(DISTINCT ha.id) FILTER (WHERE DATE(ha.appointment_date) >= CURRENT_DATE), 0)::INTEGER,
  MAX(hc.created_at),
  COALESCE(COUNT(DISTINCT hr.id) FILTER (WHERE hr.status IN ('sent', 'acknowledged')), 0)::INTEGER,
  COALESCE(COUNT(DISTINCT hdr.id) FILTER (WHERE hdr.status NOT IN ('submitted', 'verified')), 0)::INTEGER
FROM health_appointments ha
LEFT JOIN health_consultations hc ON ha.id = hc.appointment_id
LEFT JOIN health_referrals hr ON hc.id = hr.consultation_id
LEFT JOIN health_document_requests hdr ON hc.id = hdr.consultation_id
WHERE ha.student_id = p_student_id
GROUP BY p_student_id;
$$;

-- Queue student for health service
DROP FUNCTION IF EXISTS public.queue_student_for_service(
  UUID, UUID, TEXT, TEXT, TIMESTAMPTZ
) CASCADE;

CREATE OR REPLACE FUNCTION public.queue_student_for_service(
  p_student_id UUID,
  p_staff_id UUID,
  p_service TEXT,
  p_purpose TEXT,
  p_appointment_date TIMESTAMPTZ
)
RETURNS TABLE(
  appointment_id UUID,
  ticket_code TEXT,
  queue_position INTEGER,
  estimated_wait_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id UUID;
  v_ticket_code TEXT;
  v_queue_position INTEGER;
  v_wait_time INTEGER;
BEGIN
  -- Create appointment
  INSERT INTO health_appointments (
    student_id,
    staff_id,
    appointment_date,
    service,
    purpose,
    status
  ) VALUES (
    p_student_id,
    p_staff_id,
    p_appointment_date,
    p_service,
    p_purpose,
    'scheduled'
  )
  RETURNING id INTO v_appointment_id;

  -- Generate ticket code
  v_ticket_code := SUBSTR(MD5(RANDOM()::TEXT), 1, 8);

  -- Get queue position
  SELECT COUNT(*) + 1
  INTO v_queue_position
  FROM health_queue_tickets
  WHERE DATE(created_at) = CURRENT_DATE
    AND status IN ('pending', 'called');

  -- Estimate wait time (avg 15 min per person before)
  v_wait_time := (v_queue_position - 1) * 15;

  -- Create queue ticket
  INSERT INTO health_queue_tickets (
    appointment_id,
    ticket_code,
    queue_position,
    estimated_wait_minutes,
    status,
    expires_at
  ) VALUES (
    v_appointment_id,
    v_ticket_code,
    v_queue_position,
    v_wait_time,
    'pending',
    NOW() + INTERVAL '8 hours'
  );

  -- Create notification
  INSERT INTO notifications (user_id, category, title, body, href)
  VALUES (
    p_student_id,
    'health_appointment',
    'Appointment Scheduled',
    'Your ' || p_service || ' appointment is scheduled. Ticket: ' || v_ticket_code,
    '/health/appointments/' || v_appointment_id
  );

  RETURN QUERY SELECT v_appointment_id, v_ticket_code, v_queue_position, v_wait_time;
END;
$$;

-- ============================================
-- 6. ANALYTICS & REPORTING FUNCTIONS
-- ============================================

-- Get cross-office dashboard metrics
DROP FUNCTION IF EXISTS public.get_office_dashboard_metrics(
  TEXT, DATE, DATE
) CASCADE;

CREATE OR REPLACE FUNCTION public.get_office_dashboard_metrics(
  p_office TEXT,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  office TEXT,
  total_cases INTEGER,
  active_cases INTEGER,
  resolved_cases INTEGER,
  pending_requests INTEGER,
  total_referrals INTEGER,
  incoming_referrals INTEGER,
  outgoing_referrals INTEGER,
  avg_resolution_time_days INTEGER,
  students_served INTEGER
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
SELECT
  p_office,
  COALESCE(total_cases, 0)::INTEGER,
  COALESCE(active_cases, 0)::INTEGER,
  COALESCE(resolved_cases, 0)::INTEGER,
  COALESCE(pending_reqs, 0)::INTEGER,
  COALESCE(total_refs, 0)::INTEGER,
  COALESCE(incoming_refs, 0)::INTEGER,
  COALESCE(outgoing_refs, 0)::INTEGER,
  COALESCE(avg_resolution_days, 0)::INTEGER,
  COALESCE(unique_students, 0)::INTEGER
FROM (
  SELECT
    COUNT(CASE WHEN office_type = 'discipline' THEN 1 END) as total_cases,
    COUNT(CASE WHEN office_type = 'discipline' AND status NOT IN ('resolved', 'closed') THEN 1 END) as active_cases,
    COUNT(CASE WHEN office_type = 'discipline' AND status IN ('resolved', 'closed') THEN 1 END) as resolved_cases,
    COUNT(CASE WHEN office_type = 'document' AND status NOT IN ('submitted', 'verified') THEN 1 END) as pending_reqs,
    COUNT(CASE WHEN office_type = 'referral' THEN 1 END) as total_refs,
    COUNT(CASE WHEN office_type = 'referral' AND receiving_office = p_office THEN 1 END) as incoming_refs,
    COUNT(CASE WHEN office_type = 'referral' AND referring_office = p_office THEN 1 END) as outgoing_refs,
    EXTRACT(DAY FROM AVG(CASE WHEN office_type = 'discipline' THEN updated_at - created_at END))::INTEGER as avg_resolution_days,
    COUNT(DISTINCT CASE WHEN office_type IN ('discipline', 'document', 'referral') THEN student_id END) as unique_students
  FROM (
    SELECT 'discipline' as office_type, student_id, status, created_at, updated_at FROM discipline_cases WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date
    UNION ALL
    SELECT 'document', student_id, status, created_at, updated_at FROM inter_office_document_requests WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date
    UNION ALL
    SELECT 'referral', student_id, status, created_at, updated_at FROM referrals WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date
  ) combined
) metrics;
$$;

-- Get system-wide performance metrics
DROP FUNCTION IF EXISTS public.get_system_performance_metrics(DATE, DATE) CASCADE;

CREATE OR REPLACE FUNCTION public.get_system_performance_metrics(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  metric_name TEXT,
  total_count INTEGER,
  completion_rate DECIMAL,
  avg_duration_days DECIMAL,
  status_distribution JSONB
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
SELECT
  'Discipline Cases' as metric_name,
  COUNT(*)::INTEGER,
  ROUND((COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))::DECIMAL / COUNT(*)) * 100, 2),
  ROUND(AVG(EXTRACT(DAY FROM updated_at - created_at)), 1),
  jsonb_object_agg(status, count) FILTER (WHERE status IS NOT NULL)
FROM (
  SELECT status, COUNT(*) as count
  FROM discipline_cases
  WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date
  GROUP BY status
) stats, (SELECT * FROM discipline_cases WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date)
GROUP BY 1

UNION ALL

SELECT
  'Health Appointments' as metric_name,
  COUNT(*)::INTEGER,
  ROUND((COUNT(*) FILTER (WHERE status IN ('completed', 'attended'))::DECIMAL / COUNT(*)) * 100, 2),
  ROUND(AVG(EXTRACT(DAY FROM updated_at - created_at)), 1),
  jsonb_object_agg(status, count) FILTER (WHERE status IS NOT NULL)
FROM (
  SELECT status, COUNT(*) as count
  FROM health_appointments
  WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date
  GROUP BY status
) stats, (SELECT * FROM health_appointments WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date)
GROUP BY 1

UNION ALL

SELECT
  'Scholarship Applications' as metric_name,
  COUNT(*)::INTEGER,
  ROUND((COUNT(*) FILTER (WHERE status IN ('approved', 'rejected'))::DECIMAL / COUNT(*)) * 100, 2),
  ROUND(AVG(EXTRACT(DAY FROM updated_at - created_at)), 1),
  jsonb_object_agg(status, count) FILTER (WHERE status IS NOT NULL)
FROM (
  SELECT status::TEXT, COUNT(*) as count
  FROM scholarship_applications
  WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date
  GROUP BY status
) stats, (SELECT * FROM scholarship_applications WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date)
GROUP BY 1;
$$;

-- ============================================
-- 7. HELPER & UTILITY FUNCTIONS
-- ============================================

-- Generate comprehensive student report
DROP FUNCTION IF EXISTS public.generate_student_report(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.generate_student_report(p_student_id UUID)
RETURNS TABLE(
  student_id UUID,
  profile JSONB,
  discipline_summary JSONB,
  health_summary JSONB,
  scholarship_summary JSONB,
  referrals_summary JSONB,
  generated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile JSONB;
  v_discipline JSONB;
  v_health JSONB;
  v_scholarship JSONB;
  v_referrals JSONB;
BEGIN
  -- Profile
  SELECT jsonb_build_object(
    'student_id', pr.id,
    'name', CONCAT(pr.first_name, ' ', pr.last_name),
    'email', au.email,
    'program', pr.program,
    'year_level', pr.year_level
  ) INTO v_profile
  FROM profiles pr
  LEFT JOIN auth.users au ON pr.id = au.id
  WHERE pr.id = p_student_id;

  -- Discipline Summary
  SELECT jsonb_build_object(
    'total_cases', COUNT(*),
    'active_cases', COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed')),
    'recent_case', MAX(created_at)::TEXT
  ) INTO v_discipline
  FROM discipline_cases
  WHERE student_id = p_student_id;

  -- Health Summary
  SELECT jsonb_build_object(
    'total_appointments', COUNT(*),
    'upcoming_appointments', COUNT(*) FILTER (WHERE DATE(appointment_date) >= CURRENT_DATE),
    'recent_consultation', MAX(created_at)::TEXT
  ) INTO v_health
  FROM health_appointments
  WHERE student_id = p_student_id;

  -- Scholarship Summary
  SELECT jsonb_build_object(
    'applications', COUNT(*),
    'active_enrollments', COUNT(*) FILTER (WHERE status = 'active'),
    'compliance_status', COALESCE((SELECT compliance_status FROM calculate_scholar_compliance_status(MAX(id))), 'N/A')
  ) INTO v_scholarship
  FROM scholar_enrollments
  WHERE student_id = p_student_id;

  -- Referrals Summary
  SELECT jsonb_build_object(
    'total_referrals', COUNT(*),
    'pending_referrals', COUNT(*) FILTER (WHERE status IN ('sent', 'acknowledged', 'in_progress')),
    'recent_referral', MAX(created_at)::TEXT
  ) INTO v_referrals
  FROM referrals
  WHERE student_id = p_student_id;

  RETURN QUERY SELECT
    p_student_id,
    v_profile,
    v_discipline,
    v_health,
    v_scholarship,
    v_referrals,
    NOW();
END;
$$;

-- Cleanup expired queue tickets
DROP FUNCTION IF EXISTS public.cleanup_expired_tickets() CASCADE;

CREATE OR REPLACE FUNCTION public.cleanup_expired_tickets()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM health_queue_tickets
  WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT v_deleted;
END;
$$;

-- ============================================
-- 8. NOTIFY & ALERT FUNCTIONS
-- ============================================

-- Send cross-office alert for high-priority cases
DROP FUNCTION IF EXISTS public.send_cross_office_alert(
  UUID, TEXT, TEXT, JSONB
) CASCADE;

CREATE OR REPLACE FUNCTION public.send_cross_office_alert(
  p_student_id UUID,
  p_alert_type TEXT,
  p_offices TEXT[] DEFAULT ARRAY['discipline', 'health', 'sdao'],
  p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE(notifications_sent INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office TEXT;
  v_staff_ids UUID[];
  v_count INTEGER := 0;
BEGIN
  -- Get student name
  DECLARE
    v_student_name TEXT;
  BEGIN
    SELECT CONCAT(first_name, ' ', last_name)
    INTO v_student_name
    FROM profiles
    WHERE id = p_student_id;

    -- Send to each office
    FOREACH v_office IN ARRAY p_offices LOOP
      SELECT ARRAY_AGG(id)
      INTO v_staff_ids
      FROM profiles
      WHERE office = v_office AND role IN ('staff', 'admin');

      IF v_staff_ids IS NOT NULL AND ARRAY_LENGTH(v_staff_ids, 1) > 0 THEN
        INSERT INTO notifications (user_id, category, title, body, href)
        SELECT
          uid,
          'alert',
          'Alert: ' || p_alert_type,
          'Student ' || v_student_name || ' - ' || p_details->>'message' || '. Priority: ' || COALESCE(p_details->>'priority', 'normal'),
          '/students/' || p_student_id || '/profile'
        FROM UNNEST(v_staff_ids) AS uid;

        v_count := v_count + ARRAY_LENGTH(v_staff_ids, 1);
      END IF;
    END LOOP;
  END;

  RETURN QUERY SELECT v_count;
END;
$$;

-- ============================================
-- 9. GRANT PERMISSIONS
-- ============================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_student_unified_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_cross_office_referral(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_scholar_enrollment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_health_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_student_for_service(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_office_dashboard_metrics(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_performance_metrics(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_student_report(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_cross_office_alert(UUID, TEXT, TEXT[], JSONB) TO authenticated;

-- ============================================
-- 10. CREATE SUPPORTING TABLES IF NOT EXISTS
-- ============================================

-- Audit trail table
CREATE TABLE IF NOT EXISTS public.audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
  record_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  changes JSONB,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_trail_table_idx ON public.audit_trail (table_name, logged_at DESC);
CREATE INDEX IF NOT EXISTS audit_trail_user_idx ON public.audit_trail (user_id);
CREATE INDEX IF NOT EXISTS audit_trail_record_idx ON public.audit_trail (record_id);

ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for audit trail
CREATE POLICY audit_trail_read_own ON public.audit_trail
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
  ));

-- Unified referrals table (if not exists)
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referring_office TEXT NOT NULL,
  receiving_office TEXT NOT NULL,
  reason TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'acknowledged', 'in_progress', 'completed', 'cancelled')),
  reference_number TEXT UNIQUE,
  additional_data JSONB,
  linked_referral_id UUID,
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS referrals_student_idx ON public.referrals (student_id);
CREATE INDEX IF NOT EXISTS referrals_office_idx ON public.referrals (receiving_office, created_at DESC);
CREATE INDEX IF NOT EXISTS referrals_status_idx ON public.referrals (status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Document linking table
ALTER TABLE inter_office_document_requests
ADD COLUMN IF NOT EXISTS linked_referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inter_office_doc_referral_idx 
ON inter_office_document_requests(linked_referral_id) 
WHERE linked_referral_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
