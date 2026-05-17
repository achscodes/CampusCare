import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { usePresenceOptional } from "../../context/PresenceContext";
import { readCampusCareSession } from "../../utils/campusCareSession";
import StatusPicker from "../userPresence/StatusPicker";
import "./OfficeHeader.css";

const defaultAvatar = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M13.333 14v-1.333A2.667 2.667 0 0010.667 10H5.333a2.667 2.667 0 00-2.666 2.667V14"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="8"
      cy="5.333"
      r="2.667"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function OfficeHeader({
  userName,
  userRole,
  notifications = [],
  avatar = defaultAvatar,
  pageTitle,
  pageSubtitle,
  /** When set, replaces the default notification bell (e.g. Discipline Office `DONotificationBell`). */
  notificationSlot = null,
  /** Optional; defaults to session email when available. */
  userEmail = null,
}) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRootRef = useRef(null);
  const presence = usePresenceOptional();
  const showPresence = Boolean(presence?.presenceEnabled);
  const session = readCampusCareSession();
  const email = userEmail ?? session?.email ?? "";

  const hasTitle = Boolean(pageTitle);

  useEffect(() => {
    setItems(notifications);
  }, [notifications]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const onDoc = (e) => {
      if (profileRootRef.current && !profileRootRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  const toggleProfile = useCallback(() => {
    setIsNotifOpen(false);
    setProfileOpen((o) => !o);
  }, []);

  const unreadCount = items.filter((n) => n.unread).length;

  const presenceDotClass = showPresence
    ? `office-header-presence-dot office-header-presence-dot--${presence.status}`
    : "";

  return (
    <header
      className={`dashboard-header${hasTitle ? " office-header--split office-header--portal" : ""}`}
    >
      {hasTitle && (
        <div className="office-header-title-block">
          <h1>{pageTitle}</h1>
          {pageSubtitle ? <p>{pageSubtitle}</p> : null}
        </div>
      )}

      <div className="office-header-actions">
        {notificationSlot ? (
          notificationSlot
        ) : (
          <div style={{ position: "relative" }}>
            <button
              className="header-notifications"
              type="button"
              aria-label="Notifications"
              aria-expanded={isNotifOpen}
              onClick={() => setIsNotifOpen((o) => !o)}
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

            {isNotifOpen && (
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
                    onClick={() => setIsNotifOpen(false)}
                  >
                    Close
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>No notifications.</div>
                  ) : (
                    items.map((n) => (
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
                        onClick={() => {
                          setItems((prev) =>
                            prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)),
                          );
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>
                          {n.title}
                        </div>
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
                    onClick={() => {
                      setItems((prev) => prev.map((x) => ({ ...x, unread: false })));
                    }}
                  >
                    Mark all as read
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="office-header-profile" ref={profileRootRef}>
          <button
            type="button"
            className="office-header-profile-trigger"
            onClick={toggleProfile}
            aria-expanded={profileOpen}
            aria-haspopup="dialog"
          >
            <div className="header-avatar office-header-avatar-wrap" aria-hidden="true">
              {showPresence ? <span className={presenceDotClass} /> : null}
              {avatar}
            </div>
            <div className="header-user-info">
              <span className="header-user-name">{userName}</span>
              <span className="header-user-role">{userRole}</span>
            </div>
            <ChevronDown
              className="office-header-profile-chevron"
              size={18}
              strokeWidth={1.75}
              aria-hidden
              style={{
                transform: profileOpen ? "rotate(180deg)" : undefined,
                transition: "transform 0.15s ease",
              }}
            />
          </button>

          {profileOpen ? (
            <div className="office-header-profile-panel" role="dialog" aria-label="Account and status">
              <div className="office-header-profile-panel__identity">
                <p className="office-header-profile-panel__name">{userName}</p>
                {email ? <p className="office-header-profile-panel__email">{email}</p> : null}
                <p className="office-header-profile-panel__role">{userRole}</p>
              </div>
              {showPresence && presence ? (
                <div className="office-header-profile-panel__presence">
                  <p className="office-header-profile-panel__presence-label">Set status</p>
                  <StatusPicker
                    status={presence.status}
                    onSelect={presence.setManualStatus}
                    embedded
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default OfficeHeader;
