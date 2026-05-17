import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logoutCampusCare } from "../utils/campusCareAuth";
import { readCampusCareSession } from "../utils/campusCareSession";
import { isQueueDisplayKioskSession } from "../utils/authKiosk";
import { SESSION_IDLE_ACTIVITY_EVENTS, SESSION_IDLE_LOGOUT_MS } from "../constants/sessionIdle";
import { showToast } from "../utils/toast";

const PUBLIC_PATHS = new Set(["/", "/signin", "/signup", "/forgot-password", "/terms", "/privacy"]);

function isPublicPath(pathname) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return false;
}

/**
 * Signs the user out after {@link SESSION_IDLE_LOGOUT_MS} without activity.
 */
export function useSessionIdleLogout() {
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef(null);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(async () => {
        if (loggingOutRef.current) return;
        const session = readCampusCareSession();
        if (!session?.userId) return;
        if (isQueueDisplayKioskSession(session)) return;

        loggingOutRef.current = true;
        try {
          await logoutCampusCare();
          showToast("You were signed out after 15 minutes of inactivity.", { variant: "info" });
          navigate("/signin", { replace: true });
        } finally {
          loggingOutRef.current = false;
        }
      }, SESSION_IDLE_LOGOUT_MS);
    };

    const onActivity = () => {
      const session = readCampusCareSession();
      if (!session?.userId || isQueueDisplayKioskSession(session)) return;
      if (isPublicPath(location.pathname)) return;
      resetTimer();
    };

    const session = readCampusCareSession();
    if (!session?.userId || isQueueDisplayKioskSession(session) || isPublicPath(location.pathname)) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return undefined;
    }

    resetTimer();

    for (const ev of SESSION_IDLE_ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      for (const ev of SESSION_IDLE_ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
    };
  }, [location.pathname, navigate]);
}
