const NAME_MIN = 2;
const NAME_MAX = 60;
/** Unicode letters plus spaces, periods, apostrophes, hyphens — NO digits */
const NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]*$/u;

/**
 * @param {string} value
 * @param {string} label e.g. "First name"
 * @returns {string | null} error message or null if valid
 */
export function validatePersonName(value, label) {
  const t = value.trim();
  if (!t) return `${label} is required.`;
  if (/\d/.test(t)) return `${label} must not contain numbers.`;
  if (t.length < NAME_MIN) return `${label} must be at least ${NAME_MIN} characters.`;
  if (t.length > NAME_MAX) return `${label} must be at most ${NAME_MAX} characters.`;
  if (!NAME_PATTERN.test(t)) {
    return `${label}: use letters only (spaces, hyphens, and periods are allowed).`;
  }
  return null;
}

/**
 * @param {string} value
 * @returns {string | null}
 */
export function validateMiddleInitial(value) {
  const t = value.trim();
  if (!t) return null;
  if (/\d/.test(t)) return "Middle initial must not contain numbers.";
  if (t.length !== 1) return "Middle initial must be a single letter.";
  if (!/^[\p{L}]$/u.test(t)) return "Middle initial must be a letter.";
  return null;
}

/**
 * Password strength levels.
 * @param {string} password
 * @returns {{ score: number; level: 'weak' | 'medium' | 'strong'; tips: string[] }}
 */
export function getPasswordStrength(password) {
  if (!password) return { score: 0, level: "weak", tips: ["Enter a password."] };
  const tips = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else tips.push("At least 8 characters");

  if (/[A-Z]/.test(password)) score += 1;
  else tips.push("At least one uppercase letter (A-Z)");

  if (/[a-z]/.test(password)) score += 1;
  else tips.push("At least one lowercase letter (a-z)");

  if (/[0-9]/.test(password)) score += 1;
  else tips.push("At least one number (0-9)");

  if (/[_#*!@$%^&()\-+=[\]{}|;:,.<>?]/.test(password)) score += 1;
  else tips.push("At least one special character (_ # * ! @ $ % ^ &)");

  let level = "weak";
  if (score >= 5) level = "strong";
  else if (score >= 3) level = "medium";

  return { score, level, tips };
}

/**
 * @param {string} password
 * @returns {string | null}
 */
export function validateStaffPassword(password) {
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter (A-Z).";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter (a-z).";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[_#*!@$%^&()\-+=[\]{}|;:,.<>?]/.test(password)) {
    return "Password must include at least one special character (_ # * ! @ $ % ^ &).";
  }
  return null;
}

/**
 * Validates that a student ID is in numeric format (e.g. 2023-10234).
 * @param {string} value
 * @returns {string | null}
 */
export function validateStudentId(value) {
  const t = value.trim();
  if (!t) return "Student ID is required.";
  if (/[a-zA-Z]/.test(t)) return "Student ID must contain numbers only (e.g., 2023-10234).";
  if (!/^\d{4}-\d+$/.test(t)) return "Student ID must be in format YYYY-NNNNN (e.g., 2023-10234).";
  return null;
}

/**
 * Strict numeric student ID (digits only, no separators).
 * Used by Discipline Office case creation where IDs are enforced as numeric.
 * @param {string} value
 * @param {string} [label]
 * @returns {string | null}
 */
export function validateStrictNumericStudentId(value, label = "Student ID") {
  const t = String(value || "").trim();
  if (!t) return `${label} is required.`;
  if (!/^\d+$/.test(t)) return `${label} must be numeric digits only.`;
  if (t.length < 5) return `${label} must be at least 5 digits.`;
  if (t.length > 20) return `${label} must be at most 20 digits.`;
  return null;
}

/**
 * UI helper: restrict name input as the user types.
 * Keeps Unicode letters, spaces, apostrophes, periods, and hyphens.
 * @param {string} value
 */
export function sanitizePersonNameInput(value) {
  const raw = String(value ?? "");
  // strip digits first, then remove any characters outside the allowed set
  const noDigits = raw.replace(/\d+/g, "");
  return noDigits.replace(/[^\p{L}\s'.-]+/gu, "");
}

/**
 * UI helper: digits only as the user types.
 * @param {string} value
 */
export function sanitizeDigitsOnlyInput(value) {
  return String(value ?? "").replace(/[^\d]+/g, "");
}