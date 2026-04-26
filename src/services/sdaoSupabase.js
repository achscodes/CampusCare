/**
 * SDAO — load / map / write rows for scholarship module tables.
 */

import { DISCIPLINE_REFERRAL_STATUS } from "../utils/interOfficeWorkflow";
import { rowToReferral } from "../utils/disciplineOfficeMappers";

function formatShortDate(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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

export function mapBeneficiaryRow(r) {
  return {
    id: String(r.id),
    fullName: r.full_name,
    studentId: r.student_id,
    program: r.program?.trim() || "—",
    yearLevel: r.year_level?.trim() || "—",
    scholarshipType: r.scholarship_type?.trim() || "—",
    gpa: r.gpa != null && String(r.gpa).trim() !== "" ? String(r.gpa) : "—",
    email: r.email?.trim() || "—",
    contact: r.contact?.trim() || "—",
    scholarStatus: String(r.scholar_status || "active").toLowerCase(),
    internalNotes: r.internal_notes?.trim() || "",
  };
}

export function mapApplicationRow(r) {
  const sub = r.submitted_at ? isoFromDateField(r.submitted_at) : "";
  const submittedLabel = sub
    ? new Date(`${sub}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const disbursed = r.disbursed_on ? isoFromDateField(r.disbursed_on) : "";
  const disbursedLabel = disbursed
    ? new Date(`${disbursed}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : undefined;

  return {
    id: String(r.id),
    student: r.student_name,
    sid: r.student_id,
    degree: r.degree?.trim() || "—",
    type: r.scholarship_type?.trim() || "—",
    gpa: r.gpa != null && String(r.gpa).trim() !== "" ? String(r.gpa) : "—",
    submitted: submittedLabel,
    status: String(r.status || "pending").toLowerCase(),
    documents: Array.isArray(r.documents) ? r.documents : [],
    documentPresentation: r.document_presentation?.trim() || "tinted",
    disbursedOn: disbursedLabel,
  };
}

export function mapClearanceRow(r) {
  const reqs = Array.isArray(r.requirements) ? r.requirements : [];
  const pendingCount =
    typeof r.pending_count === "number"
      ? r.pending_count
      : reqs.filter((x) => String(x?.state || "").toLowerCase() === "pending").length;

  return {
    id: String(r.id),
    student: r.student_name,
    sid: r.student_id,
    program: r.program?.trim() || "—",
    yearLevel: r.year_level?.trim() || "—",
    scholarship: r.scholarship?.trim() || "—",
    progress: Number(r.progress) || 0,
    statusKey: String(r.status_key || "pending").toLowerCase(),
    progressLabel: r.progress_label?.trim() || `${Number(r.progress) || 0}% complete`,
    requirements: reqs,
    pendingCount,
    footerMessage: r.footer_message?.trim() || "",
    footerVariant: r.footer_variant?.trim() || "warning",
  };
}

export function mapSdaoDocumentRequestRow(r) {
  const req = String(r.requesting_office || "").toLowerCase();
  const tgt = String(r.target_office || "").toLowerCase();
  const viewer = "development";
  const partnerOffice = req === viewer ? tgt : req;
  const direction = req === viewer ? "outgoing" : "incoming";
  const rd = r.requested_at || r.created_at;
  const dateLabel = rd ? formatShortDate(rd) : "—";
  const up = r.uploaded_at ? formatShortDate(r.uploaded_at) : null;

  return {
    id: r.id,
    student: r.student_name,
    sid: r.student_id,
    program: r.program?.trim() || "—",
    targetOffice: tgt,
    requestingOffice: req,
    partnerOffice,
    direction,
    doc: r.document_type?.trim() || "—",
    priority: r.priority?.trim() || "Normal",
    status: String(r.status || "pending").toLowerCase(),
    date: dateLabel,
    uploadedAt: up,
    notes: r.notes?.trim() || r.description?.trim() || "",
    requestedBy: r.requested_by?.trim() || "—",
    evidence: Array.isArray(r.evidence) ? r.evidence : [],
    sdaoReferralId: r.sdao_referral_id ?? null,
    healthReferralId: r.health_referral_id ?? null,
    disciplineReferralId: r.discipline_referral_id ?? null,
  };
}

export function mapSdaoReferralRow(r) {
  const created = r.created_at ? new Date(r.created_at) : null;
  const createdLabel = created ? formatShortDate(created) : "—";

  return {
    referralDbId: String(r.id),
    refId: r.reference_id?.trim() || `REF-${String(r.id).replace(/-/g, "").slice(0, 12).toUpperCase()}`,
    student: r.student_name,
    studentId: r.student_id,
    email: r.email?.trim() || "—",
    phone: r.phone?.trim() || "—",
    program: r.program?.trim() || "—",
    receivingOffice: r.receiving_office?.trim() || "—",
    referringOffice: r.referring_office?.trim() || "SDAO",
    reason: r.reason?.trim() || "—",
    developmentDetails: r.development_details?.trim() || "",
    recommendedAction: r.recommended_action?.trim() || "",
    urgency: String(r.urgency || "normal").toLowerCase(),
    status: String(r.status || "sent").toLowerCase(),
    statusDetail: r.status_detail?.trim() || "—",
    createdAt: createdLabel,
    createdBy: r.created_by?.trim() || "—",
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    timeline: Array.isArray(r.timeline) ? r.timeline : [],
    interOfficeDocumentRequestId: r.inter_office_document_request_id?.trim() || null,
  };
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
export async function loadSdaoFromSupabase(supabase) {
  const [bRes, aRes, cRes, dRes, rRes, discRes] = await Promise.all([
    supabase.from("sdao_beneficiaries").select("*").order("created_at", { ascending: false }),
    supabase.from("sdao_scholarship_applications").select("*").order("created_at", { ascending: false }),
    supabase.from("sdao_clearance_records").select("*").order("created_at", { ascending: false }),
    supabase
      .from("inter_office_document_requests")
      .select("*")
      .or("requesting_office.eq.development,target_office.eq.development")
      .order("created_at", { ascending: false }),
    supabase.from("sdao_referrals").select("*").order("created_at", { ascending: false }),
    supabase.from("discipline_referrals").select("*").eq("target_office", "development").order("referral_date", { ascending: false }),
  ]);

  const err = bRes.error || aRes.error || cRes.error || dRes.error || rRes.error || discRes.error || null;
  if (err) {
    return {
      ok: false,
      error: err,
      beneficiaries: [],
      applications: [],
      clearanceRecords: [],
      documentRequests: [],
      referrals: [],
      disciplineReferralsIncoming: [],
    };
  }

  return {
    ok: true,
    error: null,
    beneficiaries: (bRes.data || []).map(mapBeneficiaryRow),
    applications: (aRes.data || []).map(mapApplicationRow),
    clearanceRecords: (cRes.data || []).map(mapClearanceRow),
    documentRequests: (dRes.data || []).map(mapSdaoDocumentRequestRow),
    referrals: (rRes.data || []).map(mapSdaoReferralRow),
    disciplineReferralsIncoming: (discRes.data || []).map(rowToReferral),
  };
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
export async function insertSdaoBeneficiary(supabase, form) {
  const row = {
    full_name: form.fullName.trim(),
    student_id: form.studentId.trim(),
    program: form.program.trim(),
    year_level: form.yearLevel,
    scholarship_type: form.scholarshipType,
    gpa: form.gpa.trim(),
    email: form.email.trim(),
    contact: form.contact.trim(),
    scholar_status: "active",
    internal_notes: "",
  };
  return supabase.from("sdao_beneficiaries").insert(row).select("*").single();
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
export async function updateSdaoBeneficiary(supabase, id, patch) {
  return supabase
    .from("sdao_beneficiaries")
    .update({
      scholarship_type: patch.scholarshipType,
      scholar_status: patch.scholarStatus,
      internal_notes: patch.internalNotes ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
export async function insertSdaoDocumentRequest(supabase, form, { studentName, requestedBy }) {
  const id = `REQ-SDAO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  const pri =
    String(form.priority || "Normal").toLowerCase() === "urgent" ? "high" : "medium";
  const docTypeRaw = String(form.documentType || "").trim();
  const otherSpec = String(form.documentTypeOther || "").trim();
  const documentType =
    docTypeRaw.toLowerCase() === "other" && otherSpec ? `Other: ${otherSpec}` : docTypeRaw;
  const row = {
    id,
    requesting_office: "development",
    target_office: String(form.targetOffice || "").trim().toLowerCase(),
    student_name: (studentName || "Student").trim(),
    student_id: form.studentId.trim(),
    program: (form.program && String(form.program).trim()) || "—",
    document_type: documentType,
    priority: pri,
    status: "pending",
    description: "",
    evidence: [],
    requested_at: new Date().toISOString(),
    notes: form.notes?.trim() || "",
    requested_by: requestedBy || "SDAO",
  };
  return supabase.from("inter_office_document_requests").insert(row).select("*").single();
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
export async function insertSdaoReferral(supabase, form, userLabel) {
  const ref = `REF-SDAO-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const row = {
    reference_id: ref,
    student_name: form.studentName.trim(),
    student_id: form.studentId.trim(),
    email: form.email.trim(),
    phone: "",
    program: (form.program && form.program.trim()) || "",
    receiving_office: form.receivingOffice.trim(),
    referring_office: "SDAO — Student Development & Activities Office",
    reason: form.reason.trim(),
    development_details: form.referralNotes?.trim() || "",
    recommended_action: "",
    urgency: form.urgency || "normal",
    status: DISCIPLINE_REFERRAL_STATUS.PENDING_PARTNER,
    status_detail: "Pending partner review",
    created_by: userLabel || "SDAO",
    attachments: [],
    timeline: [
      {
        id: "t1",
        title: "Referral sent",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        by: userLabel || "SDAO",
        tone: "muted",
      },
    ],
  };
  if (form.interOfficeDocumentRequestId?.trim()) {
    row.inter_office_document_request_id = form.interOfficeDocumentRequestId.trim();
  }
  return supabase.from("sdao_referrals").insert(row).select("*").single();
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
export async function updateApplicationDisbursed(supabase, applicationId) {
  const today = new Date().toISOString().slice(0, 10);
  return supabase
    .from("sdao_scholarship_applications")
    .update({
      status: "disbursed",
      disbursed_on: today,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .select("*")
    .single();
}
