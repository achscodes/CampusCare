import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_NOTIFICATIONS } from "../data/mockNotifications";

export const useDONotificationStore = create(
  persist(
    (set) => ({
      notifications: DEFAULT_NOTIFICATIONS,
      prependNotification: (n) =>
        set((s) => ({
          notifications: [
            {
              id: n.id,
              title: n.title,
              body: n.body,
              createdAt: n.createdAt || new Date().toLocaleString(),
              unread: n.unread !== false,
            },
            ...s.notifications,
          ].slice(0, 80),
        })),
      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, unread: false } : n,
          ),
        })),
      markAllNotificationsRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, unread: false })),
        })),
    }),
    {
      name: "campuscare-do-notifications-v2",
      partialize: (state) => ({ notifications: state.notifications }),
    },
  ),
);
