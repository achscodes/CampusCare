import { formatCaseDateFromIso } from "./disciplineCaseMapper";

/** @param {Record<string, unknown>} row */
export function rowToStudentRecord(row) {
  return {
    id: String(row.id),
    studentName: String(row.student_name ?? ""),
    studentId: String(row.student_id ?? ""),
    program: String(row.program ?? ""),
    cases: Number(row.open_cases_count ?? 0),
    lastIncident: row.last_incident_at
      ? formatCaseDateFromIso(row.last_incident_at)
      : "—",
    status: String(row.status ?? "active"),
    riskLevel: String(row.risk_level ?? "medium"),
    notes: String(row.notes ?? ""),
  };
}

export function studentRecordToInsert(payload) {
  return {
    student_name: payload.studentName.trim(),
    student_id: payload.studentId.trim(),
    program: payload.program.trim(),
    status: payload.status || "active",
    risk_level: payload.riskLevel || "medium",
    notes: (payload.notes || "").trim(),
    open_cases_count: payload.cases ?? 0,
    last_incident_at: payload.lastIncidentAt || new Date().toISOString(),
  };
}

/** @param {Record<string, unknown>} row */
export function rowToDocumentRequest(row) {
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  return {
    requestId: String(row.id ?? ""),
    studentName: String(row.student_name ?? ""),
    studentId: String(row.student_id ?? ""),
    program: String(row.program ?? ""),
    targetOffice: String(row.target_office ?? ""),
    documentType: String(row.document_type ?? ""),
    priority: String(row.priority ?? "medium"),
    status: String(row.status ?? ""),
    requestedDate: formatCaseDateFromIso(row.requested_at),
    description: String(row.description ?? ""),
    evidence,
  };
}

export function documentRequestToInsert(id, payload) {
  return {
    id,
    student_name: payload.studentName.trim(),
    student_id: payload.studentId.trim(),
    program: (payload.program || "").trim(),
    target_office: (payload.targetOffice || "").trim(),
    document_type: payload.documentType,
    priority: payload.priority || "medium",
    status: payload.status || "Pending",
    description: payload.description.trim(),
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    requested_at: new Date().toISOString(),
  };
}

/** @param {Record<string, unknown>} row */
export function rowToReferral(row) {
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  const referringOffice = String(row.referring_office ?? "discipline").toLowerCase();
  let targetOffice = String(row.target_office ?? "").toLowerCase();
  if (!targetOffice) {
    const rt = String(row.referral_type ?? "").toUpperCase();
    if (rt.includes("HSO")) targetOffice = "health";
    else if (rt.includes("SDAO")) targetOffice = "development";
    else if (rt.includes("DO")) targetOffice = "discipline";
  }
  return {
    referralId: String(row.id ?? ""),
    studentName: String(row.student_name ?? ""),
    studentId: String(row.student_id ?? ""),
    referralType: String(row.referral_type ?? ""),
    reason: String(row.reason ?? ""),
    status: String(row.status ?? ""),
    date: formatCaseDateFromIso(row.referral_date),
    evidence,
    referringOffice,
    targetOffice,
  };
}

export function referralToInsert(id, payload) {
  return {
    id,
    student_name: payload.studentName.trim(),
    student_id: payload.studentId.trim(),
    referral_type: payload.referralType,
    reason: payload.reason.trim(),
    status: payload.status || "Pending",
    referral_date: new Date().toISOString(),
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    referring_office: String(payload.referringOffice || "discipline").toLowerCase(),
    target_office: String(payload.targetOffice || "").toLowerCase(),
  };
}

/** @param {Record<string, unknown>} row */
export function rowToSanction(row) {
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  return {
    sanctionId: String(row.id ?? ""),
    studentName: String(row.student_name ?? ""),
    studentId: String(row.student_id ?? ""),
    sanctionType: String(row.sanction_type ?? ""),
    status: String(row.status ?? ""),
    dueDate: String(row.due_date ?? ""),
    notes: String(row.notes ?? ""),
    evidence,
    hours: row.hours != null && row.hours !== "" ? Number(row.hours) : null,
    correspondingOffice: String(row.corresponding_office ?? ""),
    correspondingOfficeOther: String(row.corresponding_office_other ?? ""),
    communityServiceDetail: String(row.community_service_detail ?? ""),
    completionDate: String(row.completion_date ?? ""),
    program: String(row.program ?? ""),
    school: String(row.school ?? ""),
    offensesSummary: String(row.offenses_summary ?? ""),
  };
}

export function sanctionToInsert(id, payload) {
  return {
    id,
    student_name: payload.studentName.trim(),
    student_id: payload.studentId.trim(),
    sanction_type: payload.sanctionType,
    status: payload.status || "In Review",
    due_date: (payload.dueDate || "").trim(),
    notes: (payload.notes || "").trim(),
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    hours: payload.hours != null && payload.hours !== "" ? Number(payload.hours) : null,
    corresponding_office: String(payload.correspondingOffice || "").trim(),
    corresponding_office_other: String(payload.correspondingOfficeOther || "").trim(),
    community_service_detail: String(payload.communityServiceDetail || "").trim(),
    completion_date: String(payload.completionDate || "").trim(),
    program: String(payload.program || "").trim(),
    school: String(payload.school || "").trim(),
    offenses_summary: String(payload.offensesSummary || "").trim(),
  };
}

/** @param {Record<string, unknown>} row */
export function rowToCaseConference(row) {
  const attendees = Array.isArray(row.attendees) ? row.attendees : [];
  return {
    conferenceId: String(row.id ?? ""),
    caseId: String(row.case_id ?? ""),
    studentName: String(row.student_name ?? ""),
    studentId: String(row.student_id ?? ""),
    caseTitle: String(row.case_title ?? ""),
    day: row.day_of_month != null ? Number(row.day_of_month) : 1,
    dateLabel: String(row.date_label ?? ""),
    timeLabel: String(row.time_label ?? ""),
    durationLabel: String(row.duration_label ?? "1 hour"),
    location: String(row.location ?? ""),
    status: String(row.status ?? "scheduled"),
    attendees,
    notes: String(row.notes ?? ""),
    presidingOfficer: String(row.presiding_officer ?? ""),
  };
}

export function caseConferenceToInsert(id, payload) {
  return {
    id,
    case_id: payload.caseId || "",
    student_name: payload.studentName,
    student_id: payload.studentId,
    case_title: payload.caseTitle,
    day_of_month: payload.day,
    date_label: payload.dateLabel,
    time_label: payload.timeLabel,
    duration_label: payload.durationLabel || "1 hour",
    location: payload.location,
    status: payload.status || "scheduled",
    attendees: Array.isArray(payload.attendees) ? payload.attendees : [],
    notes: (payload.notes || "").trim(),
    presiding_officer: payload.presidingOfficer || "Ms. Arny Lynne Saragina",
  };
}

export function nextPrefixedId(
  list,
  prefix,
  year = new Date().getFullYear(),
  padWidth = 4,
) {
  const re = new RegExp(`${prefix}-${year}-(\\d+)$`);
  let max = 0;
  for (const item of list) {
    const key =
      item.requestId ||
      item.referralId ||
      item.sanctionId ||
      item.conferenceId ||
      item.id ||
      "";
    const match = String(key).match(re);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(padWidth, "0")}`;
}

export function nextConferenceId(list) {
  let max = 0;
  for (const c of list) {
    const id = String(c.conferenceId || "");
    const m = id.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `H-${String(max + 1).padStart(3, "0")}`;
}
