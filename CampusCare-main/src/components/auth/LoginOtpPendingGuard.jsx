import { Navigate, useLocation } from "react-router-dom";
import { readCampusCareSession } from "../../utils/campusCareSession";
import { readLoginOtpPending } from "../../utils/loginOtpPending";

const PUBLIC_AUTH_PATHS = new Set([
  "/signin",
  "/signup",
  "/forgot-password",
  "/terms",
  "/privacy",
]);

export default function LoginOtpPendingGuard({ children }) {
  const location = useLocation();
  const pending = readLoginOtpPending();
  const campusSession = readCampusCareSession();

  if (
    pending?.userId &&
    !campusSession?.userId &&
    !PUBLIC_AUTH_PATHS.has(location.pathname)
  ) {
    return <Navigate to="/signin" replace />;
  }

  return children;
}
