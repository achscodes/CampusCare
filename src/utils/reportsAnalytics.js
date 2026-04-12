/** Analytics for Discipline Office Reports & Analytics (drives charts + KPIs from case rows). */

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
    case "semester":
      return getAcademicSemesterRange(now);
    case "year":
      return getCalendarYearRange(now);
    case "90d":
      return getLastNDaysRange(90, now);
    case "all":
      return { start: new Date(2000, 0, 1), end: new Date(2100, 11, 31), label: "All time" };
    default:
      return getAcademicSemesterRange(now);
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
  ongoing: "Ongoing",
  pending: "Pending",
  new: "New",
};

const DEMO_ANALYTICS = {
  isDemo: true,
  totalCases: 201,
  resolutionRatePct: 89,
  avgResolutionDays: 12,
  studentsMonitored: 1892,
  monthly: [
    { month: "Aug", filed: 42, resolved: 38 },
    { month: "Sep", filed: 48, resolved: 44 },
    { month: "Oct", filed: 52, resolved: 46 },
    { month: "Nov", filed: 38, resolved: 35 },
    { month: "Dec", filed: 45, resolved: 41 },
    { month: "Jan", filed: 36, resolved: 32 },
  ],
  statusSlices: [
    { name: "Resolved", key: "closed", value: 78, color: "#16a34a" },
    { name: "Ongoing", key: "ongoing", value: 11, color: "#155dfc" },
    { name: "Pending", key: "pending", value: 6, color: "#ea580c" },
    { name: "New", key: "new", value: 5, color: "#7c3aed" },
  ],
  violations: [
    { label: "Academic Dishonesty", count: 45, pct: 28 },
    { label: "Attendance Violation", count: 38, pct: 24 },
    { label: "Code of Conduct", count: 32, pct: 20 },
    { label: "Property Damage", count: 23, pct: 14 },
    { label: "Disruptive Behavior", count: 22, pct: 14 },
  ],
  resolutionBuckets: [
    { label: "< 1 week", count: 72 },
    { label: "1–2 weeks", count: 58 },
    { label: "2–4 weeks", count: 45 },
    { label: "> 1 month", count: 26 },
  ],
  repeatOffenders: [
    { student: "Student A", studentId: "2023-10234", violations: 4, lastDate: "Jan 12, 2026" },
    { student: "Student B", studentId: "2022-08901", violations: 3, lastDate: "Jan 8, 2026" },
    { student: "Student C", studentId: "2024-11567", violations: 3, lastDate: "Dec 19, 2025" },
  ],
  insights: [
    {
      tone: "positive",
      title: "Positive trend",
      text: "Resolution rate improved by 8% this semester compared to the prior period.",
    },
    {
      tone: "warning",
      title: "Area of concern",
      text: "Academic dishonesty cases increased by 15% — consider faculty awareness sessions.",
    },
    {
      tone: "info",
      title: "Recommendation",
      text: "Implement early intervention programs for repeat offenders identified below.",
    },
  ],
};

function normalizeViolationLabel(caseType) {
  const s = String(caseType || "Other").trim();
  if (/academic|plagiar|cheat|dishonest/i.test(s)) return "Academic Dishonesty";
  if (/attendance|absent|tardy/i.test(s)) return "Attendance Violation";
  if (/conduct|code of conduct/i.test(s)) return "Code of Conduct";
  if (/property|damage/i.test(s)) return "Property Damage";
  if (/disrupt/i.test(s)) return "Disruptive Behavior";
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
    return { ...DEMO_ANALYTICS, periodLabel: range.label };
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

  const monthlyRaw = buildMonthlyFromCases(filtered, chartRange);
  const monthly =
    monthlyRaw.length > 0
      ? monthlyRaw
      : Array.from({ length: 6 }, (_, i) => ({
          month: MONTH_SHORT[Math.max(0, chartRange.end.getMonth() - 5 + i)],
          filed: 0,
          resolved: 0,
        }));

  const statusCounts = { new: 0, ongoing: 0, pending: 0, closed: 0 };
  for (const c of filtered) {
    const k = String(c.status || "new");
    if (statusCounts[k] !== undefined) statusCounts[k] += 1;
  }
  const stTotal = total || 1;
  const statusSlices = [
    { name: STATUS_LABEL.closed, key: "closed", value: Math.round((statusCounts.closed / stTotal) * 1000) / 10, color: "#16a34a" },
    { name: STATUS_LABEL.ongoing, key: "ongoing", value: Math.round((statusCounts.ongoing / stTotal) * 1000) / 10, color: "#155dfc" },
    { name: STATUS_LABEL.pending, key: "pending", value: Math.round((statusCounts.pending / stTotal) * 1000) / 10, color: "#ea580c" },
    { name: STATUS_LABEL.new, key: "new", value: Math.round((statusCounts.new / stTotal) * 1000) / 10, color: "#7c3aed" },
  ];

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
  }));

  const resBuckets = [
    { label: "< 1 week", count: 0 },
    { label: "1–2 weeks", count: 0 },
    { label: "2–4 weeks", count: 0 },
    { label: "> 1 month", count: 0 },
  ];
  for (const c of filtered) {
    if (c.status !== "closed") continue;
    const start = parseCaseInstant(c);
    const end = c.updatedAt ? new Date(c.updatedAt) : null;
    if (!start || !end || Number.isNaN(end.getTime())) continue;
    const d = daysBetween(start, end);
    if (d < 7) resBuckets[0].count += 1;
    else if (d < 14) resBuckets[1].count += 1;
    else if (d < 28) resBuckets[2].count += 1;
    else resBuckets[3].count += 1;
  }

  const byStudent = new Map();
  for (const c of filtered) {
    const sid = String(c.studentId || "").trim();
    if (!sid) continue;
    const name = String(c.student || "Student").trim();
    const d = parseCaseInstant(c);
    const cur = byStudent.get(sid) || { student: name, studentId: sid, violations: 0, last: null };
    cur.violations += 1;
    if (d && (!cur.last || d > cur.last)) cur.last = d;
    byStudent.set(sid, cur);
  }
  const repeatOffenders = [...byStudent.values()]
    .filter((r) => r.violations > 1)
    .sort((a, b) => b.violations - a.violations)
    .slice(0, 12)
    .map((r) => ({
      student: r.student,
      studentId: r.studentId,
      violations: r.violations,
      lastDate: r.last
        ? `${MONTH_SHORT[r.last.getMonth()]} ${r.last.getDate()}, ${r.last.getFullYear()}`
        : "—",
    }));

  const adCount = violMap.get("Academic Dishonesty") || 0;
  const insights = [
    {
      tone: resolutionRatePct >= 70 ? "positive" : "warning",
      title: resolutionRatePct >= 70 ? "Positive trend" : "Resolution focus",
      text:
        resolutionRatePct >= 70
          ? `Resolution rate is ${resolutionRatePct}% for ${range.label.toLowerCase()}.`
          : `Resolution rate is ${resolutionRatePct}% — prioritize closing backlog cases.`,
    },
    {
      tone: adCount > total * 0.2 ? "warning" : "info",
      title: "Area of concern",
      text:
        adCount > 0
          ? `Academic dishonesty represents ${Math.round((adCount / total) * 100)}% of cases in this period.`
          : "No academic dishonesty cases in this period.",
    },
    {
      tone: "info",
      title: "Recommendation",
      text:
        repeatOffenders.length > 0
          ? `${repeatOffenders.length} student(s) with multiple cases — consider intervention follow-up.`
          : "No repeat offenders in this period.",
    },
  ];

  return {
    isDemo: false,
    periodLabel: range.label,
    totalCases: total,
    resolutionRatePct,
    avgResolutionDays: avgResolutionDays ?? 0,
    studentsMonitored,
    monthly,
    statusSlices,
    violations: violations.length ? violations : DEMO_ANALYTICS.violations,
    resolutionBuckets: resBuckets.some((b) => b.count > 0) ? resBuckets : DEMO_ANALYTICS.resolutionBuckets,
    repeatOffenders: repeatOffenders.length ? repeatOffenders : [],
    insights,
  };
}

export function exportAnalyticsCsv(analytics, periodLabel) {
  const lines = [
    ["CampusCare — Reports & Analytics", ""],
    ["Period", periodLabel],
    ["Total cases", String(analytics.totalCases)],
    ["Resolution rate %", String(analytics.resolutionRatePct)],
    ["Avg. resolution (days)", String(analytics.avgResolutionDays)],
    ["Students monitored", String(analytics.studentsMonitored)],
    [],
    ["Month", "Cases filed", "Cases resolved"],
    ...analytics.monthly.map((m) => [m.month, String(m.filed), String(m.resolved)]),
    [],
    ["Repeat offenders", "Student ID", "Violations", "Last violation"],
    ...analytics.repeatOffenders.map((r) => [r.student, r.studentId, String(r.violations), r.lastDate]),
  ];
  return lines.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}
