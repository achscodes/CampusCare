const SESSION_KEY = "campuscare_session_v1";

export function readCampusCareSession() {
  try {
    const sessionRaw = window.sessionStorage.getItem(SESSION_KEY);
    if (sessionRaw) return JSON.parse(sessionRaw);
  } catch {
    // Ignore read/parse errors and continue fallback.
  }

  try {
    const localRaw = window.localStorage.getItem(SESSION_KEY);
    if (localRaw) return JSON.parse(localRaw);
  } catch {
    // Ignore read/parse errors.
  }

  return null;
}

export function writeCampusCareSession(session, rememberMe = false) {
  const payload = JSON.stringify(session);
  if (rememberMe) {
    window.localStorage.setItem(SESSION_KEY, payload);
    window.sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  window.sessionStorage.setItem(SESSION_KEY, payload);
  window.localStorage.removeItem(SESSION_KEY);
}

export function clearCampusCareSession() {
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
}
