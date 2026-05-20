/** Peak-hour buckets shown in HSO Reports & Analytics charts (clinic day). */
export const HSO_PEAK_HOUR_LABELS = ["7a", "8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p"];

export const HSO_ANALYTICS_SCHOOLS = ["SECA", "SASE", "SBMA"];

export const HSO_ANALYTICS_SCHOOL_COLORS = {
  SECA: "#2563eb",
  SASE: "#10b981",
  SBMA: "#f59e0b",
};

/** Program labels grouped by school (partial match against students.program). */
const PROGRAM_TO_SCHOOL_ENTRIES = [
  ["SECA", ["BS Architecture", "BS Civil Engineering", "BS Computer Science", "BS Information Technology"]],
  [
    "SBMA",
    [
      "BS Accountancy",
      "BS Management Accounting",
      "BS Business Administration",
      "Financial Management",
      "Marketing Management",
      "Human Resource Management",
      "BS Hospitality Management",
      "BS Tourism Management",
    ],
  ],
  ["SASE", ["AB Communication", "BS Psychology", "Bachelor of Physical Education", "BS Nursing", "Pharmacy"]],
];

/**
 * @param {string | Date | null | undefined} iso
 * @returns {string | null}
 */
export function peakHourLabelFromIso(iso) {
  if (!iso) return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let h = d.getHours();
  const mer = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  const label = `${h}${mer}`;
  return HSO_PEAK_HOUR_LABELS.includes(label) ? label : null;
}

/**
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function peakHourLabelFromTimeString(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "—") return null;
  if (s.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(s)) {
    return peakHourLabelFromIso(s);
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m24) {
    let h = Number(m24[1]);
    if (Number.isFinite(h) && h >= 0 && h <= 23) {
      const mer = h >= 12 ? "p" : "a";
      h = h % 12 || 12;
      const label = `${h}${mer}`;
      return HSO_PEAK_HOUR_LABELS.includes(label) ? label : null;
    }
  }
  const m12 = s.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?/i);
  if (m12) {
    const label = `${Number(m12[1])}${m12[3].toLowerCase()}`;
    return HSO_PEAK_HOUR_LABELS.includes(label) ? label : null;
  }
  return null;
}

/**
 * @param {{ time?: string | null; checkedInAt?: string | null; consultationStartedAt?: string | null; createdAt?: string | null }} row
 * @returns {string | null}
 */
export function resolvePeakHourLabel(row) {
  return (
    peakHourLabelFromIso(row.checkedInAt) ||
    peakHourLabelFromIso(row.consultationStartedAt) ||
    peakHourLabelFromIso(row.createdAt) ||
    peakHourLabelFromTimeString(row.time)
  );
}

/**
 * @param {Array<string | null | undefined>} labels
 * @returns {Array<{ hour: string; total: number }>}
 */
export function buildPeakHoursSeries(labels) {
  const slots = new Map(HSO_PEAK_HOUR_LABELS.map((l) => [l, 0]));
  for (const label of labels) {
    if (!label || !slots.has(label)) continue;
    slots.set(label, (slots.get(label) || 0) + 1);
  }
  return HSO_PEAK_HOUR_LABELS.map((hour) => ({ hour, total: slots.get(hour) || 0 }));
}

/**
 * Map students.program / students.course to SECA, SASE, or SBMA.
 * @param {string | null | undefined} program
 * @param {string | null | undefined} [course]
 * @returns {"SECA"|"SASE"|"SBMA"|null}
 */
export function schoolBucketFromProgram(program, course) {
  const texts = [program, course].map((v) => String(v || "").trim()).filter(Boolean);
  for (const text of texts) {
    const upper = text.toUpperCase();
    for (const school of HSO_ANALYTICS_SCHOOLS) {
      if (upper.includes(school)) return school;
    }
    const lower = text.toLowerCase();
    for (const [school, programs] of PROGRAM_TO_SCHOOL_ENTRIES) {
      for (const needle of programs) {
        const n = needle.toLowerCase();
        if (lower.includes(n) || n.includes(lower)) return school;
      }
    }
  }
  return null;
}

/**
 * @param {"today"|"month"|"year"} period
 */
export function hsoAnalyticsPeriodRange(period) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  let start;
  if (period === "today") {
    start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  } else if (period === "month") {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  } else {
    start = new Date(end.getFullYear(), 0, 1);
  }
  return { start, end };
}

/**
 * @param {"week"|"month"|"quarter"|"year"} filter
 */
export function hsoReportsPeriodRange(filter) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  if (filter === "week") {
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (filter === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (filter === "quarter") {
    start.setMonth(end.getMonth() - 2, 1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

export function appointmentDateInRange(a, start, end) {
  if (!a?.dateSort) return false;
  const d = new Date(`${a.dateSort}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d >= start && d <= end;
}

export function consultationDateInRange(c, start, end) {
  const raw = c?.consultationCreatedAt;
  if (!raw) return false;
  const d = new Date(raw);
  return !Number.isNaN(d.getTime()) && d >= start && d <= end;
}

export function isTodayIsoDate(isoDateSort) {
  if (!isoDateSort) return false;
  const today = new Date().toISOString().slice(0, 10);
  return String(isoDateSort).slice(0, 10) === today;
}

/**
 * @param {Map<string, { program?: string; course?: string } | string>} rosterMap
 * @param {string} studentId
 * @param {Map<string, { program?: string }>} [recordByStudent]
 */
export function rosterProgramFieldsForStudent(rosterMap, studentId, recordByStudent) {
  const entry = rosterMap?.get(studentId);
  if (entry && typeof entry === "object") {
    return {
      program: String(entry.program || "").trim(),
      course: String(entry.course || "").trim(),
    };
  }
  if (typeof entry === "string" && entry.trim()) {
    return { program: entry.trim(), course: "" };
  }
  const rec = recordByStudent?.get(studentId);
  return {
    program: String(rec?.program || "").trim(),
    course: "",
  };
}

/**
 * @param {Array<{ studentId?: string }>} appointments
 * @param {Array<{ studentId?: string }>} consultations
 * @param {(sid: string) => { program: string; course: string }} programForSid
 */
export function buildSchoolVisitCounts(appointments, consultations, programForSid) {
  const schoolCounts = { SECA: 0, SASE: 0, SBMA: 0 };
  const seen = new Set();

  const tally = (sid, dateKey) => {
    const key = normalizeVisitKey(sid, dateKey);
    if (!key || seen.has(key)) return;
    const fields = programForSid(sid);
    const bucket = schoolBucketFromProgram(fields.program, fields.course);
    if (!bucket) return;
    seen.add(key);
    schoolCounts[bucket] += 1;
  };

  for (const a of appointments) {
    const sid = String(a.studentId || "").trim();
    if (!sid) continue;
    tally(sid, a.dateSort || a.date);
  }
  for (const c of consultations) {
    const sid = String(c.studentId || "").trim();
    if (!sid) continue;
    const dateKey = c.consultationCreatedAt
      ? String(c.consultationCreatedAt).slice(0, 10)
      : c.date;
    tally(sid, dateKey);
  }

  return schoolCounts;
}

function normalizeVisitKey(studentId, dateKey) {
  const sid = String(studentId || "").trim();
  if (!sid) return "";
  const d = String(dateKey || "").trim().slice(0, 10);
  return d ? `${sid}|${d}` : sid;
}
