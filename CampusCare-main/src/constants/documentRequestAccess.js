/**
 * Inter-office document requests: DO (discipline), HSO (health), SDAO (development).
 * Each office may only request from the other two (not Admissions).
 */

export const DOCUMENT_REQUEST_OFFICE_KEYS = /** @type {const} */ ([
  "health",
  "discipline",
  "development",
]);

const ALLOWED = new Set(DOCUMENT_REQUEST_OFFICE_KEYS);

/** @type {Record<string, string>} */
export const OFFICE_KEY_LABELS = {
  discipline: "Discipline Office (DO)",
  health: "Health Services (HSO)",
  development: "Student Development (SDAO)",
};

/**
 * @param {string | null | undefined} office
 * @returns {boolean}
 */
export function canCreateDocumentRequest(office) {
  const key = typeof office === "string" ? office.trim().toLowerCase() : "";
  return ALLOWED.has(key);
}

/**
 * Normalize session office string to a key.
 * @param {string | null | undefined} office
 */
export function normalizeOfficeKey(office) {
  return typeof office === "string" ? office.trim().toLowerCase() : "";
}

/**
 * Which partner office this user may request documents from (targets only — excludes self).
 * DO → SDAO & HSO | HSO → SDAO & DO | SDAO → HSO & DO
 * @param {string | null | undefined} office
 * @returns {{ value: string; label: string }[]}
 */
export function getDocumentRequestTargetOptionsForOffice(office) {
  const o = normalizeOfficeKey(office);
  if (o === "discipline") {
    return [
      { value: "development", label: OFFICE_KEY_LABELS.development },
      { value: "health", label: OFFICE_KEY_LABELS.health },
    ];
  }
  if (o === "health") {
    return [
      { value: "development", label: OFFICE_KEY_LABELS.development },
      { value: "discipline", label: OFFICE_KEY_LABELS.discipline },
    ];
  }
  if (o === "development") {
    return [
      { value: "health", label: OFFICE_KEY_LABELS.health },
      { value: "discipline", label: OFFICE_KEY_LABELS.discipline },
    ];
  }
  return [];
}

/**
 * @param {string | null | undefined} value office key
 */
export function labelForOfficeKey(value) {
  const key = normalizeOfficeKey(value);
  return OFFICE_KEY_LABELS[key] ?? "—";
}

/**
 * Label for the office that should fulfill the document (target_office).
 * @deprecated Prefer labelForOfficeKey — kept for compatibility with `targetOffice` fields.
 */
export function labelForDocumentRequestTarget(value) {
  return labelForOfficeKey(value);
}

/**
 * @param {string | null | undefined} requestingOffice
 * @param {string | null | undefined} targetOffice
 * @returns {boolean}
 */
export function isAllowedInterOfficePair(requestingOffice, targetOffice) {
  const req = normalizeOfficeKey(requestingOffice);
  const tgt = normalizeOfficeKey(targetOffice);
  if (!req || !tgt || req === tgt) return false;
  const allowed = getDocumentRequestTargetOptionsForOffice(req).map((x) => x.value);
  return allowed.includes(tgt);
}

/**
 * Map free-text referral / office labels (from forms or legacy rows) to an office key.
 * @param {string | null | undefined} text
 * @returns {"" | "discipline" | "health" | "development"}
 */
export function officeKeyFromInterOfficeLabel(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return "";
  if (t.includes("discipline") || t.includes("(do)")) return "discipline";
  if (t.includes("health") || t.includes("hso")) return "health";
  if (t.includes("sdao") || t.includes("student development") || t.includes("development & activities"))
    return "development";
  return "";
}
