import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { BarChart3, Building2, CalendarDays, GraduationCap, LogOut, Users } from "lucide-react";
import CCModal from "../../components/common/CCModal";
import OfficeHeader from "../../components/OfficeHeader/OfficeHeader";
import Sidebar from "../../components/Sidebar/Sidebar";
import HealthServices from "../HealthServices/HealthServices";
import { ReportsPage as DisciplineReportsPage } from "../DODashboard/DO";
import SDAO from "../SDAO/SDAO";
import UserManagement from "./UserManagement";
import WelfareStaffScheduling from "./WelfareStaffScheduling";
import { logoutCampusCare } from "../../utils/campusCareAuth";
import { getHomeRouteForSession } from "../../utils/officeRoutes";
import { displayWelfareAdminRole, isWelfareAdminForAdminRoute } from "../../utils/welfareAdmin";
import { profileSettingsPathForSessionOffice } from "../../utils/profileSettingsRoutes";
import { useLiveCampusCareSession } from "../../hooks/useLiveCampusCareSession";
import { showToast } from "../../utils/toast";
import "../DODashboard/DO.css";
import "../HealthServices/HealthServices.css";
import "../SDAO/SDAO.css";
import "./Admin.css";

const OFFICE_CONFIG = {
  health: {
    reportsLabel: "Reports & Analytics",
    usersSubtitle: "Manage Health Services staff accounts and access",
  },
  discipline: {
    reportsLabel: "Reports & Analytics",
    usersSubtitle: "Manage Discipline Office staff accounts and access",
  },
  development: {
    reportsLabel: "Reports & Analytics",
    usersSubtitle: "Manage SDAO staff accounts and access",
  },
};

const SA_NOTIFICATIONS = [];

const iconProps = { size: 20, strokeWidth: 1.5 };

/**
 * Institution / welfare admin portal (HSO, DO, SDAO).
 * @param {{ officeKey: 'health'|'discipline'|'development' }} props
 */
export default function AdminPage({ officeKey }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDualOfficeShell = officeKey === "discipline" || officeKey === "development";
  const [tab, setTab] = useState(() =>
    officeKey === "discipline" ? "do_reports" : officeKey === "development" ? "sdao_reports" : "reports",
  );
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isDualOfficeShell) return;
    if (searchParams.get("tab") === "staff_scheduling") setTab("staff_scheduling");
  }, [isDualOfficeShell, searchParams]);

  const handleNavSelect = useCallback(
    (id) => {
      setTab(id);
      if (searchParams.get("tab")) setSearchParams({}, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const session = useLiveCampusCareSession();

  const cfg = OFFICE_CONFIG[officeKey] ?? OFFICE_CONFIG.health;

  const userName = session?.name || session?.email || "User";
  const userRole = displayWelfareAdminRole(session?.role);

  const healthNavItems = useMemo(
    () => [
      { id: "reports", label: cfg.reportsLabel, icon: <BarChart3 {...iconProps} /> },
      { id: "users", label: "User Management", icon: <Users {...iconProps} /> },
    ],
    [cfg.reportsLabel],
  );

  const dualOfficeNavItems = useMemo(
    () => [
      { id: "do_reports", label: "Discipline Office", icon: <Building2 {...iconProps} /> },
      { id: "sdao_reports", label: "Student Development", icon: <GraduationCap {...iconProps} /> },
      { id: "staff_scheduling", label: "Staff Scheduling", icon: <CalendarDays {...iconProps} /> },
      { id: "users", label: "User Management", icon: <Users {...iconProps} /> },
    ],
    [],
  );

  const adminNavItems = isDualOfficeShell ? dualOfficeNavItems : healthNavItems;

  const sidebarProps = useMemo(() => {
    const profilePath = profileSettingsPathForSessionOffice(session?.office);
    const base = {
      navItems: adminNavItems,
      activeNavId: tab,
      onNavSelect: handleNavSelect,
      onLogoutRequest: () => setLogoutOpen(true),
      hideProfileFooter: false,
      profileSettingsPath: typeof profilePath === "string" && profilePath.length > 0 ? profilePath : undefined,
    };
    if (officeKey === "health") {
      return { ...base, brandTitle: "CampusCare Welfare Management" };
    }
    if (isDualOfficeShell) {
      return { ...base, brandTitle: "CampusCare Welfare Management" };
    }
    return { ...base };
  }, [adminNavItems, tab, officeKey, isDualOfficeShell, handleNavSelect, session?.office]);

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
    () =>
      isDualOfficeShell
        ? {
            title: "User Management",
            subtitle: "Create, manage, and control all staffs account",
          }
        : {
            title: "User Management",
            subtitle: cfg.usersSubtitle,
          },
    [isDualOfficeShell, cfg.usersSubtitle],
  );

  const userMgmtFilterOffices = useMemo(() => {
    if (officeKey === "health") return ["health"];
    if (isDualOfficeShell) return ["discipline", "development"];
    return [officeKey];
  }, [officeKey, isDualOfficeShell]);

  const handleLogout = useCallback(async () => {
    await logoutCampusCare();
    navigate("/", { replace: true });
  }, [navigate]);

  const confirmLogout = useCallback(async () => {
    setLogoutOpen(false);
    await handleLogout();
    showToast("You have been signed out.", { variant: "info" });
  }, [handleLogout]);

  const healthReportsPanel = useMemo(
    () => (
      <div className="sa-embed-hso">
        <HealthServices embedReportsOnly />
      </div>
    ),
    [],
  );

  if (!session?.userId) {
    return <Navigate to="/signin" replace />;
  }

  if (!isWelfareAdminForAdminRoute(session, officeKey)) {
    return <Navigate to={getHomeRouteForSession(session)} replace />;
  }

  const renderMain = () => {
    if (officeKey === "health") {
      if (tab === "reports") return healthReportsPanel;
      return (
        <>
          <section className="sa-page-heading">
            <div className="page-title-row">
              <div>
                <h1>{userMgmtMeta.title}</h1>
                <p>{userMgmtMeta.subtitle}</p>
              </div>
            </div>
          </section>
          <UserManagement filterOffices={userMgmtFilterOffices} />
        </>
      );
    }

    if (tab === "do_reports") {
      return (
        <div className="sa-welfare-reports-embed">
          <DisciplineReportsPage standalone />
        </div>
      );
    }
    if (tab === "sdao_reports") {
      return (
        <div className="sa-welfare-reports-embed">
          <SDAO embedDashboardOnly />
        </div>
      );
    }
    if (tab === "staff_scheduling") {
      return <WelfareStaffScheduling />;
    }
    return (
      <>
        <section className="sa-page-heading">
          <div className="page-title-row">
            <div>
              <h1>{userMgmtMeta.title}</h1>
              <p>{userMgmtMeta.subtitle}</p>
            </div>
          </div>
        </section>
        <UserManagement filterOffices={userMgmtFilterOffices} />
      </>
    );
  };

  return (
    <div className={layoutClass}>
      <Sidebar
        {...sidebarProps}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div className="dashboard-main">
        <OfficeHeader
          userName={userName}
          userRole={userRole}
          notifications={SA_NOTIFICATIONS}
          avatar={
            session?.profileAvatarDataUrl ? (
              <img src={session.profileAvatarDataUrl} alt="" className="header-avatar-img" />
            ) : undefined
          }
          onMenuClick={() => setMobileSidebarOpen(true)}
        />

        <main className={mainContentClass}>{renderMain()}</main>
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
