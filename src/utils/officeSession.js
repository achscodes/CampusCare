/**
 * Shared session helpers for office portals (DO / HSO / SDAO).
 */

/**
 * @param {string | null | undefined} role
 * @returns {boolean}
 */
export function isStudentLikeCampusRole(role) {
  const r = String(role || "").trim().toLowerCase();
  return r === "student" || r === "scholar";
}

/**
 * Staff who may use admin-only inter-office document requests (not student accounts).
 * @param {string | null | undefined} role
 * @returns {boolean}
 */
export function isStaffCampusRole(role) {
  return !isStudentLikeCampusRole(role);
}
