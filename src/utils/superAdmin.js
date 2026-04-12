/** Role string for HSO / DO / SDAO Super Admin users (set in Supabase `profiles.role`). */
export const SUPER_ADMIN_ROLE = "Super Admin";

/** Signup dropdown values → real `office` key + `role` for metadata / profiles. */
export const SIGNUP_OFFICE_SUPER_ADMIN = {
  health: "health_super_admin",
  discipline: "discipline_super_admin",
  development: "development_super_admin",
};

/**
 * @param {string} officeValue - value from signup office `<select>`
 * @param {Record<string, string>} staffRoleByOffice - maps staff office keys to profile role labels
 * @returns {{ officeKey: string, role: string }}
 */
export function resolveSignupOfficeAndRole(officeValue, staffRoleByOffice) {
  const v = String(officeValue || "").trim();
  if (v === SIGNUP_OFFICE_SUPER_ADMIN.health) {
    return { officeKey: "health", role: SUPER_ADMIN_ROLE };
  }
  if (v === SIGNUP_OFFICE_SUPER_ADMIN.discipline) {
    return { officeKey: "discipline", role: SUPER_ADMIN_ROLE };
  }
  if (v === SIGNUP_OFFICE_SUPER_ADMIN.development) {
    return { officeKey: "development", role: SUPER_ADMIN_ROLE };
  }
  return {
    officeKey: v,
    role: staffRoleByOffice[v] || "Staff",
  };
}

/** @param {{ role?: string } | null | undefined} session */
export function isSuperAdminSession(session) {
  return String(session?.role || "").trim() === SUPER_ADMIN_ROLE;
}

/**
 * @param {'health'|'discipline'|'development'} office
 */
export function getSuperAdminRouteForOffice(office) {
  const o = String(office || "").trim().toLowerCase();
  if (o === "health") return "/super-admin/hso";
  if (o === "discipline") return "/super-admin/do";
  if (o === "development") return "/super-admin/sdao";
  return "/";
}

/**
 * @param {{ office?: string; role?: string } | null | undefined} session
 * @param {'health'|'discipline'|'development'} expected
 */
export function isSuperAdminForOffice(session, expected) {
  if (!isSuperAdminSession(session)) return false;
  return String(session?.office || "").trim().toLowerCase() === String(expected).trim().toLowerCase();
}
