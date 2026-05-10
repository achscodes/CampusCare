import { normalizeHsoDesignation } from "./hsoAccess";

/** Welfare / institution portal admins (DO, SDAO, HSO) — stored in `profiles.role`. */
export const WELFARE_ADMIN_ROLE = "Admin";

/** Pre-migration profiles only; keep until all DBs run `20260530120000_welfare_admin_role_rename.sql`. */
export const LEGACY_WELFARE_ADMIN_ROLE = "Super Admin";

/**
 * Signup `<select>` values → office key + welfare admin role.
 * Not shown on the public signup form; kept for `handle_new_user` / manual Auth user metadata.
 */
export const SIGNUP_OFFICE_WELFARE_ADMIN = {
  health: "health_super_admin",
  discipline: "discipline_super_admin",
  development: "development_super_admin",
};

/** @deprecated Use {@link SIGNUP_OFFICE_WELFARE_ADMIN} */
export const SIGNUP_OFFICE_SUPER_ADMIN = SIGNUP_OFFICE_WELFARE_ADMIN;

/**
 * @param {string} officeValue - value from signup office `<select>`
 * @param {Record<string, string>} staffRoleByOffice - maps staff office keys to profile role labels
 * @returns {{ officeKey: string, role: string }}
 */
export function resolveSignupOfficeAndRole(officeValue, staffRoleByOffice) {
  const v = String(officeValue || "").trim();
  if (v === SIGNUP_OFFICE_WELFARE_ADMIN.health) {
    return { officeKey: "health", role: WELFARE_ADMIN_ROLE };
  }
  if (v === SIGNUP_OFFICE_WELFARE_ADMIN.discipline) {
    return { officeKey: "discipline", role: WELFARE_ADMIN_ROLE };
  }
  if (v === SIGNUP_OFFICE_WELFARE_ADMIN.development) {
    return { officeKey: "development", role: WELFARE_ADMIN_ROLE };
  }
  return {
    officeKey: v,
    role: staffRoleByOffice[v] || "Staff",
  };
}

/**
 * True for institution/welfare admins — not HSO facility desk admins (designation `admin`).
 * @param {{ role?: string; office?: string; designation?: string } | null | undefined} session
 */
export function isWelfareAdminSession(session) {
  const r = String(session?.role || "").trim();
  if (r === LEGACY_WELFARE_ADMIN_ROLE) return true;
  if (r !== WELFARE_ADMIN_ROLE) return false;
  const office = String(session?.office || "").trim().toLowerCase();
  if (office === "health" && normalizeHsoDesignation(session?.designation) === "admin") {
    return false;
  }
  return true;
}

/**
 * @param {'health'|'discipline'|'development'} office
 */
export function getWelfareAdminRouteForOffice(office) {
  const o = String(office || "").trim().toLowerCase();
  if (o === "health") return "/admin/hso";
  // DO + SDAO welfare admins share one portal URL (dual tabs).
  if (o === "discipline" || o === "development") return "/admin/do";
  return "/";
}

/**
 * Access check for `/admin/hso` vs `/admin/do` / `/admin/sdao`.
 * Discipline and development welfare admins may use either DO or SDAO route (same shell).
 */
export function isWelfareAdminForAdminRoute(session, routeOfficeKey) {
  const key = String(routeOfficeKey || "").trim().toLowerCase();
  if (key === "health") return isWelfareAdminForOffice(session, "health");
  if (key === "discipline" || key === "development") {
    if (!isWelfareAdminSession(session)) return false;
    const o = String(session?.office || "").trim().toLowerCase();
    return o === "discipline" || o === "development";
  }
  return isWelfareAdminForOffice(session, key);
}

/**
 * @param {{ office?: string; role?: string; designation?: string } | null | undefined} session
 * @param {'health'|'discipline'|'development'} expected
 */
export function isWelfareAdminForOffice(session, expected) {
  if (!isWelfareAdminSession(session)) return false;
  return String(session?.office || "").trim().toLowerCase() === String(expected).trim().toLowerCase();
}

/** Hide welfare admins from pending-approval lists (and legacy role). */
export function isWelfareAdminProfileRole(role) {
  const r = String(role || "").trim();
  return r === WELFARE_ADMIN_ROLE || r === LEGACY_WELFARE_ADMIN_ROLE;
}

/** Header / UI label: legacy DB role still reads as current welfare admin title. */
export function displayWelfareAdminRole(role) {
  const r = String(role || "").trim();
  if (r === LEGACY_WELFARE_ADMIN_ROLE) return WELFARE_ADMIN_ROLE;
  return r || WELFARE_ADMIN_ROLE;
}
