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

function parseProgramFromDescription(description) {
  const raw = String(description || "");
  if (!raw.trim()) return "";
  const parts = raw.split(/\n\s*\n/g).map((s) => s.trim());
  for (const part of parts) {
    if (part.startsWith("Program: ")) return part.slice(9).trim();
  }
  return "";
}

/** @param {Record<string, unknown>} row */
export function rowToCase(row) {
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  const reportedAt = row.reported_at ? new Date(String(row.reported_at)).toISOString() : null;
  const updatedAt = row.updated_at ? new Date(String(row.updated_at)).toISOString() : null;
  const description = String(row.description ?? "");
  const program = String(row.program ?? "") || parseProgramFromDescription(description);
  return {
    id: String(row.id ?? ""),
    student: String(row.student_name ?? ""),
    studentId: String(row.student_id ?? ""),
    caseType: String(row.case_type ?? ""),
    status: String(row.status ?? "new"),
    priority: String(row.priority ?? "medium"),
    date: formatCaseDateFromIso(row.reported_at),
    officer: String(row.reporting_officer ?? ""),
    program: program || "",
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
  };
}
