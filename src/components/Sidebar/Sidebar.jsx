import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import CCModal from "../common/CCModal";
import { logoutCampusCare } from "../../utils/campusCareAuth";
import { DO_NAV_ITEMS } from "./deanOfficeNav";
import { canCreateDocumentRequest } from "../../constants/documentRequestAccess";
import "./Sidebar.css";

/**
 * @param {object} props
 * @param {{ id: string, label: string, icon: React.ReactNode }[]} [props.navItems] — local nav (buttons); omit for Dean’s Office router links
 * @param {string} [props.activeNavId] — active item id when using local nav
 * @param {(id: string) => void} [props.onNavSelect]
 * @param {string} [props.departmentTag] — subtitle under CampusCare (ignored if brandTitle is set)
 * @param {string} [props.brandTitle] — single-line brand (e.g. "CampusCare Welfare Management")
 * @param {() => void} [props.onLogoutRequest] — if set, called instead of immediate sign-out (e.g. confirm modal)
 * @param {() => void} [props.onSettingsClick]
 * @param {string} [props.profilePath] — when set (e.g. "/profile"), footer Profile uses React Router Link
 * @param {string} [props.settingsPath] — when set (e.g. "/settings"), footer Settings uses Link instead of onSettingsClick
 * @param {string} [props.profileSettingsPath] — when set, single footer link "Profile & Settings" (takes precedence over profilePath/settingsPath)
 * @param {boolean} [props.hideProfileFooter] — when true, omit Profile / Settings / Profile & Settings (logout only)
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
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const useLocalNav = Array.isArray(navItems) && typeof onNavSelect === "function";
  const [logoutOpen, setLogoutOpen] = useState(false);

  const sessionOffice = useMemo(() => {
    try {
      const raw = window.localStorage.getItem("campuscare_session_v1");
      return raw ? JSON.parse(raw)?.office : null;
    } catch {
      return null;
    }
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

  return (
    <aside className="sidebar">
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
        <div className="sidebar-brand-text">
          {brandTitle ? (
            <h3 className="sidebar-brand-single">{brandTitle}</h3>
          ) : (
            <>
              <h3>CampusCare</h3>
              <p>{departmentTag ?? "Discipline Office"}</p>
            </>
          )}
        </div>
      </div>

      <div className="sidebar-institution">
        <p className="inst-label">Institution</p>
        <p className="inst-name">National University Dasmariñas</p>
      </div>

      <nav className="sidebar-nav">
        {!useLocalNav &&
          deanOfficeNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-nav-item${location.pathname === item.path ? " active" : ""}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}

        {useLocalNav &&
          navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item${activeNavId === item.id ? " active" : ""}`}
              onClick={() => onNavSelect(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
      </nav>

      <div className="sidebar-footer">
        {!hideProfileFooter && typeof profileSettingsPath === "string" && profileSettingsPath.length > 0 ? (
          <Link
            to={profileSettingsPath}
            className={`sidebar-nav-item${location.pathname === profileSettingsPath ? " active" : ""}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M13.333 14v-1.333A2.667 2.667 0 0010.667 10H5.333a2.667 2.667 0 00-2.666 2.667V14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="8"
                cy="5.333"
                r="2.667"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Profile & Settings
          </Link>
        ) : null}
        {!hideProfileFooter &&
        (typeof profileSettingsPath !== "string" || profileSettingsPath.length === 0) ? (
          typeof profilePath === "string" && profilePath.length > 0 ? (
            <Link
              to={profilePath}
              className={`sidebar-nav-item${location.pathname === profilePath ? " active" : ""}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M13.333 14v-1.333A2.667 2.667 0 0010.667 10H5.333a2.667 2.667 0 00-2.666 2.667V14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="8"
                  cy="5.333"
                  r="2.667"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Profile
            </Link>
          ) : null
        ) : null}
        {!hideProfileFooter &&
        (typeof profileSettingsPath !== "string" || profileSettingsPath.length === 0) ? (
          typeof settingsPath === "string" && settingsPath.length > 0 ? (
            <Link
              to={settingsPath}
              className={`sidebar-nav-item${location.pathname === settingsPath ? " active" : ""}`}
            >
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
            <path
              d="M10.667 11.333L14 8l-3.333-3.333M14 8H6M6 14H2.667A1.333 1.333 0 011.333 12.667V3.333A1.333 1.333 0 012.667 2H6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
                <h2 className="sidebar-logout-title" id="sidebar-logout-heading">
                  Logout Confirmation
                </h2>
                <p className="sidebar-logout-text">
                  Are you sure you want to logout? Any unsaved changes will be lost.
                </p>
              </div>
            </div>
            <div className="sidebar-logout-footer">
              <button type="button" className="sidebar-logout-btn sidebar-logout-btn--secondary" onClick={() => setLogoutOpen(false)}>
                Cancel
              </button>
              <button type="button" className="sidebar-logout-btn sidebar-logout-btn--primary" onClick={confirmLogout}>
                Yes, Logout
              </button>
            </div>
          </div>
        </CCModal>
      )}
    </aside>
  );
}

export default Sidebar;
