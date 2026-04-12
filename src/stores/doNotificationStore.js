import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_NOTIFICATIONS } from "../data/mockNotifications";

export const useDONotificationStore = create(
  persist(
    (set) => ({
      notifications: DEFAULT_NOTIFICATIONS,
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
      name: "campuscare-do-notifications",
      partialize: (state) => ({ notifications: state.notifications }),
    },
  ),
);
