// ============================================
// SCHOLARSHIP STORE (Zustand)
// State management for scholarship system
// ============================================

import { create } from 'zustand';
import type {
  ScholarshipProgram,
  ScholarshipApplication,
  ScholarEnrollment,
  ComplianceItem,
  ApplicationDocument,
  ApplicationStatus,
  ScholarshipStatus,
} from './types';
import * as api from './scholarshipApi';

// ============================================
// STORE STATE TYPE
// ============================================

type ScholarshipState = {
  // Data
  programs: ScholarshipProgram[];
  currentProgram: (ScholarshipProgram & { requirements: import('./types').ScholarshipRequirement[] }) | null;
  myApplications: ScholarshipApplication[];
  currentApplication: (ScholarshipApplication & { documents: ApplicationDocument[] }) | null;
  myEnrollment: (ScholarEnrollment & { program: ScholarshipProgram; complianceItems: ComplianceItem[] }) | null;
  enrollmentHistory: ScholarEnrollment[];
  
  // Loading states
  isLoadingPrograms: boolean;
  isLoadingProgram: boolean;
  isLoadingApplications: boolean;
  isLoadingApplication: boolean;
  isLoadingEnrollment: boolean;
  isUploading: boolean;
  isSubmitting: boolean;
  
  // Errors
  error: string | null;
  
  // Actions - Programs
  fetchPrograms: () => Promise<void>;
  fetchProgramById: (id: string) => Promise<void>;
  clearCurrentProgram: () => void;
  
  // Actions - Applications
  fetchMyApplications: () => Promise<void>;
  fetchApplicationById: (id: string) => Promise<void>;
  createApplication: (programId: string, data: {
    currentGpa?: number;
    currentYearLevel?: string;
    currentProgram?: string;
    personalStatement?: string;
  }) => Promise<string | null>; // Returns application ID
  updateApplication: (id: string, data: {
    currentGpa?: number;
    currentYearLevel?: string;
    currentProgram?: string;
    personalStatement?: string;
  }) => Promise<void>;
  submitApplication: (id: string) => Promise<void>;
  archiveApplication: (id: string, reason?: string) => Promise<void>;
  clearCurrentApplication: () => void;
  
  // Actions - Documents
  uploadDocument: (applicationId: string, requirementId: string, file: File | Blob, fileName: string, mimeType: string) => Promise<void>;
  deleteDocument: (docId: string) => Promise<void>;
  
  // Actions - Enrollment (My Scholarship)
  fetchMyEnrollment: () => Promise<void>;
  fetchEnrollmentHistory: () => Promise<void>;
  submitCompliance: (itemId: string, enrollmentId: string, file: File | Blob, fileName: string, mimeType: string) => Promise<void>;
  
  // Actions - Realtime
  subscribeToApplication: (applicationId: string) => (() => void);
  subscribeToCompliance: (enrollmentId: string) => (() => void);
  
  // Actions - General
  clearError: () => void;
  reset: () => void;
  
  // Computed selectors
  getApplicationById: (id: string) => ScholarshipApplication | undefined;
  getApplicationsByStatus: (status: ApplicationStatus | 'all') => ScholarshipApplication[];
  getPendingComplianceItems: () => ComplianceItem[];
  getOverdueComplianceItems: () => ComplianceItem[];
  getApplicationProgress: (applicationId: string) => { total: number; uploaded: number; percentage: number };
};

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useScholarshipStore = create<ScholarshipState>((set, get) => ({
  // Initial state
  programs: [],
  currentProgram: null,
  myApplications: [],
  currentApplication: null,
  myEnrollment: null,
  enrollmentHistory: [],
  
  isLoadingPrograms: false,
  isLoadingProgram: false,
  isLoadingApplications: false,
  isLoadingApplication: false,
  isLoadingEnrollment: false,
  isUploading: false,
  isSubmitting: false,
  
  error: null,

  // ============================================
  // PROGRAMS
  // ============================================
  
  fetchPrograms: async () => {
    set({ isLoadingPrograms: true, error: null });
    console.log('[scholarships] Fetching programs');
    
    try {
      const programs = await api.getPrograms();
      console.log('[scholarships] Fetched', programs.length, 'programs');
      set({ programs, isLoadingPrograms: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load programs';
      console.error('[scholarships] Fetch programs error:', err);
      set({ error: message, isLoadingPrograms: false });
    }
  },

  fetchProgramById: async (id: string) => {
    set({ isLoadingProgram: true, error: null });
    console.log('[scholarships] Fetching program:', id);
    
    try {
      const program = await api.getProgramById(id);
      console.log('[scholarships] Fetched program with', program.requirements.length, 'requirements');
      set({ currentProgram: program, isLoadingProgram: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load program';
      console.error('[scholarships] Fetch program error:', err);
      set({ error: message, isLoadingProgram: false });
    }
  },

  clearCurrentProgram: () => {
    set({ currentProgram: null });
  },

  // ============================================
  // APPLICATIONS
  // ============================================
  
  fetchMyApplications: async () => {
    set({ isLoadingApplications: true, error: null });
    console.log('[scholarships] Fetching my applications');
    
    try {
      const applications = await api.getMyApplications();
      console.log('[scholarships] Fetched', applications.length, 'applications');
      set({ myApplications: applications, isLoadingApplications: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load applications';
      console.error('[scholarships] Fetch applications error:', err);
      set({ error: message, isLoadingApplications: false });
    }
  },

  fetchApplicationById: async (id: string) => {
    set({ isLoadingApplication: true, error: null });
    console.log('[scholarships] Fetching application:', id);
    
    try {
      const application = await api.getApplicationById(id);
      console.log('[scholarships] Fetched application with', application.documents.length, 'documents');
      set({ currentApplication: application, isLoadingApplication: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load application';
      console.error('[scholarships] Fetch application error:', err);
      set({ error: message, isLoadingApplication: false });
    }
  },

  createApplication: async (programId: string, data) => {
    set({ isSubmitting: true, error: null });
    console.log('[scholarships] Creating application for program:', programId);
    
    try {
      const application = await api.createApplication({
        programId,
      });
      
      console.log('[scholarships] Created application:', application.id);
      
      // Pre-set currentApplication so apply screen skips its fetch on mount
      set({
        currentApplication: { ...application, documents: [] },
      });

      // Refresh the list in background (don't await — screen is already navigating)
      get().fetchMyApplications();
      set({ isSubmitting: false });
      
      return application.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create application';
      console.error('[scholarships] Create application error:', err);
      set({ error: message, isSubmitting: false });
      return null;
    }
  },

  updateApplication: async (id: string, data) => {
    set({ isSubmitting: true, error: null });
    console.log('[scholarships] Updating application:', id);
    
    try {
      await api.updateApplication(id, data);
      console.log('[scholarships] Updated application:', id);
      
      // Refresh current application if loaded
      if (get().currentApplication?.id === id) {
        await get().fetchApplicationById(id);
      }
      
      set({ isSubmitting: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update application';
      console.error('[scholarships] Update application error:', err);
      set({ error: message, isSubmitting: false });
      throw err;
    }
  },

  submitApplication: async (id: string) => {
    set({ isSubmitting: true, error: null });
    console.log('[scholarships] Submitting application:', id);
    
    try {
      await api.submitApplication(id);
      console.log('[scholarships] Submitted application:', id);
      
      // Refresh
      await get().fetchApplicationById(id);
      await get().fetchMyApplications();
      
      set({ isSubmitting: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit application';
      console.error('[scholarships] Submit application error:', err);
      set({ error: message, isSubmitting: false });
      throw err;
    }
  },

  archiveApplication: async (id: string, reason?: string) => {
    set({ isSubmitting: true, error: null });
    console.log('[scholarships] Archiving application:', id);
    
    try {
      await api.archiveApplication(id, reason);
      console.log('[scholarships] Archived application:', id);
      
      // Remove from list
      set((state) => ({
        myApplications: state.myApplications.filter(a => a.id !== id),
        isSubmitting: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to archive application';
      console.error('[scholarships] Archive application error:', err);
      set({ error: message, isSubmitting: false });
      throw err;
    }
  },

  clearCurrentApplication: () => {
    set({ currentApplication: null });
  },

  // ============================================
  // DOCUMENTS
  // ============================================
  
  uploadDocument: async (applicationId: string, requirementId: string, file: File | Blob, fileName: string, mimeType: string) => {
    set({ isUploading: true, error: null });
    console.log('[scholarships] Uploading document for application:', applicationId);
    
    try {
      await api.uploadApplicationDocument({
        applicationId,
        requirementId,
        file,
        fileName,
        mimeType,
      });
      
      console.log('[scholarships] Uploaded document');
      
      // Refresh application
      if (get().currentApplication?.id === applicationId) {
        await get().fetchApplicationById(applicationId);
      }
      
      set({ isUploading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload document';
      console.error('[scholarships] Upload document error:', err);
      set({ error: message, isUploading: false });
      throw err;
    }
  },

  deleteDocument: async (docId: string) => {
    set({ isUploading: true, error: null });
    console.log('[scholarships] Deleting document:', docId);
    
    try {
      await api.deleteApplicationDocument(docId);
      console.log('[scholarships] Deleted document:', docId);
      
      // Refresh current application
      const { currentApplication } = get();
      if (currentApplication) {
        await get().fetchApplicationById(currentApplication.id);
      }
      
      set({ isUploading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document';
      console.error('[scholarships] Delete document error:', err);
      set({ error: message, isUploading: false });
      throw err;
    }
  },

  // ============================================
  // ENROLLMENT (My Scholarship)
  // ============================================
  
  fetchMyEnrollment: async () => {
    set({ isLoadingEnrollment: true, error: null });
    console.log('[scholarships] Fetching my enrollment');
    
    try {
      const enrollment = await api.getMyActiveEnrollment();
      console.log('[scholarships] Fetched enrollment:', enrollment ? 'found' : 'none');
      set({ myEnrollment: enrollment, isLoadingEnrollment: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load enrollment';
      console.error('[scholarships] Fetch enrollment error:', err);
      set({ error: message, isLoadingEnrollment: false });
    }
  },

  fetchEnrollmentHistory: async () => {
    set({ isLoadingEnrollment: true, error: null });
    console.log('[scholarships] Fetching enrollment history');
    
    try {
      const history = await api.getEnrollmentHistory();
      console.log('[scholarships] Fetched', history.length, 'past enrollments');
      set({ enrollmentHistory: history, isLoadingEnrollment: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load history';
      console.error('[scholarships] Fetch history error:', err);
      set({ error: message, isLoadingEnrollment: false });
    }
  },

  submitCompliance: async (itemId: string, enrollmentId: string, file: File | Blob, fileName: string, mimeType: string) => {
    set({ isUploading: true, error: null });
    console.log('[scholarships] Submitting compliance item:', itemId);
    
    try {
      await api.submitComplianceItem({
        itemId,
        enrollmentId,
        file,
        fileName,
        mimeType,
      });
      
      console.log('[scholarships] Submitted compliance item');
      
      // Refresh enrollment
      await get().fetchMyEnrollment();
      
      set({ isUploading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit compliance';
      console.error('[scholarships] Submit compliance error:', err);
      set({ error: message, isUploading: false });
      throw err;
    }
  },

  // ============================================
  // REALTIME SUBSCRIPTIONS
  // ============================================
  
  subscribeToApplication: (applicationId: string) => {
    console.log('[scholarships] Subscribing to application:', applicationId);
    
    const channel = api.subscribeToApplication(applicationId, (payload) => {
      console.log('[scholarships] Application update received:', payload.eventType);
      
      // Update current application if it's the one
      if (get().currentApplication?.id === applicationId) {
        set((state) => ({
          currentApplication: state.currentApplication ? {
            ...state.currentApplication,
            ...payload.new,
          } : null,
        }));
      }
      
      // Update in list
      set((state) => ({
        myApplications: state.myApplications.map(app =>
          app.id === applicationId ? { ...app, ...payload.new } : app
        ),
      }));
    });
    
    // Return cleanup function
    return () => {
      console.log('[scholarships] Unsubscribing from application:', applicationId);
      channel.unsubscribe();
    };
  },

  subscribeToCompliance: (enrollmentId: string) => {
    console.log('[scholarships] Subscribing to compliance items:', enrollmentId);
    
    const channel = api.subscribeToComplianceItems(enrollmentId, (payload) => {
      console.log('[scholarships] Compliance update received:', payload.eventType);
      
      // Update enrollment's compliance items
      set((state) => {
        if (!state.myEnrollment || state.myEnrollment.id !== enrollmentId) return {};
        
        return {
          myEnrollment: {
            ...state.myEnrollment,
            complianceItems: state.myEnrollment.complianceItems.map(item =>
              item.id === payload.new.id ? { ...item, ...payload.new } : item
            ),
          },
        };
      });
    });
    
    // Return cleanup function
    return () => {
      console.log('[scholarships] Unsubscribing from compliance:', enrollmentId);
      channel.unsubscribe();
    };
  },

  // ============================================
  // GENERAL ACTIONS
  // ============================================
  
  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      programs: [],
      currentProgram: null,
      myApplications: [],
      currentApplication: null,
      myEnrollment: null,
      enrollmentHistory: [],
      error: null,
    });
  },

  // ============================================
  // COMPUTED SELECTORS
  // ============================================
  
  getApplicationById: (id: string) => {
    return get().myApplications.find(a => a.id === id);
  },

  getApplicationsByStatus: (status: ApplicationStatus | 'all') => {
    const { myApplications } = get();
    if (status === 'all') return myApplications;
    return myApplications.filter(a => a.status === status);
  },

  getPendingComplianceItems: () => {
    const { myEnrollment } = get();
    if (!myEnrollment) return [];
    return myEnrollment.complianceItems.filter(
      item => item.status === 'pending' || item.status === 'rejected'
    );
  },

  getOverdueComplianceItems: () => {
    const { myEnrollment } = get();
    if (!myEnrollment) return [];
    return myEnrollment.complianceItems.filter(
      item => item.status === 'overdue'
    );
  },

  getApplicationProgress: (applicationId: string) => {
    const { currentApplication, currentProgram } = get();
    
    if (!currentApplication || currentApplication.id !== applicationId) {
      return { total: 0, uploaded: 0, percentage: 0 };
    }
    
    const total = currentProgram?.requirements.length || 0;
    const requiredTotal = currentProgram?.requirements.filter(r => r.isRequired).length || total;
    
    // Count uploaded documents by requirement
    const uploadedReqIds = new Set(currentApplication.documents.map(d => d.requirementId));
    const uploaded = currentProgram?.requirements.filter(r => uploadedReqIds.has(r.id)).length || 0;
    
    const percentage = requiredTotal > 0 ? Math.round((uploaded / requiredTotal) * 100) : 0;
    
    return { total, uploaded, percentage };
  },
}));
