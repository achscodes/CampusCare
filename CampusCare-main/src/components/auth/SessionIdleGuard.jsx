import { useSessionIdleLogout } from "../../hooks/useSessionIdleLogout";

/** Activates 15-minute idle logout for signed-in staff (non-kiosk). */
export default function SessionIdleGuard({ children }) {
  useSessionIdleLogout();
  return children;
}
