import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import Sidebar from "../../components/Sidebar/Sidebar";
import OfficeHeader from "../../components/OfficeHeader/OfficeHeader";
import CCModal from "../../components/common/CCModal";
import OfficeProfileSettings from "../../components/OfficeProfileSettings/OfficeProfileSettings";
import { logoutCampusCare } from "../../utils/campusCareAuth";
import {
  canCreateDocumentRequest,
  normalizeOfficeKey,
} from "../../constants/documentRequestAccess";
import { isStudentLikeCampusRole } from "../../utils/officeSession";
import {
  PROFILE_SETTINGS_PATH_DEVELOPMENT,
  PROFILE_SETTINGS_PATH_DISCIPLINE,
  PROFILE_SETTINGS_PATH_HEALTH,
  profileSettingsPathForSessionOffice,
} from "../../utils/profileSettingsRoutes";
import { readCampusCareSession } from "../../utils/campusCareSession";
import { DisciplineOfficeTopBar } from "../DODashboard/DisciplineOfficeTopBar";
import { SDAO_NAV_ITEMS, SDAO_NOTIFICATIONS } from "../SDAO/SDAO";
import { HEALTH_NAV_ITEMS, HS_NOTIFICATIONS } from "../HealthServices/HealthServices";
import "../SDAO/SDAO.css";
import "../HealthServices/HealthServices.css";

/**
 * @param {{ variant: "do" | "sdao" | "hso" }} props
 */
export default function ModuleProfileSettingsRoute({ variant }) {
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const session = useMemo(() => {
    return readCampusCareSession();
  }, []);

  const sessionOffice = session?.office;

  const modulePath =
    variant === "sdao"
      ? PROFILE_SETTINGS_PATH_DEVELOPMENT
      : variant === "hso"
        ? PROFILE_SETTINGS_PATH_HEALTH
        : PROFILE_SETTINGS_PATH_DISCIPLINE;

  useEffect(() => {
    const officeKey = normalizeOfficeKey(sessionOffice);
    if (!officeKey) return;
    const correct = profileSettingsPathForSessionOffice(sessionOffice);
    if (correct !== modulePath) navigate(correct, { replace: true });
  }, [sessionOffice, modulePath, navigate]);

  const userName = session?.name || "—";
  const userRole = session?.role || "—";

  const canInterOfficeDocRequest = canCreateDocumentRequest(session?.office);
  const isStudentSession = isStudentLikeCampusRole(session?.role);
  const showSdaoDocRequestNav = canInterOfficeDocRequest || isStudentSession;

  const sdaoNavItems = useMemo(() => {
    if (showSdaoDocRequestNav) return SDAO_NAV_ITEMS;
    return SDAO_NAV_ITEMS.filter((i) => i.id !== "docrequests");
  }, [showSdaoDocRequestNav]);

  const healthNavItems = useMemo(() => {
    if (canInterOfficeDocRequest) return HEALTH_NAV_ITEMS;
    return HEALTH_NAV_ITEMS.filter((i) => i.id !== "docrequests");
  }, [canInterOfficeDocRequest]);

  const workflow =
    variant === "sdao" ? "development" : variant === "hso" ? "health" : "discipline";

  const confirmLogout = async () => {
    setLogoutOpen(false);
    await logoutCampusCare();
    navigate("/");
  };

  if (variant === "do") {
    return (
      <div className="dashboard-layout do-office-layout">
        <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />

        <div className="dashboard-main">
          <DisciplineOfficeTopBar />

          <main className="dashboard-content do-office-shell do-ps-page">
            <div className="do-ps-page-head">
              <div>
                <h1 className="do-ps-page-title">Profile &amp; Settings</h1>
                <p className="do-ps-page-sub">
                  Manage your CampusCare account, contact details, and office preferences.
                </p>
              </div>
            </div>
            <OfficeProfileSettings workflow={workflow} />
          </main>
        </div>
      </div>
    );
  }

  if (variant === "sdao") {
    return (
      <div className="dashboard-layout sdao-layout">
        <Sidebar
          departmentTag="Scholarship Management"
          navItems={sdaoNavItems}
          activeNavId="__profile__"
          onNavSelect={(id) => navigate("/sdao", { state: { restoreNav: id } })}
          onLogoutRequest={() => setLogoutOpen(true)}
          profileSettingsPath={PROFILE_SETTINGS_PATH_DEVELOPMENT}
        />
        <div className="dashboard-main">
          <OfficeHeader userName={userName} userRole={userRole} notifications={SDAO_NOTIFICATIONS} />
          <main className="dashboard-content sdao-page">
            <header className="sdao-page-header">
              <div className="sdao-page-header-text">
                <h1 className="sdao-page-header-title">Profile &amp; Settings</h1>
                <p className="sdao-page-header-sub">
                  Manage your CampusCare account, contact details, and office preferences.
                </p>
              </div>
            </header>
            <OfficeProfileSettings workflow={workflow} />
          </main>
        </div>

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
      </div>
    );
  }

  return (
    <div className="dashboard-layout health-services-layout hs-office-shell">
      <Sidebar
        brandTitle="CampusCare Welfare Management"
        navItems={healthNavItems}
        activeNavId="__profile__"
        onNavSelect={(id) => navigate("/health-services", { state: { restoreNav: id } })}
        onLogoutRequest={() => setLogoutOpen(true)}
        profileSettingsPath={PROFILE_SETTINGS_PATH_HEALTH}
      />
      <div className="dashboard-main">
        <OfficeHeader userName={userName} userRole={userRole} notifications={HS_NOTIFICATIONS} />
        <main className="dashboard-content hs-page hs-office-shell">
          <section className="hs-tab-page-heading">
            <div className="page-title-row">
              <div>
                <h1 className="hs-tab-page-title">Profile &amp; Settings</h1>
                <p className="hs-tab-page-subtitle">
                  Manage your CampusCare account, contact details, and office preferences.
                </p>
              </div>
            </div>
          </section>
          <OfficeProfileSettings workflow={workflow} />
        </main>
      </div>

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
              <p className="sidebar-logout-text">Are you sure you want to logout? Any unsaved changes will be lost.</p>
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
