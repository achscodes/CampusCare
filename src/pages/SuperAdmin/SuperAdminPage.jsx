import { useCallback, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BarChart3, LogOut, Users } from "lucide-react";
import CCModal from "../../components/common/CCModal";
import OfficeHeader from "../../components/OfficeHeader/OfficeHeader";
import Sidebar from "../../components/Sidebar/Sidebar";
import HealthServices from "../HealthServices/HealthServices";
import { ReportsPage } from "../DODashboard/DO";
import SDAO from "../SDAO/SDAO";
import UserManagement from "./UserManagement";
import { logoutCampusCare } from "../../utils/campusCareAuth";
import { getHomeRouteForOffice } from "../../utils/officeRoutes";
import { isSuperAdminForOffice } from "../../utils/superAdmin";
import { showToast } from "../../utils/toast";
import "../DODashboard/DO.css";
import "../HealthServices/HealthServices.css";
import "../SDAO/SDAO.css";
import "./SuperAdmin.css";

const OFFICE_CONFIG = {
  health: {
    reportsLabel: "Reports & Analytics",
    usersSubtitle: "Approve staff signups for Health Services before they can access the portal",
  },
  discipline: {
    reportsLabel: "Reports & Analytics",
    usersSubtitle: "Approve staff signups for the Discipline Office before they can access the portal",
  },
  development: {
    reportsLabel: "Reports & Analytics",
    usersSubtitle: "Approve staff signups for SDAO before they can access the portal",
  },
};

const SA_NOTIFICATIONS = [];

const iconProps = { size: 20, strokeWidth: 1.5 };

/**
 * @param {{ officeKey: 'health'|'discipline'|'development' }} props
 */
export default function SuperAdminPage({ officeKey }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("reports");
  const [logoutOpen, setLogoutOpen] = useState(false);

  const session = useMemo(() => {
    try {
      return JSON.parse(window.localStorage.getItem("campuscare_session_v1") || "null");
    } catch {
      return null;
    }
  }, []);

  const cfg = OFFICE_CONFIG[officeKey] ?? OFFICE_CONFIG.health;

  const userName = session?.name || session?.email || "User";
  const userRole = session?.role || "Super Admin";

  const superAdminNavItems = useMemo(
    () => [
      { id: "reports", label: cfg.reportsLabel, icon: <BarChart3 {...iconProps} /> },
      { id: "users", label: "User Management", icon: <Users {...iconProps} /> },
    ],
    [cfg.reportsLabel],
  );

  const sidebarProps = useMemo(() => {
    const base = {
      navItems: superAdminNavItems,
      activeNavId: tab,
      onNavSelect: setTab,
      onLogoutRequest: () => setLogoutOpen(true),
      hideProfileFooter: true,
    };
    if (officeKey === "health") {
      return { ...base, brandTitle: "CampusCare Welfare Management" };
    }
    if (officeKey === "development") {
      return { ...base, departmentTag: "Scholarship Management" };
    }
    return { ...base };
  }, [superAdminNavItems, tab, officeKey]);

  const layoutClass = useMemo(() => {
    if (officeKey === "health") return "dashboard-layout health-services-layout hs-office-shell";
    if (officeKey === "development") return "dashboard-layout sdao-layout";
    return "dashboard-layout do-office-layout";
  }, [officeKey]);

  const mainContentClass = useMemo(() => {
    if (officeKey === "health") return "dashboard-content hs-page hs-office-shell";
    if (officeKey === "development") return "dashboard-content sdao-page";
    return "dashboard-content do-office-shell";
  }, [officeKey]);

  const userMgmtMeta = useMemo(
    () => ({
      title: "User Management",
      subtitle: cfg.usersSubtitle,
    }),
    [cfg.usersSubtitle],
  );

  const handleLogout = useCallback(async () => {
    await logoutCampusCare();
    navigate("/", { replace: true });
  }, [navigate]);

  const confirmLogout = useCallback(async () => {
    setLogoutOpen(false);
    await handleLogout();
    showToast("You have been signed out.", { variant: "info" });
  }, [handleLogout]);

  const reportsPanel = useMemo(() => {
    if (officeKey === "health") {
      return (
        <div className="sa-embed-hso">
          <HealthServices embedReportsOnly />
        </div>
      );
    }
    if (officeKey === "discipline") {
      return (
        <div className="sa-embed-do">
          <ReportsPage standalone />
        </div>
      );
    }
    return (
      <div className="sa-embed-sdao">
        <SDAO embedDashboardOnly />
      </div>
    );
  }, [officeKey]);

  if (!session?.userId) {
    return <Navigate to="/signin" replace />;
  }

  if (!isSuperAdminForOffice(session, officeKey)) {
    return <Navigate to={getHomeRouteForOffice(session.office)} replace />;
  }

  return (
    <div className={layoutClass}>
      <Sidebar {...sidebarProps} />

      <div className="dashboard-main">
        <OfficeHeader userName={userName} userRole={userRole} notifications={SA_NOTIFICATIONS} />

        <main className={mainContentClass}>
          {tab === "users" ? (
            <section className="sa-page-heading">
              <div className="page-title-row">
                <div>
                  <h1>{userMgmtMeta.title}</h1>
                  <p>{userMgmtMeta.subtitle}</p>
                </div>
              </div>
            </section>
          ) : null}

          {tab === "reports" ? reportsPanel : <UserManagement officeKey={officeKey} />}
        </main>
      </div>

      <CCModal open={logoutOpen} title="Logout" onClose={() => setLogoutOpen(false)} centered showHeader={false}>
        <div className="sidebar-logout-modal">
          <div className="sidebar-logout-body">
            <div className="sidebar-logout-icon-wrap" aria-hidden>
              <LogOut size={20} strokeWidth={1.75} />
            </div>
            <div className="sidebar-logout-copy">
              <h2 className="sidebar-logout-title" id="sa-sidebar-logout-heading">
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
    </div>
  );
}
