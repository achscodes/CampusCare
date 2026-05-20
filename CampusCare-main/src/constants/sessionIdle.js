/** Auto sign-out after this period without user activity. */
export const SESSION_IDLE_LOGOUT_MS = 15 * 60 * 1000;

/** Show the idle warning this long before {@link SESSION_IDLE_LOGOUT_MS}. */
export const SESSION_IDLE_WARNING_MS = 10 * 60 * 1000;

export const SESSION_IDLE_ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
];
