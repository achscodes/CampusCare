import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import CCModal from "../common/CCModal";
import { logoutCampusCare } from "../../utils/campusCareAuth";
import { DO_NAV_ITEMS } from "./deanOfficeNav";
import { canCreateDocumentRequest } from "../../constants/documentRequestAccess";
import { readCampusCareSession } from "../../utils/campusCareSession";
import "./Sidebar.css";

/**
 * @param {object} props
 * @param {{ id: string, label: string, icon: React.ReactNode }[]} [props.navItems]
 * @param {string}   [props.activeNavId]
 * @param {(id: string) => void} [props.onNavSelect]
 * @param {string}   [props.departmentTag]
 * @param {string}   [props.brandTitle]
 * @param {() => void} [props.onLogoutRequest]
 * @param {() => void} [props.onSettingsClick]
 * @param {string}   [props.profilePath]
 * @param {string}   [props.settingsPath]
 * @param {string}   [props.profileSettingsPath]
 * @param {boolean}  [props.hideProfileFooter]
 * @param {boolean}  [props.mobileOpen]      — controlled mobile open state (from parent)
 * @param {() => void} [props.onMobileClose] — called when user closes sidebar on mobile
 */
function Sidebar({
  navItems,
  activeNavId,
  onNavSelect,
  departmentTag,
  brandTitle,
  onLogoutRequest,
  onSettingsClick,
  profilePath,
  settingsPath,
  profileSettingsPath,
  hideProfileFooter,
  mobileOpen = false,
  onMobileClose,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const useLocalNav = Array.isArray(navItems) && typeof onNavSelect === "function";
  const [logoutOpen, setLogoutOpen] = useState(false);

  const sessionOffice = useMemo(() => {
    return readCampusCareSession()?.office ?? null;
  }, []);

  const deanOfficeNavItems = useMemo(() => {
    if (canCreateDocumentRequest(sessionOffice)) return DO_NAV_ITEMS;
    return DO_NAV_ITEMS.filter((item) => item.path !== "/document-requests");
  }, [sessionOffice]);

  const handleLogoutClick = () => {
    if (typeof onLogoutRequest === "function") {
      onLogoutRequest();
      return;
    }
    setLogoutOpen(true);
  };

  const confirmLogout = async () => {
    setLogoutOpen(false);
    await logoutCampusCare();
    navigate("/");
  };

  const closeMobileSidebar = useCallback(() => {
    if (typeof onMobileClose === "function") {
      onMobileClose();
      return;
    }
    try {
      const aside = document.querySelector(".sidebar");
      const overlay = document.querySelector(".sidebar-overlay");
      if (aside && aside.classList.contains("sidebar--open")) aside.classList.remove("sidebar--open");
      if (overlay && overlay.classList.contains("sidebar-overlay--visible")) overlay.classList.remove("sidebar-overlay--visible");
      document.body.style.overflow = "";
    } catch (err) {
      // no-op
    }
  }, [onMobileClose]);

  // Close sidebar when route changes (mobile UX)
  useEffect(() => {
    closeMobileSidebar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close on Escape key (mobile only)
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const handler = (e) => {
      if (e.key === "Escape") closeMobileSidebar();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen, closeMobileSidebar]);

  return (
    <>
      {/* Overlay — mobile only */}
      <div
        className={`sidebar-overlay${mobileOpen ? " sidebar-overlay--visible" : ""}`}
        aria-hidden="true"
        onClick={closeMobileSidebar}
      />

      <aside className={`sidebar${mobileOpen ? " sidebar--open" : ""}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="sidebar-logo-fallback">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="sidebar-brand-text" style={{ flex: 1, minWidth: 0 }}>
            {brandTitle ? (
              <h3 className="sidebar-brand-single">{brandTitle}</h3>
            ) : (
              <>
                <h3>CampusCare</h3>
                <p>{departmentTag ?? "Discipline Office"}</p>
              </>
            )}
          </div>

          {/* Close button — visible only on mobile */}
          <button type="button" className="sidebar-close-btn" aria-label="Close navigation menu" onClick={closeMobileSidebar}>
            ×
          </button>
        </div>

        <div className="sidebar-institution">
          <p className="inst-label">Institution</p>
          <p className="inst-name">National University Dasmariñas</p>
        </div>

        <nav className="sidebar-nav">
          {!useLocalNav &&
            deanOfficeNavItems.map((item) => (
              <Link key={item.path} to={item.path} className={`sidebar-nav-item${location.pathname === item.path ? " active" : ""}`}>
                {item.icon}
                {item.label}
              </Link>
            ))}

          {useLocalNav &&
            navItems.map((item) => (
              <button key={item.id} type="button" className={`sidebar-nav-item${activeNavId === item.id ? " active" : ""}`} onClick={() => onNavSelect(item.id)}>
                {item.icon}
                {item.label}
              </button>
            ))}
        </nav>

        <div className="sidebar-footer">
          {!hideProfileFooter && typeof profileSettingsPath === "string" && profileSettingsPath.length > 0 ? (
            <Link to={profileSettingsPath} className={`sidebar-nav-item${location.pathname === profileSettingsPath ? " active" : ""}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M13.333 14v-1.333A2.667 2.667 0 0010.667 10H5.333a2.667 2.667 0 00-2.666 2.667V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="5.333" r="2.667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Profile & Settings
            </Link>
          ) : null}

          {!hideProfileFooter && (typeof profileSettingsPath !== "string" || profileSettingsPath.length === 0) ? (
            typeof profilePath === "string" && profilePath.length > 0 ? (
              <Link to={profilePath} className={`sidebar-nav-item${location.pathname === profilePath ? " active" : ""}`}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M13.333 14v-1.333A2.667 2.667 0 0010.667 10H5.333a2.667 2.667 0 00-2.666 2.667V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="8" cy="5.333" r="2.667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Profile
              </Link>
            ) : null
          ) : null}

          {!hideProfileFooter && (typeof profileSettingsPath !== "string" || profileSettingsPath.length === 0) ? (
            typeof settingsPath === "string" && settingsPath.length > 0 ? (
              <Link to={settingsPath} className={`sidebar-nav-item${location.pathname === settingsPath ? " active" : ""}`}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <circle cx="8" cy="8" r="6.667" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5.333V8M8 10.667h.007" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Settings
              </Link>
            ) : typeof onSettingsClick === "function" ? (
              <button type="button" className="sidebar-nav-item" onClick={() => onSettingsClick()}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.667" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5.333V8M8 10.667h.007" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Settings
              </button>
            ) : null
          ) : null}

          <button type="button" className="sidebar-nav-item" onClick={handleLogoutClick}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10.667 11.333L14 8l-3.333-3.333M14 8H6M6 14H2.667A1.333 1.333 0 011.333 12.667V3.333A1.333 1.333 0 012.667 2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Logout
          </button>
        </div>

        {!onLogoutRequest && (
          <CCModal open={logoutOpen} title="Logout" onClose={() => setLogoutOpen(false)} centered showHeader={false}>
            <div className="sidebar-logout-modal">
              <div className="sidebar-logout-body">
                <div className="sidebar-logout-icon-wrap" aria-hidden>
                  <LogOut size={20} strokeWidth={1.75} />
                </div>
                <div className="sidebar-logout-copy">
                  <h2 className="sidebar-logout-title" id="sidebar-logout-heading">Logout Confirmation</h2>
                  <p className="sidebar-logout-text">Are you sure you want to logout? Any unsaved changes will be lost.</p>
                </div>
              </div>
              <div className="sidebar-logout-footer">
                <button type="button" className="sidebar-logout-btn sidebar-logout-btn--secondary" onClick={() => setLogoutOpen(false)}>Cancel</button>
                <button type="button" className="sidebar-logout-btn sidebar-logout-btn--primary" onClick={confirmLogout}>Yes, Logout</button>
              </div>
            </div>
          </CCModal>
        )}
      </aside>
    </>
  );
}

export default Sidebar;