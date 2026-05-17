/**
 * Shared inter-office document requests (DO ↔ HSO ↔ SDAO).
 * Office keys: discipline | health | development
 */

import { formatCaseDateFromIso } from "../utils/disciplineCaseMapper";
import { isAllowedInterOfficePair, labelForOfficeKey } from "../constants/documentRequestAccess";
import { INTER_OFFICE_DOC_STATUS } from "../utils/interOfficeWorkflow";

function isoFromDateField(v) {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  try {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    /* ignore */
  }
  return "";
}

function formatShortDate(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** @param {string} viewerOffice discipline | health | development */
export function partnerOfficeKey(row, viewerOffice) {
  const v = String(viewerOffice || "").toLowerCase();
  const req = String(row.requesting_office || "").toLowerCase();
  const tgt = String(row.target_office || "").toLowerCase();
  if (!v || !req || !tgt) return "";
  return req === v ? tgt : req;
}

/**
 * @param {string} requestingOffice
 * @param {object} payload same shape as documentRequestToInsert client payload + optional notes
 * @param {string} [requestedBy]
 */
export function interOfficeDocumentRequestToInsert(id, payload, requestingOffice, requestedBy) {
  const tgt = String(payload.targetOffice || "").trim().toLowerCase();
  const req = String(requestingOffice || "").trim().toLowerCase();
  if (!isAllowedInterOfficePair(req, tgt)) {
    throw new Error("That office pairing is not allowed for document requests.");
  }
  /** @type {Record<string, unknown>} */
  const row = {
    id,
    requesting_office: req,
    target_office: tgt,
    student_name: payload.studentName.trim(),
    student_id: payload.studentId.trim(),
    program: (payload.program || "").trim(),
    document_type: payload.documentType,
    priority: String(payload.priority || "medium").toLowerCase(),
    status: payload.status || INTER_OFFICE_DOC_STATUS.PENDING_APPROVAL,
    description: (payload.description || "").trim(),
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    notes: payload.notes != null ? String(payload.notes).trim() || null : null,
    requested_by: requestedBy || null,
    requested_at: new Date().toISOString(),
  };
  if (payload.sdaoReferralId) row.sdao_referral_id = payload.sdaoReferralId;
  if (payload.healthReferralId) row.health_referral_id = payload.healthReferralId;
  if (payload.disciplineReferralId) row.discipline_referral_id = payload.disciplineReferralId;
  return row;
}

/** DO DocumentRequestsPage row shape */
export function interOfficeRowToDocumentRequest(row) {
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  const req = String(row.requesting_office || "").toLowerCase();
  const tgt = String(row.target_office || "").toLowerCase();
  const direction = req === "discipline" ? "outgoing" : "incoming";
  const partnerOffice = partnerOfficeKey(row, "discipline");

  return {
    requestId: String(row.id ?? ""),
    studentName: String(row.student_name ?? ""),
    studentId: String(row.student_id ?? ""),
    program: String(row.program ?? ""),
    requestingOffice: req,
    targetOffice: tgt,
    partnerOffice,
    direction,
    documentType: String(row.document_type ?? ""),
    priority: String(row.priority ?? "medium"),
    status: String(row.status ?? ""),
    requestedDate: row.requested_at ? formatCaseDateFromIso(row.requested_at) : "",
    description: String(row.description ?? ""),
    evidence,
  };
}

function hsoPriorityLabel(p) {
  const x = String(p || "").toLowerCase();
  if (x === "high") return "High";
  if (x === "urgent") return "Urgent";
  if (x === "low") return "Low";
  return "Normal";
}

/** HSO list row (matches mapDocumentRequestRow output shape) */
export function interOfficeRowToHsoDocumentRequest(row) {
  const rd = row.requested_at ? isoFromDateField(row.requested_at) : "";
  const dateLabel = rd ? formatShortDate(`${rd}T12:00:00`) : "—";
  const req = String(row.requesting_office || "").toLowerCase();
  const tgt = String(row.target_office || "").toLowerCase();
  const isIncoming = tgt === "health";
  const partnerOffice = partnerOfficeKey(row, "health");

  return {
    id: String(row.id),
    student: row.student_name,
    sid: row.student_id,
    program: row.program?.trim() || "—",
    targetOffice: tgt,
    requestingOffice: req,
    partnerOffice,
    doc: row.document_type?.trim() || "—",
    priority: hsoPriorityLabel(row.priority),
    status: row.status?.trim() || "Pending",
    date: dateLabel,
    dateSort: rd || "",
    notes: row.notes?.trim() || row.description?.trim() || "",
    requestedBy: row.requested_by?.trim() || "—",
    pendingSince: "",
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    statusBanner: isIncoming
      ? "Awaiting Health Services action"
      : `Awaiting ${labelForOfficeKey(partnerOffice)}`,
    direction: isIncoming ? "incoming" : "outgoing",
  };
}
