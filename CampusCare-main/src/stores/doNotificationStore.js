import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_NOTIFICATIONS } from "../data/mockNotifications";

const MAX_NOTIFICATIONS = 100;

export const useDONotificationStore = create(
  persist(
    (set) => ({
      notifications: DEFAULT_NOTIFICATIONS,
      setNotifications: (rows) =>
        set(() => ({
          notifications: Array.isArray(rows) ? rows.slice(0, MAX_NOTIFICATIONS) : [],
        })),
      /**
       * Merge server rows into the persisted store by id. Server `unread` wins
       * (so read-state survives refresh). Local-only rows are preserved.
       */
      mergeNotifications: (rows) =>
        set((s) => {
          if (!Array.isArray(rows)) return s;
          const byId = new Map(s.notifications.map((n) => [String(n.id), n]));
          for (const r of rows) {
            const id = String(r.id);
            const prev = byId.get(id);
            byId.set(id, {
              id: r.id,
              title: r.title ?? prev?.title ?? "",
              body: r.body ?? prev?.body ?? "",
              path: r.path ?? prev?.path ?? null,
              createdAt: r.createdAt ?? prev?.createdAt ?? new Date().toLocaleString(),
              unread: r.unread === undefined ? prev?.unread ?? true : r.unread,
            });
          }
          const merged = Array.from(byId.values()).sort((a, b) => {
            const ta = Date.parse(a.createdAt) || 0;
            const tb = Date.parse(b.createdAt) || 0;
            return tb - ta;
          });
          return { notifications: merged.slice(0, MAX_NOTIFICATIONS) };
        }),
      upsertNotification: (n) =>
        set((s) => {
          const next = [
            {
              id: n.id,
              title: n.title,
              body: n.body,
              path: n.path || null,
              createdAt: n.createdAt || new Date().toLocaleString(),
              unread: n.unread !== false,
            },
            ...s.notifications.filter((x) => String(x.id) !== String(n.id)),
          ].slice(0, MAX_NOTIFICATIONS);
          return { notifications: next };
        }),
      prependNotification: (n) =>
        set((s) => ({
          notifications: [
            {
              id: n.id,
              title: n.title,
              body: n.body,
              path: n.path || null,
              createdAt: n.createdAt || new Date().toLocaleString(),
              unread: n.unread !== false,
            },
            ...s.notifications,
          ].slice(0, MAX_NOTIFICATIONS),
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
