import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logoutCampusCare } from "../utils/campusCareAuth";
import { readCampusCareSession } from "../utils/campusCareSession";
import { isQueueDisplayKioskSession } from "../utils/authKiosk";
import {
  SESSION_IDLE_ACTIVITY_EVENTS,
  SESSION_IDLE_LOGOUT_MS,
  SESSION_IDLE_WARNING_MS,
} from "../constants/sessionIdle";

const PUBLIC_PATHS = new Set(["/", "/signin", "/signup", "/forgot-password", "/terms", "/privacy"]);

function isPublicPath(pathname) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return false;
}

/**
 * Two-phase idle handling for signed-in staff (non-kiosk):
 *   - Warning shown at {@link SESSION_IDLE_WARNING_MS} of inactivity.
 *   - Auto sign-out at {@link SESSION_IDLE_LOGOUT_MS} of inactivity.
 *
 * Returns the warning state and a `keepAlive` callback for the modal.
 */
export function useSessionIdleLogout() {
  const navigate = useNavigate();
  const location = useLocation();
  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const loggingOutRef = useRef(false);
  const [warningOpen, setWarningOpen] = useState(false);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const armTimers = useCallback(() => {
    clearTimers();
    warningTimerRef.current = window.setTimeout(() => {
      const session = readCampusCareSession();
      if (!session?.userId || isQueueDisplayKioskSession(session)) return;
      setWarningOpen(true);
    }, SESSION_IDLE_WARNING_MS);

    logoutTimerRef.current = window.setTimeout(async () => {
      if (loggingOutRef.current) return;
      const session = readCampusCareSession();
      if (!session?.userId) return;
      if (isQueueDisplayKioskSession(session)) return;

      loggingOutRef.current = true;
      try {
        await logoutCampusCare();
        setWarningOpen(false);
        navigate("/signin", { replace: true, state: { sessionExpired: true } });
      } finally {
        loggingOutRef.current = false;
      }
    }, SESSION_IDLE_LOGOUT_MS);
  }, [clearTimers, navigate]);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (warningOpen) setWarningOpen(false);
    armTimers();
  }, [armTimers, warningOpen]);

  const getRemainingMs = useCallback(() => {
    const elapsed = Date.now() - lastActivityRef.current;
    return Math.max(0, SESSION_IDLE_LOGOUT_MS - elapsed);
  }, []);

  useEffect(() => {
    const onActivity = () => {
      const session = readCampusCareSession();
      if (!session?.userId || isQueueDisplayKioskSession(session)) return;
      if (isPublicPath(location.pathname)) return;
      lastActivityRef.current = Date.now();
      if (warningOpen) setWarningOpen(false);
      armTimers();
    };

    const session = readCampusCareSession();
    if (!session?.userId || isQueueDisplayKioskSession(session) || isPublicPath(location.pathname)) {
      clearTimers();
      setWarningOpen(false);
      return undefined;
    }

    lastActivityRef.current = Date.now();
    armTimers();

    for (const ev of SESSION_IDLE_ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    return () => {
      clearTimers();
      for (const ev of SESSION_IDLE_ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
    };
  }, [location.pathname, armTimers, clearTimers, warningOpen]);

  return { warningOpen, keepAlive: resetActivity, getRemainingMs };
}
