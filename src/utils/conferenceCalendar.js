/** Calendar helpers for Case Conference (real dates). */

/**
 * @param {object} conf — conference row with dateLabel and/or day
 * @returns {Date | null}
 */
export function parseConferenceDate(conf) {
  if (!conf) return null;
  if (conf.dateLabel) {
    const t = Date.parse(String(conf.dateLabel).trim());
    if (!Number.isNaN(t)) return new Date(t);
  }
  if (conf.day != null) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), Number(conf.day));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Start of local calendar day for `d`.
 * @param {Date} d
 */
export function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Hearing date is strictly before today (local) — used to auto-treat scheduled items as completed in the UI.
 * @param {object} conf
 * @returns {boolean}
 */
export function isConferenceHearingDatePast(conf) {
  const d = parseConferenceDate(conf);
  if (!d || Number.isNaN(d.getTime())) return false;
  const hearingDay = startOfLocalDay(d);
  const today = startOfLocalDay(new Date());
  return hearingDay.getTime() < today.getTime();
}

/**
 * Display / workflow status: past scheduled hearings read as completed unless already cancelled.
 * @param {object} conf
 * @returns {"scheduled" | "completed" | "cancelled"}
 */
export function effectiveConferenceStatus(conf) {
  const raw = String(conf?.status || "scheduled").toLowerCase();
  if (raw === "cancelled") return "cancelled";
  if (raw === "completed") return "completed";
  if (raw === "scheduled" && isConferenceHearingDatePast(conf)) return "completed";
  return "scheduled";
}

export function dateKey(d) {
  if (!d || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isSameCalendarDay(a, b) {
  if (!a || !b) return false;
  return dateKey(a) === dateKey(b);
}

/** @returns {(Date | null)[]} — null for padding cells */
export function buildMonthGrid(viewMonth) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function startOfWeekSunday(d) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfWeekSunday(d) {
  const x = startOfWeekSunday(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function toDateInputValue(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateInputToLabel(iso) {
  if (!iso || typeof iso !== "string") return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
