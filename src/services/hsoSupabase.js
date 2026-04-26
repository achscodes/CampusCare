/**
 * Health Services Office — load/map rows from Supabase (tables in migrations).
 */

import { interOfficeRowToHsoDocumentRequest } from "./interOfficeDocumentRequests";
import { rowToReferral } from "../utils/disciplineOfficeMappers";

function visitTypeLabel(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "walkin" || s === "walk-in") return "Walk-in";
  if (s === "scheduled") return "Scheduled";
  return raw ? String(raw).replace(/^./, (c) => c.toUpperCase()) : "Walk-in";
}

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

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
export async function loadHsoFromSupabase(supabase) {
  const [cRes, rRes, aRes, refRes, dRes, discRes] = await Promise.all([
    supabase.from("health_consultations").select("*").order("created_at", { ascending: false }),
    supabase.from("medical_records").select("*").order("updated_at", { ascending: false }),
    supabase.from("health_appointments").select("*").order("appointment_date", { ascending: false }),
    supabase.from("health_referrals").select("*").order("referral_date", { ascending: false }),
    supabase
      .from("inter_office_document_requests")
      .select("*")
      .or("requesting_office.eq.health,target_office.eq.health")
      .order("created_at", { ascending: false }),
    supabase.from("discipline_referrals").select("*").eq("target_office", "health").order("referral_date", { ascending: false }),
  ]);

  const err =
    cRes.error || rRes.error || aRes.error || refRes.error || dRes.error || discRes.error || null;
  if (err) {
    return {
      ok: false,
      error: err,
      consultations: [],
      records: [],
      appointments: [],
      referrals: [],
      documents: [],
      disciplineReferralsIncoming: [],
    };
  }

  return {
    ok: true,
    error: null,
    consultations: (cRes.data || []).map(mapConsultationRow),
    records: (rRes.data || []).map(mapMedicalRecordRow),
    appointments: (aRes.data || []).map(mapAppointmentRow),
    referrals: (refRes.data || []).map(mapReferralRow),
    documents: (dRes.data || []).map(interOfficeRowToHsoDocumentRequest),
    disciplineReferralsIncoming: (discRes.data || []).map(rowToReferral),
  };
}

export function mapConsultationRow(r) {
  const visitD = r.visit_date || (r.created_at ? isoFromDateField(r.created_at) : "");
  const created = r.created_at ? new Date(r.created_at) : null;
  const dateLabel = visitD ? formatShortDate(`${visitD}T12:00:00`) : created ? formatShortDate(created) : "";
  let timeLabel = r.visit_time?.trim() || "";
  if (!timeLabel && created) {
    timeLabel = created.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  if (!timeLabel) timeLabel = "—";

  const st = String(r.status || "pending").toLowerCase();

  return {
    id: String(r.id),
    student: r.student_name,
    studentId: r.student_id,
    type: visitTypeLabel(r.visit_type),
    followup: false,
    reason: r.chief_complaint?.trim() || "—",
    date: dateLabel || "—",
    time: timeLabel,
    doctor: r.attended_by?.trim() || "—",
    status: st,
    bloodPressure: r.blood_pressure || "",
    temperature: r.temperature_c || "",
    heartRate: r.heart_rate_bpm || "",
    diagnosis: r.diagnosis || "",
    treatment: r.treatment || "",
  };
}

export function mapMedicalRecordRow(r) {
  const lastSort = r.last_checkup ? isoFromDateField(r.last_checkup) : "";
  const lastLabel = lastSort
    ? new Date(`${lastSort}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const badges = Array.isArray(r.badges) && r.badges.length ? r.badges : ["cleared"];

  return {
    id: String(r.id),
    student: r.student_name,
    studentId: r.student_id,
    program: r.program?.trim() || "—",
    blood: r.blood_type?.trim() || "—",
    allergies: r.allergies?.trim() || "None",
    last: lastLabel,
    lastSort: lastSort || lastLabel,
    badges,
    email: r.email?.trim() || "—",
    phone: r.phone?.trim() || "—",
    emergencyContact: r.emergency_contact?.trim() || "—",
    medications: r.medications?.trim() || "None",
    chronicConditions: r.chronic_conditions?.trim() || "None",
    vaccinations: r.vaccinations?.trim() || "—",
    weightKg: r.weight_kg?.trim() || "—",
    heightCm: r.height_cm?.trim() || "—",
    notes: r.notes?.trim() || "",
  };
}

export function mapAppointmentRow(r) {
  const d = r.appointment_date ? isoFromDateField(r.appointment_date) : "";
  const dateLabel = d ? formatShortDate(`${d}T12:00:00`) : "—";

  return {
    id: String(r.id),
    student: r.student_name,
    studentId: r.student_id,
    time: r.appointment_time?.trim() || "—",
    date: dateLabel,
    dateSort: d || "",
    room: r.room?.trim() || "—",
    service: r.service?.trim() || "—",
    status: String(r.status || "pending").toLowerCase(),
    email: r.student_email?.trim() || "—",
    phone: r.student_phone?.trim() || "—",
    doctor: r.doctor?.trim() || "—",
    duration: r.duration?.trim() || "—",
    purpose: r.purpose?.trim() || "—",
    notes: r.notes?.trim() || "",
  };
}

export function mapReferralRow(r) {
  const rd = r.referral_date ? isoFromDateField(r.referral_date) : "";
  const dateLabel = rd ? formatShortDate(`${rd}T12:00:00`) : "—";

  return {
    id: String(r.id),
    referenceId: r.reference_id,
    student: r.student_name,
    studentId: r.student_id,
    program: r.program?.trim() || "—",
    email: r.student_email?.trim() || "—",
    phone: r.student_phone?.trim() || "—",
    office: r.receiving_office?.trim() || "—",
    referringLabel: r.referring_office?.trim() || "Health Services Office",
    reason: r.reason?.trim() || "—",
    observations: r.health_observations?.trim() || "—",
    recommendedAction: r.recommended_action?.trim() || "—",
    date: dateLabel,
    dateSort: rd || "",
    by: r.created_by_name?.trim() || "—",
    status: r.status?.trim() || "Sent",
    urgent: Boolean(r.urgent),
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    timeline: Array.isArray(r.timeline) ? r.timeline : [],
  };
}

