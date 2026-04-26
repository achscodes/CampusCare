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
  if (value === "ongoing") return "pending";
  if (value === "new" || value === "pending" || value === "closed") return value;
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
    priority: String(row.priority ?? "medium"),
    date: formatCaseDateFromIso(row.reported_at),
    officer: String(row.reporting_officer ?? ""),
    program: program || "",
    school: school || "",
    offenseType: offenseType || "",
    description,
    evidence,
    reportedAt: reportedAt || undefined,
    updatedAt: updatedAt || undefined,
  };
}

/**
 * @param {object} payload
 * @param {string} payload.student
 * @param {string} payload.studentId
 * @param {string} payload.caseType
 * @param {string} payload.description
 * @param {object[]} [payload.evidence]
 * @param {string} [payload.priority]
 * @param {string} [payload.officer]
 */
export function buildCaseInsertRow(id, payload) {
  return {
    id,
    student_name: payload.student.trim(),
    student_id: payload.studentId.trim(),
    case_type: payload.caseType,
    status: "new",
    priority: payload.priority || "medium",
    reporting_officer: payload.officer || "Discipline Office",
    description: payload.description.trim(),
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    reported_at: new Date().toISOString(),
    program: String(payload.program || "").trim(),
    school: String(payload.school || "").trim(),
    offense_type: String(payload.offenseType || "").trim(),
  };
}
