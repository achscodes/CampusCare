import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type {
  StudentReferral,
  ReferralStatus,
  ReferralCategory,
  WelfareOffice,
  ReferralFilter,
} from './types';

// ============================================
// STORE STATE TYPE
// ============================================
type ReferralState = {
  // Data
  items: StudentReferral[];
  isLoading: boolean;
  error: string | null;
  
  // Filters
  filter: ReferralFilter;
  
  // Actions
  fetchAll: (studentId: string) => Promise<void>;
  subscribe: (studentId: string) => () => void;
  setFilter: (filter: Partial<ReferralFilter>) => void;
  clearError: () => void;
  
  // Computed (via selectors)
  filteredItems: () => StudentReferral[];
  getById: (id: string) => StudentReferral | undefined;
  getCountsByStatus: () => Record<ReferralStatus | 'all', number>;
};

// ============================================
// DATABASE ROW TYPE (snake_case from Supabase)
// ============================================
// Safe columns that students can see (NEVER use select('*'))
type StudentReferralRow = {
  id: string;
  reference_id: string;
  student_id: string;
  from_service: WelfareOffice;
  to_service: WelfareOffice;
  status: ReferralStatus;
  category: ReferralCategory;
  reason: string;
  reason_summary: string | null;
  appointment_date: string | null;
  student_notes: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// MAPPER: DB row → TypeScript type
// ============================================
const mapRowToReferral = (row: StudentReferralRow): StudentReferral => ({
  id: row.id,
  referenceId: row.reference_id,
  studentId: row.student_id,
  fromService: row.from_service,
  toService: row.to_service,
  status: row.status,
  category: row.category,
  reason: row.reason,
  reasonSummary: row.reason_summary ?? undefined,
  appointmentDate: row.appointment_date ?? undefined,
  studentNotes: row.student_notes ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ============================================
// STORE IMPLEMENTATION
// ============================================
export const useReferralStore = create<ReferralState>((set, get) => ({
  // Initial state
  items: [],
  isLoading: false,
  error: null,
  filter: {
    status: 'all',
    category: 'all',
    fromService: 'all',
    searchQuery: '',
  },

  // ============================================
  // FETCH ALL REFERRALS FOR STUDENT
  // ============================================
  fetchAll: async (studentId: string) => {
    if (!supabase) {
      set({ error: 'Supabase client not initialized' });
      return;
    }

    set({ isLoading: true, error: null });
    console.log('[referrals] Fetching referrals for student:', studentId);

    try {
      // Query referrals table with EXPLICIT safe columns only
      // NEVER use select('*') - admin columns must stay hidden
      const { data, error } = await supabase
        .from('referrals')
        .select('id, reference_id, student_id, from_service, to_service, status, category, reason, reason_summary, appointment_date, student_notes, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[referrals] Fetch error:', error);
        set({ error: error.message, isLoading: false });
        return;
      }

      const items = (data as StudentReferralRow[] | null)?.map(mapRowToReferral) ?? [];
      console.log('[referrals] Fetched', items.length, 'referrals');
      set({ items, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[referrals] Fetch failed:', err);
      set({ error: message, isLoading: false });
    }
  },

  // ============================================
  // REALTIME SUBSCRIPTION
  // ============================================
  subscribe: (studentId: string) => {
    if (!supabase) {
      console.warn('[referrals] Supabase not initialized, subscription skipped');
      return () => {};
    }

    console.log('[referrals] Subscribing to realtime for student:', studentId);

    // Set up realtime subscription on the referrals table
    const channel = supabase
      .channel(`referrals:${studentId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'referrals',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          console.log('[referrals] Realtime event received:', payload.eventType, payload);
          // Refetch to get latest data
          get().fetchAll(studentId);
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('[referrals] Subscription error:', err);
        } else {
          console.log('[referrals] Subscription status:', status);
        }
      });

    // Polling fallback (every 30 seconds)
    const pollInterval = setInterval(() => {
      console.log('[referrals] Polling for updates');
      get().fetchAll(studentId);
    }, 30000);

    // Return cleanup function
    return () => {
      console.log('[referrals] Unsubscribing from realtime');
      clearInterval(pollInterval);
      if (supabase) {
        supabase.removeChannel(channel).catch((err) => {
          console.warn('[referrals] Error removing channel:', err);
        });
      }
    };
  },

  // ============================================
  // FILTER ACTIONS
  // ============================================
  setFilter: (filter) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }));
  },

  clearError: () => set({ error: null }),

  // ============================================
  // COMPUTED SELECTORS
  // ============================================
  filteredItems: () => {
    const { items, filter } = get();
    
    return items.filter((item) => {
      // Status filter
      if (filter.status && filter.status !== 'all' && item.status !== filter.status) {
        return false;
      }
      
      // Category filter
      if (filter.category && filter.category !== 'all' && item.category !== filter.category) {
        return false;
      }
      
      // From service filter
      if (filter.fromService && filter.fromService !== 'all' && item.fromService !== filter.fromService) {
        return false;
      }
      
      // Search query
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const searchableText = `${item.referenceId} ${item.reason} ${item.category}`.toLowerCase();
        if (!searchableText.includes(query)) {
          return false;
        }
      }
      
      return true;
    });
  },

  getById: (id: string) => {
    return get().items.find((item) => item.id === id);
  },

  getCountsByStatus: () => {
    const { items } = get();
    const counts: Record<ReferralStatus | 'all', number> = {
      all: items.length,
      pending: 0,
      in_review: 0,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
    };

    items.forEach((item) => {
      counts[item.status]++;
    });

    return counts;
  },
}));
