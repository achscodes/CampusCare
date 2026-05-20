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
import { normalizeHsoDesignation } from "../../utils/hsoAccess";
import { DisciplineOfficeTopBar } from "../DODashboard/DisciplineOfficeTopBar";
import { SDAO_NAV_ITEMS, SDAO_NOTIFICATIONS } from "../SDAO/SDAO";
import { HS_NOTIFICATIONS } from "../HealthServices/hsoNavConfig";
import { buildHealthNavItems } from "../HealthServices/hsoSidebarNav";
import "../SDAO/SDAO.css";
import "../HealthServices/HealthServices.css";

function ProfilePasswordRequiredBanner() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener("campuscare-session-updated", h);
    return () => window.removeEventListener("campuscare-session-updated", h);
  }, []);
  const session = readCampusCareSession();
  const show = session?.mustChangePassword === true;
  if (!show) return null;
  return (
    <div
      role="status"
      style={{
        marginBottom: 20,
        padding: "12px 14px",
        borderRadius: 8,
        background: "#fffbeb",
        border: "1px solid #fde68a",
        color: "#92400e",
        fontSize: 14,
        lineHeight: 1.5,
        width: "100%",
        maxWidth: 960,
      }}
    >
      <strong>Password update required.</strong> You signed in with a temporary password from account setup. Scroll to{" "}
      <strong>Change password</strong> below and complete email verification — other campus workspaces stay limited until your
      password is updated.
    </div>
  );
}

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

  const [liveDisplayName, setLiveDisplayName] = useState(() => session?.name || "—");
  const [liveAvatarUrl, setLiveAvatarUrl] = useState(() => readCampusCareSession()?.profileAvatarDataUrl ?? null);
  const userName = liveDisplayName || "—";
  const userRole = session?.role || "—";

  const handleProfileSaved = (name) => {
    setLiveDisplayName(name?.trim() ? name.trim() : "—");
  };

  const handleAvatarSaved = (url) => {
    setLiveAvatarUrl(url && String(url).trim() ? String(url).trim() : null);
  };

  const headerAvatar = liveAvatarUrl ? (
    <img src={liveAvatarUrl} alt="" className="header-avatar-img" />
  ) : undefined;

  const canInterOfficeDocRequest = canCreateDocumentRequest(session?.office);
  const hsoDesignation = normalizeHsoDesignation(session?.designation);
  const isStudentSession = isStudentLikeCampusRole(session?.role);
  const showSdaoDocRequestNav = canInterOfficeDocRequest || isStudentSession;

  const sdaoNavItems = useMemo(() => {
    if (showSdaoDocRequestNav) return SDAO_NAV_ITEMS;
    return SDAO_NAV_ITEMS.filter((i) => i.id !== "docrequests");
  }, [showSdaoDocRequestNav]);

  const healthNavItems = useMemo(() => {
    return buildHealthNavItems({ designation: hsoDesignation, canInterOfficeDocRequest });
  }, [hsoDesignation, canInterOfficeDocRequest]);

  const workflow =
    variant === "sdao" ? "development" : variant === "hso" ? "health" : "discipline";

  const confirmLogout = async () => {
    setLogoutOpen(false);
    await logoutCampusCare();
    navigate("/");
  };

  const pageHeading = (
    <div className="office-ps-page-head">
      <h1 className="office-ps-page-title">Profile &amp; Settings</h1>
      <p className="office-ps-page-sub">
        Manage your CampusCare account, contact details, and office preferences.
      </p>
    </div>
  );

  const profileBody = (
    <>
      {pageHeading}
      <ProfilePasswordRequiredBanner />
      <OfficeProfileSettings
        workflow={workflow}
        onProfileSaved={handleProfileSaved}
        onAvatarSaved={handleAvatarSaved}
      />
    </>
  );

  const logoutModal = (
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
          <button
            type="button"
            className="sidebar-logout-btn sidebar-logout-btn--secondary"
            onClick={() => setLogoutOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="sidebar-logout-btn sidebar-logout-btn--primary"
            onClick={confirmLogout}
          >
            Yes, Logout
          </button>
        </div>
      </div>
    </CCModal>
  );

  if (variant === "do") {
    return (
      <div className="dashboard-layout do-office-layout">
        <Sidebar
          profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE}
          onLogoutRequest={() => setLogoutOpen(true)}
        />

        <div className="dashboard-main">
          <DisciplineOfficeTopBar userName={userName} userRole={userRole} avatarUrl={liveAvatarUrl} />

          <main className="dashboard-content do-office-shell do-ps-page">{profileBody}</main>
        </div>
        {logoutModal}
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
          <OfficeHeader
            userName={userName}
            userRole={userRole}
            notifications={SDAO_NOTIFICATIONS}
            avatar={headerAvatar}
          />
          <main className="dashboard-content sdao-page">{profileBody}</main>
        </div>
        {logoutModal}
      </div>
    );
  }

  return (
    <div className="dashboard-layout health-services-layout hs-office-shell">
      <Sidebar
        brandTitle="CampusCare Welfare Management"
        navItems={healthNavItems}
        activeNavId="__profile__"
        onNavSelect={(id) => {
          if (id === "queueDisplay") {
            navigate("/health-services/queue-display");
            return;
          }
          navigate("/health-services", { state: { restoreNav: id } });
        }}
        onLogoutRequest={() => setLogoutOpen(true)}
        profileSettingsPath={PROFILE_SETTINGS_PATH_HEALTH}
      />
      <div className="dashboard-main">
        <OfficeHeader
          userName={userName}
          userRole={userRole}
          notifications={HS_NOTIFICATIONS}
          avatar={headerAvatar}
        />
        <main className="dashboard-content hs-page hs-office-shell">{profileBody}</main>
      </div>
      {logoutModal}
    </div>
  );
}
