import { useState } from "react";
import { useDONotificationStore } from "../../stores/doNotificationStore";

/** Shared notification bell for DO, HSO, and SDAO headers (same store + UI). */
export default function StaffNotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = useDONotificationStore((s) => s.notifications);
  const markRead = useDONotificationStore((s) => s.markNotificationRead);
  const markAllRead = useDONotificationStore((s) => s.markAllNotificationsRead);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div style={{ position: "relative" }}>
      <button
        className="header-notifications"
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M15 6.667A5 5 0 005 6.667C5 10.833 3.333 12.5 3.333 12.5h13.334S15 10.833 15 6.667zM11.442 17.5a1.667 1.667 0 01-2.884 0"
            stroke="#374151"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 ? <span className="notif-badge">{unreadCount}</span> : null}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 44,
            width: 320,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0px 18px 60px rgba(15, 23, 42, 0.15)",
            padding: 12,
            zIndex: 2500,
          }}
          role="menu"
        >
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              color: "#0f172a",
              fontSize: 14,
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            Notifications
            <button
              type="button"
              className="cc-btn-secondary"
              style={{ height: 28, padding: "0 10px" }}
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>No notifications.</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    padding: 8,
                    borderRadius: 10,
                    cursor: "pointer",
                    border: n.unread ? "1px solid #e9d5ff" : "1px solid transparent",
                  }}
                  onClick={() => markRead(n.id)}
                >
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{n.title}</div>
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{n.body}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{n.createdAt}</div>
                </button>
              ))
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              type="button"
              className="cc-btn-secondary"
              style={{ height: 30, padding: "0 12px" }}
              onClick={() => markAllRead()}
            >
              Mark all as read
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
