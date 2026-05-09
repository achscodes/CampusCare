export const HSO_DESIGNATIONS = ["nurse", "physician", "dentist", "admin"];

export const HSO_DESIGNATION_OPTIONS = [
  { value: "nurse", label: "Nurse" },
  { value: "physician", label: "Physician" },
  { value: "dentist", label: "Dentist" },
  { value: "admin", label: "Admin" },
];

/**
 * @param {string | null | undefined} value
 * @returns {'nurse'|'physician'|'dentist'|'admin'}
 */
export function normalizeHsoDesignation(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (HSO_DESIGNATIONS.includes(raw)) return /** @type {any} */ (raw);
  return "admin";
}

/**
 * @param {string | null | undefined} value
 */
export function hsoDesignationLabel(value) {
  const d = normalizeHsoDesignation(value);
  if (d === "nurse") return "Nurse";
  if (d === "physician") return "Physician";
  if (d === "dentist") return "Dentist";
  return "Admin";
}

/**
 * @param {{ office?: string | null | undefined, designation?: string | null | undefined } | null | undefined} session
 */
export function isHsoAdminSession(session) {
  return String(session?.office || "").trim().toLowerCase() === "health"
    && normalizeHsoDesignation(session?.designation) === "admin";
}
