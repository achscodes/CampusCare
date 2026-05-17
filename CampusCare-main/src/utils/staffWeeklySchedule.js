/** Display order Mon → Sun (maps to JS Date getDay(): 1..6,0) */
export const WEEKLY_SCHEDULE_DISPLAY_DAYS = [
  { dow: 1, label: "Mon" },
  { dow: 2, label: "Tue" },
  { dow: 3, label: "Wed" },
  { dow: 4, label: "Thu" },
  { dow: 5, label: "Fri" },
  { dow: 6, label: "Sat" },
  { dow: 0, label: "Sun" },
];

/** @param {string | null | undefined} t - "HH:MM" or "HH:MM:SS" */
export function normalizeTimeForDb(t) {
  const s = String(t || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const hh = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, "0");
  const mm = String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

/** @param {string | null | undefined} t */
export function formatTime12h(t) {
  const n = normalizeTimeForDb(t);
  if (!n) return "";
  const [hh, mm] = n.split(":").map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** @param {string | null | undefined} start */
/** @param {string | null | undefined} end */
export function weeklyHoursForDay(start, end) {
  const a = normalizeTimeForDb(start);
  const b = normalizeTimeForDb(end);
  if (!a || !b) return 0;
  const [sh, sm] = a.split(":").map((x) => parseInt(x, 10));
  const [eh, em] = b.split(":").map((x) => parseInt(x, 10));
  const t0 = sh * 60 + sm;
  const t1 = eh * 60 + em;
  let diff = t1 - t0;
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

/** @param {Record<number, { is_working?: boolean; start_time?: string | null; end_time?: string | null }>} byDow */
export function sumWeeklyHours(byDow) {
  let h = 0;
  for (let d = 0; d <= 6; d++) {
    const row = byDow[d];
    if (!row?.is_working) continue;
    h += weeklyHoursForDay(row.start_time, row.end_time);
  }
  return Math.round(h * 10) / 10;
}

/** @returns {Record<number, { enabled: boolean; start: string; end: string }>} */
export function defaultDraftWeek() {
  /** @type {Record<number, { enabled: boolean; start: string; end: string }>} */
  const out = {};
  for (let d = 0; d <= 6; d++) {
    out[d] = { enabled: false, start: "09:00", end: "17:00" };
  }
  return out;
}

/** @param {Array<{ day_of_week: number; is_working?: boolean; start_time?: string | null; end_time?: string | null }>} rows */
export function draftFromAvailabilityRows(rows) {
  const draft = defaultDraftWeek();
  for (const r of rows || []) {
    const d = Number(r.day_of_week);
    if (d < 0 || d > 6) continue;
    draft[d] = {
      enabled: Boolean(r.is_working),
      start: r.start_time ? String(r.start_time).slice(0, 5) : "09:00",
      end: r.end_time ? String(r.end_time).slice(0, 5) : "17:00",
    };
  }
  return draft;
}
