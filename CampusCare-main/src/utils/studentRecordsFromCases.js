import { formatCaseDateFromIso } from "./disciplineCaseMapper";
import { classifyOffense } from "./reportsAnalytics";

/** @param {string} description */
export function parseProgramFromDescription(description) {
  const desc = String(description || "");
  for (const part of desc.split("\n\n")) {
    if (part.startsWith("Program: ")) return part.slice(9).trim();
  }
  return "";
}

function reportedDate(c) {
  if (c.reportedAt) {
    const d = new Date(c.reportedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Derive standing for KPIs + pills from case list for one student.
 * @param {object[]} studentCases
 */
export function categorizeStanding(studentCases) {
  const list = studentCases || [];
  const total = list.length;
  const active = list.filter((c) => c.status !== "closed").length;
  const hasHighOpen = list.some((c) => c.status !== "closed" && c.priority === "high");

  if (total === 0) return "good_standing";
  if (active === 0) return "good_standing";
  if (total >= 3 || active >= 2 || hasHighOpen) return "high_risk";
  return "on_probation";
}

export const STANDING_LABELS = {
  good_standing: "Good Standing",
  on_probation: "On Probation",
  high_risk: "High Risk",
};

/**
 * Merge discipline_cases-driven rows with optional discipline_student_records.
 * @param {object[]} cases — from useCases
 * @param {object[]} manualRecords — from useStudentRecords
 */
/** @param {object} c — discipline case row */
export function offenseCategoryForCase(c) {
  const ot = String(c.offenseType || "").toLowerCase();
  if (ot.includes("major")) return "major";
  if (ot.includes("minor")) return "minor";
  return classifyOffense(c.caseType) === "major" ? "major" : "minor";
}

function parseCaseDescriptionBody(c) {
  const desc = String(c.description || "");
  let offenseFromDesc = "";
  const chunks = [];
  for (const part of desc.split("\n\n")) {
    if (part.startsWith("Program: ") || part.startsWith("School: ")) continue;
    if (part.startsWith("Offense Type: ")) {
      if (!offenseFromDesc) offenseFromDesc = part.slice(14).trim();
      continue;
    }
    if (part.startsWith("Reported by: ")) continue;
    chunks.push(part);
  }
  const body = chunks.join("\n\n").trim();
  return { body: body || desc.trim() || "", offenseFromDesc };
}

function caseEvidenceNames(c) {
  if (!Array.isArray(c.evidence)) return [];
  return c.evidence.map((e) => (typeof e === "string" ? e : e?.name)).filter(Boolean);
}

function tallyMajorMinorFromCases(studentCases) {
  let major = 0;
  let minor = 0;
  for (const c of studentCases || []) {
    const ot = String(c.offenseType || "").toLowerCase();
    if (ot.includes("major")) major += 1;
    else if (ot.includes("minor")) minor += 1;
    else if (classifyOffense(c.caseType) === "major") major += 1;
    else minor += 1;
  }
  return { major, minor };
}

/**
 * @param {object[]} studentCases
 */
export function countMajorMinorCases(studentCases) {
  const { major, minor } = tallyMajorMinorFromCases(studentCases);
  const equivalentMajorTotal = major + Math.floor(minor / 3);
  return { major, minor, equivalentMajorTotal };
}

const CAPSULE_SLOTS = 3;

/**
 * Visual capsule fill for Student Records: minor row shows remainder toward the next major (3 minor = 1 major);
 * major row shows combined native majors plus majors earned from every group of 3 minors (capped at 3 slots).
 * @param {object[]} studentCases
 */
export function getOffenseCapsuleFill(studentCases) {
  const { major, minor } = tallyMajorMinorFromCases(studentCases);
  const equivalentMajorTotal = major + Math.floor(minor / 3);
  const capsuleMajorFilled = Math.min(CAPSULE_SLOTS, equivalentMajorTotal);
  const capsuleMinorFilled = minor % 3;
  return {
    capsuleMajorFilled,
    capsuleMinorFilled,
    capsuleSlots: CAPSULE_SLOTS,
    equivalentMajorTotal,
  };
}

export function mergeStudentRecordsFromCases(cases, manualRecords) {
  const byStudent = new Map();
  for (const c of cases || []) {
    const sid = String(c.studentId || "").trim();
    if (!sid) continue;
    if (!byStudent.has(sid)) byStudent.set(sid, []);
    byStudent.get(sid).push(c);
  }

  const manualBySid = new Map((manualRecords || []).map((r) => [String(r.studentId || "").trim(), r]));
  const allIds = new Set([...byStudent.keys(), ...manualBySid.keys()]);

  const rows = [];
  for (const studentId of allIds) {
    const group = byStudent.get(studentId) || [];
    const manual = manualBySid.get(studentId);
    let category = categorizeStanding(group);
    /** Formal welfare row in discipline_student_records overrides derived standing for display & edits. */
    if (manual) {
      if (manual.riskLevel === "high") category = "high_risk";
      else if (manual.status === "active") category = "on_probation";
      else category = "good_standing";
    }

    const programsFromCases = group
      .map((c) => {
        const fromDesc = parseProgramFromDescription(c.description);
        const fromLocal = typeof c.program === "string" ? c.program.trim() : "";
        return fromDesc || fromLocal;
      })
      .filter(Boolean);
    let program = manual?.program?.trim() || programsFromCases[programsFromCases.length - 1] || "—";

    const schoolsFromCases = group
      .map((c) => String(c.school || "").trim())
      .filter(Boolean);
    const school =
      schoolsFromCases[schoolsFromCases.length - 1] ||
      (() => {
        for (const c of group) {
          const desc = String(c.description || "");
          for (const part of desc.split(/\n\s*\n/g)) {
            if (part.startsWith("School: ")) return part.slice(8).trim();
          }
        }
        return "";
      })() ||
      "—";

    const { major: majorCases, minor: minorCases, equivalentMajorTotal } = countMajorMinorCases(group);
    const { capsuleMajorFilled, capsuleMinorFilled, capsuleSlots } = getOffenseCapsuleFill(group);

    let lastMs = 0;
    for (const c of group) {
      const d = reportedDate(c);
      if (d && d.getTime() > lastMs) lastMs = d.getTime();
    }
    if (manual?.lastIncident && manual.lastIncident !== "—") {
      const p = Date.parse(manual.lastIncident);
      if (!Number.isNaN(p)) lastMs = Math.max(lastMs, p);
    }

    const lastIncident = lastMs ? formatCaseDateFromIso(new Date(lastMs)) : manual?.lastIncident || "—";

    let total = group.length;
    let active = group.filter((c) => c.status !== "closed").length;
    if (group.length === 0 && manual) {
      const mc = Number(manual.cases ?? 0);
      total = mc;
      active = manual.status === "active" ? mc : 0;
    }
    const casesDisplay = `${total} total, ${active} active`;

    const studentName =
      group[0]?.student?.trim() || manual?.studentName?.trim() || "—";

    const caseSummaries = [...group]
      .sort((a, b) => {
        const da = reportedDate(a)?.getTime() || 0;
        const db = reportedDate(b)?.getTime() || 0;
        return db - da;
      })
      .map((c) => {
        const { body, offenseFromDesc } = parseCaseDescriptionBody(c);
        const offenseTypeDisplay =
          String(c.offenseType || "").trim() || offenseFromDesc || "—";
        const d = reportedDate(c);
        const dateLabel = d ? formatCaseDateFromIso(d) : String(c.date || "").trim() || "—";
        return {
          id: c.id,
          caseType: c.caseType,
          status: c.status,
          date: c.date,
          dateLabel,
          offenseType: offenseTypeDisplay,
          offenseCategory: offenseCategoryForCase(c),
          body: body || "No description provided.",
          officer: String(c.officer || "").trim() || "—",
          priority: String(c.priority || "").trim() || "—",
          evidenceNames: caseEvidenceNames(c),
        };
      });

    rows.push({
      id: manual?.id || `derived-${studentId}`,
      studentId,
      studentName,
      program,
      school: school || "—",
      casesDisplay,
      casesTotal: total,
      casesActive: active,
      majorCases,
      minorCases,
      equivalentMajorTotal,
      capsuleMajorFilled,
      capsuleMinorFilled,
      capsuleSlots,
      lastIncident,
      category,
      notes: manual?.notes ?? "",
      riskLevel: manual?.riskLevel ?? "medium",
      hasManualRecord: Boolean(manual),
      manualRecordId: manual?.id ?? null,
      caseSummaries,
    });
  }

  rows.sort((a, b) => a.studentName.localeCompare(b.studentName));
  return rows;
}
