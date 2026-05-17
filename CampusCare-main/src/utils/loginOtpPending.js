const STORAGE_KEY = "campuscare_login_otp_pending_v1";

/**
 * @typedef {{
 *   userId: string,
 *   email: string,
 *   rememberMe: boolean,
 *   expiresAt?: string,
 *   nextResendAt?: string,
 *   emailSentMask?: string,
 * }} LoginOtpPending
 */

/** @returns {LoginOtpPending | null} */
export function readLoginOtpPending() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @param {LoginOtpPending} data */
export function writeLoginOtpPending(data) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearLoginOtpPending() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isLoginOtpPending() {
  return Boolean(readLoginOtpPending()?.userId);
}
