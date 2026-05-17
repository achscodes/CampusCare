const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatCaseDateFromIso(isoOrDate) {
  const dt = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(dt.getTime())) return "";
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

export function formatCaseId(caseId) {
  const raw = String(caseId ?? "").trim();
  const match = raw.match(/^DC-(\d{4})-(\d+)$/i);
  if (!match) return raw;
  const seq = Number.parseInt(match[2], 10);
  if (Number.isNaN(seq)) return raw;
  return `DC-${match[1]}-${String(seq).padStart(2, "0")}`;
}

export function normalizeCaseStatus(status) {
  const value = String(status ?? "new").trim().toLowerCase();
  if (
    value === "new" ||
    value === "pending" ||
    value === "ongoing" ||
    value === "escalated" ||
    value === "closed"
  ) {
    return value;
  }
  return "new";
}

function parseProgramFromDescription(description) {
  const raw = String(description || "");
  if (!raw.trim()) return "";
  const parts = raw.split(/\n\s*\n/g).map((s) => s.trim());
  for (const part of parts) {
    if (part.startsWith("Program: ")) return part.slice(9).trim();
  }
  return "";
}

function parseSchoolFromDescription(description) {
  const raw = String(description || "");
  for (const part of raw.split(/\n\s*\n/g).map((s) => s.trim())) {
    if (part.startsWith("School: ")) return part.slice(8).trim();
  }
  return "";
}

function parseOffenseTypeFromDescription(description) {
  const raw = String(description || "");
  for (const part of raw.split(/\n\s*\n/g).map((s) => s.trim())) {
    if (part.startsWith("Offense Type: ")) return part.slice(14).trim();
  }
  return "";
}

export function parseCaseDescriptionSchool(description) {
  return parseSchoolFromDescription(description);
}

/** @param {Record<string, unknown>} row */
export function rowToCase(row) {
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  const reportedAt = row.reported_at ? new Date(String(row.reported_at)).toISOString() : null;
  const updatedAt = row.updated_at ? new Date(String(row.updated_at)).toISOString() : null;
  const description = String(row.description ?? "");
  const program = String(row.program ?? "") || parseProgramFromDescription(description);
  const school = String(row.school ?? "") || parseSchoolFromDescription(description);
  const offenseType = String(row.offense_type ?? "") || parseOffenseTypeFromDescription(description);
  return {
    id: String(row.id ?? ""),
    student: String(row.student_name ?? ""),
    studentId: String(row.student_id ?? ""),
    caseType: String(row.case_type ?? ""),
    status: normalizeCaseStatus(row.status),
    priority:
      row.priority != null && String(row.priority).trim() !== ""
        ? String(row.priority).trim()
        : "medium",
    date: formatCaseDateFromIso(row.reported_at),
    officer: String(row.reporting_officer ?? ""),
    program: program || "",
    school: school || "",
    offenseType: offenseType || "",
    description,
    evidence,
    reportedAt: reportedAt || undefined,
    updatedAt: updatedAt || undefined,
    respondentEmail: String(row.respondent_email ?? ""),
    nteSentAt: row.nte_sent_at ? new Date(String(row.nte_sent_at)).toISOString() : null,
    closureSummary: String(row.closure_summary ?? ""),
    closedAt: row.closed_at ? new Date(String(row.closed_at)).toISOString() : null,
    closedByUserId: row.closed_by_user_id ? String(row.closed_by_user_id) : null,
    escalatedAt: row.escalated_at ? new Date(String(row.escalated_at)).toISOString() : null,
    sourceIncidentReportId: String(row.source_incident_report_id ?? ""),
  };
}

/**
 * @param {object} payload
 * @param {string} payload.student
 * @param {string} payload.studentId
 * @param {string} payload.caseType
 * @param {string} payload.description
 * @param {object[]} [payload.evidence]
 * @param {string} [payload.officer]
 */
export function buildCaseInsertRow(id, payload) {
  return {
    id,
    student_name: payload.student.trim(),
    student_id: payload.studentId.trim(),
    case_type: payload.caseType,
    status: payload.status ? normalizeCaseStatus(payload.status) : "new",
    reporting_officer: payload.officer || "Discipline Office",
    description: payload.description.trim(),
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    reported_at: new Date().toISOString(),
    program: String(payload.program || "").trim(),
    school: String(payload.school || "").trim(),
    offense_type: String(payload.offenseType || "").trim(),
    ...(payload.respondentEmail != null && String(payload.respondentEmail).trim() !== ""
      ? { respondent_email: String(payload.respondentEmail).trim() }
      : {}),
    ...(payload.sourceIncidentReportId != null && String(payload.sourceIncidentReportId).trim() !== ""
      ? { source_incident_report_id: String(payload.sourceIncidentReportId).trim() }
      : {}),
  };
}

/**
 * Next `DC-YYYY-NN` id from existing `discipline_cases` rows (same rules as DO case creation).
 * @param {{ id: string }[]} rows
 */
export function makeNextDisciplineCaseId(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const year = String(new Date().getFullYear());
  const prefix = `DC-${year}-`;
  const parseCaseIndex = (caseId) => {
    const parts = String(caseId).split("-");
    const last = parts[parts.length - 1];
    const n = Number(last);
    return Number.isFinite(n) ? n : 0;
  };
  const maxIdx = list.reduce((acc, row) => Math.max(acc, parseCaseIndex(row.id)), 0);
  return `${prefix}${String(maxIdx + 1).padStart(2, "0")}`;
}

/**
 * Insert row for a case created from an incident report (includes workflow link columns when present in DB).
 * @param {string} id
 * @param {{
 *   studentName: string,
 *   studentId: string,
 *   caseType: string,
 *   description: string,
 *   evidence?: object[],
 *   officer?: string,
 *   program?: string,
 *   school?: string,
 *   offenseType?: string,
 *   sourceIncidentReportId?: string | null,
 *   respondentEmail?: string | null,
 * }} payload
 */
export function buildCaseInsertRowFromIncident(id, payload) {
  return buildCaseInsertRow(id, {
    student: payload.studentName,
    studentId: payload.studentId,
    caseType: payload.caseType,
    description: payload.description,
    evidence: payload.evidence,
    officer: payload.officer,
    program: payload.program,
    school: payload.school,
    offenseType: payload.offenseType,
    status: "new",
    respondentEmail: payload.respondentEmail,
    sourceIncidentReportId: payload.sourceIncidentReportId,
  });
}
