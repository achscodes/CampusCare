import { normalizeHsoDesignation } from "./hsoAccess";

/**
 * Maps staff `office` from signup / profile to the default app route (RBAC landing).
 * Keys match OFFICE_OPTIONS values in `data/mockUsers.js`.
 */
const OFFICE_HOME_ROUTE = {
  health: "/health-services",
  guidance: "/dashboard",
  discipline: "/dashboard",
  development: "/sdao",
};

/**
 * @param {string | null | undefined} office
 * @returns {string}
 */
export function getHomeRouteForOffice(office) {
  const key = typeof office === "string" ? office.trim() : "";
  if (key && OFFICE_HOME_ROUTE[key]) return OFFICE_HOME_ROUTE[key];
  return "/dashboard";
}

/**
 * Landing route after sign-in (includes HSO TV kiosk role).
 * @param {{ office?: string | null | undefined; designation?: string | null | undefined } | null | undefined} session
 * @returns {string}
 */
export function getHomeRouteForSession(session) {
  const office = String(session?.office || "").trim().toLowerCase();
  if (office === "health" && normalizeHsoDesignation(session?.designation) === "queue_display") {
    return "/health-services/queue-display";
  }
  return getHomeRouteForOffice(session?.office);
}
