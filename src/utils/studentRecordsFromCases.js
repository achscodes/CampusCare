import { formatCaseDateFromIso } from "./disciplineCaseMapper";

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

    rows.push({
      id: manual?.id || `derived-${studentId}`,
      studentId,
      studentName,
      program,
      casesDisplay,
      casesTotal: total,
      casesActive: active,
      lastIncident,
      category,
      notes: manual?.notes ?? "",
      riskLevel: manual?.riskLevel ?? "medium",
      hasManualRecord: Boolean(manual),
      manualRecordId: manual?.id ?? null,
    });
  }

  rows.sort((a, b) => a.studentName.localeCompare(b.studentName));
  return rows;
}
