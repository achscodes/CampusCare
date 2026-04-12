const NAME_MIN = 2;
const NAME_MAX = 60;
/** Unicode letters plus spaces, periods, apostrophes, hyphens */
const NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]*$/u;

/**
 * @param {string} value
 * @param {string} label e.g. "First name"
 * @returns {string | null} error message or null if valid
 */
export function validatePersonName(value, label) {
  const t = value.trim();
  if (!t) return `${label} is required.`;
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
  if (t.length !== 1) return "Middle initial must be a single letter.";
  if (!/^[\p{L}]$/u.test(t)) return "Middle initial must be a letter.";
  return null;
}

/**
 * @param {string} password
 * @returns {string | null}
 */
export function validateStaffPassword(password) {
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  if (!/[a-zA-Z]/.test(password)) return "Password must include at least one letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  return null;
}
