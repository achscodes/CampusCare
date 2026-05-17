/** Auto sign-out after this period without user activity. */
export const SESSION_IDLE_LOGOUT_MS = 15 * 60 * 1000;

export const SESSION_IDLE_ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
];
