/**
 * Data Interconnection Service Layer
 * Provides unified access to cross-office student data and operations
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export type SupabaseClient = ReturnType<typeof createClient<Database>>;

// ============================================
// STUDENT PROFILE SERVICES
// ============================================

export const studentProfileService = {
  /**
   * Get complete unified profile for a student across all offices
   */
  async getUnifiedProfile(supabase: SupabaseClient, studentId: string) {
    const { data, error } = await supabase.rpc('get_student_unified_profile', {
      p_student_id: studentId,
    });

    if (error) throw new Error(`Failed to fetch unified profile: ${error.message}`);
    return data?.[0] || null;
  },

  /**
   * Generate comprehensive student report with all office summaries
   */
  async generateStudentReport(supabase: SupabaseClient, studentId: string) {
    const { data, error } = await supabase.rpc('generate_student_report', {
      p_student_id: studentId,
    });

    if (error) throw new Error(`Failed to generate report: ${error.message}`);
    return data?.[0] || null;
  },

  /**
   * Get health services summary for a student
   */
  async getHealthSummary(supabase: SupabaseClient, studentId: string) {
    const { data, error } = await supabase.rpc('get_student_health_summary', {
      p_student_id: studentId,
    });

    if (error) throw new Error(`Failed to fetch health summary: ${error.message}`);
    return data?.[0] || null;
  },
};

// ============================================
// REFERRAL MANAGEMENT SERVICES
// ============================================

export const referralService = {
  /**
   * Create a cross-office referral with automatic notifications
   */
  async createCrossOfficeReferral(
    supabase: SupabaseClient,
    studentId: string,
    fromOffice: string,
    toOffice: string,
    reason: string,
    urgency: 'low' | 'normal' | 'high' | 'critical' = 'normal',
    details?: Record<string, any>,
    createdBy?: string
  ) {
    const { data, error } = await supabase.rpc('create_cross_office_referral', {
      p_student_id: studentId,
      p_from_office: fromOffice,
      p_to_office: toOffice,
      p_reason: reason,
      p_urgency: urgency,
      p_details: details || {},
      p_created_by: createdBy,
    });

    if (error) throw new Error(`Failed to create referral: ${error.message}`);
    return data?.[0] || null;
  },

  /**
   * Link a document request to a referral
   */
  async linkDocumentToReferral(
    supabase: SupabaseClient,
    docRequestId: string,
    referralId: string
  ) {
    const { data, error } = await supabase.rpc('link_document_to_referral', {
      p_doc_request_id: docRequestId,
      p_referral_id: referralId,
    });

    if (error) throw new Error(`Failed to link document: ${error.message}`);
    return data?.[0] || null;
  },

  /**
   * Get all referrals for a student
   */
  async getStudentReferrals(supabase: SupabaseClient, studentId: string) {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch referrals: ${error.message}`);
    return data || [];
  },

  /**
   * Get incoming referrals for HSO (Health Services Office)
   */
  async getHSOIncomingReferrals(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('hso_incoming_referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch HSO referrals: ${error.message}`);
    return data || [];
  },

  /**
   * Get outgoing referrals for SDAO (Student Development Affairs Office)
   */
  async getSDAOOutgoingReferrals(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('sdao_outgoing_referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch SDAO referrals: ${error.message}`);
    return data || [];
  },

  /**
   * Get referrals by office and direction
   */
  async getOfficeReferrals(
    supabase: SupabaseClient,
    office: string,
    direction: 'incoming' | 'outgoing' | 'all' = 'all'
  ) {
    let query = supabase.from('referrals').select('*');

    if (direction === 'incoming') {
      query = query.eq('to_service', office);
    } else if (direction === 'outgoing') {
      query = query.eq('from_service', office);
    }
    // else: both incoming and outgoing (already included in base query)

    query = query
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch office referrals: ${error.message}`);
    return data || [];
  },

  /**
   * Update referral status
   */
  async updateReferralStatus(
    supabase: SupabaseClient,
    referralId: string,
    status: string,
    notes?: string
  ) {
    const { data, error } = await supabase
      .from('referrals')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', referralId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update referral: ${error.message}`);
    return data;
  },

  /**
   * Debug: Check current user's office and referral visibility
   */
  async debugReferralVisibility(supabase: SupabaseClient) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.user.id)
      .single();

    // Get user's referrals
    const { data: referrals } = await supabase
      .from('referrals')
      .select('id, reference_id, from_service, to_service, status')
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      userId: user.user.id,
      userEmail: user.user.email,
      userProfile: profile,
      visibleReferrals: referrals || [],
      diagnostics: {
        profileOffice: profile?.office,
        profileRole: profile?.role,
        totalVisibleReferrals: referrals?.length || 0,
      },
    };
  },
};

// ============================================
// SCHOLARSHIP MANAGEMENT SERVICES
// ============================================

export const scholarshipService = {
  /**
   * Process scholar enrollment from an application
   */
  async processEnrollment(supabase: SupabaseClient, applicationId: string) {
    const { data, error } = await supabase.rpc('process_scholar_enrollment', {
      p_application_id: applicationId,
    });

    if (error) throw new Error(`Failed to process enrollment: ${error.message}`);
    return data?.[0] || null;
  },

  /**
   * Calculate compliance status for a scholar
   */
  async getComplianceStatus(supabase: SupabaseClient, enrollmentId: string) {
    const { data, error } = await supabase.rpc('calculate_scholar_compliance_status', {
      p_enrollment_id: enrollmentId,
    });

    if (error) throw new Error(`Failed to fetch compliance status: ${error.message}`);
    return data?.[0] || null;
  },

  /**
   * Get pending compliance items for a scholar
   */
  async getPendingCompliances(supabase: SupabaseClient, enrollmentId: string) {
    const { data, error } = await supabase
      .from('compliance_items')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .neq('status', 'verified')
      .neq('status', 'waived')
      .order('due_date', { ascending: true });

    if (error) throw new Error(`Failed to fetch compliance items: ${error.message}`);
    return data || [];
  },

  /**
   * Submit compliance item for verification
   */
  async submitComplianceItem(
    supabase: SupabaseClient,
    itemId: string,
    evidence: {
      file_path?: string;
      document_url?: string;
      notes?: string;
    }
  ) {
    const { data, error } = await supabase
      .from('compliance_items')
      .update({
        status: 'submitted',
        evidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw new Error(`Failed to submit compliance: ${error.message}`);
    return data;
  },
};

// ============================================
// HEALTH SERVICES INTEGRATION
// ============================================

export const healthService = {
  /**
   * Queue a student for health service
   */
  async queueForService(
    supabase: SupabaseClient,
    studentId: string,
    staffId: string,
    service: string,
    purpose: string,
    appointmentDate: Date
  ) {
    const { data, error } = await supabase.rpc('queue_student_for_service', {
      p_student_id: studentId,
      p_staff_id: staffId,
      p_service: service,
      p_purpose: purpose,
      p_appointment_date: appointmentDate.toISOString(),
    });

    if (error) throw new Error(`Failed to queue student: ${error.message}`);
    return data?.[0] || null;
  },

  /**
   * Get upcoming appointments for a student
   */
  async getUpcomingAppointments(supabase: SupabaseClient, studentId: string) {
    const { data, error } = await supabase
      .from('health_appointments')
      .select('*')
      .eq('student_id', studentId)
      .gte('appointment_date', new Date().toISOString())
      .order('appointment_date', { ascending: true });

    if (error) throw new Error(`Failed to fetch appointments: ${error.message}`);
    return data || [];
  },

  /**
   * Record vital signs for an appointment
   */
  async recordVitalSigns(
    supabase: SupabaseClient,
    appointmentId: string,
    ticketId: string,
    vitals: {
      temperature?: number;
      heart_rate?: number;
      blood_pressure_systolic?: number;
      blood_pressure_diastolic?: number;
      oxygen_saturation?: number;
      weight?: number;
      height?: number;
      notes?: string;
    }
  ) {
    const { data, error } = await supabase
      .from('health_vital_signs')
      .insert({
        appointment_id: appointmentId,
        ticket_id: ticketId,
        recorded_by: (await supabase.auth.getUser()).data.user?.id || '',
        recorded_at: new Date().toISOString(),
        ...vitals,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to record vital signs: ${error.message}`);
    return data;
  },
};

// ============================================
// ANALYTICS & REPORTING SERVICES
// ============================================

export const analyticsService = {
  /**
   * Get dashboard metrics for an office
   */
  async getOfficeDashboard(
    supabase: SupabaseClient,
    office: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const { data, error } = await supabase.rpc('get_office_dashboard_metrics', {
      p_office: office,
      p_start_date: startDate?.toISOString().split('T')[0] || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      p_end_date: endDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    });

    if (error) throw new Error(`Failed to fetch dashboard: ${error.message}`);
    return data?.[0] || null;
  },

  /**
   * Get system-wide performance metrics
   */
  async getSystemMetrics(
    supabase: SupabaseClient,
    startDate?: Date,
    endDate?: Date
  ) {
    const { data, error } = await supabase.rpc('get_system_performance_metrics', {
      p_start_date: startDate?.toISOString().split('T')[0] || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      p_end_date: endDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    });

    if (error) throw new Error(`Failed to fetch metrics: ${error.message}`);
    return data || [];
  },

  /**
   * Get audit trail for an entity
   */
  async getAuditTrail(supabase: SupabaseClient, entityId: string) {
    const { data, error } = await supabase
      .from('audit_trail')
      .select('*')
      .eq('record_id', entityId)
      .order('logged_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch audit trail: ${error.message}`);
    return data || [];
  },
};

// ============================================
// NOTIFICATION SERVICES
// ============================================

export const notificationService = {
  /**
   * Send cross-office alert for high-priority cases
   */
  async sendCrossOfficeAlert(
    supabase: SupabaseClient,
    studentId: string,
    alertType: string,
    offices: string[] = ['discipline', 'health', 'sdao'],
    details?: {
      message: string;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      [key: string]: any;
    }
  ) {
    const { data, error } = await supabase.rpc('send_cross_office_alert', {
      p_student_id: studentId,
      p_alert_type: alertType,
      p_offices: offices,
      p_details: details || { message: alertType },
    });

    if (error) throw new Error(`Failed to send alert: ${error.message}`);
    return data?.[0] || null;
  },

  /**
   * Get notifications for current user
   */
  async getUserNotifications(
    supabase: SupabaseClient,
    unreadOnly: boolean = false
  ) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch notifications: ${error.message}`);
    return data || [];
  },

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(supabase: SupabaseClient, notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update notification: ${error.message}`);
    return data;
  },
};

// ============================================
// DATA INTEGRITY & MAINTENANCE
// ============================================

export const maintenanceService = {
  /**
   * Cleanup expired queue tickets
   */
  async cleanupExpiredTickets(supabase: SupabaseClient) {
    const { data, error } = await supabase.rpc('cleanup_expired_tickets');

    if (error) throw new Error(`Failed to cleanup tickets: ${error.message}`);
    return data?.[0]?.deleted_count || 0;
  },

  /**
   * Log activity for audit trail
   */
  async logActivity(
    supabase: SupabaseClient,
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, any>
  ) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('activity_log')
      .insert({
        actor_id: user.user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details: details || {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to log activity: ${error.message}`);
    return data;
  },

  /**
   * Get activity log
   */
  async getActivityLog(
    supabase: SupabaseClient,
    filters?: {
      actor_id?: string;
      action?: string;
      entity_type?: string;
      limit?: number;
    }
  ) {
    let query = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.actor_id) {
      query = query.eq('actor_id', filters.actor_id);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.entity_type) {
      query = query.eq('entity_type', filters.entity_type);
    }

    query = query.limit(filters?.limit || 100);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch activity log: ${error.message}`);
    return data || [];
  },
};

export default {
  studentProfileService,
  referralService,
  scholarshipService,
  healthService,
  analyticsService,
  notificationService,
  maintenanceService,
};
