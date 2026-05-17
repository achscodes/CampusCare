import { create } from 'zustand';

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_NOTIFICATIONS } from './mockNotifications';
import {
  toNotificationItem,
  isWithinDays,
  type NotificationItem,
  type NotificationRow,
  type NotificationSection,
} from './types';

interface NotificationState {
  items: NotificationItem[];
  loading: boolean;
  error: string | null;

  /** Number of unread notifications. */
  unreadCount: () => number;

  /** Initial fetch (call on screen mount or app launch). */
  fetchAll: (userId: string) => Promise<void>;

  /** Mark every notification in a section as read. */
  markAllReadInSection: (section: NotificationSection) => Promise<void>;

  /** Mark a single notification as read. */
  markRead: (id: string) => Promise<void>;

  /** Remove a notification by ID. */
  archive: (id: string) => Promise<void>;

  /** Subscribe to realtime changes for this user. Returns unsubscribe fn. */
  subscribe: (userId: string) => () => void;

  /** Dev-only: seed the store with mock data when Supabase isn't configured. */
  loadMock: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  unreadCount: () => get().items.filter((n) => !n.read).length,

  fetchAll: async (userId) => {
    if (!isSupabaseConfigured || !supabase) {
      get().loadMock();
      return;
    }
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    const rows = (data ?? []) as NotificationRow[];
    const within30 = rows.filter((r) => isWithinDays(r.created_at, 30));
    set({
      items: within30.map(toNotificationItem),
      loading: false,
    });
  },

  markAllReadInSection: async (section) => {
    const ids = get()
      .items.filter((n) => n.section === section && !n.read)
      .map((n) => n.id);
    if (!ids.length) return;

    // Optimistic
    set((s) => ({
      items: s.items.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
    }));

    if (!isSupabaseConfigured || !supabase) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids);
  },

  markRead: async (id) => {
    // Optimistic
    set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
    if (!isSupabaseConfigured || !supabase) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
  },

  archive: async (id) => {
    // Optimistic
    set((s) => ({ items: s.items.filter((n) => n.id !== id) }));
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('notifications').delete().eq('id', id);
  },

  subscribe: (userId) => {
    if (!isSupabaseConfigured || !supabase) return () => {};
    console.log('[notifications] Subscribing to realtime for user:', userId);

    // Set up realtime subscription
    const channel = supabase
      .channel(`notifications:${userId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[notifications] Realtime event received:', payload);
          // Refetch to get the latest data
          get().fetchAll(userId);
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('[notifications] Subscription error:', err);
        } else {
          console.log('[notifications] Subscription status:', status);
        }
      });

    // Polling fallback (every 30 seconds) as backup
    const pollInterval = setInterval(() => {
      console.log('[notifications] Polling for updates');
      get().fetchAll(userId);
    }, 30000);

    // Return cleanup function
    return () => {
      console.log('[notifications] Unsubscribing from realtime and clearing poll');
      clearInterval(pollInterval);
      supabase!.removeChannel(channel).catch((err) => {
        console.warn('[notifications] Error removing channel:', err);
      });
    };
  },

  loadMock: () => {
    set({ items: [...MOCK_NOTIFICATIONS], loading: false, error: null });
  },
}));
