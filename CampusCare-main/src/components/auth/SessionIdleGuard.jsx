import { useSessionIdleLogout } from "../../hooks/useSessionIdleLogout";
import SessionIdleWarningModal from "./SessionIdleWarningModal";

/**
 * Two-phase idle handling for signed-in staff (non-kiosk):
 *   - Warning modal at 10 minutes of inactivity (5 minutes before logout).
 *   - Auto sign-out at 15 minutes of inactivity.
 */
export default function SessionIdleGuard({ children }) {
  const { warningOpen, keepAlive, getRemainingMs } = useSessionIdleLogout();
  return (
    <>
      {children}
      <SessionIdleWarningModal
        open={warningOpen}
        onStay={keepAlive}
        getRemainingMs={getRemainingMs}
      />
    </>
  );
}
