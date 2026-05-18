/**
 * `public.discipline_incident_reports` — live Supabase (see disciplineMobileWebContract.js).
 */

import {
  INCIDENT_REPORT_TABLE,
  INCIDENT_REPORT_STATUSES,
  INCIDENT_REPORT_INCIDENT_TYPES,
  INCIDENT_REPORT_COLUMNS,
} from "../constants/disciplineMobileWebContract";

export {
  INCIDENT_REPORT_TABLE,
  INCIDENT_REPORT_STATUSES,
  INCIDENT_REPORT_INCIDENT_TYPES,
  INCIDENT_REPORT_COLUMNS,
};

export const INCIDENT_REPORT_SELECT = INCIDENT_REPORT_COLUMNS.join(", ");

export const IR_STATUS_MODAL_LABEL = {
  submitted: "Pending Review",
  under_review: "Under Review",
  converted_to_case: "Converted to Case",
  rejected: "Rejected",
};

export const IR_FILTER_TABS = [
  { key: "all", label: "All Reports" },
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "rejected", label: "Rejected" },
  { key: "converted_to_case", label: "Converted to Case" },
];

/** UI pill class for `cc-pill` (matches DO office patterns). */
export function irStatusPillClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "converted_to_case") return "completed";
  if (s === "rejected") return "cancelled";
  if (s === "under_review") return "scheduled";
  if (s === "submitted") return "scheduled";
  return "scheduled";
}

export function irStatusLabel(status) {
  const s = String(status || "").toLowerCase();
  return IR_STATUS_MODAL_LABEL[s] || status || "—";
}

export function irFormatDate(raw) {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return raw;
  }
}

export function irFormatTime(raw) {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return raw;
  }
}

export function irFormatDateTime(raw) {
  if (!raw) return "—";
  try {
    const d = new Date(raw);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${date} ${time}`;
  } catch {
    return raw;
  }
}

export function irFormatFiledOn(raw) {
  return irFormatDateTime(raw);
}

export function irFormatId(raw) {
  if (!raw) return "—";
  const s = String(raw).toUpperCase();
  return /^IR-/.test(s) ? s : `IR-${s}`;
}

export function irDisplayReportId(raw) {
  const id = irFormatId(raw);
  if (id === "—") return "—";
  return `#${id}`;
}

export function irParseParties(parties) {
  if (!parties) return [];
  try {
    const arr = Array.isArray(parties) ? parties : JSON.parse(parties);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function irAttachmentsList(report) {
  const raw = report?.attachments;
  return Array.isArray(raw) ? raw : [];
}

export function irLooksLikeUuid(s) {
  if (s == null || typeof s !== "string") return false;
  const t = s.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(t);
}

export function irCollectEmbeddedRosterHints(reports) {
  const uuids = new Set();
  const sids = new Set();
  const emails = new Set();
  for (const r of reports || []) {
    if (r?.reporter_student_id != null && String(r.reporter_student_id).trim()) {
      sids.add(String(r.reporter_student_id).trim());
    }
    const arr = irParseParties(r?.involved_parties);
    for (const p of arr) {
      if (typeof p !== "object" || !p) continue;
      const sid =
        p.student_id ??
        p.studentId ??
        p.school_id ??
        p.reporter_student_id ??
        p.studentNumber ??
        p.enrollment_id ??
        p.enrollmentId;
      if (sid != null && String(sid).trim()) sids.add(String(sid).trim());
      const em = p.email ?? p.school_email;
      if (em != null && String(em).trim()) emails.add(String(em).trim().toLowerCase());
      for (const key of [
        "user_id",
        "profile_id",
        "student_uuid",
        "students_id",
        "reporter_id",
        "reporterId",
        "complainant_id",
        "complainee_id",
        "complainantId",
        "complaineeId",
      ]) {
        const v = p[key];
        if (v != null && irLooksLikeUuid(String(v))) uuids.add(String(v).trim().toLowerCase());
      }
    }
  }
  return { uuids: [...uuids], sids: [...sids], emails: [...emails] };
}

export function irPartyObjectRosterName(p, nameByKey) {
  if (typeof p !== "object" || !p || typeof nameByKey !== "object") return null;
  const sid =
    p.student_id ??
    p.studentId ??
    p.school_id ??
    p.reporter_student_id ??
    p.studentNumber ??
    p.enrollment_id ??
    p.enrollmentId;
  if (sid != null && String(sid).trim()) {
    const k = `sid:${String(sid).trim()}`;
    if (nameByKey[k]) return nameByKey[k];
  }
  const em = p.email ?? p.school_email;
  if (em != null && String(em).trim()) {
    const k = `email:${String(em).trim().toLowerCase()}`;
    if (nameByKey[k]) return nameByKey[k];
  }
  for (const key of [
    "user_id",
    "profile_id",
    "student_uuid",
    "students_id",
    "reporter_id",
    "reporterId",
    "complainant_id",
    "complainee_id",
    "complainantId",
    "complaineeId",
  ]) {
    const v = p[key];
    if (v != null && irLooksLikeUuid(String(v))) {
      const k = `uuid:${String(v).trim().toLowerCase()}`;
      if (nameByKey[k]) return nameByKey[k];
    }
  }
  return null;
}

export function irPartyTextDisplayName(p) {
  if (typeof p === "string") {
    const t = p.trim();
    return t || "";
  }
  if (typeof p !== "object" || !p) return "";
  const n = p.name ?? p.full_name ?? p.fullName ?? p.student ?? p.displayName ?? p.email ?? p.id;
  return n != null && String(n).trim() ? String(n).trim() : "";
}

export function irPartyLabels(report) {
  const out = { complainant: "—", complainee: "—" };
  const arr = irParseParties(report?.involved_parties);
  if (arr.length === 0) return out;

  const nameOf = (p) => {
    const t = irPartyTextDisplayName(p);
    return t || "—";
  };
  const roleOf = (p) => String(p?.role || p?.type || "").toLowerCase();

  const pickFirst = (matchers) => {
    for (const p of arr) {
      const role = roleOf(p);
      if (matchers.some((m) => role.includes(m))) return nameOf(p);
    }
    return "—";
  };

  out.complainant = pickFirst([
    "complainant",
    "reporter",
    "reporting",
    "reported_by",
    "submitter",
    "author",
    "filing",
    "plaintiff",
  ]);
  out.complainee = pickFirst(["complainee", "accused", "respondent", "subject", "alleged", "student"]);

  if (out.complainant === "—" && out.complainee === "—") {
    if (arr.every((p) => typeof p === "string")) {
      out.complainant = nameOf(arr[0]);
      out.complainee = arr[1] != null ? nameOf(arr[1]) : "—";
    } else {
      out.complainant = nameOf(arr[0]);
      if (arr[1]) out.complainee = nameOf(arr[1]);
    }
  }
  return out;
}

export function rosterStudentDisplayName(row) {
  if (!row) return "—";
  const full = row.full_name != null && String(row.full_name).trim();
  if (full) return String(row.full_name).trim();
  const fn = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return fn || "—";
}

export function irStudentRosterMapAddRow(map, row) {
  if (!row || typeof map !== "object") return;
  const name = rosterStudentDisplayName(row);
  if (row.id != null && String(row.id).trim()) {
    map[`uuid:${String(row.id).trim().toLowerCase()}`] = name;
  }
  if (row.student_id != null && String(row.student_id).trim()) {
    map[`sid:${String(row.student_id).trim()}`] = name;
  }
  if (row.email != null && String(row.email).trim()) {
    map[`email:${String(row.email).trim().toLowerCase()}`] = name;
  }
}

/** Reporter / filer: `reporter_student_id` → roster, then `involved_parties`. */
export function irComplainantDisplay(report, nameByKey = {}) {
  if (report?.reporter_student_id != null && String(report.reporter_student_id).trim()) {
    const sid = String(report.reporter_student_id).trim();
    const k = `sid:${sid}`;
    if (nameByKey[k]) return nameByKey[k];
    return sid;
  }
  return irPartyLabels(report).complainant;
}

export function irComplaineeDisplay(report, nameByKey = {}) {
  const arr = irParseParties(report?.involved_parties);
  const specific = ["complainee", "accused", "respondent", "subject", "alleged", "defendant"];
  for (const p of arr) {
    if (typeof p !== "object" || !p) continue;
    const role = String(p.role || p.type || "").toLowerCase();
    if (!specific.some((m) => role.includes(m))) continue;
    const rn = irPartyObjectRosterName(p, nameByKey);
    if (rn) return rn;
    const tx = irPartyTextDisplayName(p);
    if (tx) return tx;
  }
  if (arr.length >= 1) {
    const first = arr[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (typeof first === "object" && first) {
      const rn = irPartyObjectRosterName(first, nameByKey);
      if (rn) return rn;
      const tx = irPartyTextDisplayName(first);
      if (tx) return tx;
    }
  }
  if (arr.length >= 2 && typeof arr[1] === "object" && arr[1]) {
    const rn1 = irPartyObjectRosterName(arr[1], nameByKey);
    if (rn1) return rn1;
    const tx1 = irPartyTextDisplayName(arr[1]);
    if (tx1) return tx1;
  }
  return irPartyLabels(report).complainee;
}

export async function irResolveComplaineeEmail(report, nameByKey, studentName, supabaseClient) {
  const arr = irParseParties(report?.involved_parties);
  const roles = ["complainee", "accused", "respondent", "subject", "alleged", "defendant"];
  let party = null;
  for (const p of arr) {
    if (typeof p !== "object" || !p) continue;
    const role = String(p.role || p.type || "").toLowerCase();
    if (roles.some((m) => role.includes(m))) {
      party = p;
      break;
    }
  }
  if (!party && arr.length >= 2 && typeof arr[1] === "object") party = arr[1];

  const direct = party?.email ?? party?.school_email;
  if (direct != null && String(direct).trim()) return String(direct).trim();

  const sid = party?.student_id ?? party?.studentId ?? party?.school_id;
  if (sid != null && String(sid).trim() && supabaseClient) {
    const { data } = await supabaseClient
      .from("students")
      .select("email")
      .eq("student_id", String(sid).trim())
      .maybeSingle();
    if (data?.email) return String(data.email).trim();
  }

  const uuid = party?.user_id ?? party?.complainee_id ?? party?.complaineeId;
  if (uuid != null && irLooksLikeUuid(String(uuid)) && supabaseClient) {
    const { data } = await supabaseClient
      .from("students")
      .select("email")
      .eq("id", String(uuid).trim())
      .maybeSingle();
    if (data?.email) return String(data.email).trim();
  }

  return "";
}

export function irTryExtractStudentId(report) {
  const arr = irParseParties(report?.involved_parties);
  for (const p of arr) {
    if (typeof p !== "object" || !p) continue;
    const role = String(p?.role || p?.type || "").toLowerCase();
    if (
      !role.includes("complainee") &&
      !role.includes("accused") &&
      !role.includes("respondent") &&
      !role.includes("student")
    ) {
      continue;
    }
    const raw = p.studentId ?? p.student_id ?? p.school_id ?? "";
    const s = String(raw).trim();
    if (s.length >= 4) return s;
  }
  for (const p of arr) {
    if (typeof p !== "object" || !p) continue;
    const raw = p.studentId ?? p.student_id ?? p.school_id ?? "";
    const s = String(raw).trim();
    if (s.length >= 4) return s;
  }
  return "";
}

export function irIncidentType(report) {
  const t = report?.incident_type;
  return t != null && String(t).trim() ? String(t).trim() : "—";
}

export function irNarrative(report) {
  const s = report?.narrative;
  return s != null && String(s).trim() ? String(s).trim() : "—";
}

export function irImpact(report) {
  const s = report?.impact;
  return s != null && String(s).trim() ? String(s).trim() : "—";
}

/** Staff rejection text (detail modal / student email — not staff table). */
export function irRejectionMessage(report) {
  const s = report?.rejection_message;
  return s != null && String(s).trim() ? String(s).trim() : "—";
}

/** @deprecated alias — use `irNarrative` */
export function irStatement(report) {
  return irNarrative(report);
}

export function irAttachmentsSummary(report) {
  const raw = irAttachmentsList(report);
  if (raw.length === 0) return "—";
  return raw.length === 1 ? "1 item" : `${raw.length} items`;
}

export function irAttachmentsLines(report) {
  return irAttachmentsList(report).map((item, i) => {
    if (item == null) return { key: i, text: "—" };
    if (typeof item === "string") return { key: i, text: item.trim() || "—" };
    const name = item.file_name || item.name || item.filename || item.title || item.label;
    const url = item.storage_path || item.url || item.href || item.path;
    const mime = item.mime_type ? ` (${item.mime_type})` : "";
    if (name && url) return { key: i, text: `${name}${mime} — ${url}` };
    if (name) return { key: i, text: `${name}${mime}` };
    if (url) return { key: i, text: String(url) };
    try {
      return { key: i, text: JSON.stringify(item) };
    } catch {
      return { key: i, text: String(item) };
    }
  });
}

/** Map incident `attachments` jsonb → discipline_cases `evidence` shape. */
export function irAttachmentsForCaseEvidence(report) {
  return irAttachmentsList(report).map((item) => {
    if (typeof item === "string") return { name: item };
    return {
      name: item?.file_name || item?.name || item?.filename || "attachment",
      path: item?.storage_path || item?.url || item?.path || "",
      mime_type: item?.mime_type || null,
      size_bytes: item?.size_bytes ?? null,
    };
  });
}

/** @deprecated alias — use `irAttachmentsLines` */
export function irEvidenceLines(report) {
  return irAttachmentsLines(report);
}

export function irRowSearchBlob(report, nameByKey = {}) {
  const complainant = irComplainantDisplay(report, nameByKey);
  const complainee = irComplaineeDisplay(report, nameByKey);
  return [
    report?.id,
    irFormatId(report?.id),
    irIncidentType(report),
    report?.location,
    report?.narrative,
    report?.impact,
    irNarrative(report),
    irAttachmentsSummary(report),
    complainant,
    complainee,
    report?.reporter_student_id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** @param {string} caseId @param {string | null | undefined} reviewedBy auth.users id */
export function buildIncidentReportConvertUpdate(caseId, reviewedBy) {
  return {
    status: "converted_to_case",
    converted_case_id: caseId,
    reviewed_at: new Date().toISOString(),
    ...(reviewedBy ? { reviewed_by: reviewedBy } : {}),
  };
}

/** Staff may reject or convert while submitted or under_review. */
export function irStaffCanRejectOrConvert(status) {
  const s = String(status || "").toLowerCase();
  return s === "submitted" || s === "under_review";
}

/** @param {string | null | undefined} reviewedBy auth.users id */
export function buildIncidentReportUnderReviewUpdate(reviewedBy) {
  return {
    status: "under_review",
    reviewed_at: new Date().toISOString(),
    ...(reviewedBy ? { reviewed_by: reviewedBy } : {}),
  };
}

/**
 * Saves rejection text in `rejection_message`; does not modify student `impact`.
 * @param {{ quickLines: string[], detail: string }} rejection
 * @param {string | null | undefined} reviewedBy auth.users id
 */
export function buildIncidentReportRejectUpdate({ quickLines, detail }, reviewedBy) {
  const quickBlock =
    quickLines.length > 0
      ? `Common reasons selected:\n${quickLines.map((l) => `• ${l}`).join("\n")}`
      : "Common reasons selected: (none)";
  const stamp = new Date().toISOString();
  const rejection_message = `${quickBlock}\n\nMessage to student:\n${detail}`;
  return {
    status: "rejected",
    reviewed_at: stamp,
    rejection_message,
    ...(reviewedBy ? { reviewed_by: reviewedBy } : {}),
  };
}
