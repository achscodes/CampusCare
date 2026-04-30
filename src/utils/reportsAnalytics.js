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

export const PERIOD_OPTIONS = [
  { id: "semester", label: "This Semester" },
  { id: "year", label: "This Year" },
  { id: "90d", label: "Last 90 Days" },
  { id: "all", label: "All Time" },
];

function getLast12MonthsRange(now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);
  start.setHours(0, 0, 0, 0);
  return { start, end, label: "Last 12 months (chart)" };
}

function getPeriodRange(periodId, now = new Date()) {
  switch (periodId) {
    case "semester": return getAcademicSemesterRange(now);
    case "year": return getCalendarYearRange(now);
    case "90d": return getLastNDaysRange(90, now);
    case "all": return { start: new Date(2000, 0, 1), end: new Date(2100, 11, 31), label: "All time" };
    default: return getAcademicSemesterRange(now);
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
    totalCases: 0,
    resolutionRatePct: 0,
    avgResolutionDays: 0,
    studentsMonitored: 0,
    majorOffenses: 0,
    minorOffenses: 0,
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
    topSchool: { school: "—", count: 0 },
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

/**
 * @param {object[]} cases — discipline case objects (from useCases / Supabase)
 * @param {string} periodId — see PERIOD_OPTIONS
 */
export function buildReportsAnalytics(cases, periodId = "semester") {
  const range = getPeriodRange(periodId);
  const list = cases || [];
  const filtered =
    periodId === "all"
      ? list.filter((c) => parseCaseInstant(c))
      : list.filter((c) => {
          const d = parseCaseInstant(c);
          return d ? inRange(d, range.start, range.end) : false;
        });

  if (filtered.length === 0) {
    return buildEmptyPeriodAnalytics(range);
  }

  const chartRange = periodId === "all" ? getLast12MonthsRange() : range;

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
  const bestSchool = [...schoolStats].sort((a, b) => b.count - a.count)[0] || { school: "—", count: 0 };
  /** When all schools have zero cases, sort order is arbitrary — show no leader instead of a false label. */
  const topSchool =
    bestSchool.count > 0 ? bestSchool : { school: "—", count: 0 };

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
      tone: topSchool.count > 0 ? "info" : "positive",
      title: "Cases by school (SECA / SASE / SBMA)",
      text:
        topSchool.count > 0
          ? `Highest case volume: ${topSchool.school} (${topSchool.count} case${topSchool.count !== 1 ? "s" : ""}).`
          : "No cases tagged with SECA, SASE, or SBMA in this period — add School when filing cases.",
    },
  ];

  return {
    isDemo: false,
    periodLabel: range.label,
    totalCases: total,
    resolutionRatePct,
    avgResolutionDays: avgResolutionDays ?? 0,
    studentsMonitored,
    majorOffenses: majorCount,
    minorOffenses: minorCount,
    offenseBreakdown,
    monthly,
    statusSlices,
    violations: violations.length ? violations : [],
    departmentStats: departmentStats.length ? departmentStats : [],
    departmentCounts: departmentStats.length ? departmentStats : [],
    peakDepartment,
    peakPeriod,
    schoolStats,
    topSchool,
    topDepartment: departmentStats[0] ? { department: departmentStats[0].department, count: departmentStats[0].count } : null,
    insights,
  };
}

export function exportAnalyticsCsv(analytics, periodLabel) {
  const lines = [
    ["CampusCare — Reports & Analytics", ""],
    ["Period", periodLabel],
    ["Total cases", String(analytics.totalCases)],
    ["Major offenses", String(analytics.majorOffenses)],
    ["Minor offenses", String(analytics.minorOffenses)],
    ["Resolution rate %", String(analytics.resolutionRatePct)],
    ["Avg. resolution (days)", String(analytics.avgResolutionDays)],
    ["Students monitored", String(analytics.studentsMonitored)],
    ["Top school (SECA/SASE/SBMA)", String(analytics.topSchool?.school || "—")],
    ["Top school case count", String(analytics.topSchool?.count ?? 0)],
    [],
    ["Month", "Cases filed", "Cases resolved"],
    ...analytics.monthly.map((m) => [m.month, String(m.filed), String(m.resolved)]),
    [],
    ["Department", "Cases", "Percentage"],
    ...(analytics.departmentStats || []).map((d) => [d.department, String(d.count), `${d.pct}%`]),
    [],
    ["School", "Cases"],
    ...(analytics.schoolStats || []).map((s) => [s.school, String(s.count)]),
  ];
  return lines.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}
