import { lazy, Suspense, useMemo } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ToastProvider from "./components/common/ToastProvider";
import AppVisitLogger from "./components/AppVisitLogger";
import LandingPage from "./pages/LandingPage";
import { profileSettingsPathForSessionOffice } from "./utils/profileSettingsRoutes";
import { readCampusCareSession } from "./utils/campusCareSession";
import { useSupabaseAuthRecovery } from "./hooks/useSupabaseAuthRecovery";

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
const SDAO = lazy(() =>
  import("./pages/SDAO/SDAO").then((m) => ({ default: m.default ?? m.SDAO }))
);
const ModuleProfileSettingsRoute = lazy(() =>
  import("./pages/ProfileSettings/ModuleProfileSettingsRoute").then((m) => ({ default: m.default ?? m.ModuleProfileSettingsRoute }))
);
const SuperAdminPage = lazy(() =>
  import("./pages/SuperAdmin/SuperAdminPage").then((m) => ({ default: m.default ?? m.SuperAdminPage }))
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
            <Route path="/do" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/health-services" element={<HealthServices />} />
            <Route path="/super-admin/hso" element={<SuperAdminPage officeKey="health" />} />
            <Route path="/super-admin/do" element={<SuperAdminPage officeKey="discipline" />} />
            <Route path="/super-admin/sdao" element={<SuperAdminPage officeKey="development" />} />
            <Route path="/sdao" element={<SDAO />} />
            <Route path="/case-conference" element={<CaseConferencePage />} />
            <Route path="/student-records" element={<StudentRecordsPage />} />
            <Route path="/case-management" element={<CaseManagementPage />} />
            <Route path="/incident-report" element={<IncidentReportPage />} />
            <Route path="/document-requests" element={<DocumentRequestsPage />} />
            <Route path="/referrals" element={<ReferralsPage />} />
            <Route path="/sanctions" element={<SanctionsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/do/profile-settings" element={<ModuleProfileSettingsRoute variant="do" />} />
            <Route path="/sdao/profile-settings" element={<ModuleProfileSettingsRoute variant="sdao" />} />
            <Route path="/health-services/profile-settings" element={<ModuleProfileSettingsRoute variant="hso" />} />
            <Route path="/profile" element={<LegacyProfileSettingsRedirect />} />
            <Route path="/settings" element={<LegacyProfileSettingsRedirect />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </Router>
  );
}

export default App;
