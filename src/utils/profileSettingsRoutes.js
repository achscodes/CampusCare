import { normalizeOfficeKey } from "../constants/documentRequestAccess";

/** Discipline Office (DO) — includes guidance staff who share the DO shell. */
export const PROFILE_SETTINGS_PATH_DISCIPLINE = "/do/profile-settings";

export const PROFILE_SETTINGS_PATH_DEVELOPMENT = "/sdao/profile-settings";

export const PROFILE_SETTINGS_PATH_HEALTH = "/health-services/profile-settings";

/**
 * @param {string | null | undefined} office raw session `office`
 * @returns {string}
 */
export function profileSettingsPathForSessionOffice(office) {
  const k = normalizeOfficeKey(office);
  if (k === "health") return PROFILE_SETTINGS_PATH_HEALTH;
  if (k === "development") return PROFILE_SETTINGS_PATH_DEVELOPMENT;
  return PROFILE_SETTINGS_PATH_DISCIPLINE;
}
