import { useMemo } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ToastProvider from "./components/common/ToastProvider";
import AppVisitLogger from "./components/AppVisitLogger";
import LandingPage from "./pages/LandingPage";
import SignupPage from "./pages/SignupPage";
import SigninPage from "./pages/SigninPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import {
  CaseConferencePage,
  CaseManagementPage,
  DashboardPage,
  DocumentRequestsPage,
  ReferralsPage,
  ReportsPage,
  SanctionsPage,
  StudentRecordsPage,
} from "./pages/DODashboard/DO";
import HealthServices from "./pages/HealthServices/HealthServices";
import SDAO from "./pages/SDAO/SDAO";
import ModuleProfileSettingsRoute from "./pages/ProfileSettings/ModuleProfileSettingsRoute";
import SuperAdminPage from "./pages/SuperAdmin/SuperAdminPage";
import { profileSettingsPathForSessionOffice } from "./utils/profileSettingsRoutes";

function LegacyProfileSettingsRedirect() {
  const session = useMemo(() => {
    try {
      return JSON.parse(window.localStorage.getItem("campuscare_session_v1") || "null");
    } catch {
      return null;
    }
  }, []);
  return <Navigate to={profileSettingsPathForSessionOffice(session?.office)} replace />;
}

function App() {
  return (
    <Router>
      <ToastProvider>
        <AppVisitLogger />
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
      </ToastProvider>
    </Router>
  );
}

export default App;