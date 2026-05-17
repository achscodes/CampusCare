/** Analytics for Discipline Office Reports & Analytics (drives charts + KPIs from case rows). */

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Offense classification ────────────────────────────────────────────────────

/** Major offenses — serious violations requiring formal disciplinary action */
const MAJOR_OFFENSE_PATTERNS = [
  /academic\s*dishonest/i,
  /plagiar/i,
  /cheating/i,
  /falsif/i,
  /property\s*damage/i,
  /fraud/i,
  /harassment/i,
  /violence/i,
  /drug/i,
  /weapon/i,
];

/** Minor offenses — less severe, may be resolved through counseling */
const MINOR_OFFENSE_PATTERNS = [
  /attendance/i,
  /absent/i,
  /tardy/i,
  /disrupt/i,
  /code\s*of\s*conduct/i,
  /uniform/i,
  /noise/i,
  /language/i,
];

export function classifyOffense(caseType) {
  const s = String(caseType || "").trim();
  for (const p of MAJOR_OFFENSE_PATTERNS) {
    if (p.test(s)) return "major";
  }
  for (const p of MINOR_OFFENSE_PATTERNS) {
    if (p.test(s)) return "minor";
  }
  // Default to minor for unclassified
  return "minor";
}

// ── Program → Department mapping ─────────────────────────────────────────────

function programToDepartment(program) {
  const p = String(program || "").toLowerCase();
  if (/architecture|civil|engineering/i.test(p)) return "College of Engineering & Architecture";
  if (/computer|information\s*tech/i.test(p)) return "College of Computing & Information Technology";
  if (/accountanc|management\s*account|business\s*admin|bsba|financial|marketing|human\s*resource/i.test(p))
    return "College of Business & Accountancy";
  if (/communication|psychology|ab\s*/i.test(p)) return "College of Arts & Sciences";
  if (/nursing|pharmacy|health\s*sci/i.test(p)) return "College of Health Sciences";
  if (/physical\s*educ|bped/i.test(p)) return "College of Education";
  if (/hospitality|tourism/i.test(p)) return "College of Tourism & Hospitality";
  if (/stem|abm|humss/i.test(p)) return "Senior High School";
  return "Other";
}

// ── Date range helpers ────────────────────────────────────────────────────────

/** Philippine-style academic semester containing `date` (Sem 1: Aug–Jan, Sem 2: Feb–Jul). */
export function getAcademicSemesterRange(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  if (m >= 7) {
    return {
      start: new Date(y, 7, 1),
      end: new Date(y + 1, 0, 31, 23, 59, 59, 999),
      label: `Semester 1 (${y}–${y + 1})`,
    };
  }
  if (m === 0) {
    return {
      start: new Date(y - 1, 7, 1),
      end: new Date(y, 0, 31, 23, 59, 59, 999),
      label: `Semester 1 (${y - 1}–${y})`,
    };
  }
  return {
    start: new Date(y, 1, 1),
    end: new Date(y, 6, 31, 23, 59, 59, 999),
    label: `Semester 2 (${y})`,
  };
}

export function getCalendarYearRange(date = new Date()) {
  const y = date.getFullYear();
  return {
    start: new Date(y, 0, 1),
    end: new Date(y, 11, 31, 23, 59, 59, 999),
    label: `Calendar ${y}`,
  };
}

export function getLastNDaysRange(n, date = new Date()) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const start = new Date(date);
  start.setDate(start.getDate() - (n - 1));
  start.setHours(0, 0, 0, 0);
  return { start, end, label: `Last ${n} days` };
}

/** Current calendar month (local). */
export function getThisCalendarMonthRange(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  return {
    start: new Date(y, m, 1, 0, 0, 0, 0),
    end: new Date(y, m + 1, 0, 23, 59, 59, 999),
    label: `${MONTH_SHORT[m]} ${y}`,
  };
}

/** Current calendar quarter Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec (local). */
export function getCalendarQuarterRange(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const qi = Math.floor(m / 3);
  const startM = qi * 3;
  const endM = startM + 2;
  return {
    start: new Date(y, startM, 1, 0, 0, 0, 0),
    end: new Date(y, endM + 1, 0, 23, 59, 59, 999),
    label: `Quarter ${qi + 1} (${MONTH_SHORT[startM]}–${MONTH_SHORT[endM]} ${y})`,
  };
}

/**
 * Parses `yyyy-mm-dd` from `<input type="date">` as a local calendar day.
 * @param {string} raw
 * @param {boolean} endOfDay
 */
export function parseReportsDateInput(raw, endOfDay = false) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw || "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(
    y,
    mo,
    d,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Presets for Period dropdown — dates are edited separately (`custom` branch in resolver). */
export const PERIOD_OPTIONS = [
  { id: "month", label: "This Month" },
  { id: "quarter", label: "Quarterly" },
  { id: "year", label: "This Year" },
];

/**
 * @param {string} periodId — `month` | `quarter` | `year` | `custom`
 * @param {Date} [now]
 * @param {{ start?: string, end?: string } | null} [custom] — yyyy-mm-dd from date inputs when periodId === "custom"
 * @returns {{ start: Date, end: Date, label: string, invalid?: boolean }}
 */
export function resolveReportsPeriodRange(periodId, now = new Date(), custom = null) {
  switch (periodId) {
    case "month":
      return getThisCalendarMonthRange(now);
    case "quarter":
      return getCalendarQuarterRange(now);
    case "year":
      return getCalendarYearRange(now);
    case "custom": {
      const start = parseReportsDateInput(custom?.start, false);
      const end = parseReportsDateInput(custom?.end, true);
      if (!start || !end || start > end) {
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
          end: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
          label: "Invalid or incomplete date range",
          invalid: true,
        };
      }
      const a = start.toLocaleDateString("en-PH", { dateStyle: "medium" });
      const b = end.toLocaleDateString("en-PH", { dateStyle: "medium" });
      return { start, end, label: `${a} — ${b}` };
    }
    default:
      return getThisCalendarMonthRange(now);
  }
}

function parseCaseInstant(c) {
  if (c.reportedAt) {
    const d = new Date(c.reportedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const parsed = Date.parse(String(c.date || ""));
  if (!Number.isNaN(parsed)) return new Date(parsed);
  return null;
}

function inRange(d, start, end) {
  if (!d) return false;
  return d >= start && d <= end;
}

function daysBetween(a, b) {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

const STATUS_LABEL = {
  closed: "Resolved",
  pending: "Pending",
  new: "New",
};

function buildEmptyPeriodAnalytics(range) {
  const now = new Date();
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { month: MONTH_SHORT[d.getMonth()], filed: 0, resolved: 0 };
  });
  return {
    isDemo: false,
    periodLabel: range.label,
    periodInvalid: Boolean(range.invalid),
    totalCases: 0,
    resolutionRatePct: 0,
    avgResolutionDays: 0,
    studentsMonitored: 0,
    majorOffenses: 0,
    minorOffenses: 0,
    pendingMajorCases: 0,
    offenseBreakdown: [
      { label: "Major Offenses", count: 0, pct: 0, color: "#dc2626" },
      { label: "Minor Offenses", count: 0, pct: 0, color: "#f59e0b" },
    ],
    monthly,
    statusSlices: [
      { name: STATUS_LABEL.closed, key: "closed", value: 0, color: "#16a34a" },
      { name: STATUS_LABEL.pending, key: "pending", value: 0, color: "#155dfc" },
      { name: STATUS_LABEL.new, key: "new", value: 0, color: "#7c3aed" },
    ],
    violations: [],
    departmentStats: [],
    departmentCounts: [],
    peakDepartment: "—",
    peakPeriod: "—",
    schoolStats: [
      { school: "SECA", count: 0 },
      { school: "SASE", count: 0 },
      { school: "SBMA", count: 0 },
    ],
    topDepartment: null,
    insights: [
      {
        tone: "info",
        title: "No case data in this period",
        text: "Charts will fill in when cases exist in Case Management for the selected reporting period.",
      },
    ],
  };
}

function normalizeViolationLabel(caseType) {
  const s = String(caseType || "Other").trim();
  if (/academic|plagiar|cheat|dishonest/i.test(s)) return "Academic Dishonesty";
  if (/attendance|absent|tardy/i.test(s)) return "Attendance Violation";
  if (/conduct|code of conduct/i.test(s)) return "Code of Conduct";
  if (/property|damage/i.test(s)) return "Property Damage";
  if (/disrupt/i.test(s)) return "Disruptive Behavior";
  if (/falsif/i.test(s)) return "Falsification of Records";
  if (/plagiar/i.test(s)) return "Plagiarism";
  return s || "Other";
}

function buildMonthlyFromCases(cases, range) {
  const byMonth = new Map();
  const startYm = range.start.getFullYear() * 12 + range.start.getMonth();
  const endYm = range.end.getFullYear() * 12 + range.end.getMonth();
  for (let ym = startYm; ym <= endYm; ym++) {
    const y = Math.floor(ym / 12);
    const m = ym % 12;
    byMonth.set(`${y}-${m}`, { month: MONTH_SHORT[m], filed: 0, resolved: 0 });
  }
  for (const c of cases) {
    const d = parseCaseInstant(c);
    if (!d || !inRange(d, range.start, range.end)) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!byMonth.has(key)) continue;
    const row = byMonth.get(key);
    row.filed += 1;
    if (c.status === "closed") row.resolved += 1;
  }
  const list = [...byMonth.values()];
  return list.length > 6 ? list.slice(-6) : list;
}

function parseProgramFromDescription(description) {
  const desc = String(description || "");
  for (const part of desc.split("\n\n")) {
    if (part.startsWith("Program: ")) return part.slice(9).trim();
  }
  return "";
}

function schoolFromCase(c) {
  const s = String(c.school || "").trim();
  if (s && /^(SECA|SASE|SBMA)$/i.test(s)) return s.toUpperCase();
  const desc = String(c.description || "");
  for (const part of desc.split(/\n\s*\n/g)) {
    if (part.startsWith("School: ")) {
      const v = part.slice(8).trim().toUpperCase();
      if (v === "SECA" || v === "SASE" || v === "SBMA") return v;
    }
  }
  return "";
}

/** Mirrors major/minor tally used for KPIs (`majorOffenses`). */
export function isCaseMajorOffense(c) {
  const ot = String(c.offenseType || "").toLowerCase();
  if (ot.includes("major")) return true;
  if (ot.includes("minor")) return false;
  return classifyOffense(c.caseType) === "major";
}

/**
 * @param {object[]} cases — discipline case objects (from useCases / Supabase)
 * @param {{ start?: string, end?: string } | null} customRange — reporting window (`yyyy-mm-dd` from calendar inputs)
 */
export function buildReportsAnalytics(cases, customRange = null) {
  const range = resolveReportsPeriodRange("custom", new Date(), customRange);
  const list = cases || [];

  if (range.invalid) {
    const empty = buildEmptyPeriodAnalytics(range);
    empty.insights = [
      {
        tone: "warning",
        title: "Choose a valid date range",
        text: "Pick a start and end date on the calendar; the end date must be on or after the start.",
      },
    ];
    return empty;
  }

  const filtered = list.filter((c) => {
    const d = parseCaseInstant(c);
    return d ? inRange(d, range.start, range.end) : false;
  });

  if (filtered.length === 0) {
    return buildEmptyPeriodAnalytics(range);
  }

  const chartRange = range;

  const total = filtered.length;
  const closed = filtered.filter((c) => c.status === "closed").length;
  const resolutionRatePct = total ? Math.round((closed / total) * 1000) / 10 : 0;

  const resolutionDays = [];
  for (const c of filtered) {
    if (c.status !== "closed") continue;
    const start = parseCaseInstant(c);
    const end = c.updatedAt ? new Date(c.updatedAt) : null;
    if (start && end && !Number.isNaN(end.getTime())) {
      resolutionDays.push(daysBetween(start, end));
    }
  }
  const avgResolutionDays =
    resolutionDays.length > 0
      ? Math.round((resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length) * 10) / 10
      : null;

  const uniqueStudents = new Set(filtered.map((c) => String(c.studentId || "").trim()).filter(Boolean));
  const studentsMonitored = uniqueStudents.size;

  // ── Offense breakdown (major vs minor) ──────────────────────────────────
  let majorCount = 0;
  let minorCount = 0;
  for (const c of filtered) {
    const ot = String(c.offenseType || "").toLowerCase();
    if (ot.includes("major")) majorCount += 1;
    else if (ot.includes("minor")) minorCount += 1;
    else if (classifyOffense(c.caseType) === "major") majorCount += 1;
    else minorCount += 1;
  }
  const offenseBreakdown = [
    { label: "Major Offenses", count: majorCount, pct: Math.round((majorCount / total) * 100), color: "#dc2626" },
    { label: "Minor Offenses", count: minorCount, pct: Math.round((minorCount / total) * 100), color: "#f59e0b" },
  ];

  const pendingMajorCases = filtered.filter((c) => c.status === "pending" && isCaseMajorOffense(c)).length;

  // ── Department stats ────────────────────────────────────────────────────
  const deptMap = new Map();
  for (const c of filtered) {
    const prog = parseProgramFromDescription(c.description) || c.program || "";
    const dept = programToDepartment(prog);
    deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
  }
  const departmentStats = [...deptMap.entries()]
    .map(([department, count]) => ({ department, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const peakDepartment = departmentStats[0]?.department || "—";

  const schoolLabels = ["SECA", "SASE", "SBMA"];
  const schoolCounts = { SECA: 0, SASE: 0, SBMA: 0 };
  for (const c of filtered) {
    const sch = schoolFromCase(c);
    if (sch && schoolCounts[sch] !== undefined) schoolCounts[sch] += 1;
  }
  const schoolStats = schoolLabels.map((school) => ({ school, count: schoolCounts[school] }));

  // ── Monthly trend ───────────────────────────────────────────────────────
  const monthlyRaw = buildMonthlyFromCases(filtered, chartRange);
  const monthly = monthlyRaw.length > 0
    ? monthlyRaw
    : Array.from({ length: 6 }, (_, i) => ({
        month: MONTH_SHORT[Math.max(0, chartRange.end.getMonth() - 5 + i)],
        filed: 0, resolved: 0,
      }));

  // Find peak period
  const peakMonth = [...monthly].sort((a, b) => b.filed - a.filed)[0];
  const peakPeriod = peakMonth ? peakMonth.month : "—";

  // ── Status distribution ─────────────────────────────────────────────────
  const statusCounts = { new: 0, pending: 0, closed: 0 };
  for (const c of filtered) {
    const k = String(c.status || "new");
    if (statusCounts[k] !== undefined) statusCounts[k] += 1;
  }
  const stTotal = total || 1;
  const statusSlices = [
    { name: STATUS_LABEL.closed, key: "closed", value: Math.round((statusCounts.closed / stTotal) * 1000) / 10, color: "#16a34a" },
    { name: STATUS_LABEL.pending, key: "pending", value: Math.round((statusCounts.pending / stTotal) * 1000) / 10, color: "#155dfc" },
    { name: STATUS_LABEL.new, key: "new", value: Math.round((statusCounts.new / stTotal) * 1000) / 10, color: "#7c3aed" },
  ];

  // ── Violation types ─────────────────────────────────────────────────────
  const violMap = new Map();
  for (const c of filtered) {
    const lab = normalizeViolationLabel(c.caseType);
    violMap.set(lab, (violMap.get(lab) || 0) + 1);
  }
  const violSorted = [...violMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const violTotal = violSorted.reduce((acc, [, n]) => acc + n, 0) || 1;
  const violations = violSorted.map(([label, count]) => ({
    label,
    count,
    pct: Math.round((count / violTotal) * 100),
    severity: classifyOffense(label),
  }));

  // ── Insights ────────────────────────────────────────────────────────────
  const insights = [
    {
      tone: resolutionRatePct >= 70 ? "positive" : "warning",
      title: resolutionRatePct >= 70 ? "Positive trend" : "Resolution focus",
      text: resolutionRatePct >= 70
        ? `Resolution rate is ${resolutionRatePct}% for ${range.label.toLowerCase()}.`
        : `Resolution rate is ${resolutionRatePct}% — prioritize closing backlog cases.`,
    },
    {
      tone: majorCount > total * 0.3 ? "warning" : "info",
      title: "Offense severity",
      text: majorCount > 0
        ? `${majorCount} major offense${majorCount !== 1 ? "s" : ""} (${Math.round((majorCount / total) * 100)}%) and ${minorCount} minor offense${minorCount !== 1 ? "s" : ""} in this period.`
        : "No major offenses recorded in this period.",
    },
    {
      tone: pendingMajorCases > 0 ? "warning" : "positive",
      title: "Pending major cases",
      text:
        pendingMajorCases > 0
          ? `${pendingMajorCases} major classification case${pendingMajorCases !== 1 ? "s" : ""} still pending in this period.`
          : "No pending major cases in this period.",
    },
  ];

  return {
    isDemo: false,
    periodLabel: range.label,
    periodInvalid: false,
    totalCases: total,
    resolutionRatePct,
    avgResolutionDays: avgResolutionDays ?? 0,
    studentsMonitored,
    majorOffenses: majorCount,
    minorOffenses: minorCount,
    pendingMajorCases,
    offenseBreakdown,
    monthly,
    statusSlices,
    violations: violations.length ? violations : [],
    departmentStats: departmentStats.length ? departmentStats : [],
    departmentCounts: departmentStats.length ? departmentStats : [],
    peakDepartment,
    peakPeriod,
    schoolStats,
    topDepartment: departmentStats[0] ? { department: departmentStats[0].department, count: departmentStats[0].count } : null,
    insights,
  };
}

/**
 * @param {object} analytics — `buildReportsAnalytics` output
 * @param {string} presetLabel — e.g. “This Month” (filter preset name)
 * @param {Date} [generatedAt]
 */
export function exportAnalyticsCsv(analytics, presetLabel, generatedAt = new Date()) {
  const genTs =
    generatedAt instanceof Date && !Number.isNaN(generatedAt.getTime())
      ? generatedAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
      : "—";

  const lines = [
    ["CampusCare", "Discipline Office — Reports & Analytics"],
    [],
    ["— Report envelope —", ""],
    ["Filter preset", String(presetLabel || "—")],
    ["Reporting window", String(analytics.periodLabel || "—")],
    ["Generated (local)", genTs],
    [],
    ["— Summary metrics —", "", ""],
    ["Metric", "Value", ""],
    ["Total cases", String(analytics.totalCases ?? 0), ""],
    ["Minor offenses", String(analytics.minorOffenses ?? 0), ""],
    ["Major offenses", String(analytics.majorOffenses ?? 0), ""],
    ["Pending (major classification)", String(analytics.pendingMajorCases ?? 0), ""],
    ["Resolution rate %", String(analytics.resolutionRatePct ?? 0), ""],
    ["Avg. resolution (days)", String(analytics.avgResolutionDays ?? "—"), ""],
    ["Students monitored", String(analytics.studentsMonitored ?? 0), ""],
    [],
    ["— Cases per month (filed vs resolved) —", "", ""],
    ["Month", "Cases filed", "Cases resolved"],
    ...(analytics.monthly || []).map((m) => [m.month, String(m.filed), String(m.resolved)]),
    [],
    ["— Case status (% of cases in window) —", "", ""],
    ["Status", "Share %", ""],
    ...(analytics.statusSlices || []).map((s) => [String(s.name), `${s.value}%`, ""]),
    [],
    ["— Common violation types (top) —", "", ""],
    ["Violation", "Count", "Share %"],
    ...(analytics.violations || []).map((v) => [String(v.label), String(v.count), `${v.pct}%`]),
    [],
    ["— Cases by department —", "", ""],
    ["Department", "Cases", "Share %"],
    ...(analytics.departmentStats || []).map((d) => [d.department, String(d.count), `${d.pct}%`]),
    [],
    ["— Cases by school (SECA / SASE / SBMA) —", "", ""],
    ["School", "Cases", ""],
    ...(analytics.schoolStats || []).map((s) => [s.school, String(s.count), ""]),
  ];

  const esc = (c) => `"${String(c).replace(/"/g, '""')}"`;
  return lines.map((row) => row.map(esc).join(",")).join("\r\n");
}
