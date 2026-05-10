import { lazy, Suspense, useMemo } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ToastProvider from "./components/common/ToastProvider";
import AppVisitLogger from "./components/AppVisitLogger";
import LandingPage from "./pages/LandingPage";
import { profileSettingsPathForSessionOffice } from "./utils/profileSettingsRoutes";
import { readCampusCareSession } from "./utils/campusCareSession";
import { normalizeHsoDesignation } from "./utils/hsoAccess";
import { useSupabaseAuthRecovery } from "./hooks/useSupabaseAuthRecovery";
import { isWelfareAdminForAdminRoute } from "./utils/welfareAdmin";

const SignupPage = lazy(() =>
  import("./pages/SignupPage").then((m) => ({ default: m.default ?? m.SignupPage }))
);
const SigninPage = lazy(() =>
  import("./pages/SigninPage").then((m) => ({ default: m.default ?? m.SigninPage }))
);
const ForgotPasswordPage = lazy(() =>
  import("./pages/ForgotPasswordPage").then((m) => ({ default: m.default ?? m.ForgotPasswordPage }))
);
const TermsPage = lazy(() =>
  import("./pages/TermsPage").then((m) => ({ default: m.default ?? m.TermsPage }))
);
const PrivacyPage = lazy(() =>
  import("./pages/PrivacyPage").then((m) => ({ default: m.default ?? m.PrivacyPage }))
);

const CaseConferencePage = lazy(() =>
  import("./pages/DODashboard/DO").then((m) => ({ default: m.CaseConferencePage }))
);
const IncidentReportPage = lazy(() =>
  import("./pages/DODashboard/DO").then((m) => ({ default: m.IncidentReportPage }))
);
const CaseManagementPage = lazy(() =>
  import("./pages/DODashboard/DO").then((m) => ({ default: m.CaseManagementPage }))
);
const DashboardPage = lazy(() =>
  import("./pages/DODashboard/DO").then((m) => ({ default: m.DashboardPage }))
);
const DocumentRequestsPage = lazy(() =>
  import("./pages/DODashboard/DO").then((m) => ({ default: m.DocumentRequestsPage }))
);
const ReferralsPage = lazy(() =>
  import("./pages/DODashboard/DO").then((m) => ({ default: m.ReferralsPage }))
);
const ReportsPage = lazy(() =>
  import("./pages/DODashboard/DO").then((m) => ({ default: m.ReportsPage }))
);
const SanctionsPage = lazy(() =>
  import("./pages/DODashboard/DO").then((m) => ({ default: m.SanctionsPage }))
);
const StudentRecordsPage = lazy(() =>
  import("./pages/DODashboard/DO").then((m) => ({ default: m.StudentRecordsPage }))
);

const HealthServices = lazy(() =>
  import("./pages/HealthServices/HealthServices").then((m) => ({ default: m.default ?? m.HealthServices }))
);
const HealthQueueDisplayPage = lazy(() =>
  import("./pages/HealthServices/HealthQueueDisplayPage").then((m) => ({ default: m.default }))
);
const SDAO = lazy(() =>
  import("./pages/SDAO/SDAO").then((m) => ({ default: m.default ?? m.SDAO }))
);
const ModuleProfileSettingsRoute = lazy(() =>
  import("./pages/ProfileSettings/ModuleProfileSettingsRoute").then((m) => ({ default: m.default ?? m.ModuleProfileSettingsRoute }))
);
const AdminPage = lazy(() =>
  import("./pages/Admin/AdminPage").then((m) => ({ default: m.default ?? m.AdminPage }))
);

function RouteLoadingFallback() {
  return (
    <div
      style={{
        minHeight: "40vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#64748b",
        fontSize: 14,
      }}
    >
      Loading…
    </div>
  );
}

function LegacyProfileSettingsRedirect() {
  const session = useMemo(() => {
    return readCampusCareSession();
  }, []);
  return <Navigate to={profileSettingsPathForSessionOffice(session?.office)} replace />;
}

function RequireSignedIn({ children }) {
  const session = readCampusCareSession();
  if (!session?.userId) return <Navigate to="/signin" replace />;
  return children;
}

function RequireOffice({ office, children }) {
  const session = readCampusCareSession();
  if (!session?.userId) return <Navigate to="/signin" replace />;
  if (String(session?.office || "").trim().toLowerCase() !== String(office).trim().toLowerCase()) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function RequireWelfareAdminOffice({ office, children }) {
  const session = readCampusCareSession();
  if (!session?.userId) return <Navigate to="/signin" replace />;
  if (!isWelfareAdminForAdminRoute(session, office)) return <Navigate to="/" replace />;
  return children;
}

function HealthServicesHome() {
  const session = readCampusCareSession();
  if (normalizeHsoDesignation(session?.designation) === "queue_display") {
    return <Navigate to="/health-services/queue-display" replace />;
  }
  return <HealthServices />;
}

function App() {
  // Recover existing Supabase session on app load
  useSupabaseAuthRecovery();

  return (
    <Router>
      <ToastProvider>
        <AppVisitLogger />
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/signin" element={<SigninPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/do" element={<RequireOffice office="discipline"><DashboardPage /></RequireOffice>} />
            <Route path="/dashboard" element={<RequireOffice office="discipline"><DashboardPage /></RequireOffice>} />
            <Route path="/health-services" element={<RequireOffice office="health"><HealthServicesHome /></RequireOffice>} />
            <Route path="/health-services/queue-display" element={<RequireOffice office="health"><HealthQueueDisplayPage /></RequireOffice>} />
            <Route path="/super-admin/hso" element={<Navigate to="/admin/hso" replace />} />
            <Route path="/super-admin/do" element={<Navigate to="/admin/do" replace />} />
            <Route path="/super-admin/sdao" element={<Navigate to="/admin/do" replace />} />
            <Route path="/admin/hso" element={<RequireWelfareAdminOffice office="health"><AdminPage officeKey="health" /></RequireWelfareAdminOffice>} />
            <Route path="/admin/do" element={<RequireWelfareAdminOffice office="discipline"><AdminPage officeKey="discipline" /></RequireWelfareAdminOffice>} />
            <Route path="/admin/sdao" element={<Navigate to="/admin/do" replace />} />
            <Route path="/sdao" element={<RequireOffice office="development"><SDAO /></RequireOffice>} />
            <Route path="/case-conference" element={<RequireOffice office="discipline"><CaseConferencePage /></RequireOffice>} />
            <Route path="/student-records" element={<RequireOffice office="discipline"><StudentRecordsPage /></RequireOffice>} />
            <Route path="/case-management" element={<RequireOffice office="discipline"><CaseManagementPage /></RequireOffice>} />
            <Route path="/incident-report" element={<RequireOffice office="discipline"><IncidentReportPage /></RequireOffice>} />
            <Route path="/document-requests" element={<RequireOffice office="discipline"><DocumentRequestsPage /></RequireOffice>} />
            <Route path="/referrals" element={<RequireOffice office="discipline"><ReferralsPage /></RequireOffice>} />
            <Route path="/sanctions" element={<RequireOffice office="discipline"><SanctionsPage /></RequireOffice>} />
            <Route path="/reports" element={<RequireOffice office="discipline"><ReportsPage /></RequireOffice>} />
            <Route path="/do/profile-settings" element={<RequireOffice office="discipline"><ModuleProfileSettingsRoute variant="do" /></RequireOffice>} />
            <Route path="/sdao/profile-settings" element={<RequireOffice office="development"><ModuleProfileSettingsRoute variant="sdao" /></RequireOffice>} />
            <Route path="/health-services/profile-settings" element={<RequireOffice office="health"><ModuleProfileSettingsRoute variant="hso" /></RequireOffice>} />
            <Route path="/profile" element={<LegacyProfileSettingsRedirect />} />
            <Route path="/settings" element={<LegacyProfileSettingsRedirect />} />
            <Route path="*" element={<RequireSignedIn><Navigate to="/" replace /></RequireSignedIn>} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </Router>
  );
}

export default App;
