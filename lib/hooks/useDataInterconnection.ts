/**
 * React Hook: useDataInterconnection
 * Simplified interface for data interconnection services in React components
 */

'use client';

import { useCallback, useState } from 'react';
import { useSupabase } from '@/lib/hooks/useSupabase';
import {
  studentProfileService,
  referralService,
  scholarshipService,
  healthService,
  analyticsService,
  notificationService,
  maintenanceService,
} from './data-interconnection.service';

export interface UseDataInterconnectionOptions {
  autoFetch?: boolean;
  studentId?: string;
}

export const useDataInterconnection = (options: UseDataInterconnectionOptions = {}) => {
  const { supabase } = useSupabase();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  // ============================================
  // STUDENT PROFILE HOOKS
  // ============================================

  const getStudentProfile = useCallback(
    async (studentId: string) => {
      try {
        setLoading(true);
        setError(null);
        const profile = await studentProfileService.getUnifiedProfile(supabase, studentId);
        return profile;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const generateStudentReport = useCallback(
    async (studentId: string) => {
      try {
        setLoading(true);
        setError(null);
        const report = await studentProfileService.generateStudentReport(supabase, studentId);
        return report;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const getHealthSummary = useCallback(
    async (studentId: string) => {
      try {
        setLoading(true);
        setError(null);
        const summary = await studentProfileService.getHealthSummary(supabase, studentId);
        return summary;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  // ============================================
  // REFERRAL HOOKS
  // ============================================

  const createReferral = useCallback(
    async (
      studentId: string,
      fromOffice: string,
      toOffice: string,
      reason: string,
      urgency: 'low' | 'normal' | 'high' | 'critical' = 'normal'
    ) => {
      try {
        setLoading(true);
        setError(null);
        const referral = await referralService.createCrossOfficeReferral(
          supabase,
          studentId,
          fromOffice,
          toOffice,
          reason,
          urgency
        );
        return referral;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const getStudentReferrals = useCallback(
    async (studentId: string) => {
      try {
        setLoading(true);
        setError(null);
        const referrals = await referralService.getStudentReferrals(supabase, studentId);
        return referrals;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const getHSOIncomingReferrals = useCallback(
    async () => {
      try {
        setLoading(true);
        setError(null);
        const referrals = await referralService.getHSOIncomingReferrals(supabase);
        return referrals;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const getSDAOOutgoingReferrals = useCallback(
    async () => {
      try {
        setLoading(true);
        setError(null);
        const referrals = await referralService.getSDAOOutgoingReferrals(supabase);
        return referrals;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const debugReferralVisibility = useCallback(
    async () => {
      try {
        setLoading(true);
        setError(null);
        const debug = await referralService.debugReferralVisibility(supabase);
        return debug;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const updateReferralStatus = useCallback(
    async (referralId: string, status: string) => {
      try {
        setLoading(true);
        setError(null);
        const updated = await referralService.updateReferralStatus(supabase, referralId, status);
        return updated;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  // ============================================
  // SCHOLARSHIP HOOKS
  // ============================================

  const processEnrollment = useCallback(
    async (applicationId: string) => {
      try {
        setLoading(true);
        setError(null);
        const enrollment = await scholarshipService.processEnrollment(supabase, applicationId);
        return enrollment;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const getComplianceStatus = useCallback(
    async (enrollmentId: string) => {
      try {
        setLoading(true);
        setError(null);
        const status = await scholarshipService.getComplianceStatus(supabase, enrollmentId);
        return status;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  // ============================================
  // HEALTH SERVICE HOOKS
  // ============================================

  const queueForService = useCallback(
    async (
      studentId: string,
      staffId: string,
      service: string,
      purpose: string,
      appointmentDate: Date
    ) => {
      try {
        setLoading(true);
        setError(null);
        const result = await healthService.queueForService(
          supabase,
          studentId,
          staffId,
          service,
          purpose,
          appointmentDate
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const getUpcomingAppointments = useCallback(
    async (studentId: string) => {
      try {
        setLoading(true);
        setError(null);
        const appointments = await healthService.getUpcomingAppointments(supabase, studentId);
        return appointments;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  // ============================================
  // ANALYTICS HOOKS
  // ============================================

  const getOfficeDashboard = useCallback(
    async (office: string) => {
      try {
        setLoading(true);
        setError(null);
        const dashboard = await analyticsService.getOfficeDashboard(supabase, office);
        return dashboard;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const getSystemMetrics = useCallback(
    async () => {
      try {
        setLoading(true);
        setError(null);
        const metrics = await analyticsService.getSystemMetrics(supabase);
        return metrics;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  // ============================================
  // NOTIFICATION HOOKS
  // ============================================

  const getUserNotifications = useCallback(
    async (unreadOnly = false) => {
      try {
        setLoading(true);
        setError(null);
        const notifications = await notificationService.getUserNotifications(supabase, unreadOnly);
        return notifications;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const sendAlert = useCallback(
    async (
      studentId: string,
      alertType: string,
      offices?: string[],
      details?: Record<string, any>
    ) => {
      try {
        setLoading(true);
        setError(null);
        const result = await notificationService.sendCrossOfficeAlert(
          supabase,
          studentId,
          alertType,
          offices,
          details
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  return {
    loading,
    error,
    // Profile
    getStudentProfile,
    generateStudentReport,
    getHealthSummary,
    // Referral
    createReferral,
    getStudentReferrals,
    getHSOIncomingReferrals,
    getSDAOOutgoingReferrals,
    debugReferralVisibility,
    updateReferralStatus,
    // Scholarship
    processEnrollment,
    getComplianceStatus,
    // Health
    queueForService,
    getUpcomingAppointments,
    // Analytics
    getOfficeDashboard,
    getSystemMetrics,
    // Notifications
    getUserNotifications,
    sendAlert,
  };
};

export default useDataInterconnection;
