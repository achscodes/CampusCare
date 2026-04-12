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
