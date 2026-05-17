/**
 * NU Dasmariñas student email helpers.
 * Example: "Glenn Francis Anjobhel D. Achas" → achasgd@students.nu-dasma.edu.ph
 * Mobile app should mirror this algorithm when collecting involved-party names.
 */

export const NU_STUDENT_EMAIL_DOMAIN = "@students.nu-dasma.edu.ph";

/** @param {string} token */
function tokenLooksLikeInitial(token) {
  const t = String(token || "").replace(/\./g, "").trim();
  return t.length === 1 && /^[a-zA-Z]$/.test(t);
}

/**
 * @param {string} fullName
 * @returns {string | null} local part only, or null if name cannot be parsed
 */
export function parseNuStudentEmailLocalPart(fullName) {
  const normalized = String(fullName || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) return null;

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length < 2) return null;

  const surnameRaw = parts[parts.length - 1].replace(/\./g, "");
  const surname = surnameRaw.toLowerCase();
  if (!surname) return null;

  const firstToken = parts[0].replace(/\./g, "");
  const firstInitial = firstToken.charAt(0).toLowerCase();
  if (!firstInitial) return null;

  let middleInitial = "";
  if (parts.length >= 3) {
    const beforeSurname = parts[parts.length - 2];
    if (tokenLooksLikeInitial(beforeSurname)) {
      middleInitial = beforeSurname.replace(/\./g, "").charAt(0).toLowerCase();
    }
  }

  return `${surname}${firstInitial}${middleInitial}`;
}

/**
 * @param {string} fullName
 * @returns {string | null}
 */
export function generateNuStudentEmail(fullName) {
  const local = parseNuStudentEmailLocalPart(fullName);
  if (!local) return null;
  return `${local}${NU_STUDENT_EMAIL_DOMAIN}`;
}

/**
 * @param {string} email
 * @returns {boolean}
 */
export function isNuStudentEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .endsWith(NU_STUDENT_EMAIL_DOMAIN);
}
