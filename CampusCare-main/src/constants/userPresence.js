/** @typedef {'online'|'on_break'|'offline'} UserPresenceStatus */

/** @type {UserPresenceStatus[]} */
export const USER_PRESENCE_STATUSES = ["online", "on_break", "offline"];

/** Manual picker targets — staff cannot pick offline (set on logout). */
export const USER_PRESENCE_MANUAL_OPTIONS = ["online", "on_break"];

export const PRESENCE_ACTIVITY_DEBOUNCE_MS = 45_000;

/** @param {string | null | undefined} v */
export function normalizePresenceStatus(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return "online";
  const s = raw.toLowerCase().replace(/[\s-]+/g, "_");
  // Legacy values map onto the simplified set.
  if (s === "idle" || s === "do_not_disturb" || s === "donotdisturb" || s === "dnd") return "online";
  if (USER_PRESENCE_STATUSES.includes(s)) return /** @type {UserPresenceStatus} */ (s);
  return "offline";
}

/** @param {UserPresenceStatus} status */
export function presenceStatusLabel(status) {
  switch (status) {
    case "online":
      return "Online";
    case "on_break":
      return "On break";
    case "offline":
      return "Offline";
    default:
      return "Offline";
  }
}
