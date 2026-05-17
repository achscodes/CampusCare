/** @typedef {'online'|'idle'|'do_not_disturb'|'on_break'|'offline'} UserPresenceStatus */

/** @type {UserPresenceStatus[]} */
export const USER_PRESENCE_STATUSES = ["online", "idle", "do_not_disturb", "on_break", "offline"];

/** Manual picker targets (idle is system-driven). */
export const USER_PRESENCE_MANUAL_OPTIONS = ["online", "do_not_disturb", "on_break", "offline"];

export const IDLE_AFTER_MS = 5 * 60 * 1000;
export const OFFLINE_AFTER_IDLE_MS = 60 * 60 * 1000;
export const PRESENCE_ACTIVITY_DEBOUNCE_MS = 45_000;

/** @param {string | null | undefined} v */
export function normalizePresenceStatus(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return "online";
  const s = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (s === "donotdisturb" || s === "dnd") return "do_not_disturb";
  if (USER_PRESENCE_STATUSES.includes(s)) return /** @type {UserPresenceStatus} */ (s);
  return "offline";
}

/** @param {UserPresenceStatus} status */
export function presenceStatusLabel(status) {
  switch (status) {
    case "online":
      return "Online";
    case "idle":
      return "Idle";
    case "do_not_disturb":
      return "Do not disturb";
    case "on_break":
      return "On break";
    case "offline":
      return "Offline";
    default:
      return "Offline";
  }
}
