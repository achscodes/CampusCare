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

function parseTimeLabelToHoursMinutes(timeLabel) {
  const raw = String(timeLabel || "").trim();
  if (!raw) return null;

  // Supports "8:00 AM", "10:00 PM" (UI uses these).
  const m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ampm = m[3].toUpperCase();
    if (ampm === "AM") {
      if (h === 12) h = 0;
    } else {
      if (h !== 12) h += 12;
    }
    return { hours: h, minutes: min };
  }

  // Supports "HH:MM" (24h).
  const m24 = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return { hours: h, minutes: min };
  }

  return null;
}

export function durationMinutesFromLabel(durationLabel) {
  const s = String(durationLabel || "").trim().toLowerCase();
  if (!s) return 60;
  if (s === "30 min" || s === "30 mins" || s === "30 minutes") return 30;
  if (s === "45 min" || s === "45 mins" || s === "45 minutes") return 45;
  if (s === "1 hour" || s === "1hr" || s === "1 h") return 60;
  if (s === "1.5 hours" || s === "90 min" || s === "90 mins" || s === "90 minutes") return 90;
  if (s === "2 hours" || s === "2hrs" || s === "2 h") return 120;
  const mh = s.match(/(\d+(?:\.\d+)?)\s*hour/);
  if (mh) {
    const hrs = Number(mh[1]);
    if (Number.isFinite(hrs) && hrs > 0) return Math.round(hrs * 60);
  }
  const mm = s.match(/(\d+)\s*min/);
  if (mm) {
    const mins = parseInt(mm[1], 10);
    if (Number.isFinite(mins) && mins > 0) return mins;
  }
  return 60;
}

/**
 * Local scheduled start datetime for a conference.
 * @param {object} conf
 * @returns {Date | null}
 */
export function parseConferenceStartDateTime(conf) {
  const d = parseConferenceDate(conf);
  if (!d || Number.isNaN(d.getTime())) return null;
  const t = parseTimeLabelToHoursMinutes(conf?.timeLabel);
  const x = new Date(d);
  if (t) {
    x.setHours(t.hours, t.minutes, 0, 0);
  } else {
    // If time is missing/unparseable, treat as noon to avoid marking as past too early.
    x.setHours(12, 0, 0, 0);
  }
  return x;
}

/**
 * @param {object} conf
 * @returns {{ start: Date, end: Date } | null}
 */
export function conferenceWindow(conf) {
  const start = parseConferenceStartDateTime(conf);
  if (!start) return null;
  const mins = durationMinutesFromLabel(conf?.durationLabel);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + mins);
  return { start, end };
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
 * Hearing end datetime is strictly before now (local).
 * @param {object} conf
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isConferenceHearingTimePast(conf, now = new Date()) {
  const w = conferenceWindow(conf);
  if (!w) return false;
  return w.end.getTime() <= now.getTime();
}

/**
 * @param {object} conf
 * @param {Date} [now]
 * @returns {"future" | "ongoing" | "past" | "unknown"}
 */
export function conferenceTimeState(conf, now = new Date()) {
  const w = conferenceWindow(conf);
  if (!w) return "unknown";
  const t = now.getTime();
  if (t < w.start.getTime()) return "future";
  if (t >= w.start.getTime() && t < w.end.getTime()) return "ongoing";
  return "past";
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
  if (raw === "scheduled" && isConferenceHearingTimePast(conf)) return "completed";
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
