/**
 * Health Services Office — load/map rows from Supabase (tables in migrations).
 */

import { interOfficeRowToHsoDocumentRequest } from "./interOfficeDocumentRequests";
import { rowToReferral } from "../utils/disciplineOfficeMappers";
import { checkinLookupVariants } from "../utils/hsoWorkflow";

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

function formatConsultationDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
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
  const [cRes, rRes, aRes, refRes, dRes, discRes, sdaoRefRes] = await Promise.all([
    supabase.from("health_consultations").select("*").order("created_at", { ascending: false }),
    supabase.from("medical_records").select("*").order("updated_at", { ascending: false }),
    supabase.from("health_appointments").select("*").order("appointment_date", { ascending: false }),
    supabase.from("health_referrals").select("*").order("referral_date", { ascending: false }),
    supabase
      .from("inter_office_document_requests")
      .select("*")
      .or("requesting_office.eq.health,target_office.eq.health")
      .order("created_at", { ascending: false }),
    // Query discipline referrals directly with proper filtering
    supabase.from("discipline_referrals").select("*").eq("target_office", "health").order("referral_date", { ascending: false }),
    // Query SDAO referrals for HSO using both key and human-readable office labels.
    supabase
      .from("sdao_referrals")
      .select("*")
      .or("receiving_office.eq.health,receiving_office.ilike.%health%,receiving_office.ilike.%hso%")
      .order("created_at", { ascending: false }),
  ]);

  const err =
    cRes.error || rRes.error || aRes.error || refRes.error || dRes.error || discRes.error || sdaoRefRes.error || null;
  if (err) {
    return {
      ok: false,
      error: err,
      consultations: [],
      records: [],
      appointments: [],
      referrals: [],
      documents: [],
      incomingReferrals: [],
      disciplineReferralsIncoming: [],
      sdaoReferralsIncoming: [],
    };
  }

  // Safely map referrals from both sources
  const disciplineIncoming = (discRes.data || []).map(rowToReferral);
  const sdaoIncoming = (sdaoRefRes.data || []).map((r) => {
    // Map SDAO referral fields to match expected structure
    return {
      id: r.id,
      referenceId: r.reference_id || `REF-SDAO-${r.id}`,
      student: r.student_name || "",
      studentId: r.student_id || "",
      program: r.program || "",
      email: r.email || "",
      phone: r.phone || "",
      office: r.receiving_office || "health",
      reason: r.reason || "",
      observations: r.development_details || "",
      recommendedAction: r.recommended_action || "",
      date: r.created_at ? new Date(r.created_at).toLocaleDateString("en-US") : "",
      dateSort: r.created_at ? r.created_at.split("T")[0] : "",
      by: r.created_by || "SDAO",
      status: r.status || "sent",
      urgent: false,
      attachments: r.attachments || [],
      timeline: r.timeline || [],
    };
  });

  return {
    ok: true,
    error: null,
    consultations: (cRes.data || []).map(mapConsultationRow),
    records: (rRes.data || []).map(mapMedicalRecordRow),
    appointments: (aRes.data || []).map(mapAppointmentRow),
    referrals: (refRes.data || []).map(mapReferralRow),
    documents: (dRes.data || []).map(interOfficeRowToHsoDocumentRequest),
    incomingReferrals: [...disciplineIncoming, ...sdaoIncoming],
    disciplineReferralsIncoming: disciplineIncoming,
    sdaoReferralsIncoming: sdaoIncoming,
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

  const certReason = String(r.certificate_reason ?? r.certificateReason ?? "").trim();
  const prescriptionDetail = String(r.prescription_detail ?? "").trim();
  const treatment = String(r.treatment ?? "").trim();
  const prescriptionCombined = prescriptionDetail || treatment;

  const serviceLabel =
    String(r.consultation_service ?? "").trim() || r.chief_complaint?.trim() || "—";

  return {
    id: String(r.id),
    student: r.student_name,
    studentId: String(r.student_id ?? "").trim(),
    type: visitTypeLabel(r.visit_type),
    followup: false,
    reason: r.chief_complaint?.trim() || "—",
    service: serviceLabel,
    date: dateLabel || "—",
    time: timeLabel,
    doctor: r.attended_by?.trim() || "—",
    status: st,
    bloodPressure: r.blood_pressure || "",
    temperature: r.temperature_c || "",
    heartRate: r.heart_rate_bpm || "",
    diagnosis: r.diagnosis || "",
    treatment,
    prescription: prescriptionCombined,
    prescriptionDetail,
    certificateReason: certReason,
    certReason,
    certificatePeriod: String(r.certificate_period ?? "").trim(),
    certificateStatus: String(r.certificate_status ?? "issued").trim() || "issued",
    consultationCreatedAt: r.created_at || null,
    consultationDateTimeLabel: formatConsultationDateTime(r.created_at),
    notes: String(r.diagnosis ?? "").trim(),
  };
}

function physicianChartJsonObject(raw) {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  return null;
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

  const updatedAtMs = r.updated_at ? new Date(r.updated_at).getTime() : 0;

  return {
    id: String(r.id),
    student: r.student_name,
    studentId: String(r.student_id ?? "").trim(),
    updatedAt: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
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
    physicianMedicalHistory: r.physician_medical_history?.trim() || "",
    physicianPhysicalExamination: r.physician_physical_examination?.trim() || "",
    physicianMedicalHistoryJson: physicianChartJsonObject(r.physician_medical_history_json),
    physicianPhysicalExaminationJson: physicianChartJsonObject(r.physician_physical_examination_json),
    physicianPrescriptionNotes: r.physician_prescription_notes?.trim() || "",
    physicianDocumentsNotes: r.physician_documents_notes?.trim() || "",
    physicianDocumentsAttachments: Array.isArray(r.physician_documents_attachments)
      ? r.physician_documents_attachments
      : [],
  };
}

export function mapAppointmentRow(r) {
  const d = r.appointment_date ? isoFromDateField(r.appointment_date) : "";
  const dateLabel = d ? formatShortDate(`${d}T12:00:00`) : "—";

  return {
    id: String(r.id),
    student: r.student_name,
    studentId: String(r.student_id ?? "").trim(),
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
    designation: String(r.designation || "").toLowerCase() || "physician",
    consultationType: r.consultation_type?.trim() || r.purpose?.trim() || "General Check-up",
    additionalComments: r.additional_comments?.trim() || "",
    workflowStatus: String(r.workflow_status || r.status || "booked").toLowerCase(),
    checkinCode: (() => {
      const v = r.check_in_code ?? r.checkin_code;
      if (v == null || v === "") return "";
      return String(v).trim();
    })(),
    checkinValidFrom: r.checkin_valid_from || null,
    checkinValidUntil: r.checkin_valid_until || null,
    checkedInAt: r.checked_in_at || null,
    queueNumber: r.queue_number ? Number(r.queue_number) : null,
    providerQueue: String(r.provider_queue || "").toLowerCase() || null,
    nurseVitals: r.nurse_vitals || null,
    nurseCompletedAt: r.nurse_assessment_completed_at || null,
    consultationStartedAt: r.consultation_started_at || null,
    consultationCompletedAt: r.consultation_completed_at || null,
  };
}

/**
 * Load a single appointment row by check-in code (handles CH-0001 vs 0001 and legacy checkin_code column).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} normalizedCode result of normalizeCheckinCode()
 */
export async function fetchAppointmentByCheckinCode(supabase, normalizedCode) {
  const variants = checkinLookupVariants(normalizedCode);
  if (!variants.length) return null;

  const attempt = async (column) => {
    const { data, error } = await supabase
      .from("health_appointments")
      .select("*")
      .in(column, variants)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { data, error };
  };

  let { data, error } = await attempt("check_in_code");
  if (data) return data;
  if (error) {
    console.warn("[fetchAppointmentByCheckinCode] check_in_code query failed:", error.message || error);
    const r2 = await attempt("checkin_code");
    if (r2.error) console.warn("[fetchAppointmentByCheckinCode] checkin_code query failed:", r2.error.message || r2.error);
    return r2.data || null;
  }
  return null;
}

function pickStudentNameField(v) {
  return String(v ?? "").trim();
}

function formatStudentRecordName(row) {
  if (!row || typeof row !== "object") return "";
  const full =
    pickStudentNameField(row.full_name) ||
    pickStudentNameField(row.name) ||
    pickStudentNameField(row.student_name) ||
    pickStudentNameField(row.display_name);
  if (full) return full;
  const first = pickStudentNameField(row.first_name);
  const last = pickStudentNameField(row.last_name);
  return [first, last].filter(Boolean).join(" ").trim();
}

/**
 * Roster lookup: health_appointments.student_id → students.student_id.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string | null | undefined} studentId
 */
/**
 * Roster row for inter-office referral form (name, school email, program).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string | null | undefined} studentId
 */
export async function fetchStudentRowForReferral(supabase, studentId) {
  const sid = String(studentId ?? "").trim();
  if (!sid || !supabase) return null;
  const { data, error } = await supabase
    .from("students")
    .select("student_id, full_name, first_name, last_name, program, email")
    .eq("student_id", sid)
    .maybeSingle();
  if (error) {
    console.warn("[fetchStudentRowForReferral]", error.message || error);
    return null;
  }
  if (!data) return null;
  return {
    studentId: String(data.student_id ?? "").trim(),
    studentName: formatStudentRecordName(data),
    schoolEmail: pickStudentNameField(data.email),
    program: pickStudentNameField(data.program),
  };
}

export async function fetchStudentNameByStudentId(supabase, studentId) {
  const sid = String(studentId ?? "").trim();
  if (!sid || !supabase) return "";
  const { data, error } = await supabase.from("students").select("*").eq("student_id", sid).maybeSingle();
  if (error) {
    const msg = String(error.message || error.code || "").toLowerCase();
    if (!msg.includes("does not exist") && !msg.includes("schema cache")) {
      console.warn("[fetchStudentNameByStudentId]", error.message || error);
    }
    return "";
  }
  if (!data) return "";
  return formatStudentRecordName(data);
}

/**
 * Use students table name when present (fixes empty health_appointments.student_name).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {ReturnType<typeof mapAppointmentRow>} mapped
 */
export async function enrichAppointmentWithStudentName(supabase, mapped) {
  if (!mapped || !supabase) return mapped;
  const resolved = await fetchStudentNameByStudentId(supabase, mapped.studentId);
  if (resolved) return { ...mapped, student: resolved };
  return mapped;
}

/**
 * Prefer `students.full_name` (or first/last) for every appointment with a student_id.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {ReturnType<typeof mapAppointmentRow>[]} appointments
 */
export async function enrichAppointmentsWithStudentNames(supabase, appointments) {
  if (!supabase || !Array.isArray(appointments) || appointments.length === 0) return appointments || [];
  const out = appointments.map((a) => ({ ...a }));
  const ids = [...new Set(out.map((a) => String(a.studentId || "").trim()).filter(Boolean))];
  await Promise.all(
    ids.map(async (sid) => {
      const name = await fetchStudentNameByStudentId(supabase, sid);
      if (!name) return;
      for (let i = 0; i < out.length; i += 1) {
        if (String(out[i].studentId) === sid) out[i] = { ...out[i], student: name };
      }
    }),
  );
  return out;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {ReturnType<typeof mapMedicalRecordRow>[]} records
 */
export async function enrichHealthRecordsWithStudentNames(supabase, records) {
  if (!supabase || !Array.isArray(records) || records.length === 0) return records || [];
  const out = records.map((r) => ({ ...r }));
  const ids = [...new Set(out.map((r) => String(r.studentId || "").trim()).filter(Boolean))];
  await Promise.all(
    ids.map(async (sid) => {
      const name = await fetchStudentNameByStudentId(supabase, sid);
      if (!name) return;
      for (let i = 0; i < out.length; i += 1) {
        if (String(out[i].studentId) === sid) out[i] = { ...out[i], student: name };
      }
    }),
  );
  return out;
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
export async function enrichConsultationsWithStudentNames(supabase, consultations) {
  if (!supabase || !Array.isArray(consultations) || consultations.length === 0) return consultations || [];
  const out = consultations.map((c) => ({ ...c }));
  const ids = [...new Set(out.map((c) => String(c.studentId || "").trim()).filter(Boolean))];
  await Promise.all(
    ids.map(async (sid) => {
      const name = await fetchStudentNameByStudentId(supabase, sid);
      if (!name) return;
      for (let i = 0; i < out.length; i += 1) {
        if (String(out[i].studentId) === sid) out[i] = { ...out[i], student: name };
      }
    }),
  );
  return out;
}

/**
 * Student demographics for read-only physician chart (mobile/student app is source of truth).
 * @param {Record<string, unknown> | null} data
 */
export function mapStudentRosterForChart(data) {
  if (!data || typeof data !== "object") return null;
  return {
    studentId: String(data.student_id ?? "").trim(),
    fullName: formatStudentRecordName(data),
    firstName: pickStudentNameField(data.first_name),
    lastName: pickStudentNameField(data.last_name),
    middleInitial: pickStudentNameField(data.middle_initial),
    course: pickStudentNameField(data.course),
    yearLevel: pickStudentNameField(data.year_level),
    address: pickStudentNameField(data.address),
    contactNo: pickStudentNameField(data.contact_no),
    birthdate: data.birthdate ?? "",
    age: pickStudentNameField(data.age),
    sex: pickStudentNameField(data.sex),
    maritalStatus: pickStudentNameField(data.marital_status),
    religion: pickStudentNameField(data.religion),
    emergencyContactName: pickStudentNameField(data.emergency_contact_name),
    emergencyRelationship: pickStudentNameField(data.emergency_relationship),
    emergencyContactNo: pickStudentNameField(data.emergency_contact_no),
    nationality: pickStudentNameField(data.nationality),
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string | null | undefined} studentId
 */
export async function fetchStudentRosterForChart(supabase, studentId) {
  const sid = String(studentId ?? "").trim();
  if (!sid || !supabase) return null;
  const { data, error } = await supabase.from("students").select("*").eq("student_id", sid).maybeSingle();
  if (error) {
    console.warn("[fetchStudentRosterForChart]", error.message || error);
    return null;
  }
  return mapStudentRosterForChart(data);
}

/**
 * Latest medical_record for a student (for physician chart draft).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string | null | undefined} studentId
 */
export async function fetchMedicalRecordRowForStudent(supabase, studentId) {
  const sid = String(studentId ?? "").trim();
  if (!sid || !supabase) return null;
  const { data, error } = await supabase
    .from("medical_records")
    .select("*")
    .eq("student_id", sid)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[fetchMedicalRecordRowForStudent]", error.message || error);
    return null;
  }
  return data ? mapMedicalRecordRow(data) : null;
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

function inferDesignationFromProfile(profile) {
  const raw = String(profile?.designation || "").trim().toLowerCase();
  if (["nurse", "physician", "dentist", "admin", "welfare_admin", "queue_display"].includes(raw)) return raw;

  const roleRaw = String(profile?.role || "").trim().toLowerCase();
  if (roleRaw.includes("nurse")) return "nurse";
  if (roleRaw.includes("dentist")) return "dentist";
  if (roleRaw.includes("physician") || roleRaw.includes("doctor")) return "physician";
  if (roleRaw.includes("admin")) return "admin";
  return "admin";
}

function mapProfileToStaffRow(profile) {
  const designation = inferDesignationFromProfile(profile);
  const first = String(profile?.first_name || "").trim();
  const middle = String(profile?.middle_initial || "").trim();
  const last = String(profile?.last_name || "").trim();
  const middleToken = middle ? `${middle}.` : "";
  const fullName = [first, middleToken, last].filter(Boolean).join(" ").trim() || "HSO Staff";
  const role = designation === "admin"
    ? "Admin"
    : designation === "nurse"
      ? "Nurse"
      : designation === "dentist"
        ? "Dentist"
        : "Physician";
  const titlePrefix = designation === "nurse" ? "Nurse" : designation === "admin" ? "" : "Dr.";
  const status = String(profile?.account_status || "").toLowerCase() === "approved" ? "on-duty" : "off-duty";

  return {
    id: String(profile.id),
    name: fullName,
    titlePrefix,
    role,
    designation,
    status,
    patientLoad: 0,
    email: String(profile?.email || "").trim() || "—",
    lastLogin: profile?.updated_at ? formatShortDate(profile.updated_at) : "—",
    schedule: { mon: "—", tue: "—", wed: "—", thu: "—", fri: "—", sat: "—" },
    shift: "—",
    requestedAt: profile?.created_at ? formatShortDate(profile.created_at) : "—",
    accountStatus: String(profile?.account_status || "pending").toLowerCase(),
  };
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
export async function loadHsoStaffFromSupabase(supabase) {
  const selectVariants = [
    "id, first_name, middle_initial, last_name, office, role, account_status, updated_at, created_at, designation, email",
    "id, first_name, middle_initial, last_name, office, role, account_status, updated_at, created_at",
  ];
  let data = null;
  let error = null;
  for (const selectCols of selectVariants) {
    const res = await supabase
      .from("profiles")
      .select(selectCols)
      .eq("office", "health")
      .order("created_at", { ascending: false });
    if (!res.error) {
      data = res.data;
      error = null;
      break;
    }
    error = res.error;
  }

  if (error) {
    return {
      ok: false,
      error,
      staffRows: [],
      pendingApprovals: [],
    };
  }

  const staffRows = (data || [])
    .filter((p) => {
      const des = String(p?.designation || "").trim().toLowerCase();
      const r = String(p?.role || "").trim();
      if (des === "welfare_admin") return false;
      if (r === "Super Admin") return false;
      return true;
    })
    .map(mapProfileToStaffRow);
  return {
    ok: true,
    error: null,
    staffRows,
    pendingApprovals: staffRows.filter((r) => r.accountStatus === "pending"),
  };
}

