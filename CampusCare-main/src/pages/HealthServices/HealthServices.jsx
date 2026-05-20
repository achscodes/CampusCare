import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileHeart,
  FileText,
  Folder,
  Lock,
  LogOut,
  Mail,
  Phone,
  Plus,
  Printer,
  Route,
  Send,
  Smile,
  Sparkles,
  Stethoscope,
  Thermometer,
  Timer,
  Upload,
  UserPlus,
  Users,
  CheckCircle,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { jsPDF } from "jspdf";
import { showToast } from "../../utils/toast";
import { buildStationAnnouncement } from "../../utils/hsoQueueAnnounceText";
import { primeSpeechSynthesis, speakQueueAnnouncement } from "../../utils/hsoQueueSpeech";
import Sidebar from "../../components/Sidebar/Sidebar";
import OfficeHeader from "../../components/OfficeHeader/OfficeHeader";
import StaffNotificationBell from "../../components/common/StaffNotificationBell";
import CCModal from "../../components/common/CCModal";
import WeeklyStaffSchedulePanel from "../../components/staffScheduling/WeeklyStaffSchedulePanel";
import InterOfficeNewDocumentRequestModal from "../../components/interOffice/InterOfficeNewDocumentRequestModal";
import { useDONotificationsRealtime } from "../../hooks/useDONotificationsRealtime";
import { useRealtimeHsoData } from "../../hooks/useRealtimeHsoData";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import {
  loadHsoFromSupabase,
  loadHsoStaffFromSupabase,
  mapAppointmentRow,
  mapConsultationRow,
  mapMedicalRecordRow,
  fetchAppointmentByCheckinCode,
  enrichAppointmentWithStudentName,
  enrichAppointmentsWithStudentNames,
  enrichHealthRecordsWithStudentNames,
  enrichConsultationsWithStudentNames,
  fetchStudentRosterForChart,
  fetchMedicalRecordRowForStudent,
  fetchStudentRowForReferral,
  mapReferralRow,
} from "../../services/hsoSupabase";
import {
  interOfficeDocumentRequestToInsert,
  interOfficeRowToHsoDocumentRequest,
} from "../../services/interOfficeDocumentRequests";
import { appendEvidenceToInterOfficeRequest } from "../../services/interOfficeDocumentEvidence";
import {
  uploadPhysicianChartDocument,
  deletePhysicianChartDocument,
} from "../../services/physicianChartDocuments";
import { logoutCampusCare } from "../../utils/campusCareAuth";
import { PROFILE_SETTINGS_PATH_HEALTH } from "../../utils/profileSettingsRoutes";
import { useLiveCampusCareSession } from "../../hooks/useLiveCampusCareSession";
import { canCreateDocumentRequest, labelForOfficeKey } from "../../constants/documentRequestAccess";
import { NU_PROGRAM_OPTIONS } from "../../data/nuPrograms";
import "../DODashboard/DO.css";
import "../Admin/Admin.css";
import UserManagement from "../Admin/UserManagement";
import "./HealthServices.css";
import { sanitizeCheckinCodeInput, sanitizeDigitsOnlyInput, sanitizePersonNameInput } from "../../utils/signupFieldValidation";
import { hsoDesignationLabel, normalizeHsoDesignation } from "../../utils/hsoAccess";
import { HS_NOTIFICATIONS } from "./hsoNavConfig";
import { buildHealthNavItems, getHealthAllowedNavSet } from "./hsoSidebarNav";
import DentistOdontogram from "./DentistOdontogram";
import {
  HSO_WORKFLOW_STATUS,
  computeCheckinWindow,
  consultationTypeOptions,
  designationToService,
  checkinLookupVariants,
  formatCheckinCodeFromNumber,
  normalizeCheckinCode,
  normalizeWorkflowStatus,
  nowInWindow,
  statusLabel,
} from "../../utils/hsoWorkflow";
import {
  INTER_OFFICE_DOC_STATUS,
  DISCIPLINE_REFERRAL_STATUS,
  isDocRequestPendingApproval,
  isDocRequestDeclined,
  isDocRequestApprovedForFulfillment,
  normalizeInterOfficeDocStatus,
  canReceivingOfficeUploadDoc,
  canReceivingOfficeReviewReferral,
  isReferralPendingPartnerReview,
  normalizeReferralStatus,
} from "../../utils/interOfficeWorkflow";

/** Next ticket uses max(queue_number) from today only so old appointments do not inflate the counter. */
function maxQueueNumberForToday(appointmentsList, nurseVisitors) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  let max = 0;
  for (const a of appointmentsList) {
    const qn = Number(a.queueNumber || 0);
    if (!qn) continue;
    const at = a.checkedInAt ? new Date(a.checkedInAt) : null;
    if (at && !Number.isNaN(at.getTime()) && at >= start && at < end) max = Math.max(max, qn);
  }
  for (const v of nurseVisitors) {
    const qn = Number(v.queueNumber || 0);
    if (!qn) continue;
    const at = v.arrivedAt ? new Date(v.arrivedAt) : null;
    if (at && !Number.isNaN(at.getTime()) && at >= start && at < end) max = Math.max(max, qn);
  }
  return max;
}

function appointmentStudentLabel(a) {
  const s = String(a?.student ?? "").trim();
  if (s) return s;
  const sid = String(a?.studentId ?? "").trim();
  if (sid) return `Student ID ${sid}`;
  return "";
}

function formatRosterBirthdate(v) {
  if (v == null || v === "") return "—";
  const d = v instanceof Date ? v : new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-US");
  return String(v);
}

function workflowAppointmentReason(a) {
  const t = String(a.consultationType || a.purpose || a.service || "").trim();
  return t || "—";
}

/** Map DB / JSON vitals to display fields (camelCase or snake_case). */
function normalizeNurseVitalsDisplay(vitals) {
  if (!vitals || typeof vitals !== "object") return null;
  const v = vitals;
  return {
    temperature: v.temperature ?? v.temp_c ?? v.temp ?? "",
    bloodPressure: v.bloodPressure ?? v.blood_pressure ?? "",
    pulse: v.pulse ?? v.heart_rate ?? v.heartRate ?? "",
    respiratoryRate: v.respiratoryRate ?? v.respiratory_rate ?? v.resp_rate ?? "",
    weightKg: v.weightKg ?? v.weight_kg ?? "",
    heightCm: v.heightCm ?? v.height_cm ?? "",
    spo2: v.spo2 ?? v.o2 ?? v.oxygen_saturation ?? v.oxygenSaturation ?? "",
  };
}

const EMPTY_PHYSICIAN_MEDICAL_HISTORY = {
  previousIllness: "",
  allergy: "",
  asthma: "",
  tb: "",
  hpn: "",
  gynecologicalObstetrical: "",
  smoker: "",
  alcoholicDrinker: "",
  diabetesMellitus: "",
  heartAilment: "",
  kidneyDisease: "",
};

const EMPTY_PHYSICIAN_PHYSICAL_EXAM = {
  skin: "",
  eyesOd: "",
  eyesOs: "",
  earsAd: "",
  earsAs: "",
  nose: "",
  throat: "",
  heart: "",
  lungs: "",
  abdomen: "",
  extremities: "",
  deformities: "",
  otherPertinentFindings: "",
};

const PHYSICIAN_MEDICAL_HISTORY_FIELDS = [
  { key: "previousIllness", label: "History of Previous Illness/Surgical Operation" },
  { key: "allergy", label: "Allergy" },
  { key: "asthma", label: "Asthma" },
  { key: "tb", label: "TB" },
  { key: "hpn", label: "HPN (Hypertension)" },
  { key: "gynecologicalObstetrical", label: "Gynecological/Obstetrical" },
  { key: "smoker", label: "Smoker" },
  { key: "alcoholicDrinker", label: "Alcoholic Drinker" },
  { key: "diabetesMellitus", label: "Diabetes Mellitus" },
  { key: "heartAilment", label: "Heart Ailment" },
  { key: "kidneyDisease", label: "Kidney Disease" },
];

const PHYSICIAN_PHYSICAL_EXAM_FIELDS = [
  { key: "skin", label: "Skin" },
  { key: "eyesOd", label: "Eyes — O.D. (right)" },
  { key: "eyesOs", label: "Eyes — O.S. (left)" },
  { key: "earsAd", label: "Ears — A.D. (right)" },
  { key: "earsAs", label: "Ears — A.S. (left)" },
  { key: "nose", label: "Nose" },
  { key: "throat", label: "Throat" },
  { key: "heart", label: "Heart" },
  { key: "lungs", label: "Lungs" },
  { key: "abdomen", label: "Abdomen" },
  { key: "extremities", label: "Extremities" },
  { key: "deformities", label: "Deformities" },
  { key: "otherPertinentFindings", label: "Other Pertinent Findings" },
];

function medicalHistoryDraftFromRecord(rec) {
  const json = rec?.physicianMedicalHistoryJson;
  if (json && typeof json === "object") {
    return { ...EMPTY_PHYSICIAN_MEDICAL_HISTORY, ...json };
  }
  const legacy = String(rec?.physicianMedicalHistory || "").trim();
  if (legacy) return { ...EMPTY_PHYSICIAN_MEDICAL_HISTORY, previousIllness: legacy };
  return { ...EMPTY_PHYSICIAN_MEDICAL_HISTORY };
}

function physicalExamDraftFromRecord(rec) {
  const json = rec?.physicianPhysicalExaminationJson;
  if (json && typeof json === "object") {
    return { ...EMPTY_PHYSICIAN_PHYSICAL_EXAM, ...json };
  }
  const legacy = String(rec?.physicianPhysicalExamination || "").trim();
  if (legacy) return { ...EMPTY_PHYSICIAN_PHYSICAL_EXAM, otherPertinentFindings: legacy };
  return { ...EMPTY_PHYSICIAN_PHYSICAL_EXAM };
}

function patientRecordDocUrlIsPdf(url) {
  return /\.pdf(\?|$)/i.test(String(url || ""));
}

function patientRecordDocUrlIsImage(url) {
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(String(url || ""));
}

const PAGE_META = {
  dashboard: {
    title: "Admin Dashboard",
    subtitle: "Operational overview of HSO queues, staffing, and service delivery",
  },
  userManagement: {
    title: "User Management",
    subtitle: "Manage HSO staff accounts, roles, and account status",
  },
  staffScheduling: {
    title: "Staff Scheduling",
    subtitle: "Manage nurse/physician/dentist shifts and assignment coverage",
  },
  checkin: {
    title: "Check-in Desk",
    subtitle: "Validate check-in codes and issue queue numbers for nurse assessment",
  },
  queue: {
    title: "Queue Management",
    subtitle: "Move students through nurse and provider queues in real time",
  },
  consultation: {
    title: "Consultations",
    subtitle: "Provider queue and findings logging for physician and dentist sessions",
  },
  visits: {
    title: "Student Visits",
    subtitle: "Record and manage student health consultations and medical visits",
  },
  records: {
    title: "Medical Records",
    subtitle: "Manage student medical records and health information",
  },
  appointments: {
    title: "Appointments",
    subtitle: "Medical appointments and schedules",
  },
  nurseStation: {
    title: "Inter-Office Coordination",
    subtitle:
      "Document requests and student referrals between welfare departments — transfer information so offices can coordinate student support.",
  },
  referrals: {
    title: "Referrals",
    subtitle: "Refer students to partner departments and track incoming referrals sent to Health Services",
  },
  docrequests: {
    title: "Document Requests",
    subtitle: "Inter-office document exchange for HSO, Discipline Office (DO), and Student Development (SDAO)",
  },
  reports: {
    title: "Reports & Analytics",
    subtitle: "Health services statistics, metrics, and insights",
  },
  queueDisplay: {
    title: "Queue Display",
    subtitle: "Patient-facing queue board for TV monitor display",
  },
  dentalQueue: {
    title: "Queue Management",
    subtitle: "Live ticketing in Dentist Station.",
  },
  dentalRecords: {
    title: "Patient Records",
    subtitle: "Dental history, charts and follow-ups.",
  },
  dentalChart: {
    title: "Dental Dashboard",
    subtitle: "Charting, procedures and follow-ups.",
  },
  dentalFollowups: {
    title: "Follow-up Appointments",
    subtitle: "Recall visits, post-procedure reviews and check-backs.",
  },
};

const REPORTS_CONCERNS_ROWS = [];

function pillClass(status) {
  const s = String(status).toLowerCase();
  if (s.includes("completed") || s.includes("complete") || s.includes("received")) return "hs-pill hs-pill-completed";
  if (s.includes("cancelled") || s.includes("canceled")) return "hs-pill hs-pill-waiting";
  if (s.includes("moved")) return "hs-pill hs-pill-ongoing";
  if (s.includes("uploaded")) return "hs-pill hs-pill-ongoing";
  if (s.includes("ongoing")) return "hs-pill hs-pill-ongoing";
  if (s.includes("waiting")) return "hs-pill hs-pill-waiting";
  if (s.includes("scheduled")) return "hs-pill hs-pill-scheduled";
  if (s.includes("confirmed")) return "hs-pill hs-pill-ongoing";
  if (s.includes("pending")) return "hs-pill hs-pill-waiting";
  if (s.includes("declined") || s.includes("rejected")) return "hs-pill hs-pill-waiting";
  if (s.includes("approved")) return "hs-pill hs-pill-completed";
  return "hs-pill hs-pill-waiting";
}

function formatVisitDateLabel(d = new Date()) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function consultStatusToLabel(status) {
  const s = String(status).toLowerCase();
  if (s === "pending") return "Pending";
  if (s === "completed" || s === "complete") return "Complete";
  if (s === "moved") return "Moved";
  if (s === "cancelled" || s === "canceled") return "Cancelled";
  if (s === "ongoing") return "Ongoing";
  if (s === "waiting") return "Waiting";
  if (s === "scheduled") return "Scheduled";
  if (!status) return "Pending";
  return String(status).replace(/^./, (c) => c.toUpperCase());
}

function prescriptionRowListPreview(text) {
  const t = String(text || "").trim().replace(/\s+/g, " ");
  if (!t) return "—";
  return t.length > 100 ? `${t.slice(0, 97)}…` : t;
}

/** Compare student IDs case-insensitively (trim whitespace). */
function normalizeStudentIdMatch(id) {
  return String(id ?? "").trim().toLowerCase();
}

/** Latest prescription among saved chart notes and consultation visits (newest timestamp wins). */
function latestPrescriptionSnapshot(studentId, consultationRows, recRow) {
  const k = normalizeStudentIdMatch(studentId);
  if (!k) return { text: "", at: 0, detail: "", source: "" };
  let best = { text: "", at: 0, detail: "", source: "" };
  const mrRx = String(recRow?.physicianPrescriptionNotes ?? "").trim();
  const mrAt = Number(recRow?.updatedAt) || 0;
  if (mrRx) {
    best = { text: mrRx, at: mrAt, detail: "Medical record (saved chart)", source: "record" };
  }
  for (const c of consultationRows) {
    if (normalizeStudentIdMatch(c.studentId) !== k) continue;
    const txt = String(c.prescription || c.prescriptionDetail || c.treatment || "").trim();
    if (!txt) continue;
    const t = new Date(c.consultationCreatedAt || 0).getTime();
    if (!Number.isFinite(t)) continue;
    const detail = `${c.date || "—"} · ${c.service || c.reason || "Consultation"}`;
    if (t >= best.at) {
      best = { text: txt, at: t, detail, source: "consultation" };
    }
  }
  return best;
}

const PHYSICIAN_ANALYTICS_SCHOOLS = ["SECA", "SASE", "SBMA"];

const PHYSICIAN_ANALYTICS_SCHOOL_COLORS = {
  SECA: "#2563eb",
  SASE: "#10b981",
  SBMA: "#f59e0b",
};

const HSO_ANALYTICS_MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const HSO_ANALYTICS_PIE_COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#64748b",
  "#84cc16",
];

/** Peak month: count Health Services visits by calendar month (consultation recorded date). */
function peakMonthSeriesForYearFromConsultations(consultsFilteredForPeriod, year) {
  const counts = Array(12).fill(0);
  consultsFilteredForPeriod.forEach((c) => {
    const raw = c?.consultationCreatedAt;
    if (!raw) return;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) return;
    counts[d.getMonth()] += 1;
  });
  return HSO_ANALYTICS_MONTH_SHORT.map((month, i) => ({ month, total: counts[i] }));
}

function hsoAnalyticsPeriodRange(period) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  let start;
  if (period === "today") {
    start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  } else if (period === "month") {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  } else {
    start = new Date(end.getFullYear(), 0, 1);
  }
  return { start, end };
}

function appointmentDateInPhysicianAnalyticsRange(a, start, end) {
  if (!a?.dateSort) return false;
  const d = new Date(`${a.dateSort}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d >= start && d <= end;
}

function consultationDateInPhysicianAnalyticsRange(c, start, end) {
  const raw = c?.consultationCreatedAt;
  if (!raw) return false;
  const d = new Date(raw);
  return !Number.isNaN(d.getTime()) && d >= start && d <= end;
}

function schoolBucketFromProgram(program) {
  const p = String(program || "").toUpperCase();
  for (const s of PHYSICIAN_ANALYTICS_SCHOOLS) {
    if (p.includes(s)) return s;
  }
  return null;
}

function physicianPeakHourSeriesFromAppointments(appts) {
  const labels = ["8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p"];
  const slots = new Map(labels.map((l) => [l, 0]));
  const toLabel = (time) => {
    const raw = String(time || "").trim();
    if (!raw) return null;
    const m24 = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
    if (m24) {
      let h = Number(m24[1]);
      const mer = h >= 12 ? "p" : "a";
      h = h % 12 || 12;
      return `${h}${mer}`;
    }
    const m12 = raw.toLowerCase().match(/^([1-9]|1[0-2])(?::([0-5]\d))?\s*([ap])m?$/);
    if (m12) return `${m12[1]}${m12[3]}`;
    return null;
  };
  appts.forEach((a) => {
    const lbl = toLabel(a.time);
    if (!lbl || !slots.has(lbl)) return;
    slots.set(lbl, (slots.get(lbl) || 0) + 1);
  });
  return labels.map((hour) => ({ hour, total: slots.get(hour) || 0 }));
}

function hsoAnalyticsPeriodLabel(period) {
  if (period === "today") return "Today";
  if (period === "month") return "This month";
  return "This year";
}

/** Identifies rows created from Save chart (prescription snapshot); separate from consultation_service label. */
const CHART_SAVE_CHIEF_COMPLAINT = "Physician chart (saved)";

/** Timeline / cards: physician name with Dr. prefix, no "Seen by". */
function formatPhysicianTimelineDoctor(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "—") return "";
  if (/^dr\.?\s/i.test(s)) {
    const rest = s.replace(/^dr\.?\s*/i, "").trim();
    return rest ? `Dr. ${rest}` : "Dr.";
  }
  return `Dr. ${s}`;
}

/** Clear message when PostgREST reports missing columns on health_consultations (migration not applied). */
function formatHealthConsultationsDbError(err, shortFallback) {
  const raw = String(err?.message ?? err ?? "").trim();
  if (/student_name|schema cache|PGRST206/i.test(raw)) {
    return `${shortFallback} Apply supabase/migrations/20260516150000_ensure_health_consultations_columns.sql in the Supabase SQL Editor, then reload the API schema (Project Settings → API).`;
  }
  return raw || shortFallback;
}

function parseIsoDateOnly(iso) {
  if (!iso || typeof iso !== "string") return null;
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatLastCheckupLabel(isoDateInput) {
  const dt = parseIsoDateOnly(isoDateInput);
  return dt ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
}

function recordRowLastDate(row) {
  const iso = row.lastSort || row.last;
  const fromIso = parseIsoDateOnly(typeof iso === "string" && iso.includes("-") && iso.length <= 12 ? iso : "");
  if (fromIso) return fromIso;
  const parsed = Date.parse(row.last);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

function EmptyStateMessage({
  icon: Icon = AlertCircle,
  title = "No data available.",
  description = "",
  compact = false,
}) {
  return (
    <div className={`hs-empty-state${compact ? " hs-empty-state--compact" : ""}`} role="status" aria-live="polite">
      <div className="hs-empty-state-icon" aria-hidden>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <p className="hs-empty-state-title">{title}</p>
      {description ? <p className="hs-empty-state-description">{description}</p> : null}
    </div>
  );
}

const INITIAL_NEW_CONSULT = {
  studentName: "",
  studentId: "",
  visitType: "walkin",
  visitTime: "",
  chiefComplaint: "",
  bloodPressure: "",
  temperature: "",
  heartRate: "",
  diagnosis: "",
  treatment: "",
};

const INITIAL_NEW_RECORD = {
  studentName: "",
  studentId: "",
  program: "",
  bloodType: "",
  allergyCategory: "None",
  allergyOther: "",
  chronicCategory: "None",
  chronicOther: "",
  lastCheckup: "",
  email: "",
  phone: "",
  emergencyContact: "",
  medications: "",
  weight: "",
  bloodPressure: "",
  height: "",
  notes: "",
};

const INITIAL_NEW_APPT = {
  studentName: "",
  studentId: "",
  email: "",
  phone: "",
  date: "",
  time: "",
  designation: "physician",
  consultationType: "General Check-up",
  additionalComments: "",
  purpose: "General Check-up",
};

const INITIAL_NURSE_TRIAGE = {
  temperature: "",
  bloodPressure: "",
  pulse: "",
  respiratoryRate: "",
  spo2: "",
  heightCm: "",
  weightKg: "",
  remarks: "",
};

const INITIAL_NEW_REFERRAL = {
  studentName: "",
  studentId: "",
  email: "",
  program: "",
  receivingOffice: "Discipline Office (DO)",
  reason: "",
};

const REFERRAL_STUDENT_ID_YEARS = new Set([2022, 2023, 2024, 2025, 2026, 2027]);

/** Formats nurse input as YYYY-####### (year then hyphen then 6–7 digit unique id). */
function formatReferralStudentIdInput(raw) {
  const digits = String(raw ?? "")
    .replace(/\D/g, "")
    .slice(0, 11);
  if (!digits.length) return "";
  const y = digits.slice(0, 4);
  const uid = digits.slice(4, 11);
  if (digits.length <= 4) return y;
  return `${y}-${uid}`;
}

function isCompleteReferralStudentId(id) {
  const s = String(id ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{6,7})$/);
  if (!m) return false;
  const yr = Number(m[1]);
  return REFERRAL_STUDENT_ID_YEARS.has(yr);
}

const HS_REFERRAL_OFFICES = ["Discipline Office (DO)", "SDAO — Student Development"];

const HS_BLOOD_TYPE_OPTIONS = ["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const HS_ALLERGY_OPTIONS = ["None", "Food", "Drug", "Environmental", "Other"];

const HS_CHRONIC_OPTIONS = ["None", "Asthma", "Diabetes", "Hypertension", "Heart disease", "Other"];

const HS_VISIT_DISPOSITIONS = [
  { value: "complete", label: "Complete" },
  { value: "pending", label: "Pending" },
  { value: "moved", label: "Moved" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * @param {{ embedReportsOnly?: boolean }} props
 * When true, renders only Reports & Analytics (no office sidebar/header) for welfare AdminPage embed.
 */
function HealthServices({ embedReportsOnly = false } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState(embedReportsOnly ? "reports" : "dashboard");
  const [search, setSearch] = useState("");
  const [visitTab, setVisitTab] = useState("all");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [newConsultOpen, setNewConsultOpen] = useState(false);
  const [consultationRows, setConsultationRows] = useState(() => []);
  const consultationRowsRef = useRef(consultationRows);
  consultationRowsRef.current = consultationRows;
  const [newConsultForm, setNewConsultForm] = useState(() => ({ ...INITIAL_NEW_CONSULT }));
  const [consultSaving, setConsultSaving] = useState(false);
  const [consultDetail, setConsultDetail] = useState(null);
  const [recordDetail, setRecordDetail] = useState(null);
  const [newApptOpen, setNewApptOpen] = useState(false);
  const [newReferralOpen, setNewReferralOpen] = useState(false);
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [hsoNewDocModalKey, setHsoNewDocModalKey] = useState(0);
  const [docStatusFilter, setDocStatusFilter] = useState("all");
  const [healthRecordsRows, setHealthRecordsRows] = useState(() => []);
  const [newRecordOpen, setNewRecordOpen] = useState(false);
  const [newRecordForm, setNewRecordForm] = useState(() => ({ ...INITIAL_NEW_RECORD }));
  const [recordSaving, setRecordSaving] = useState(false);
  const [recordFilterOpen, setRecordFilterOpen] = useState(false);
  const [recordFilterStatus, setRecordFilterStatus] = useState("all");
  const [recordFilterDateFrom, setRecordFilterDateFrom] = useState("");
  const [recordFilterDateTo, setRecordFilterDateTo] = useState("");
  const [recordFilterStudent, setRecordFilterStudent] = useState("");
  const [certificateSearch, setCertificateSearch] = useState("");
  const [appointmentsList, setAppointmentsList] = useState(() => []);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [referralsList, setReferralsList] = useState(() => []);
  const [disciplineIncomingReferrals, setDisciplineIncomingReferrals] = useState(() => []);
  const [sdaoIncomingReferrals, setSdaoIncomingReferrals] = useState(() => []);
  const [adminStaffRows, setAdminStaffRows] = useState(() => []);
  const [pendingApprovalRows, setPendingApprovalRows] = useState(() => []);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [docRequestsRows, setDocRequestsRows] = useState(() => []);
  const [selectedDocRequest, setSelectedDocRequest] = useState(null);
  const [reportsTimeFilter, setReportsTimeFilter] = useState("week");
  const [hsoAnalyticsPeriod, setHsoAnalyticsPeriod] = useState("today");
  const [studentProgramsByStudentId, setStudentProgramsByStudentId] = useState(() => new Map());
  const [hsoLoading, setHsoLoading] = useState(false);
  const [hsoLoadError, setHsoLoadError] = useState(null);
  const [newApptForm, setNewApptForm] = useState(() => ({ ...INITIAL_NEW_APPT }));
  const [newReferralForm, setNewReferralForm] = useState(() => ({ ...INITIAL_NEW_REFERRAL }));
  const [referralStudentLookup, setReferralStudentLookup] = useState(() => ({ status: "idle", message: "" }));
  const [apptSaving, setApptSaving] = useState(false);
  const [referralSaving, setReferralSaving] = useState(false);
  const [docSaving, setDocSaving] = useState(false);
  const [docAcceptingUploadBusy, setDocAcceptingUploadBusy] = useState(false);
  const [checkinCodeInput, setCheckinCodeInput] = useState("");
  const [nurseQueueCounter, setNurseQueueCounter] = useState(0);
  const [checkinPreview, setCheckinPreview] = useState(null);
  const [nurseStationOnline, setNurseStationOnline] = useState(false);
  const [physicianStationOnline, setPhysicianStationOnline] = useState(false);
  const [dentistStationOnline, setDentistStationOnline] = useState(false);
  const [physicianRecordsStudentId, setPhysicianRecordsStudentId] = useState(null);
  const [activeNurseSessionId, setActiveNurseSessionId] = useState(null);
  const [nurseTriageForm, setNurseTriageForm] = useState(() => ({ ...INITIAL_NURSE_TRIAGE }));
  const [transferTarget, setTransferTarget] = useState("physician");
  const [nurseVisitors, setNurseVisitors] = useState(() => []);
  const [newVisitorForm, setNewVisitorForm] = useState({ name: "", contactNumber: "", purpose: "" });
  const [addVisitorOpen, setAddVisitorOpen] = useState(false);
  const [nurseRecentActivity, setNurseRecentActivity] = useState(() => []);
  const [recordsQuery, setRecordsQuery] = useState("");
  const [visitorArchive, setVisitorArchive] = useState(() => []);
  const [physicianPanelTab, setPhysicianPanelTab] = useState("vitals");
  const [physicianCertModalOpen, setPhysicianCertModalOpen] = useState(false);
  const [physicianChartOpen, setPhysicianChartOpen] = useState(false);
  const [physicianChartStudentId, setPhysicianChartStudentId] = useState(null);
  const [physicianChartRoster, setPhysicianChartRoster] = useState(null);
  const [physicianChartDraft, setPhysicianChartDraft] = useState({
    medicalHistory: { ...EMPTY_PHYSICIAN_MEDICAL_HISTORY },
    physicalExam: { ...EMPTY_PHYSICIAN_PHYSICAL_EXAM },
    prescriptionNotes: "",
    documentsNotes: "",
  });
  const [physicianChartSaving, setPhysicianChartSaving] = useState(false);
  const [physicianChartLoading, setPhysicianChartLoading] = useState(false);
  const [physicianChartAttachments, setPhysicianChartAttachments] = useState([]);
  /** Snapshot from fetch when chart opens — drives “latest” Rx vs visits before parent state merges */
  const [physicianChartRecordSnapshot, setPhysicianChartRecordSnapshot] = useState(null);
  const [physicianChartDocUploading, setPhysicianChartDocUploading] = useState(false);
  const physicianChartFileInputRef = useRef(null);
  const [certExpandedStudentId, setCertExpandedStudentId] = useState(null);
  const [physicianRecordsSubTab, setPhysicianRecordsSubTab] = useState("timeline");
  const [physicianRecordDocPreview, setPhysicianRecordDocPreview] = useState(null);
  const [physicianRecordsRxExpandedId, setPhysicianRecordsRxExpandedId] = useState(null);
  const [dentalRecordsSelectedId, setDentalRecordsSelectedId] = useState(null);
  const [dentalRecordsSearch, setDentalRecordsSearch] = useState("");
  const [dentalPatientTab, setDentalPatientTab] = useState("procedures");
  const [dentalOdontogramArch, setDentalOdontogramArch] = useState("permanent");
  const [dentalOdontogramPaint, setDentalOdontogramPaint] = useState("healthy");
  const [dentalToothStatus, setDentalToothStatus] = useState(() => ({
    16: "caries",
    26: "filled",
    36: "filled",
    48: "missing",
  }));
  const [dentalProcedurePick, setDentalProcedurePick] = useState("Cleaning");
  const [dentalFollowupSearch, setDentalFollowupSearch] = useState("");
  const [physicianConsultForm, setPhysicianConsultForm] = useState({
    diagnosis: "",
    prescription: "",
    notes: "",
    certReason: "",
    certFrom: "",
    certUntil: "",
    certRecommendation: "",
  });
  const recordFiltersSnapshot = useRef(null);

  const queueStationStatusBadge = (online) => (
    <div
      className={`hs-queue-station-status ${online ? "hs-queue-station-status--online" : "hs-queue-station-status--offline"}`}
      role="status"
      aria-live="polite"
    >
      <span className="hs-queue-station-status__dot-wrap" aria-hidden>
        <span className="hs-queue-station-status__dot" />
      </span>
      <span className="hs-queue-station-status__label">{online ? "Online" : "Offline"}</span>
    </div>
  );

  const session = useLiveCampusCareSession();

  useDONotificationsRealtime();
  const canInterOfficeDocRequest = canCreateDocumentRequest(session?.office);
  const userDesignation = normalizeHsoDesignation(session?.designation);
  const isNurseUser = userDesignation === "nurse";
  const isPhysicianUser = userDesignation === "physician";
  const isDentistUser = userDesignation === "dentist";
  const allowedNavSet = useMemo(() => getHealthAllowedNavSet(userDesignation), [userDesignation]);
  const healthNavItems = useMemo(
    () => buildHealthNavItems({ designation: userDesignation, canInterOfficeDocRequest }),
    [userDesignation, canInterOfficeDocRequest],
  );

  const userName = session?.name || "Priscilla C. Pelayo";
  const userRole = `${hsoDesignationLabel(userDesignation)} · ${session?.role || "Staff"}`;

  // --- Nurse side page metadata ---
  const nurseMetaByNav = {
    dashboard: { title: "Dashboard", subtitle: "Nurse station overview and patient management" },
    checkin: { title: "Patient Check-In", subtitle: "Nurse station overview and patient management" },
    queue: { title: "Queue Management", subtitle: "Live ticketing across all stations." },
    docrequests: {
      title: "Document Request",
      subtitle:
        "Requests between HSO, Discipline Office, and SDAO only. This tab does not handle student records.",
    },
    referrals: {
      title: "Referrals",
      subtitle:
        "Refer students from HSO to partner departments and review referrals sent from other departments to HSO.",
    },
    records: { title: "Patient Records", subtitle: "Read-only view for nurses - diagnoses are restricted to physicians." },
    reports: { title: "Reports & Analytics", subtitle: "Clinic visits, programs, schools, and wait times." },
  };
  // --- Physician side page metadata ---
  const physicianMetaByNav = {
    dashboard: { title: "Physician Workspace", subtitle: "Review vitals, consult patients, manage prescriptions." },
    visits: { title: "Physician Queue", subtitle: "Manage patient queue and flow." },
    records: { title: "Patient Records", subtitle: "Full clinical history with prescriptions and vitals." },
    consultation: { title: "Consultation", subtitle: "Review vitals, consult patients, manage prescriptions." },
    appointments: { title: "Medical Certificates", subtitle: "Issue and track medical certifications." },
    reports: { title: "Reports & Analytics", subtitle: "Clinic visits, programs, schools, and wait times for your filters." },
  };
  // --- Dentist side page metadata ---
  const dentistMetaByNav = {
    dashboard: { title: "Dentist Dashboard", subtitle: "Track patients, procedures and follow-ups." },
    dentalQueue: { title: "Queue Management", subtitle: "Live ticketing in Dentist Station." },
    dentalRecords: { title: "Patient Records", subtitle: "Dental history, charts and follow-ups." },
    dentalChart: { title: "Dental Dashboard", subtitle: "Charting, procedures and follow-ups." },
    dentalFollowups: { title: "Follow-up Appointments", subtitle: "Recall visits, post-procedure reviews and check-backs." },
    reports: { title: "Reports & Analytics", subtitle: "Clinic visits, programs, schools, and wait times." },
  };
  const meta = isNurseUser
    ? (nurseMetaByNav[activeNav] || nurseMetaByNav.dashboard)
    : isPhysicianUser
      ? (physicianMetaByNav[activeNav] || physicianMetaByNav.dashboard)
      : isDentistUser
        ? (dentistMetaByNav[activeNav] ?? dentistMetaByNav.dashboard)
        : (PAGE_META[activeNav] ?? PAGE_META.dashboard);

  useEffect(() => {
    if (isNurseUser && activeNav === "nurseStation") {
      setActiveNav("docrequests");
      return;
    }
    if (!canInterOfficeDocRequest && activeNav === "docrequests") setActiveNav("dashboard");
  }, [canInterOfficeDocRequest, activeNav, isNurseUser]);

  useEffect(() => {
    if (allowedNavSet.has(activeNav)) return;
    setActiveNav("dashboard");
  }, [allowedNavSet, activeNav]);

  useEffect(() => {
    if (embedReportsOnly) return;
    const id = location.state?.restoreNav;
    if (!id || typeof id !== "string") return;
    setActiveNav(id);
    navigate("/health-services", { replace: true, state: {} });
  }, [location.state, navigate, embedReportsOnly]);

  useEffect(() => {
    if (embedReportsOnly && activeNav !== "reports") setActiveNav("reports");
  }, [embedReportsOnly, activeNav]);

  const hsoLoadingRef = useRef(false);
  const reloadHsoData = useCallback(async ({ silent = false } = {}) => {
    if (!isSupabaseConfigured() || !supabase) return;
    if (hsoLoadingRef.current) return;
    const { data: authData } = await supabase.auth.getSession();
    if (!authData?.session) return;
    hsoLoadingRef.current = true;
    if (!silent) {
      setHsoLoading(true);
      setHsoLoadError(null);
    }
    try {
      const [res, staffRes] = await Promise.all([
        loadHsoFromSupabase(supabase),
        loadHsoStaffFromSupabase(supabase),
      ]);
      if (!res.ok) {
        setHsoLoadError(res.error?.message || "Could not load Health Services data from Supabase.");
        return;
      }
      let consultations = res.consultations;
      let records = res.records;
      let appointments = res.appointments;
      try {
        [consultations, records, appointments] = await Promise.all([
          enrichConsultationsWithStudentNames(supabase, consultations),
          enrichHealthRecordsWithStudentNames(supabase, records),
          enrichAppointmentsWithStudentNames(supabase, appointments),
        ]);
      } catch (enrichErr) {
        console.warn("[HealthServices] roster name enrich failed", enrichErr);
      }
      setConsultationRows(consultations);
      setHealthRecordsRows(records);
      setAppointmentsList(appointments);
      try {
        const { data: studs, error: studErr } = await supabase.from("students").select("student_id, program");
        if (!studErr && studs?.length) {
          const m = new Map();
          studs.forEach((s) => {
            const id = normalizeStudentIdMatch(s.student_id);
            if (id) m.set(id, String(s.program ?? "").trim());
          });
          setStudentProgramsByStudentId(m);
        }
      } catch (e) {
        console.warn("[HealthServices] students program fetch failed", e);
      }
      setReferralsList(res.referrals);
      setDocRequestsRows(res.documents);
      setDisciplineIncomingReferrals(res.disciplineReferralsIncoming || []);
      setSdaoIncomingReferrals(res.sdaoReferralsIncoming || []);
      if (staffRes.ok) {
        setAdminStaffRows(staffRes.staffRows || []);
        setPendingApprovalRows(staffRes.pendingApprovals || []);
      }
    } finally {
      hsoLoadingRef.current = false;
      if (!silent) setHsoLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadHsoData();
  }, [reloadHsoData]);

  useRealtimeHsoData(() => {
    void reloadHsoData({ silent: true });
  });

  const confirmLogout = async () => {
    setLogoutOpen(false);
    await logoutCampusCare();
    navigate("/");
  };

  useEffect(() => {
    if (!physicianChartOpen || !physicianChartStudentId || !isSupabaseConfigured() || !supabase) return;
    let cancelled = false;
    (async () => {
      setPhysicianChartLoading(true);
      try {
        const sid = physicianChartStudentId;
        const [roster, rec] = await Promise.all([
          fetchStudentRosterForChart(supabase, sid),
          fetchMedicalRecordRowForStudent(supabase, sid),
        ]);
        if (cancelled) return;
        setPhysicianChartRoster(roster);
        setPhysicianChartRecordSnapshot(rec || null);
        const consultSnap = latestPrescriptionSnapshot(sid, consultationRowsRef.current || [], rec);
        const rxInitial =
          consultSnap.text ||
          String(rec?.physicianPrescriptionNotes ?? "").trim();
        setPhysicianChartDraft({
          medicalHistory: medicalHistoryDraftFromRecord(rec),
          physicalExam: physicalExamDraftFromRecord(rec),
          prescriptionNotes: rxInitial,
          documentsNotes: String(rec?.physicianDocumentsNotes ?? "").trim(),
        });
        setPhysicianChartAttachments(
          Array.isArray(rec?.physicianDocumentsAttachments) ? rec.physicianDocumentsAttachments : [],
        );
      } catch (e) {
        console.warn(e);
        if (!cancelled) setPhysicianChartRoster(null);
      } finally {
        if (!cancelled) setPhysicianChartLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [physicianChartOpen, physicianChartStudentId]);

  const openPhysicianChart = useCallback((studentId) => {
    const sid = String(studentId ?? "").trim();
    if (!sid) {
      showToast("Select a patient with a student ID first.", { variant: "warning" });
      return;
    }
    setPhysicianChartStudentId(sid);
    setPhysicianChartOpen(true);
  }, []);

  const closePhysicianChart = useCallback(() => {
    setPhysicianChartOpen(false);
    setPhysicianChartStudentId(null);
    setPhysicianChartRoster(null);
    setPhysicianChartAttachments([]);
    setPhysicianChartRecordSnapshot(null);
  }, []);

  const openNewConsultationModal = () => {
    setNewConsultForm({ ...INITIAL_NEW_CONSULT });
    setNewConsultOpen(true);
  };

  const closeNewConsultationModal = () => {
    setNewConsultOpen(false);
    setNewConsultForm({ ...INITIAL_NEW_CONSULT });
  };

  const persistVisitDisposition = async (rowId, nextStatus) => {
    const norm = String(nextStatus).toLowerCase();
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from("health_consultations").update({ status: norm }).eq("id", rowId);
        if (error) throw error;
      }
      setConsultationRows((prev) =>
        prev.map((r) => (String(r.id) === String(rowId) ? { ...r, status: norm } : r)),
      );
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Could not update visit status.", { variant: "error" });
    }
  };

  const saveNewConsultation = async () => {
    const missing = [];
    if (!newConsultForm.studentName.trim()) missing.push("Student name");
    if (!newConsultForm.studentId.trim()) missing.push("Student ID");
    if (!newConsultForm.visitType) missing.push("Visit type");
    if (!newConsultForm.visitTime.trim()) missing.push("Time");
    if (!newConsultForm.chiefComplaint.trim()) missing.push("Chief complaint");
    if (!newConsultForm.bloodPressure.trim()) missing.push("Blood pressure");
    if (!newConsultForm.temperature.trim()) missing.push("Temperature");
    if (!newConsultForm.heartRate.trim()) missing.push("Heart rate");
    if (missing.length) {
      showToast(`Please complete all fields: ${missing.join(", ")}.`, { variant: "warning" });
      return;
    }
    const insertPayload = {
      student_name: newConsultForm.studentName.trim(),
      student_id: newConsultForm.studentId.trim(),
      visit_type: newConsultForm.visitType,
      visit_time: newConsultForm.visitTime.trim(),
      visit_date: new Date().toISOString().slice(0, 10),
      attended_by: userName,
      chief_complaint: newConsultForm.chiefComplaint.trim(),
      blood_pressure: newConsultForm.bloodPressure.trim(),
      temperature_c: newConsultForm.temperature.trim(),
      heart_rate_bpm: newConsultForm.heartRate.trim(),
      status: "pending",
    };
    let newId = `CONS-${Date.now()}`;
    try {
      setConsultSaving(true);
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from("health_consultations")
          .insert(insertPayload)
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) newId = String(data.id);
      }
      const typeLabel = newConsultForm.visitType === "walkin" ? "Walk-in" : "Scheduled";
      const newRow = {
        id: newId,
        student: newConsultForm.studentName.trim(),
        studentId: newConsultForm.studentId.trim(),
        type: typeLabel,
        followup: false,
        reason: newConsultForm.chiefComplaint.trim() || "—",
        date: formatVisitDateLabel(),
        time: newConsultForm.visitTime.trim() || "—",
        doctor: userName,
        status: "pending",
        bloodPressure: newConsultForm.bloodPressure.trim() || "",
        temperature: newConsultForm.temperature.trim() || "",
        heartRate: newConsultForm.heartRate.trim() || "",
      };
      setConsultationRows((prev) => [newRow, ...prev]);
      setNewConsultOpen(false);
      setNewConsultForm({ ...INITIAL_NEW_CONSULT });
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Could not save consultation.", { variant: "error" });
    } finally {
      setConsultSaving(false);
    }
  };

  const openNewRecordModal = () => {
    setNewRecordForm({ ...INITIAL_NEW_RECORD });
    setNewRecordOpen(true);
  };

  const openRecordFiltersModal = () => {
    recordFiltersSnapshot.current = {
      status: recordFilterStatus,
      dateFrom: recordFilterDateFrom,
      dateTo: recordFilterDateTo,
      student: recordFilterStudent,
    };
    setRecordFilterOpen(true);
  };

  const cancelRecordFiltersModal = () => {
    const s = recordFiltersSnapshot.current;
    if (s) {
      setRecordFilterStatus(s.status);
      setRecordFilterDateFrom(s.dateFrom);
      setRecordFilterDateTo(s.dateTo);
      setRecordFilterStudent(s.student);
    }
    setRecordFilterOpen(false);
  };

  const applyRecordFiltersModal = () => {
    setRecordFilterOpen(false);
  };

  const resetRecordFiltersInModal = () => {
    setRecordFilterStatus("all");
    setRecordFilterDateFrom("");
    setRecordFilterDateTo("");
    setRecordFilterStudent("");
  };

  const closeNewRecordModal = () => {
    setNewRecordOpen(false);
    setNewRecordForm({ ...INITIAL_NEW_RECORD });
  };

  const saveNewMedicalRecord = async () => {
    const allergyVal =
      newRecordForm.allergyCategory === "Other"
        ? newRecordForm.allergyOther.trim()
        : newRecordForm.allergyCategory;
    const chronicVal =
      newRecordForm.chronicCategory === "Other"
        ? newRecordForm.chronicOther.trim()
        : newRecordForm.chronicCategory;
    const miss = [];
    if (!newRecordForm.studentName.trim()) miss.push("Student name");
    if (!newRecordForm.studentId.trim()) miss.push("Student ID");
    if (!newRecordForm.program.trim()) miss.push("Program");
    if (!newRecordForm.bloodType.trim()) miss.push("Blood type");
    if (!newRecordForm.allergyCategory) miss.push("Allergies");
    if (newRecordForm.allergyCategory === "Other" && !newRecordForm.allergyOther.trim()) {
      showToast("Please specify allergies when you select Other.", { variant: "warning" });
      return;
    }
    if (!newRecordForm.chronicCategory) miss.push("Chronic conditions");
    if (newRecordForm.chronicCategory === "Other" && !newRecordForm.chronicOther.trim()) {
      showToast("Please specify chronic conditions when you select Other.", { variant: "warning" });
      return;
    }
    if (!newRecordForm.lastCheckup.trim()) miss.push("Last checkup");
    if (!newRecordForm.email.trim()) miss.push("Email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newRecordForm.email.trim())) {
      showToast("Enter a valid email address.", { variant: "warning" });
      return;
    }
    if (!newRecordForm.phone.trim()) miss.push("Phone");
    if (!newRecordForm.emergencyContact.trim()) miss.push("Emergency contact");
    if (!newRecordForm.medications.trim()) miss.push("Medications");
    if (!newRecordForm.weight.trim()) miss.push("Weight");
    if (!newRecordForm.height.trim()) miss.push("Height");
    if (!newRecordForm.bloodPressure.trim()) miss.push("Blood pressure");
    if (!newRecordForm.notes.trim()) miss.push("Notes");
    if (miss.length) {
      showToast(`Please complete all fields: ${miss.join(", ")}.`, { variant: "warning" });
      return;
    }
    const lastSort = newRecordForm.lastCheckup.trim();
    const lastLabel = formatLastCheckupLabel(lastSort);
    const insertPayload = {
      student_name: newRecordForm.studentName.trim(),
      student_id: newRecordForm.studentId.trim(),
      program: newRecordForm.program.trim(),
      blood_type: newRecordForm.bloodType.trim(),
      allergies: allergyVal,
      last_checkup: lastSort,
      email: newRecordForm.email.trim(),
      phone: newRecordForm.phone.trim(),
      emergency_contact: newRecordForm.emergencyContact.trim(),
      chronic_conditions: chronicVal,
      medications: newRecordForm.medications.trim(),
      weight_kg: newRecordForm.weight.trim(),
      height_cm: newRecordForm.height.trim(),
      blood_pressure: newRecordForm.bloodPressure.trim(),
      notes: newRecordForm.notes.trim(),
      vaccinations: null,
      badges: ["new"],
    };
    let newId = `HR-${Date.now()}`;
    try {
      setRecordSaving(true);
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.from("medical_records").insert(insertPayload).select("id").single();
        if (error) throw error;
        if (data?.id) newId = String(data.id);
      }
      const newRow = {
        id: newId,
        student: newRecordForm.studentName.trim(),
        studentId: newRecordForm.studentId.trim(),
        program: newRecordForm.program.trim() || "—",
        blood: newRecordForm.bloodType.trim() || "—",
        allergies: allergyVal || "None",
        last: lastLabel || "—",
        lastSort,
        badges: ["new"],
        email: newRecordForm.email.trim() || "—",
        phone: newRecordForm.phone.trim() || "—",
        emergencyContact: newRecordForm.emergencyContact.trim() || "—",
        medications: newRecordForm.medications.trim() || "None",
        chronicConditions: chronicVal || "None",
        vaccinations: "—",
        weightKg: newRecordForm.weight.trim() || "—",
        heightCm: newRecordForm.height.trim() || "—",
        notes: newRecordForm.notes.trim() || "",
      };
      setHealthRecordsRows((prev) => [newRow, ...prev]);
      closeNewRecordModal();
      showToast("Health record saved successfully.", { variant: "success" });
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Could not save health record.", { variant: "error" });
    } finally {
      setRecordSaving(false);
    }
  };

  const openNewAppointmentModal = () => {
    setNewApptForm({ ...INITIAL_NEW_APPT });
    setNewApptOpen(true);
  };

  const openNewReferralModal = () => {
    setNewReferralForm({ ...INITIAL_NEW_REFERRAL });
    setReferralStudentLookup({ status: "idle", message: "" });
    setNewReferralOpen(true);
  };

  const openNewDocModal = useCallback(() => {
    if (!canInterOfficeDocRequest) return;
    setHsoNewDocModalKey((k) => k + 1);
    setNewDocOpen(true);
  }, [canInterOfficeDocRequest]);

  const saveNewAppointment = async () => {
    const miss = [];
    if (!newApptForm.studentName.trim()) miss.push("Student name");
    if (!newApptForm.studentId.trim()) miss.push("Student ID");
    if (!newApptForm.email.trim()) miss.push("Email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newApptForm.email.trim())) {
      showToast("Enter a valid email address.", { variant: "warning" });
      return;
    }
    if (!newApptForm.phone.trim()) miss.push("Phone");
    if (!newApptForm.date) miss.push("Date");
    if (!newApptForm.time.trim()) miss.push("Time");
    if (!newApptForm.consultationType.trim()) miss.push("Consultation form answer");
    if (!newApptForm.designation.trim()) miss.push("Designation");
    if (miss.length) {
      showToast(`Please complete all fields: ${miss.join(", ")}.`, { variant: "warning" });
      return;
    }
    const { validFrom, validUntil } = computeCheckinWindow(newApptForm.date, newApptForm.time);
    const maxChSeq = appointmentsList.reduce((max, a) => {
      const n = normalizeCheckinCode(a.checkinCode || "");
      const m = n.match(/^CH-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const mockCheckinCode = formatCheckinCodeFromNumber(maxChSeq + 1);
    const payload = {
      student_name: newApptForm.studentName.trim(),
      student_id: newApptForm.studentId.trim(),
      student_email: newApptForm.email.trim(),
      student_phone: newApptForm.phone.trim(),
      appointment_date: newApptForm.date,
      appointment_time: newApptForm.time.trim(),
      purpose: newApptForm.consultationType.trim(),
      consultation_type: newApptForm.consultationType.trim(),
      additional_comments: newApptForm.additionalComments.trim() || null,
      designation: newApptForm.designation,
      checkin_valid_from: validFrom?.toISOString() || null,
      checkin_valid_until: validUntil?.toISOString() || null,
      workflow_status: HSO_WORKFLOW_STATUS.BOOKED,
      status: "pending",
      room: "Medical Room 1",
      service: designationToService(newApptForm.designation),
      doctor: "—",
      duration: "30 minutes",
      notes: null,
    };
    try {
      setApptSaving(true);
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.from("health_appointments").insert(payload).select("*").single();
        if (error) throw error;
        if (data) setAppointmentsList((prev) => [mapAppointmentRow(data), ...prev]);
      } else {
        const id = `APT-${Date.now()}`;
        const d = payload.appointment_date;
        const dateObj = new Date(`${d}T12:00:00`);
        const dateLabel = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        setAppointmentsList((prev) => [
          {
            id,
            student: payload.student_name,
            studentId: payload.student_id,
            time: payload.appointment_time || "—",
            date: dateLabel,
            dateSort: d,
            room: payload.room,
            service: payload.service,
            status: "pending",
            workflowStatus: HSO_WORKFLOW_STATUS.BOOKED,
            checkinCode: mockCheckinCode,
            checkinValidFrom: payload.checkin_valid_from,
            checkinValidUntil: payload.checkin_valid_until,
            designation: payload.designation,
            consultationType: payload.consultation_type,
            additionalComments: payload.additional_comments || "",
            email: payload.student_email || "—",
            phone: payload.student_phone || "—",
            doctor: "—",
            duration: payload.duration,
            purpose: payload.purpose || "—",
            notes: "",
          },
          ...prev,
        ]);
      }
      setNewApptOpen(false);
      setNewApptForm({ ...INITIAL_NEW_APPT });
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Could not save appointment.", { variant: "error" });
    } finally {
      setApptSaving(false);
    }
  };

  const mergeAppointmentIntoList = useCallback((mapped) => {
    setAppointmentsList((prev) => {
      const i = prev.findIndex((a) => String(a.id) === String(mapped.id));
      if (i === -1) return [mapped, ...prev];
      const next = [...prev];
      next[i] = { ...next[i], ...mapped };
      return next;
    });
  }, []);

  const resolveAppointmentForCheckin = useCallback(
    async (codeNormalized) => {
      if (isSupabaseConfigured() && supabase) {
        const row = await fetchAppointmentByCheckinCode(supabase, codeNormalized);
        if (row) {
          let mapped = mapAppointmentRow(row);
          mapped = await enrichAppointmentWithStudentName(supabase, mapped);
          mergeAppointmentIntoList(mapped);
          return mapped;
        }
        // Do not fall back to React state: after a DB reset/truncate, lists can still show ghost rows.
        return null;
      }
      return appointmentsList.find((a) => normalizeCheckinCode(a.checkinCode) === codeNormalized) || null;
    },
    [appointmentsList, mergeAppointmentIntoList],
  );

  const persistAppointmentWorkflow = async (appointmentId, patch) => {
    const rowId = String(appointmentId);

    const mergePatchIntoList = () => {
      setAppointmentsList((prev) =>
        prev.map((a) => {
          if (String(a.id) !== rowId) return a;
          const merged = { ...a };
          if (patch.workflow_status != null) merged.workflowStatus = patch.workflow_status;
          if (patch.status != null) merged.status = String(patch.status).toLowerCase();
          if (patch.checked_in_at !== undefined) merged.checkedInAt = patch.checked_in_at;
          if (patch.queue_number !== undefined) merged.queueNumber = patch.queue_number;
          if (patch.provider_queue !== undefined) merged.providerQueue = patch.provider_queue;
          if (patch.nurse_vitals !== undefined) merged.nurseVitals = patch.nurse_vitals;
          if (patch.nurse_assessment_completed_at !== undefined) {
            merged.nurseCompletedAt = patch.nurse_assessment_completed_at;
          }
          if (patch.consultation_started_at !== undefined) {
            merged.consultationStartedAt = patch.consultation_started_at;
          }
          if (patch.consultation_completed_at !== undefined) {
            merged.consultationCompletedAt = patch.consultation_completed_at;
          }
          return merged;
        }),
      );
    };

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from("health_appointments").update(patch).eq("id", rowId);
        if (error) throw error;
      }
      mergePatchIntoList();
      return true;
    } catch (err) {
      const msg = String(err?.message || "");
      const dupQueue =
        msg.includes("health_queue_tickets") ||
        msg.includes("ticket_code_key") ||
        (msg.toLowerCase().includes("duplicate key") &&
          (msg.includes("ticket_code") || msg.includes("health_queue")));

      if (dupQueue && isSupabaseConfigured() && supabase) {
        try {
          const { error: rpcErr } = await supabase.rpc("clear_health_queue_ticket_for_appointment", {
            p_appt: rowId,
          });
          if (rpcErr) {
            console.warn("[persistAppointmentWorkflow] clear_health_queue_ticket_for_appointment:", rpcErr.message || rpcErr);
          }

          const { data: appt } = await supabase
            .from("health_appointments")
            .select("check_in_code, checkin_code")
            .eq("id", rowId)
            .maybeSingle();
          const normalized = normalizeCheckinCode(appt?.check_in_code ?? appt?.checkin_code ?? "");
          const variants = normalized ? checkinLookupVariants(normalized) : [];
          if (variants.length) {
            await supabase.from("health_queue_tickets").delete().in("ticket_code", variants);
          }

          const retryErr = (await supabase.from("health_appointments").update(patch).eq("id", rowId)).error;
          if (!retryErr) {
            mergePatchIntoList();
            return true;
          }
        } catch {
          /* fall through */
        }
        const detail = msg.length > 140 ? `${msg.slice(0, 137)}…` : msg;
        showToast(
          `Still blocked after cleanup (${detail}). Apply migration 20260523120000 in Supabase (RPC clear_health_queue_ticket_for_appointment), hard-refresh this page after clearing tables, or remove the stuck CH- row in health_queue_tickets.`,
          { variant: "error" },
        );
        return false;
      }
      showToast(err?.message || "Could not update queue workflow.", { variant: "error" });
      return false;
    }
  };

  const verifyCheckinCode = async () => {
    const code = normalizeCheckinCode(checkinCodeInput);
    if (!code) {
      showToast("Enter check-in code.", { variant: "warning" });
      return;
    }
    const target = await resolveAppointmentForCheckin(code);
    if (!target) {
      setCheckinPreview(null);
      showToast("Invalid check-in code.", { variant: "warning" });
      return;
    }
    setCheckinPreview(target);
  };

  const handleCheckinByCode = async () => {
    const code = normalizeCheckinCode(checkinCodeInput);
    if (!code) {
      showToast("Enter a valid check-in code or verify first.", { variant: "warning" });
      return;
    }
    const target =
      checkinPreview && normalizeCheckinCode(checkinPreview.checkinCode) === code
        ? checkinPreview
        : await resolveAppointmentForCheckin(code);
    if (!target) {
      showToast("Enter a valid check-in code or verify first.", { variant: "warning" });
      return;
    }

    const latest =
      (isSupabaseConfigured() && supabase ? await resolveAppointmentForCheckin(code) : null) ||
      appointmentsList.find((a) => String(a.id) === String(target.id)) ||
      target;

    const st = normalizeWorkflowStatus(latest.workflowStatus || latest.status);
    const alreadyInVisitFlow = [
      HSO_WORKFLOW_STATUS.CHECKED_IN,
      HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE,
      HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS,
      HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER,
      HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS,
      HSO_WORKFLOW_STATUS.COMPLETED,
      HSO_WORKFLOW_STATUS.CANCELLED,
      HSO_WORKFLOW_STATUS.NO_SHOW,
    ].includes(st);

    if (alreadyInVisitFlow) {
      showToast(
        "This check-in code was already used for this visit. Use Nurse Queue to continue. For another visit, book a new appointment (new CH- code)—same student, new code is OK.",
        { variant: "warning" },
      );
      return;
    }

    if (isSupabaseConfigured() && supabase) {
      const variants = checkinLookupVariants(code);
      if (variants.length) {
        const { data: ticketRows, error: ticketErr } = await supabase
          .from("health_queue_tickets")
          .select("*")
          .in("ticket_code", variants)
          .limit(2);
        if (!ticketErr && ticketRows?.length) {
          const ticket = ticketRows[0];
          const ticketApptId =
            ticket.health_appointment_id ?? ticket.appointment_id ?? ticket.health_appointments_id ?? null;
          if (ticketApptId && String(ticketApptId) === String(latest.id)) {
            showToast(
              "This check-in code already has a queue ticket. Continue in Nurse Queue—do not check in again.",
              { variant: "warning" },
            );
            return;
          }
          if (ticketApptId) {
            showToast(
              "This ticket code is already linked to another visit. Use a new appointment and check-in code, or ask an administrator to review health_queue_tickets.",
              { variant: "error" },
            );
            return;
          }
          showToast(
            "A queue row already exists for this ticket code. If check-in is stuck, ask an admin to run the latest migrations (upsert on health_queue_tickets) or remove the orphan row.",
            { variant: "warning" },
          );
          return;
        }
      }
    }

    if (!nowInWindow(latest.checkinValidFrom, latest.checkinValidUntil)) {
      await persistAppointmentWorkflow(latest.id, { workflow_status: HSO_WORKFLOW_STATUS.EXPIRED_CODE });
      showToast("Check-in code expired or not active yet.", { variant: "warning" });
      return;
    }
    const nextQueue = maxQueueNumberForToday(appointmentsList, nurseVisitors) + 1;
    setNurseQueueCounter(nextQueue);
    const ok = await persistAppointmentWorkflow(latest.id, {
      workflow_status: HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE,
      checked_in_at: new Date().toISOString(),
      queue_number: nextQueue,
      status: "confirmed",
    });
    if (ok) {
      setCheckinCodeInput("");
      setCheckinPreview(null);
      showToast(`Checked in successfully. Queue #${nextQueue}`, { variant: "success" });
    }
  };

  const addNurseActivity = useCallback((entry) => {
    setNurseRecentActivity((prev) => [entry, ...prev].slice(0, 5));
  }, []);

  const handleAddVisitor = () => {
    const name = sanitizePersonNameInput(newVisitorForm.name).trim();
    const contactNumber = sanitizeDigitsOnlyInput(newVisitorForm.contactNumber).trim();
    const purpose = newVisitorForm.purpose.trim();
    if (!name || !contactNumber || !purpose) {
      showToast("Please complete visitor details.", { variant: "warning" });
      return;
    }
    const queueNumber = maxQueueNumberForToday(appointmentsList, nurseVisitors) + 1;
    setNurseQueueCounter(queueNumber);
    setNurseVisitors((prev) => [
      ...prev,
      {
        id: `V-${Date.now()}`,
        queueNumber,
        name,
        contactNumber,
        purpose,
        arrivedAt: new Date().toISOString(),
        workflowStatus: HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE,
      },
    ]);
    setAddVisitorOpen(false);
    setNewVisitorForm({ name: "", contactNumber: "", purpose: "" });
  };

  const handleNurseNext = async () => {
    if (!nurseStationOnline) {
      showToast("Start the station first.", { variant: "warning" });
      return;
    }
    primeSpeechSynthesis();

    const nextRow = nurseWaitlistRows.find((r) => r.status === HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE);
    if (!nextRow) {
      const busy = nurseWaitlistRows.some((r) => r.status === HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS);
      showToast(
        busy
          ? "No other patients are waiting. Complete the current patient first, then press Next to call the next ticket."
          : "No pending students in queue.",
        { variant: "warning" },
      );
      return;
    }
    setActiveNurseSessionId(nextRow.id);
    setNurseTriageForm({ ...INITIAL_NURSE_TRIAGE });
    const announceLine = buildStationAnnouncement("nurse", nextRow.queueNumber);
    if (announceLine) void speakQueueAnnouncement(announceLine, { repeats: 2 });

    let advancedOk = true;
    if (nextRow.source === "student") {
      advancedOk = await persistAppointmentWorkflow(nextRow.appointmentId, {
        workflow_status: HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS,
        consultation_started_at: new Date().toISOString(),
      });
    } else {
      setNurseVisitors((prev) =>
        prev.map((v) =>
          String(v.id) === String(nextRow.appointmentId)
            ? { ...v, workflowStatus: HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS }
            : v,
        ),
      );
    }
    if (!advancedOk) {
      showToast("Could not update queue. Check connection or resolve queue ticket conflicts.", { variant: "error" });
    }
  };

  const handleNurseComplete = async () => {
    if (!activeNurseSession) {
      showToast("No active patient session. Press Next to call a patient, or refresh if the screen is out of sync.", {
        variant: "warning",
      });
      return;
    }
    let activityAction = "Completed triage";
    if (activeNurseSession.source === "student") {
      const apptRow = appointmentsList.find((a) => String(a.id) === String(activeNurseSession.appointmentId));
      const rawDes = String(apptRow?.designation || "physician").toLowerCase();
      const providerTarget = rawDes === "dentist" ? "dentist" : "physician";
      activityAction = `Vitals done → ${providerTarget} queue`;
      const ok = await persistAppointmentWorkflow(activeNurseSession.appointmentId, {
        workflow_status: HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER,
        provider_queue: providerTarget,
        nurse_vitals: nurseTriageForm,
        nurse_assessment_completed_at: new Date().toISOString(),
      });
      if (!ok) {
        showToast("Could not save triage. Fix any queue error shown earlier, then try again.", { variant: "error" });
        return;
      }
    } else {
      setNurseVisitors((prev) => prev.filter((v) => String(v.id) !== String(activeNurseSession.appointmentId)));
      setVisitorArchive((prev) => [
        {
          ...activeNurseSession,
          completedAt: new Date().toISOString(),
          disposition: "Completed",
        },
        ...prev,
      ]);
    }
    addNurseActivity({
      id: `n-complete-${Date.now()}`,
      queueNumber: activeNurseSession.queueNumber,
      name: activeNurseSession.name,
      action: activityAction,
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
    setActiveNurseSessionId(null);
    setNurseTriageForm({ ...INITIAL_NURSE_TRIAGE });
  };

  const handleNurseTransfer = async (overrideTarget) => {
    if (!activeNurseSession) return;
    const resolvedTarget = overrideTarget || transferTarget;
    if (activeNurseSession.source === "student") {
      await persistAppointmentWorkflow(activeNurseSession.appointmentId, {
        workflow_status: HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER,
        provider_queue: resolvedTarget,
        nurse_vitals: nurseTriageForm,
      });
    } else {
      setNurseVisitors((prev) => prev.filter((v) => String(v.id) !== String(activeNurseSession.appointmentId)));
      setVisitorArchive((prev) => [
        {
          ...activeNurseSession,
          completedAt: new Date().toISOString(),
          disposition: `Transferred to ${resolvedTarget}`,
        },
        ...prev,
      ]);
    }
    addNurseActivity({
      id: `n-transfer-${Date.now()}`,
      queueNumber: activeNurseSession.queueNumber,
      name: activeNurseSession.name,
      action: `Forwarded to ${resolvedTarget}`,
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
    setActiveNurseSessionId(null);
    setNurseTriageForm({ ...INITIAL_NURSE_TRIAGE });
  };

  const handleNurseQueueStationStart = () => {
    setNurseStationOnline(true);
    showToast("Nurse Queue is now Online", { variant: "success" });
  };

  const handleNurseQueueStationClose = () => {
    setNurseStationOnline(false);
    setActiveNurseSessionId(null);
    showToast("Nurse Queue is now Offline", { variant: "info" });
  };

  const startProviderConsultation = useCallback(async (appt) => {
    if (!appt?.id) return;
    primeSpeechSynthesis();
    const pq = String(appt.providerQueue ?? appt.designation ?? "").toLowerCase();
    const stationKey = pq === "dentist" ? "dentist" : "physician";
    const providerLine = buildStationAnnouncement(stationKey, appt.queueNumber);
    if (providerLine) void speakQueueAnnouncement(providerLine, { repeats: 2 });

    const ok = await persistAppointmentWorkflow(appt.id, {
      workflow_status: HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS,
      consultation_started_at: new Date().toISOString(),
    });
    if (!ok) {
      showToast("Could not start consultation in the database.", { variant: "error" });
    }
  }, []);

  /** After a visit is completed, keep Open Chart prescription text aligned with that visit. */
  const syncChartPrescriptionToMedicalRecord = useCallback(
    async ({ studentId, studentLabel, recordId, prescriptionText }) => {
      const sid = String(studentId || "").trim();
      const rxText = String(prescriptionText ?? "").trim();
      const displayName = String(studentLabel || "").trim() || `Student ID ${sid}`;
      if (!sid) return;
      if (!isSupabaseConfigured() || !supabase) {
        setHealthRecordsRows((prev) => {
          const i = prev.findIndex((r) => normalizeStudentIdMatch(r.studentId) === normalizeStudentIdMatch(sid));
          if (i < 0) return prev;
          const next = [...prev];
          next[i] = { ...next[i], physicianPrescriptionNotes: rxText };
          return next;
        });
        return;
      }
      const rid = recordId && /^[0-9a-f-]{36}$/i.test(String(recordId)) ? String(recordId) : null;
      try {
        if (rid) {
          const { data, error } = await supabase
            .from("medical_records")
            .update({ physician_prescription_notes: rxText || null })
            .eq("id", rid)
            .select("*")
            .single();
          if (error) throw error;
          if (data) {
            const mapped = mapMedicalRecordRow(data);
            setHealthRecordsRows((prev) => {
              const i = prev.findIndex((r) => String(r.id) === rid);
              if (i < 0) return [mapped, ...prev];
              const next = [...prev];
              next[i] = mapped;
              return next;
            });
          }
        } else {
          const rd = new Date().toISOString().slice(0, 10);
          const insertPayload = {
            student_id: sid,
            student_name: displayName,
            program: "—",
            blood_type: "—",
            allergies: "None",
            last_checkup: rd,
            email: "—",
            phone: "—",
            emergency_contact: "—",
            chronic_conditions: "None",
            medications: "None",
            weight_kg: "—",
            height_cm: "—",
            blood_pressure: "—",
            notes: "",
            badges: ["cleared"],
            physician_prescription_notes: rxText || null,
          };
          const { data, error } = await supabase.from("medical_records").insert(insertPayload).select("*").single();
          if (error) throw error;
          if (data) {
            const mapped = mapMedicalRecordRow(data);
            setHealthRecordsRows((prev) => {
              const i = prev.findIndex((r) => normalizeStudentIdMatch(r.studentId) === normalizeStudentIdMatch(sid));
              if (i < 0) return [mapped, ...prev];
              const next = [...prev];
              next[i] = mapped;
              return next;
            });
          }
        }
      } catch (e) {
        console.error(e);
        showToast(e?.message || "Consultation saved but chart prescription could not be updated.", {
          variant: "warning",
        });
      }
    },
    [supabase],
  );

  /**
   * When the physician saves the chart with prescription text, mirror that into `health_consultations`
   * so Patient Records → Prescription shows a dated row (not only the medical_record field).
   * Replaces the previous "Chart save" row for this student so repeated saves update one list entry.
   */
  const logPrescriptionConsultationFromChartSave = useCallback(
    async ({ studentId, studentLabel, medicalRecordId, prescriptionText, serviceLabel }) => {
      const rx = String(prescriptionText || "").trim();
      const sid = String(studentId || "").trim();
      if (!rx || !sid) return;
      const name = String(studentLabel || "").trim() || `Student ID ${sid}`;
      const recordId =
        medicalRecordId && /^[0-9a-f-]{36}$/i.test(String(medicalRecordId)) ? String(medicalRecordId) : null;
      const service = String(serviceLabel || "").trim() || "General Check-up";

      const isPriorChartSaveRow = (r) =>
        normalizeStudentIdMatch(r.studentId) === normalizeStudentIdMatch(sid) &&
        String(r.reason || "").trim() === CHART_SAVE_CHIEF_COMPLAINT;

      const removePriorChartSaveRows = (rows) => rows.filter((r) => !isPriorChartSaveRow(r));

      if (!isSupabaseConfigured() || !supabase) {
        const now = new Date();
        const localRow = {
          id: `local-chart-${sid}-${Date.now()}`,
          student_name: name,
          student_id: sid,
          visit_type: "scheduled",
          visit_date: now.toISOString().slice(0, 10),
          visit_time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
          chief_complaint: CHART_SAVE_CHIEF_COMPLAINT,
          consultation_service: service,
          treatment: rx,
          prescription_detail: rx,
          status: "completed",
          attended_by: userName,
          created_at: now.toISOString(),
          medical_record_id: recordId,
        };
        setConsultationRows((prev) => [mapConsultationRow(localRow), ...removePriorChartSaveRows(prev)]);
        return;
      }

      const now = new Date();
      try {
        await supabase
          .from("health_consultations")
          .delete()
          .eq("student_id", sid)
          .eq("chief_complaint", CHART_SAVE_CHIEF_COMPLAINT);
        const payload = {
          student_name: name,
          student_id: sid,
          visit_type: "scheduled",
          visit_date: now.toISOString().slice(0, 10),
          visit_time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
          chief_complaint: CHART_SAVE_CHIEF_COMPLAINT,
          consultation_service: service,
          blood_pressure: null,
          temperature_c: null,
          heart_rate_bpm: null,
          diagnosis: null,
          treatment: rx,
          prescription_detail: rx,
          status: "completed",
          attended_by: userName,
          medical_record_id: recordId,
        };
        const { data, error } = await supabase.from("health_consultations").insert(payload).select("*").single();
        if (error) throw error;
        if (data) {
          setConsultationRows((prev) => [mapConsultationRow(data), ...removePriorChartSaveRows(prev)]);
        }
      } catch (e) {
        console.error(e);
        showToast(
          formatHealthConsultationsDbError(
            e,
            "Chart was saved; prescription timeline row could not be written.",
          ),
          { variant: "warning" },
        );
      }
    },
    [supabase, userName],
  );

  const completeProviderConsultation = useCallback(
    async (appt) => {
      if (!appt?.id) return;
      const ok = await persistAppointmentWorkflow(appt.id, {
        workflow_status: HSO_WORKFLOW_STATUS.COMPLETED,
        consultation_completed_at: new Date().toISOString(),
        status: "completed",
      });
      if (!ok) return;

      const sidNorm = normalizeStudentIdMatch(appt.studentId);
      const rec = healthRecordsRows.find((r) => normalizeStudentIdMatch(r.studentId) === sidNorm);
      const now = new Date();
      const serviceLabel = String(appt.consultationType || appt.purpose || appt.service || "Consultation").trim();
      const rx = String(physicianConsultForm.prescription || "").trim();
      const dx = String(physicianConsultForm.diagnosis || "").trim();
      const recordId = rec?.id && /^[0-9a-f-]{36}$/i.test(String(rec.id)) ? rec.id : null;
      const studentDisplay = String(appt.studentLabel || appt.student || "").trim() || `Student ID ${appt.studentId}`;
      const studentIdForDb = String(appt.studentId ?? "").trim();

      let consultationLogged = false;
      if (isSupabaseConfigured() && supabase) {
        try {
          const payload = {
            student_name: studentDisplay,
            student_id: studentIdForDb,
            visit_type: "scheduled",
            visit_date: now.toISOString().slice(0, 10),
            visit_time:
              appt.time?.trim() ||
              now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
            chief_complaint: serviceLabel,
            consultation_service: serviceLabel,
            blood_pressure: appt.nurseVitals?.bloodPressure || null,
            temperature_c: appt.nurseVitals?.temperature || null,
            heart_rate_bpm: appt.nurseVitals?.pulse || null,
            diagnosis: dx || null,
            treatment: rx || null,
            prescription_detail: rx || null,
            status: "completed",
            attended_by: userName,
            medical_record_id: recordId,
          };
          const { data, error } = await supabase.from("health_consultations").insert(payload).select("*").single();
          if (error) throw error;
          setConsultationRows((prev) => [mapConsultationRow(data), ...prev]);
          await syncChartPrescriptionToMedicalRecord({
            studentId: studentIdForDb,
            studentLabel: studentDisplay,
            recordId,
            prescriptionText: rx,
          });
          consultationLogged = true;
        } catch (e) {
          console.error(e);
          showToast(
            formatHealthConsultationsDbError(
              e,
              "Visit marked complete, but the consultation log failed to save.",
            ),
            { variant: "warning" },
          );
        }
      } else {
        const fallbackRow = {
          id: `local-${appt.id}-${Date.now()}`,
          student_name: appt.student || appt.studentLabel,
          student_id: studentIdForDb,
          visit_type: "scheduled",
          visit_date: now.toISOString().slice(0, 10),
          visit_time: appt.time,
          chief_complaint: serviceLabel,
          consultation_service: serviceLabel,
          blood_pressure: appt.nurseVitals?.bloodPressure,
          temperature_c: appt.nurseVitals?.temperature,
          heart_rate_bpm: appt.nurseVitals?.pulse,
          diagnosis: dx,
          treatment: rx,
          prescription_detail: rx,
          status: "completed",
          attended_by: userName,
          created_at: now.toISOString(),
          medical_record_id: recordId,
        };
        setConsultationRows((prev) => [mapConsultationRow(fallbackRow), ...prev]);
        await syncChartPrescriptionToMedicalRecord({
          studentId: studentIdForDb,
          studentLabel: studentDisplay,
          recordId,
          prescriptionText: rx,
        });
        consultationLogged = true;
      }
      if (consultationLogged) {
        showToast("Consultation completed, logged, and chart prescription updated.", { variant: "success" });
        if (
          physicianChartOpen &&
          normalizeStudentIdMatch(physicianChartStudentId) === sidNorm
        ) {
          setPhysicianChartDraft((d) => ({ ...d, prescriptionNotes: rx }));
        }
      }
    },
    [
      healthRecordsRows,
      physicianConsultForm,
      userName,
      supabase,
      syncChartPrescriptionToMedicalRecord,
      physicianChartOpen,
      physicianChartStudentId,
    ],
  );

  const saveNewReferral = async () => {
    const sid = String(newReferralForm.studentId || "").trim();
    if (!isCompleteReferralStudentId(sid)) {
      showToast(
        "No record found for this student ID.",
        { variant: "warning" },
      );
      return;
    }
    if (referralStudentLookup.status !== "found") {
      showToast("Wait until student details load from the roster, or fix the Student ID.", { variant: "warning" });
      return;
    }
    const miss = [];
    if (!newReferralForm.studentName.trim()) miss.push("Student name");
    const emailTrim = newReferralForm.email.trim();
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      showToast("School email from roster looks invalid.", { variant: "warning" });
      return;
    }
    if (!newReferralForm.receivingOffice.trim()) miss.push("Receiving office");
    else if (!HS_REFERRAL_OFFICES.includes(newReferralForm.receivingOffice)) {
      showToast("Receiving office must be DO or SDAO.", { variant: "warning" });
      return;
    }
    if (!newReferralForm.reason.trim()) miss.push("Reason for referral");
    if (miss.length) {
      showToast(`Please complete all fields: ${miss.join(", ")}.`, { variant: "warning" });
      return;
    }
    const refId = `REF-HSO-${Date.now()}`;
    const rd = new Date().toISOString().slice(0, 10);
    const dateLabel = formatVisitDateLabel(new Date(`${rd}T12:00:00`));
    const payload = {
      reference_id: refId,
      student_name: newReferralForm.studentName.trim(),
      student_id: newReferralForm.studentId.trim(),
      program: newReferralForm.program.trim() || null,
      student_email: newReferralForm.email.trim() || null,
      student_phone: null,
      receiving_office: newReferralForm.receivingOffice,
      referring_office: "Health Services Office",
      reason: newReferralForm.reason.trim(),
      health_observations: null,
      recommended_action: null,
      status: DISCIPLINE_REFERRAL_STATUS.PENDING_PARTNER,
      urgent: false,
      created_by_name: userName,
      referral_date: rd,
      attachments: [],
      timeline: [{ label: "Pending partner review", when: dateLabel, by: userName, done: true }],
    };
    try {
      setReferralSaving(true);
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.from("health_referrals").insert(payload).select("*").single();
        if (error) throw error;
        if (data) setReferralsList((prev) => [mapReferralRow(data), ...prev]);
      } else {
        setReferralsList((prev) => [
          {
            id: `local-${Date.now()}`,
            referenceId: refId,
            student: payload.student_name,
            studentId: payload.student_id,
            program: payload.program || "—",
            email: payload.student_email || "—",
            phone: "—",
            office: payload.receiving_office,
            reason: payload.reason,
            observations: "—",
            recommendedAction: "—",
            date: dateLabel,
            dateSort: rd,
            by: userName,
            status: DISCIPLINE_REFERRAL_STATUS.PENDING_PARTNER,
            urgent: false,
            attachments: [],
            timeline: payload.timeline,
          },
          ...prev,
        ]);
      }
      setNewReferralOpen(false);
      setNewReferralForm({ ...INITIAL_NEW_REFERRAL });
      setReferralStudentLookup({ status: "idle", message: "" });
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Could not send referral.", { variant: "error" });
    } finally {
      setReferralSaving(false);
    }
  };

  useEffect(() => {
    if (!newReferralOpen) {
      setReferralStudentLookup({ status: "idle", message: "" });
      return;
    }
    const id = String(newReferralForm.studentId || "").trim();
    if (isCompleteReferralStudentId(id)) return;
    setNewReferralForm((f) => ({ ...f, studentName: "", email: "", program: "" }));
    setReferralStudentLookup({ status: "idle", message: "" });
  }, [newReferralOpen, newReferralForm.studentId]);

  useEffect(() => {
    if (!newReferralOpen || !isSupabaseConfigured() || !supabase) return;
    const id = String(newReferralForm.studentId || "").trim();
    if (!isCompleteReferralStudentId(id)) return;

    let cancelled = false;
    setReferralStudentLookup({ status: "loading", message: "" });

    const t = setTimeout(async () => {
      try {
        const row = await fetchStudentRowForReferral(supabase, id);
        if (cancelled) return;
        if (!row) {
          setNewReferralForm((f) => ({ ...f, studentName: "", email: "", program: "" }));
          setReferralStudentLookup({
            status: "not_found",
            message: "No student found with this ID in the roster.",
          });
          return;
        }
        setNewReferralForm((f) => ({
          ...f,
          studentName: row.studentName || "",
          email: row.schoolEmail || "",
          program: row.program || "",
        }));
        setReferralStudentLookup({ status: "found", message: "" });
      } catch (e) {
        if (!cancelled) {
          setReferralStudentLookup({
            status: "error",
            message: e?.message || "Could not load student.",
          });
        }
      }
    }, 420);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [newReferralOpen, newReferralForm.studentId, supabase]);

  const handleHsoNewDocumentRequestSubmit = async (payload) => {
    if (!canInterOfficeDocRequest) return;
    const docLabel =
      String(payload.documentType).toLowerCase() === "other" && payload.documentTypeOther?.trim()
        ? `Other: ${payload.documentTypeOther.trim()}`
        : payload.documentType.trim();
    const id = `IOR-HSO-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const rowPayload = {
      studentName: payload.studentName,
      studentId: payload.studentId,
      program: payload.program,
      targetOffice: payload.targetOffice,
      documentType: docLabel,
      priority: payload.priority,
      status: INTER_OFFICE_DOC_STATUS.PENDING_APPROVAL,
      description: payload.description,
      evidence: payload.evidenceFile ? [{ name: payload.evidenceFile.name }] : [],
      notes: null,
    };
    try {
      setDocSaving(true);
      const row = interOfficeDocumentRequestToInsert(id, rowPayload, "health", userName);
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.from("inter_office_document_requests").insert(row).select("*").single();
        if (error) throw error;
        if (data) setDocRequestsRows((prev) => [interOfficeRowToHsoDocumentRequest(data), ...prev]);
      } else {
        setDocRequestsRows((prev) => [interOfficeRowToHsoDocumentRequest({ ...row, requested_at: row.requested_at }), ...prev]);
      }
      setNewDocOpen(false);
    } catch (err) {
      console.error(err);
      throw new Error(err?.message || "Could not submit request.");
    } finally {
      setDocSaving(false);
    }
  };

  const handleHsoAcceptingOfficeUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedDocRequest || selectedDocRequest.direction !== "incoming") return;
    if (!canReceivingOfficeUploadDoc(selectedDocRequest.status)) {
      showToast("Approve the request first before attaching a file.", { variant: "warning" });
      return;
    }
    try {
      setDocAcceptingUploadBusy(true);
      if (isSupabaseConfigured() && supabase) {
        const { evidence } = await appendEvidenceToInterOfficeRequest(supabase, selectedDocRequest.id, file);
        setSelectedDocRequest((prev) => (prev ? { ...prev, evidence } : null));
        setDocRequestsRows((prev) =>
          prev.map((d) => (d.id === selectedDocRequest.id ? { ...d, evidence } : d)),
        );
      } else {
        const newItem = { name: file.name, source: "target", uploadedAt: new Date().toISOString() };
        const next = [...(selectedDocRequest.evidence || []), newItem];
        setSelectedDocRequest((prev) => (prev ? { ...prev, evidence: next } : null));
        setDocRequestsRows((prev) =>
          prev.map((d) => (d.id === selectedDocRequest.id ? { ...d, evidence: next } : d)),
        );
      }
    } catch (err) {
      showToast(err?.message || "Could not upload attachment.", { variant: "error" });
    } finally {
      setDocAcceptingUploadBusy(false);
    }
  };

  const filteredRecords = useMemo(() => {
    const q = search.toLowerCase();
    let rows = healthRecordsRows;
    if (q) {
      rows = rows.filter(
        (r) =>
          r.student.toLowerCase().includes(q) ||
          r.studentId.includes(q) ||
          r.blood.toLowerCase().includes(q),
      );
    }
    const fs = recordFilterStudent.trim().toLowerCase();
    if (fs) {
      rows = rows.filter((r) => r.student.toLowerCase().includes(fs) || r.studentId.toLowerCase().includes(fs));
    }
    if (recordFilterStatus !== "all") {
      const target = recordFilterStatus.toLowerCase();
      rows = rows.filter((r) =>
        (r.badges || []).some((b) => String(b).toLowerCase() === target),
      );
    }
    const fromD = parseIsoDateOnly(recordFilterDateFrom);
    const toD = parseIsoDateOnly(recordFilterDateTo);
    if (fromD) {
      rows = rows.filter((r) => {
        const rd = recordRowLastDate(r);
        return rd && rd >= fromD;
      });
    }
    if (toD) {
      const end = new Date(toD.getFullYear(), toD.getMonth(), toD.getDate(), 23, 59, 59, 999);
      rows = rows.filter((r) => {
        const rd = recordRowLastDate(r);
        return rd && rd <= end;
      });
    }
    return rows;
  }, [healthRecordsRows, search, recordFilterStudent, recordFilterStatus, recordFilterDateFrom, recordFilterDateTo]);

  const filteredDocs = useMemo(() => {
    return docRequestsRows.filter((d) => {
      if (docStatusFilter === "all") return true;
      if (docStatusFilter === "pendingApproval") return isDocRequestPendingApproval(d.status);
      if (docStatusFilter === "approved") return isDocRequestApprovedForFulfillment(d.status);
      if (docStatusFilter === "declined") return isDocRequestDeclined(d.status);
      if (docStatusFilter === "fulfilled") return normalizeInterOfficeDocStatus(d.status) === "fulfilled";
      return d.status.toLowerCase() === docStatusFilter;
    }).filter((d) => {
      const q = search.toLowerCase();
      if (!q || activeNav !== "docrequests") return true;
      const partner = labelForOfficeKey(d.partnerOffice).toLowerCase();
      return (
        d.id.toLowerCase().includes(q) ||
        d.doc.toLowerCase().includes(q) ||
        partner.includes(q) ||
        (d.partnerOffice || "").toLowerCase().includes(q)
      );
    });
  }, [docRequestsRows, search, docStatusFilter, activeNav]);

  const visitTabStats = useMemo(() => {
    const today = formatVisitDateLabel(new Date());
    const rows = consultationRows;
    return {
      todayTotal: rows.filter((c) => c.date === today).length,
      walkins: rows.filter((c) => c.type === "Walk-in").length,
      scheduled: rows.filter((c) => c.type === "Scheduled").length,
      followups: rows.filter((c) => c.followup).length,
    };
  }, [consultationRows]);

  const recordsTabStats = useMemo(() => {
    const total = healthRecordsRows.length;
    const ongoing = healthRecordsRows.filter((r) =>
      (r.badges || []).some((b) => String(b).toLowerCase() === "followup"),
    ).length;
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const checkupsWeek = healthRecordsRows.filter((r) => {
      const rd = recordRowLastDate(r);
      return rd && rd >= weekAgo;
    }).length;
    return { total, ongoing, checkupsWeek };
  }, [healthRecordsRows]);

  const appointmentsTabStats = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const list = appointmentsList;
    const todayCount = list.filter((a) => a.dateSort === todayIso).length;
    const pending = list.filter((a) => String(a.status).toLowerCase() === "pending").length;
    const confirmed = list.filter((a) => String(a.status).toLowerCase() === "confirmed").length;
    return { todayCount, pending, confirmed, total: list.length };
  }, [appointmentsList]);

  const certificatesList = useMemo(
    () =>
      consultationRows
        .filter((row) => String(row.certificateReason || row.certReason || "").trim())
        .map((row, index) => ({
          id: row.id || `cert-${index}`,
          patient: row.student || row.patient || "—",
          reason: row.certificateReason || row.certReason || "—",
          period: row.certificatePeriod || "—",
          issuedAt: row.date || "—",
          status: row.certificateStatus || "issued",
        })),
    [consultationRows],
  );

  const certificatesByStudent = useMemo(() => {
    const groups = new Map();
    for (const row of consultationRows) {
      if (!String(row.certificateReason || row.certReason || "").trim()) continue;
      const sid = String(row.studentId || "").trim();
      if (!sid) continue;
      const name = String(row.student || "").trim() || `Student ID ${sid}`;
      if (!groups.has(sid)) groups.set(sid, { studentId: sid, studentName: name, entries: [] });
      groups.get(sid).entries.push(row);
    }
    for (const g of groups.values()) {
      g.entries.sort((a, b) => {
        const ta = new Date(a.consultationCreatedAt || 0).getTime();
        const tb = new Date(b.consultationCreatedAt || 0).getTime();
        return tb - ta;
      });
    }
    return [...groups.values()].sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [consultationRows]);

  /** Nurse Patient Records: one row per student; visits from all health_consultations (physician + dentist) plus medical_records dates */
  const nursePatientRecordsRoster = useMemo(() => {
    const m = new Map();

    for (const r of healthRecordsRows) {
      const k = normalizeStudentIdMatch(r.studentId);
      if (!k) continue;
      const name = String(r.student || "").trim();
      const prog = String(r.program || "").trim();
      const ld = recordRowLastDate(r);
      const ms = ld && !Number.isNaN(ld.getTime()) ? ld.getTime() : 0;
      const prev = m.get(k);
      if (!prev) {
        m.set(k, { studentId: k, studentName: name || "", program: prog, lastVisitMs: ms });
      } else {
        if (name) prev.studentName = name;
        if (prog) prev.program = prog;
        if (ms > prev.lastVisitMs) prev.lastVisitMs = ms;
      }
    }

    for (const c of consultationRows) {
      const k = normalizeStudentIdMatch(c.studentId);
      if (!k) continue;
      const name = String(c.student || "").trim();
      const cms = new Date(c.consultationCreatedAt || 0).getTime();
      const valid = Number.isFinite(cms) ? cms : 0;
      const prev = m.get(k);
      if (!prev) {
        m.set(k, { studentId: k, studentName: name || "", program: "", lastVisitMs: valid });
      } else {
        if (name) prev.studentName = name;
        if (valid > prev.lastVisitMs) prev.lastVisitMs = valid;
      }
    }

    const rows = [...m.values()].map((row) => {
      const progFromStudent = studentProgramsByStudentId.get(normalizeStudentIdMatch(row.studentId));
      const program =
        (progFromStudent && String(progFromStudent).trim()) || String(row.program || "").trim() || "—";
      const lastVisit =
        row.lastVisitMs > 0
          ? new Date(row.lastVisitMs).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
          : "—";
      return {
        studentId: row.studentId,
        studentName: row.studentName.trim() || `Student ID ${row.studentId}`,
        program,
        lastVisit,
        lastVisitMs: row.lastVisitMs,
      };
    });

    rows.sort((a, b) => {
      if (b.lastVisitMs !== a.lastVisitMs) return b.lastVisitMs - a.lastVisitMs;
      return a.studentName.localeCompare(b.studentName);
    });
    return rows;
  }, [healthRecordsRows, consultationRows, studentProgramsByStudentId]);

  const nursePatientRecordsFiltered = useMemo(() => {
    const q = String(recordsQuery || "").trim().toLowerCase();
    if (!q) return nursePatientRecordsRoster;
    return nursePatientRecordsRoster.filter(
      (row) =>
        row.studentId.toLowerCase().includes(q) ||
        row.studentName.toLowerCase().includes(q) ||
        String(row.program || "").toLowerCase().includes(q),
    );
  }, [nursePatientRecordsRoster, recordsQuery]);

  const workflowRows = useMemo(
    () =>
      appointmentsList.map((a) => {
        const studentLabel = appointmentStudentLabel(a) || "Patient";
        return {
          ...a,
          workflowStatus: normalizeWorkflowStatus(a.workflowStatus || a.status),
          reason: workflowAppointmentReason(a),
          studentLabel,
        };
      }),
    [appointmentsList],
  );

  const physicianChartVitalsDisplay = useMemo(() => {
    const sid = String(physicianChartStudentId || "").trim();
    const dash = (x) => (x != null && String(x).trim() !== "" ? String(x).trim() : "—");
    if (!sid) {
      return {
        bloodPressure: "—",
        pulse: "—",
        temperature: "—",
        heightCm: "—",
        weightKg: "—",
        spo2: "—",
      };
    }
    const candidates = appointmentsList.filter(
      (a) =>
        String(a.studentId) === sid &&
        a.nurseVitals &&
        typeof a.nurseVitals === "object" &&
        Object.values(a.nurseVitals).some((val) => String(val ?? "").trim() !== ""),
    );
    let v = null;
    if (candidates.length) {
      const sorted = [...candidates].sort((a, b) => {
        const ta = new Date(a.nurseCompletedAt || a.checkedInAt || 0).getTime();
        const tb = new Date(b.nurseCompletedAt || b.checkedInAt || 0).getTime();
        return tb - ta;
      });
      v = normalizeNurseVitalsDisplay(sorted[0].nurseVitals);
    }
    const rec = healthRecordsRows.find((r) => String(r.studentId) === sid);
    return {
      bloodPressure: dash(v?.bloodPressure),
      pulse: dash(v?.pulse),
      temperature: dash(v?.temperature),
      heightCm: dash(v?.heightCm || rec?.heightCm),
      weightKg: dash(v?.weightKg || rec?.weightKg),
      spo2: dash(v?.spo2),
    };
  }, [appointmentsList, healthRecordsRows, physicianChartStudentId]);

  const clinicalLatestPrescriptionSnapshot = useMemo(() => {
    const sid = physicianChartStudentId;
    if (!sid) return { text: "", at: 0, detail: "", source: "" };
    const rec =
      physicianChartRecordSnapshot ||
      healthRecordsRows.find((r) => normalizeStudentIdMatch(r.studentId) === normalizeStudentIdMatch(sid)) ||
      null;
    return latestPrescriptionSnapshot(sid, consultationRows, rec);
  }, [physicianChartStudentId, physicianChartRecordSnapshot, healthRecordsRows, consultationRows]);

  const clinicalLatestRxTimestampLabel = useMemo(() => {
    const at = clinicalLatestPrescriptionSnapshot.at;
    if (!at) return "";
    return new Date(at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  }, [clinicalLatestPrescriptionSnapshot.at]);

  const clinicalChartDocumentsSorted = useMemo(() => {
    const list = Array.isArray(physicianChartAttachments) ? [...physicianChartAttachments] : [];
    return list.sort((a, b) => {
      const ta = new Date(a.uploadedAt || 0).getTime();
      const tb = new Date(b.uploadedAt || 0).getTime();
      return tb - ta;
    });
  }, [physicianChartAttachments]);

  const savePhysicianChart = useCallback(async () => {
    const sid = String(physicianChartStudentId ?? "").trim();
    if (!sid) return;
    if (!supabase || !isSupabaseConfigured()) {
      showToast("Supabase is not configured.", { variant: "error" });
      return;
    }
    const roster = physicianChartRoster;
    const appt = appointmentsList.find((a) => String(a.studentId) === sid);
    const wf = workflowRows.find((w) => String(w.studentId) === sid);
    const displayName =
      String(wf?.studentLabel || appt?.student || roster?.fullName || "").trim() || `Student ID ${sid}`;
    const patch = {
      physician_medical_history_json: physicianChartDraft.medicalHistory,
      physician_physical_examination_json: physicianChartDraft.physicalExam,
      physician_prescription_notes: physicianChartDraft.prescriptionNotes,
      physician_documents_notes: physicianChartDraft.documentsNotes,
      physician_documents_attachments: physicianChartAttachments,
    };
    const rxNotes = String(physicianChartDraft.prescriptionNotes || "").trim();
    setPhysicianChartSaving(true);
    try {
      let savedMedicalRecordId = null;
      const existing = healthRecordsRows.find((r) => normalizeStudentIdMatch(r.studentId) === normalizeStudentIdMatch(sid));
      if (existing?.id) {
        const { data, error } = await supabase
          .from("medical_records")
          .update(patch)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        const mapped = mapMedicalRecordRow(data);
        savedMedicalRecordId = mapped?.id || existing.id;
        setHealthRecordsRows((prev) => {
          const i = prev.findIndex((r) => String(r.id) === String(existing.id));
          if (i < 0) return [mapped, ...prev];
          const next = [...prev];
          next[i] = mapped;
          return next;
        });
      } else {
        const insertPayload = {
          student_id: sid,
          student_name: displayName,
          program: "—",
          blood_type: "—",
          allergies: "None",
          last_checkup: new Date().toISOString().slice(0, 10),
          email: "—",
          phone: roster?.contactNo || "—",
          emergency_contact: "—",
          chronic_conditions: "None",
          medications: "None",
          weight_kg: "—",
          height_cm: "—",
          blood_pressure: "—",
          notes: "",
          badges: ["cleared"],
          ...patch,
        };
        const { data, error } = await supabase.from("medical_records").insert(insertPayload).select("*").single();
        if (error) throw error;
        const mapped = mapMedicalRecordRow(data);
        savedMedicalRecordId = mapped?.id || null;
        setHealthRecordsRows((prev) => [mapped, ...prev]);
      }
      if (rxNotes) {
        const wfRow = workflowRows.find((w) => normalizeStudentIdMatch(w.studentId) === normalizeStudentIdMatch(sid));
        const apptRow = appointmentsList.find(
          (a) => normalizeStudentIdMatch(a.studentId) === normalizeStudentIdMatch(sid),
        );
        const chartServiceLabel =
          String(
            wfRow?.consultationType ||
              wfRow?.purpose ||
              wfRow?.service ||
              apptRow?.consultationType ||
              apptRow?.purpose ||
              apptRow?.service ||
              "General Check-up",
          ).trim() || "General Check-up";
        await logPrescriptionConsultationFromChartSave({
          studentId: sid,
          studentLabel: displayName,
          medicalRecordId: savedMedicalRecordId,
          prescriptionText: rxNotes,
          serviceLabel: chartServiceLabel,
        });
      }
      // Working copy: prescription text lives in health_consultations + Patient Records; clear MR draft field.
      if (savedMedicalRecordId && rxNotes) {
        try {
          const { data: clearedRec, error: clearErr } = await supabase
            .from("medical_records")
            .update({ physician_prescription_notes: null })
            .eq("id", savedMedicalRecordId)
            .select("*")
            .single();
          if (!clearErr && clearedRec) {
            const mappedClr = mapMedicalRecordRow(clearedRec);
            setHealthRecordsRows((prev) => {
              const i = prev.findIndex((r) => String(r.id) === String(savedMedicalRecordId));
              if (i < 0) return [mappedClr, ...prev];
              const next = [...prev];
              next[i] = mappedClr;
              return next;
            });
          }
        } catch (clearEx) {
          console.warn(clearEx);
        }
      }
      setPhysicianChartDraft((d) => ({
        ...d,
        prescriptionNotes: "",
        documentsNotes: "",
      }));
      setPhysicianChartAttachments([]);
      showToast("Chart saved.", { variant: "success" });
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Could not save chart.", { variant: "error" });
    } finally {
      setPhysicianChartSaving(false);
    }
  }, [
    appointmentsList,
    healthRecordsRows,
    physicianChartAttachments,
    physicianChartDraft,
    physicianChartRoster,
    physicianChartStudentId,
    supabase,
    workflowRows,
    logPrescriptionConsultationFromChartSave,
    appointmentsList,
    workflowRows,
  ]);

  const handlePhysicianChartDocumentUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (!supabase || !isSupabaseConfigured()) {
        showToast("Supabase is not configured.", { variant: "error" });
        return;
      }
      const sid = String(physicianChartStudentId ?? "").trim();
      if (!sid) return;
      setPhysicianChartDocUploading(true);
      try {
        const meta = await uploadPhysicianChartDocument(supabase, sid, file);
        const next = [...physicianChartAttachments, meta];
        setPhysicianChartAttachments(next);
        const existing = healthRecordsRows.find((r) => String(r.studentId) === sid);
        if (existing?.id) {
          const { data, error } = await supabase
            .from("medical_records")
            .update({ physician_documents_attachments: next })
            .eq("id", existing.id)
            .select("*")
            .single();
          if (error) throw error;
          const mapped = mapMedicalRecordRow(data);
          setHealthRecordsRows((prev) => {
            const i = prev.findIndex((r) => String(r.id) === String(existing.id));
            if (i < 0) return [mapped, ...prev];
            const copy = [...prev];
            copy[i] = mapped;
            return copy;
          });
        }
        showToast("File attached.", { variant: "success" });
      } catch (err) {
        console.error(err);
        showToast(err?.message || "Could not upload file.", { variant: "error" });
      } finally {
        setPhysicianChartDocUploading(false);
      }
    },
    [physicianChartAttachments, physicianChartStudentId, healthRecordsRows, supabase],
  );

  const handleRemovePhysicianChartDocument = useCallback(
    async (storagePath) => {
      if (!supabase || !isSupabaseConfigured()) return;
      const sid = String(physicianChartStudentId ?? "").trim();
      const next = physicianChartAttachments.filter((a) => a.path !== storagePath);
      try {
        await deletePhysicianChartDocument(supabase, storagePath);
        setPhysicianChartAttachments(next);
        const existing = healthRecordsRows.find((r) => String(r.studentId) === sid);
        if (existing?.id) {
          const { data, error } = await supabase
            .from("medical_records")
            .update({ physician_documents_attachments: next })
            .eq("id", existing.id)
            .select("*")
            .single();
          if (error) throw error;
          const mapped = mapMedicalRecordRow(data);
          setHealthRecordsRows((prev) => {
            const i = prev.findIndex((r) => String(r.id) === String(existing.id));
            if (i < 0) return [mapped, ...prev];
            const copy = [...prev];
            copy[i] = mapped;
            return copy;
          });
        }
        showToast("Attachment removed.", { variant: "success" });
      } catch (err) {
        console.error(err);
        showToast(err?.message || "Could not remove file.", { variant: "error" });
      }
    },
    [physicianChartAttachments, physicianChartStudentId, healthRecordsRows, supabase],
  );

  const issuePhysicianCertificate = useCallback(async () => {
    const active = workflowRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS);
    if (!active?.studentId) {
      showToast("Start a consultation with a patient first.", { variant: "warning" });
      return;
    }
    const reason = String(physicianConsultForm.certReason || "").trim();
    if (!reason) {
      showToast("Enter a certificate reason.", { variant: "warning" });
      return;
    }
    if (!supabase || !isSupabaseConfigured()) {
      showToast("Supabase is not configured.", { variant: "error" });
      return;
    }
    const sid = String(active.studentId);
    const name = String(active.studentLabel || active.student || "").trim() || `Student ID ${sid}`;
    const from = String(physicianConsultForm.certFrom || "").trim();
    const until = String(physicianConsultForm.certUntil || "").trim();
    const period = from && until ? `${from} – ${until}` : from || until || "—";
    const now = new Date();
    const attend = String(session?.name || "").trim() || "Physician";
    const payload = {
      student_name: name,
      student_id: sid,
      visit_type: "scheduled",
      visit_time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      visit_date: now.toISOString().slice(0, 10),
      consultation_service: "Medical Certificate Request",
      chief_complaint: reason,
      certificate_reason: reason,
      certificate_period: period,
      certificate_status: "issued",
      diagnosis: String(physicianConsultForm.certRecommendation || "").trim() || null,
      treatment: null,
      status: "completed",
      attended_by: attend,
    };
    try {
      const { data, error } = await supabase.from("health_consultations").insert(payload).select("*").single();
      if (error) throw error;
      setConsultationRows((prev) => [mapConsultationRow(data), ...prev]);
      setPhysicianCertModalOpen(false);
      showToast("Medical certificate recorded.", { variant: "success" });
    } catch (err) {
      console.error(err);
      showToast(
        formatHealthConsultationsDbError(err, "Could not issue certificate."),
        { variant: "error" },
      );
    }
  }, [physicianConsultForm, session?.name, supabase, workflowRows]);

  const physicianSidebarRecords = useMemo(() => {
    const rows = [];
    const seen = new Set();
    const add = (id, student, studentId, allergies) => {
      const sid = String(studentId || "").trim();
      if (!sid || seen.has(sid)) return;
      seen.add(sid);
      rows.push({
        id,
        student: student || `Student ID ${sid}`,
        studentId: sid,
        allergies: allergies || "—",
      });
    };
    for (const r of healthRecordsRows) {
      add(r.id, r.student, r.studentId, r.allergies);
    }
    for (const w of workflowRows) {
      add(`wf-${w.id}`, w.studentLabel, w.studentId, "—");
    }
    for (const c of consultationRows) {
      add(`cc-${c.id}`, c.student, c.studentId, "—");
    }
    return rows;
  }, [healthRecordsRows, workflowRows, consultationRows]);

  const selectedPhysicianSidebarPatient = useMemo(() => {
    const list = physicianSidebarRecords;
    if (!list.length) return null;
    if (physicianRecordsStudentId) {
      const hit = list.find(
        (r) => normalizeStudentIdMatch(r.studentId) === normalizeStudentIdMatch(physicianRecordsStudentId),
      );
      if (hit) return hit;
    }
    return list[0];
  }, [physicianSidebarRecords, physicianRecordsStudentId]);

  useEffect(() => {
    if (!physicianSidebarRecords.length) {
      if (physicianRecordsStudentId !== null) setPhysicianRecordsStudentId(null);
      return;
    }
    const valid = physicianRecordsStudentId
      && physicianSidebarRecords.some(
        (r) => normalizeStudentIdMatch(r.studentId) === normalizeStudentIdMatch(physicianRecordsStudentId),
      );
    if (!valid) setPhysicianRecordsStudentId(physicianSidebarRecords[0].studentId);
  }, [physicianSidebarRecords, physicianRecordsStudentId]);

  useEffect(() => {
    setPhysicianRecordDocPreview(null);
    setPhysicianRecordsRxExpandedId(null);
  }, [physicianRecordsSubTab, selectedPhysicianSidebarPatient?.studentId]);

  const physicianRecordTimelineRows = useMemo(() => {
    const sel = selectedPhysicianSidebarPatient;
    if (!sel?.studentId) return [];
    const sid = normalizeStudentIdMatch(sel.studentId);
    return consultationRows
      .filter((row) => normalizeStudentIdMatch(row.studentId) === sid)
      .sort((a, b) => {
        const ta = new Date(a.consultationCreatedAt || 0).getTime();
        const tb = new Date(b.consultationCreatedAt || 0).getTime();
        return tb - ta;
      });
  }, [consultationRows, selectedPhysicianSidebarPatient]);

  const selectedPhysicianCertificateDocs = useMemo(() => {
    const sel = selectedPhysicianSidebarPatient;
    if (!sel?.studentId) return [];
    const sid = normalizeStudentIdMatch(sel.studentId);
    return consultationRows.filter(
      (row) =>
        normalizeStudentIdMatch(row.studentId) === sid && String(row.certificateReason || row.certReason || "").trim(),
    );
  }, [consultationRows, selectedPhysicianSidebarPatient]);

  const selectedPhysicianHealthRecord = useMemo(() => {
    const sel = selectedPhysicianSidebarPatient;
    if (!sel?.studentId) return null;
    return (
      healthRecordsRows.find((r) => normalizeStudentIdMatch(r.studentId) === normalizeStudentIdMatch(sel.studentId)) ||
      null
    );
  }, [healthRecordsRows, selectedPhysicianSidebarPatient]);

  /** All logged consultations for the selected patient (prescription tab = one row per visit, dated). */
  const selectedPhysicianPrescriptionHistoryRows = useMemo(() => {
    const sel = selectedPhysicianSidebarPatient;
    if (!sel?.studentId) return [];
    const sid = normalizeStudentIdMatch(sel.studentId);
    const rows = consultationRows.filter((row) => normalizeStudentIdMatch(row.studentId) === sid);
    return [...rows].sort((a, b) => {
      const ta = new Date(a.consultationCreatedAt || 0).getTime();
      const tb = new Date(b.consultationCreatedAt || 0).getTime();
      if (tb !== ta) return tb - ta;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [consultationRows, selectedPhysicianSidebarPatient]);

  const queueStats = useMemo(() => {
    const stat = (s) => workflowRows.filter((r) => r.workflowStatus === s).length;
    return {
      booked: stat(HSO_WORKFLOW_STATUS.BOOKED),
      checkinOpen: stat(HSO_WORKFLOW_STATUS.CHECKIN_WINDOW_OPEN),
      waitingNurse: stat(HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE),
      waitingProvider: stat(HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER),
      inProgress: stat(HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS),
      completed: stat(HSO_WORKFLOW_STATUS.COMPLETED),
    };
  }, [workflowRows]);

  const clinicalStaffRows = useMemo(
    () => adminStaffRows.filter((r) => ["nurse", "physician", "dentist"].includes(String(r.designation || "").toLowerCase())),
    [adminStaffRows],
  );

  const approvedClinicalStaffRows = useMemo(
    () => clinicalStaffRows.filter((r) => String(r.accountStatus || "").toLowerCase() === "approved"),
    [clinicalStaffRows],
  );

  const staffingSummary = useMemo(() => {
    const c = (d) => approvedClinicalStaffRows.filter((r) => r.designation === d).length;
    const onDuty = approvedClinicalStaffRows.filter((r) => r.status === "on-duty").length;
    const offDuty = approvedClinicalStaffRows.filter((r) => r.status === "off-duty").length;
    return {
      nurse: c("nurse"),
      physician: c("physician"),
      dentist: c("dentist"),
      total: approvedClinicalStaffRows.length,
      onDuty,
      offDuty,
    };
  }, [approvedClinicalStaffRows]);

  const prefixedName = (r) => `${r.titlePrefix} ${r.name}`.trim();

  const providerQueueRows = useMemo(
    () =>
      workflowRows
        .filter((r) =>
          [HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER, HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS].includes(r.workflowStatus),
        )
        .sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)),
    [workflowRows],
  );

  const physicianQueueActionRows = useMemo(
    () =>
      workflowRows.filter(
        (r) =>
          [HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER, HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS].includes(r.workflowStatus) &&
          (r.providerQueue || r.designation || "").toLowerCase() === "physician",
      ),
    [workflowRows],
  );

  const physicianProviderQueueRows = useMemo(
    () => [...physicianQueueActionRows].sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)),
    [physicianQueueActionRows],
  );

  const handlePhysicianQueueStart = useCallback(async () => {
    setPhysicianStationOnline(true);
    showToast("Physician Queue is now Online", { variant: "success" });
    const q = physicianQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER);
    if (!q) return;
    await startProviderConsultation(q);
    showToast("Consultation started.", { variant: "success" });
  }, [physicianQueueActionRows, startProviderConsultation]);

  const handlePhysicianQueueCompleteOnly = useCallback(async () => {
    const active = physicianQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS);
    if (!active) {
      showToast("Start the consultation first.", { variant: "warning" });
      return;
    }
    await completeProviderConsultation(active);
  }, [physicianQueueActionRows, completeProviderConsultation]);

  const handlePhysicianQueueNext = useCallback(async () => {
    const active = physicianQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS);
    if (active) {
      await completeProviderConsultation(active);
      showToast("Completed. Use Start when you are ready for the next patient.", { variant: "success" });
      return;
    }
    const q = physicianQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER);
    if (q) {
      await startProviderConsultation(q);
      showToast("Consultation started.", { variant: "success" });
    } else {
      showToast("No patient in physician queue.", { variant: "info" });
    }
  }, [physicianQueueActionRows, completeProviderConsultation, startProviderConsultation]);

  const handlePhysicianQueueTransfer = useCallback(async () => {
    const target =
      physicianQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS) ||
      physicianQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER);
    if (!target) {
      showToast("No patient to transfer.", { variant: "warning" });
      return;
    }
    const ok = await persistAppointmentWorkflow(target.id, {
      provider_queue: "dentist",
      workflow_status: HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER,
    });
    if (ok) showToast("Patient moved to the dental queue.", { variant: "success" });
  }, [physicianQueueActionRows]);

  const handlePhysicianQueueClose = useCallback(async () => {
    setPhysicianStationOnline(false);
    showToast("Physician Queue is now Offline", { variant: "info" });
    const target =
      physicianQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS) ||
      physicianQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER);
    if (!target) return;
    const ok = await persistAppointmentWorkflow(target.id, {
      workflow_status: HSO_WORKFLOW_STATUS.CANCELLED,
      status: "cancelled",
    });
    if (ok) showToast("Removed from queue.", { variant: "success" });
  }, [physicianQueueActionRows]);

  const dentistQueueActionRows = useMemo(
    () =>
      workflowRows.filter(
        (r) =>
          [HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER, HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS].includes(r.workflowStatus) &&
          (r.providerQueue || r.designation || "").toLowerCase() === "dentist",
      ),
    [workflowRows],
  );

  const handleDentistQueueStart = useCallback(async () => {
    setDentistStationOnline(true);
    showToast("Dentist Queue is now Online", { variant: "success" });
    const q = dentistQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER);
    if (!q) return;
    await startProviderConsultation(q);
    showToast("Consultation started.", { variant: "success" });
  }, [dentistQueueActionRows, startProviderConsultation]);

  const handleDentistQueueCompleteOnly = useCallback(async () => {
    const active = dentistQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS);
    if (!active) {
      showToast("Start the consultation first.", { variant: "warning" });
      return;
    }
    await completeProviderConsultation(active);
  }, [dentistQueueActionRows, completeProviderConsultation]);

  const handleDentistQueueNext = useCallback(async () => {
    const active = dentistQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS);
    if (active) {
      await completeProviderConsultation(active);
      showToast("Completed. Use Start when you are ready for the next patient.", { variant: "success" });
      return;
    }
    const q = dentistQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER);
    if (q) {
      await startProviderConsultation(q);
      showToast("Consultation started.", { variant: "success" });
    } else {
      showToast("No patient in dentist queue.", { variant: "info" });
    }
  }, [dentistQueueActionRows, completeProviderConsultation, startProviderConsultation]);

  const handleDentistQueueTransfer = useCallback(async () => {
    const target =
      dentistQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS) ||
      dentistQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER);
    if (!target) {
      showToast("No patient to transfer.", { variant: "warning" });
      return;
    }
    const ok = await persistAppointmentWorkflow(target.id, {
      provider_queue: "physician",
      workflow_status: HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER,
    });
    if (ok) showToast("Patient moved to the physician queue.", { variant: "success" });
  }, [dentistQueueActionRows]);

  const handleDentistQueueClose = useCallback(async () => {
    setDentistStationOnline(false);
    showToast("Dentist Queue is now Offline", { variant: "info" });
    const target =
      dentistQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS) ||
      dentistQueueActionRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER);
    if (!target) return;
    const ok = await persistAppointmentWorkflow(target.id, {
      workflow_status: HSO_WORKFLOW_STATUS.CANCELLED,
      status: "cancelled",
    });
    if (ok) showToast("Removed from queue.", { variant: "success" });
  }, [dentistQueueActionRows]);

  const dentistQueueRows = useMemo(
    () =>
      providerQueueRows.filter((r) => (r.providerQueue || r.designation || "").toLowerCase() === "dentist"),
    [providerQueueRows],
  );

  const dentalWeekBarData = useMemo(
    () => [
      { day: "Mon", total: 8 },
      { day: "Tue", total: 12 },
      { day: "Wed", total: 6 },
      { day: "Thu", total: 10 },
      { day: "Fri", total: 4 },
    ],
    [],
  );

  const dentalFollowupRows = useMemo(() => {
    const rows = appointmentsList
      .filter((a) => {
        const st = String(a.status || a.workflowStatus || "").toLowerCase();
        return a.followup || st.includes("pending") || st.includes("confirm") || st.includes("book");
      })
      .map((a) => ({
        id: a.id,
        student: a.student || "—",
        studentId: a.studentId || "",
        dateSort: a.dateSort || a.date,
        time: a.time || "09:00 AM",
        reason: a.consultationType || a.purpose || a.service || "Recall visit",
        status: String(a.status || "pending").toLowerCase().includes("confirm") ? "confirmed" : "pending",
      }));
    return rows.slice(0, 24);
  }, [appointmentsList]);

  useEffect(() => {
    if (!isDentistUser) return;
    if (!healthRecordsRows.length) {
      setDentalRecordsSelectedId(null);
      return;
    }
    setDentalRecordsSelectedId((prev) => {
      if (prev && healthRecordsRows.some((r) => String(r.id) === String(prev))) return prev;
      return healthRecordsRows[0]?.id ?? null;
    });
  }, [isDentistUser, healthRecordsRows]);

  const stationQueueRows = useMemo(() => {
    const rows = workflowRows.filter((r) =>
      [
        HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE,
        HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER,
        HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS,
      ].includes(r.workflowStatus),
    );
    return {
      nurse: rows.filter((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE).slice(0, 4),
      physician: rows.filter((r) => (r.providerQueue || r.designation) === "physician").slice(0, 4),
      dentist: rows.filter((r) => (r.providerQueue || r.designation) === "dentist").slice(0, 4),
    };
  }, [workflowRows]);

  const nurseWaitlistRows = useMemo(() => {
    const appointmentRows = workflowRows
      .filter((r) =>
        [HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE, HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS].includes(r.workflowStatus),
      )
      .map((r) => ({
        id: `student-${r.id}`,
        source: "student",
        appointmentId: r.id,
        queueNumber: r.queueNumber || 0,
        name: r.student || "Unknown Student",
        studentId: r.studentId || "—",
        arrivedAt: r.checkedInAt || r.checkinValidFrom || "",
        status: r.workflowStatus,
        reason: r.consultationType || r.purpose || "General concern",
      }));
    const visitorRows = nurseVisitors.map((v) => ({
      id: `visitor-${v.id}`,
      source: "visitor",
      appointmentId: v.id,
      queueNumber: v.queueNumber || 0,
      name: v.name,
      studentId: "Visitor",
      arrivedAt: v.arrivedAt,
      status: v.workflowStatus,
      reason: v.purpose || "Walk-in concern",
    }));
    return [...appointmentRows, ...visitorRows].sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0));
  }, [workflowRows, nurseVisitors]);

  /** Waiting for nurse triage only — excludes current NURSE_IN_PROGRESS so lists match “Next” behavior */
  const nurseWaitlistPendingRows = useMemo(
    () => nurseWaitlistRows.filter((r) => r.status === HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE),
    [nurseWaitlistRows],
  );

  const activeNurseSession = useMemo(() => {
    const match =
      activeNurseSessionId != null && activeNurseSessionId !== ""
        ? nurseWaitlistRows.find((r) => String(r.id) === String(activeNurseSessionId))
        : null;
    if (match) return match;
    /* Refresh / another tab: workflow shows nurse_in_progress but local session id was never set or cleared */
    const inProgress = nurseWaitlistRows.filter((r) => r.status === HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS);
    if (inProgress.length === 1) return inProgress[0];
    return null;
  }, [nurseWaitlistRows, activeNurseSessionId]);

  useEffect(() => {
    if (activeNurseSessionId) return;
    const only = nurseWaitlistRows.filter((r) => r.status === HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS);
    if (only.length === 1) setActiveNurseSessionId(only[0].id);
  }, [nurseWaitlistRows, activeNurseSessionId]);

  const nurseDashboardStats = useMemo(() => {
    const checkedIn = workflowRows.filter((r) =>
      [
        HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE,
        HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS,
        HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER,
        HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS,
      ].includes(r.workflowStatus),
    ).length;
    const pendingTriage = workflowRows.filter((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE).length;
    const waitedMinutes = workflowRows
      .filter((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE && r.checkedInAt)
      .map((r) => Math.max(0, Math.round((Date.now() - new Date(r.checkedInAt).getTime()) / 60000)));
    const avgWaitMins = waitedMinutes.length
      ? Math.round(waitedMinutes.reduce((sum, m) => sum + m, 0) / waitedMinutes.length)
      : 0;
    return { checkedIn, pendingTriage, avgWaitMins };
  }, [workflowRows]);

  const nurseNowServing = useMemo(() => {
    const fromStudent = workflowRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS);
    if (fromStudent) return fromStudent;
    const fromVisitor = nurseVisitors.find((v) => v.workflowStatus === HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS);
    return fromVisitor || null;
  }, [workflowRows, nurseVisitors]);

  useEffect(() => {
    const nextBaseline = maxQueueNumberForToday(appointmentsList, nurseVisitors);
    setNurseQueueCounter((prev) => (prev < nextBaseline ? nextBaseline : prev));
  }, [appointmentsList, nurseVisitors]);

  useEffect(() => {
    const updates = workflowRows.filter(
      (r) =>
        normalizeWorkflowStatus(r.workflowStatus) === HSO_WORKFLOW_STATUS.BOOKED &&
        nowInWindow(r.checkinValidFrom, r.checkinValidUntil),
    );
    if (!updates.length) return;
    updates.forEach((r) => {
      persistAppointmentWorkflow(r.id, { workflow_status: HSO_WORKFLOW_STATUS.CHECKIN_WINDOW_OPEN });
    });
  }, [workflowRows]);

  const referralsTabStats = useMemo(() => {
    const list = referralsList;
    const st = (r) => String(r.status || "").toLowerCase();
    const sent = list.filter((r) => st(r).includes("sent") || st(r) === "pending").length;
    const inProg = list.filter((r) => st(r).includes("progress")).length;
    const done = list.filter(
      (r) => st(r).includes("accepted") || st(r).includes("completed") || st(r).includes("closed"),
    ).length;
    const urgent = list.filter((r) => r.urgent).length;
    return { sent, inProg, done, urgent };
  }, [referralsList]);

  const docTabStats = useMemo(() => {
    const list = docRequestsRows;
    return {
      total: list.length,
      pending: list.filter((d) => isDocRequestPendingApproval(d.status)).length,
      uploaded: list.filter((d) => isDocRequestApprovedForFulfillment(d.status)).length,
      received: list.filter((d) => normalizeInterOfficeDocStatus(d.status) === "fulfilled").length,
    };
  }, [docRequestsRows]);

  const reportsDonutData = useMemo(() => {
    const physician = appointmentsList.filter((r) => (r.designation || "").toLowerCase() === "physician").length;
    const dentist = appointmentsList.filter((r) => (r.designation || "").toLowerCase() === "dentist").length;
    return [
      { name: "Physician", value: physician, color: "#3b82f6" },
      { name: "Dentist", value: dentist, color: "#10b981" },
    ].filter((x) => x.value > 0);
  }, [appointmentsList]);

  const dailyVisitsTrend = useMemo(() => {
    const out = [];
    const today = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const day = d.toLocaleDateString("en-US", { weekday: "short" });
      const visits = appointmentsList.filter((a) => a.dateSort === iso).length;
      out.push({ day, visits });
    }
    return out;
  }, [appointmentsList]);

  const peakHoursSeries = useMemo(() => {
    const labels = ["8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p"];
    const slots = new Map(labels.map((l) => [l, 0]));
    const toLabel = (time) => {
      const raw = String(time || "").trim();
      if (!raw) return null;
      const m24 = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
      if (m24) {
        let h = Number(m24[1]);
        const mer = h >= 12 ? "p" : "a";
        h = h % 12 || 12;
        return `${h}${mer}`;
      }
      const m12 = raw.toLowerCase().match(/^([1-9]|1[0-2])(?::([0-5]\d))?\s*([ap])m?$/);
      if (m12) return `${m12[1]}${m12[3]}`;
      return null;
    };
    appointmentsList.forEach((a) => {
      const lbl = toLabel(a.time);
      if (!lbl || !slots.has(lbl)) return;
      slots.set(lbl, (slots.get(lbl) || 0) + 1);
    });
    return labels.map((hour) => ({ hour, total: slots.get(hour) || 0 }));
  }, [appointmentsList]);

  const topComplaints = useMemo(() => {
    const tally = new Map();
    appointmentsList.forEach((a) => {
      const key = (a.consultationType || a.purpose || "General Check-up").trim();
      tally.set(key, (tally.get(key) || 0) + 1);
    });
    return [...tally.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [appointmentsList]);

  const hsoAnalyticsData = useMemo(() => {
    const { start, end } = hsoAnalyticsPeriodRange(hsoAnalyticsPeriod);
    const appts = appointmentsList.filter((a) => appointmentDateInPhysicianAnalyticsRange(a, start, end));
    const consults = consultationRows.filter((c) => consultationDateInPhysicianAnalyticsRange(c, start, end));

    const recordByStudent = new Map(
      healthRecordsRows.map((r) => [normalizeStudentIdMatch(r.studentId), r]),
    );

    const programForSid = (sid) => {
      const k = normalizeStudentIdMatch(sid);
      const fromStudent = studentProgramsByStudentId.get(k);
      if (fromStudent) return fromStudent;
      return String(recordByStudent.get(k)?.program || "").trim();
    };

    const schoolCounts = { SECA: 0, SASE: 0, SBMA: 0 };
    const programVisitTally = new Map();

    let certCount = 0;
    for (const c of consults) {
      const prog = programForSid(c.studentId);
      const bucket = schoolBucketFromProgram(prog);
      if (bucket) schoolCounts[bucket] += 1;

      const pk = prog || "Unknown";
      programVisitTally.set(pk, (programVisitTally.get(pk) || 0) + 1);

      const cert = String(c.certReason || c.certificateReason || "").trim();
      const svc = String(c.service || "").toLowerCase();
      if (cert || svc.includes("certificate")) certCount += 1;
    }

    const totalQueues = appts.filter((a) => Number(a.queueNumber) > 0 || a.checkedInAt).length;

    let waitSum = 0;
    let waitN = 0;
    appts.forEach((a) => {
      if (!a.checkedInAt || !a.consultationStartedAt) return;
      const w = (new Date(a.consultationStartedAt).getTime() - new Date(a.checkedInAt).getTime()) / 60000;
      if (w >= 0 && w < 720) {
        waitSum += w;
        waitN += 1;
      }
    });
    const avgWaitMin = waitN ? Math.round(waitSum / waitN) : 0;

    const reportYear = end.getFullYear();
    const peakMonthSeries = peakMonthSeriesForYearFromConsultations(consults, reportYear);

    const schoolPieData = PHYSICIAN_ANALYTICS_SCHOOLS.map((name) => ({
      name,
      value: schoolCounts[name],
    }));

    const programPieData = [...programVisitTally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, value]) => ({
        name: name.length > 32 ? `${name.slice(0, 29)}…` : name,
        value,
      }));

    return {
      start,
      end,
      totalQueues,
      certCount,
      avgWaitMin,
      schoolCounts,
      schoolPieData,
      programPieData,
      peakMonthSeries,
    };
  }, [hsoAnalyticsPeriod, appointmentsList, consultationRows, healthRecordsRows, studentProgramsByStudentId]);

  const exportHsoAnalyticsCsv = useCallback(() => {
    const d = hsoAnalyticsData;
    const lines = [
      ["Reports & Analytics", hsoAnalyticsPeriodLabel(hsoAnalyticsPeriod)],
      ["Metric", "Value"],
      ["Total queues", String(d.totalQueues)],
      ["Medical certificates issued", String(d.certCount)],
      ["Average waiting time (min)", String(d.avgWaitMin)],
      [],
      ["Month", "HSO visits (consultations in period)"],
      ...d.peakMonthSeries.map((r) => [r.month, String(r.total)]),
      [],
      ["School", "Consultations"],
      ...PHYSICIAN_ANALYTICS_SCHOOLS.map((s) => [s, String(d.schoolCounts[s])]),
      [],
      ["Program (students.program)", "Consultations"],
      ...d.programPieData.map((p) => [p.name, String(p.value)]),
    ];
    const csv = lines.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hs-reports-${hsoAnalyticsPeriod}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV downloaded.", { variant: "success" });
  }, [hsoAnalyticsData, hsoAnalyticsPeriod]);

  const exportHsoAnalyticsPdf = useCallback(() => {
    const d = hsoAnalyticsData;
    const doc = new jsPDF();
    let y = 16;
    doc.setFontSize(16);
    doc.text("Reports & Analytics", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Period: ${hsoAnalyticsPeriodLabel(hsoAnalyticsPeriod)}`, 14, y);
    y += 10;
    const rows = [
      ["Total queues", String(d.totalQueues)],
      ["Medical certificates issued", String(d.certCount)],
      ["Avg. waiting time (minutes)", String(d.avgWaitMin)],
    ];
    rows.forEach(([k, v]) => {
      doc.text(`${k}: ${v}`, 14, y);
      y += 6;
      if (y > 270) {
        doc.addPage();
        y = 16;
      }
    });
    doc.save(`hs-reports-${hsoAnalyticsPeriod}-${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast("PDF downloaded.", { variant: "success" });
  }, [hsoAnalyticsData, hsoAnalyticsPeriod]);


  // --- Nurse / Physician / Dentist / Admin Dashboard Views ---
  const renderDashboard = () => {
    if (isNurseUser) {
      const dashboardQueueRows = nurseWaitlistPendingRows.slice(0, 5);
      const nurseServingQueueRaw = nurseNowServing?.queueNumber;
      const hasNurseServingTicket =
        nurseNowServing != null &&
        nurseServingQueueRaw !== undefined &&
        nurseServingQueueRaw !== null &&
        nurseServingQueueRaw !== "" &&
        Number(nurseServingQueueRaw) > 0;
      const servingQueueNum = hasNurseServingTicket
        ? String(Number(nurseServingQueueRaw)).padStart(4, "0")
        : "0000";
      return (
        <div className="hs-nurse-shell">
          <div className="hs-nurse-kpi-row">
            {[
              { label: "Patients in Queue", value: nurseDashboardStats.checkedIn, Icon: Users, tone: "blue" },
              { label: "In Progress", value: nurseDashboardStats.pendingTriage, Icon: Activity, tone: "green" },
              { label: "Completed Today", value: nurseRecentActivity.length, Icon: Clock, tone: "orange" },
              {
                label: "Avg Wait Time (min)",
                value: nurseDashboardStats.avgWaitMins,
                Icon: Thermometer,
                tone: "red",
              },
            ].map((s) => (
              <div key={s.label} className="hs-stat-card hs-nurse-kpi">
                <div className="hs-stat-card-top">
                  <div className={`hs-nurse-kpi-icon hs-nurse-kpi-icon--${s.tone}`}><s.Icon size={16} strokeWidth={1.8} /></div>
                  <p className="hs-stat-value">{s.value}</p>
                </div>
                <p className="hs-stat-label">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="hs-nurse-dash-layout">
            <div className="cases-panel hs-panel-elevated hs-nurse-card hs-nurse-card--queue">
              <div className="cases-panel-header">
                <div className="cases-panel-title cases-panel-title--strong">Nurse Queue</div>
                <p className="hs-list-sub hs-list-sub--tight">Patients waiting for vital signs assessment</p>
              </div>
              <div className="cc-modal-body">
                {dashboardQueueRows.length ? (
                  dashboardQueueRows.map((row) => (
                    <div key={row.id} className="hs-nurse-ticket hs-nurse-ticket--dashboard">
                      <div className="hs-nurse-ticket-no">
                        <span>TICKET</span>
                        <strong>{String(row.queueNumber || 0).padStart(4, "0")}</strong>
                      </div>
                      <div>
                        <strong>{row.name}</strong>
                        <p>{String(row.reason || "Physician").includes("Dental") ? "Dentist" : "Physician"}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyStateMessage
                    icon={Users}
                    title="No patients in queue."
                    description="Check in patients using Patient Check-In; they will appear here when waiting for vital signs."
                  />
                )}
              </div>
            </div>
            <div className="hs-nurse-mid-col">
              <div className="cases-panel hs-panel-elevated hs-nurse-card">
                <div className="cases-panel-header">
                  <div className="cases-panel-title cases-panel-title--strong">Now Serving</div>
                </div>
                <div className="cc-modal-body">
                  <div className="hs-nurse-now-serving-strip">
                    <strong>{servingQueueNum}</strong>
                    <div>
                      <p>{nurseNowServing?.student || nurseNowServing?.name || "No patient in service"}</p>
                      <span>Physician</span>
                    </div>
                    {hasNurseServingTicket ? (
                      <span className="hs-pill hs-pill-ongoing">In Progress</span>
                    ) : (
                      <span className="hs-pill hs-pill-waiting">Idle</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="cases-panel hs-panel-elevated hs-nurse-card hs-nurse-form">
                <div className="cases-panel-header">
                  <div className="cases-panel-title cases-panel-title--strong">Patient Check-In</div>
                </div>
                <div className="cc-modal-body">
                  <div className="hs-modal-field">
                    <label htmlFor="hs-patient-checkin-code">Check-In Code</label>
                    <input
                      id="hs-patient-checkin-code"
                      placeholder="e.g. CH-0001"
                      autoComplete="off"
                      spellCheck={false}
                      inputMode="numeric"
                      title="Check-in code format: CH- followed by digits (e.g. CH-0001)"
                      value={checkinCodeInput}
                      onChange={(e) => setCheckinCodeInput(sanitizeCheckinCodeInput(e.target.value))}
                    />
                  </div>
                  <button type="button" className="hs-btn-primary hs-nurse-full-btn" onClick={verifyCheckinCode} style={{ marginTop: 10 }}>
                    Look up appointment
                  </button>
                  {checkinPreview ? (
                    <div className="do-panel hs-checkin-fetched" style={{ marginTop: 14 }}>
                      <div className="do-panel-header">
                        <h2 className="do-panel-title">Appointment details</h2>
                      </div>
                      <div className="do-panel-body" style={{ padding: "12px 16px" }}>
                        <p className="cell-text"><strong>Student:</strong> {checkinPreview.student}</p>
                        <p className="cell-text"><strong>Student ID:</strong> {checkinPreview.studentId || "—"}</p>
                        <p className="cell-text"><strong>Designation:</strong> {hsoDesignationLabel(checkinPreview.designation)}</p>
                        <p className="cell-text"><strong>Service:</strong> {checkinPreview.service || "—"}</p>
                        <p className="cell-text"><strong>Date:</strong> {checkinPreview.date || "—"}</p>
                        <p className="cell-text"><strong>Time:</strong> {checkinPreview.time || "—"}</p>
                        <p className="cell-text"><strong>Check-in code:</strong> {checkinPreview.checkinCode || "—"}</p>
                        <button type="button" className="hs-btn-success hs-nurse-full-btn" onClick={handleCheckinByCode} style={{ marginTop: 12 }}>
                          Confirm check-in and assign queue
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="hs-nurse-right-col">
              <div className="cases-panel hs-panel-elevated hs-nurse-card hs-nurse-form">
                <div className="cases-panel-header">
                  <div className="cases-panel-title cases-panel-title--strong">Vital Signs</div>
                  <p className="hs-list-sub hs-list-sub--tight">
                    For {nurseNowServing?.student || nurseNowServing?.name || "selected patient"}
                  </p>
                </div>
                <div className="cc-modal-body">
                  <div className="hs-modal-field"><label>Temperature (°C)</label><input placeholder="e.g. 36.5" value={nurseTriageForm.temperature} onChange={(e) => setNurseTriageForm((f) => ({ ...f, temperature: e.target.value }))} /></div>
                  <div className="hs-modal-field"><label>Blood Pressure</label><input placeholder="e.g. 120/80" value={nurseTriageForm.bloodPressure} onChange={(e) => setNurseTriageForm((f) => ({ ...f, bloodPressure: e.target.value }))} /></div>
                  <div className="hs-modal-field"><label>Pulse</label><input placeholder="e.g. 72 bpm" value={nurseTriageForm.pulse} onChange={(e) => setNurseTriageForm((f) => ({ ...f, pulse: e.target.value }))} /></div>
                  <div className="hs-modal-field"><label>Resp. Rate</label><input placeholder="e.g. 16 rpm" value={nurseTriageForm.respiratoryRate} onChange={(e) => setNurseTriageForm((f) => ({ ...f, respiratoryRate: e.target.value }))} /></div>
                  <div className="hs-modal-field"><label>Notes</label><textarea placeholder="Observations, concerns, allergies..." value={nurseTriageForm.remarks} onChange={(e) => setNurseTriageForm((f) => ({ ...f, remarks: e.target.value }))} /></div>
                  <div className="hs-nurse-vitals-actions">
                    <button type="button" className="hs-btn-success" onClick={handleNurseComplete}>Complete</button>
                    <button type="button" className="hs-btn-primary" onClick={handleNurseNext}>Next</button>
                  </div>
                </div>
              </div>
              <div className="cases-panel hs-panel-elevated hs-nurse-card hs-nurse-card--compact">
                <div className="cases-panel-header">
                  <div className="cases-panel-title cases-panel-title--strong">Route Patient</div>
                </div>
                <div className="cc-modal-body hs-nurse-route-actions">
                  <button type="button" className="hs-btn-secondary" onClick={() => { setTransferTarget("physician"); handleNurseTransfer("physician"); }}>
                    <Stethoscope size={14} /> Send to Physician
                  </button>
                  <button type="button" className="hs-btn-secondary" onClick={() => { setTransferTarget("dentist"); handleNurseTransfer("dentist"); }}>
                    <Activity size={14} /> Send to Dentist
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (isPhysicianUser) {
      const physicianQueueRows = workflowRows
        .filter((r) =>
          [HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER, HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS].includes(r.workflowStatus),
        )
        .filter((r) => (r.providerQueue || r.designation || "").toLowerCase() === "physician")
        .slice(0, 5);
      const active = physicianQueueRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS) || physicianQueueRows[0];
      const historyRows = consultationRows
        .filter((row) =>
          active?.studentId
            ? String(row.studentId || "").toLowerCase() === String(active.studentId || "").toLowerCase()
            : String(row.student || "").toLowerCase() === String(active?.studentLabel || active?.student || "").toLowerCase(),
        )
        .sort((a, b) => {
          const ta = new Date(a.consultationCreatedAt || 0).getTime();
          const tb = new Date(b.consultationCreatedAt || 0).getTime();
          return tb - ta;
        })
        .slice(0, 12);
      const activeRow = active || physicianQueueRows[0] || null;
      const activeVitals = normalizeNurseVitalsDisplay(activeRow?.nurseVitals);
      return (
        <div className="hs-phys-shell">
          <div className="hs-phys-kpi-row">
            <div className="hs-stat-card hs-phys-kpi"><p className="hs-stat-value">{physicianQueueRows.length}</p><p className="hs-stat-label">IN QUEUE</p></div>
            <div className="hs-stat-card hs-phys-kpi"><p className="hs-stat-value">{consultationRows.length}</p><p className="hs-stat-label">CONSULTATIONS TODAY</p></div>
            <div className="hs-stat-card hs-phys-kpi"><p className="hs-stat-value">{certificatesList.length}</p><p className="hs-stat-label">Certificates Issued</p></div>
          </div>
          <div className="hs-phys-main-grid">
            <div className="cases-panel hs-panel-elevated hs-phys-card">
              <div className="cases-panel-header"><div className="cases-panel-title cases-panel-title--strong">Physician Queue</div></div>
              <div className="cc-modal-body">
                {physicianQueueRows.map((r) => (
                  <div className={`hs-phys-queue-item ${activeRow?.id === r.id ? "hs-phys-queue-item--active" : ""}`} key={r.id}>
                    <div className="hs-phys-queue-no">{`Q${String(r.queueNumber || 0).padStart(2, "0")}`}</div>
                    <div className="hs-phys-queue-main">
                      <strong>{r.studentLabel}</strong>
                      <p>{r.reason}</p>
                    </div>
                    <div className="hs-phys-queue-right">
                      <p>{`${Math.max(12, (r.queueNumber || 1) * 3)}m`}</p>
                      <span>Waiting</span>
                    </div>
                  </div>
                ))}
                {!physicianQueueRows.length ? (
                  <EmptyStateMessage
                    icon={Users}
                    title="No waiting patients at the moment."
                    description="New patients will appear here once done with checking the vital signs."
                  />
                ) : null}
              </div>
            </div>
            <div className="cases-panel hs-panel-elevated hs-phys-card">
              <div className="cases-panel-header">
                <div className={`hs-phys-active-title-wrap${!activeRow ? " hs-phys-active-title-wrap--empty" : ""}`}>
                  {activeRow?.queueNumber ? (
                    <span className="hs-phys-active-q">{`Q${String(activeRow.queueNumber).padStart(2, "0")}`}</span>
                  ) : null}
                  <div>
                    <div className="cases-panel-title cases-panel-title--strong">{activeRow?.studentLabel || "No active patient selected."}</div>
                    {activeRow ? (
                      <p className="hs-stat-meta">{`${activeRow?.studentId || "—"} · ${activeRow?.reason}`}</p>
                    ) : (
                      <p className="hs-stat-meta">Select a student from the queue to begin consultation.</p>
                    )}
                  </div>
                </div>
                {activeRow ? (
                  <div className="hs-phys-panel-actions">
                    <button
                      type="button"
                      className="hs-btn-secondary"
                      onClick={() => openPhysicianChart(activeRow.studentId)}
                    >
                      Open Chart
                    </button>
                    <button
                      type="button"
                      className="hs-btn-secondary"
                      onClick={() => setPhysicianCertModalOpen(true)}
                    >
                      Medical Certificate
                    </button>
                    <button
                      type="button"
                      className="hs-btn-primary"
                      onClick={() => {
                        if (!activeRow) return;
                        if (activeRow.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS) {
                          completeProviderConsultation(activeRow);
                        } else if (activeRow.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER) {
                          startProviderConsultation(activeRow);
                          showToast("Consultation started.", { variant: "success" });
                        } else {
                          showToast("No active consultation to complete.", { variant: "warning" });
                        }
                      }}
                    >
                      {activeRow?.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS ? "Complete" : "Start visit"}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="cc-modal-body">
                {!activeRow ? (
                  <EmptyStateMessage
                    icon={Stethoscope}
                    title="No active patient selected."
                    description="Select a student from the queue to begin consultation."
                  />
                ) : (
                  <>
                    <div className="hs-phys-tab-row">
                        {[
                        { id: "vitals", label: "Vitals" },
                        { id: "history", label: "History" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          className={`hs-phys-tab-btn ${physicianPanelTab === tab.id ? "hs-phys-tab-btn--active" : ""}`}
                          onClick={() => setPhysicianPanelTab(tab.id)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    {physicianPanelTab === "vitals" ? (
                      <div className="hs-phys-vitals-form">
                        <div className="hs-phys-vitals-grid">
                          <div><span>Temp</span><strong>{activeVitals?.temperature || "—"}</strong></div>
                          <div><span>BP</span><strong>{activeVitals?.bloodPressure || "—"}</strong></div>
                          <div><span>Pulse</span><strong>{activeVitals?.pulse || "—"}</strong></div>
                          <div><span>Resp</span><strong>{activeVitals?.respiratoryRate || "—"}</strong></div>
                        </div>
                        <p className="hs-stat-meta" style={{ marginTop: 10 }}>Recorded by triage nurse.</p>
                      </div>
                    ) : null}
                    {physicianPanelTab === "history" ? (
                      <div>
                        {historyRows.map((h) => (
                          <div className="hs-nurse-ticket" key={h.id}>
                            <p style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
                              {h.date}
                              <span className="hs-stat-meta" style={{ fontWeight: 500, marginLeft: 8 }}>
                                {h.time}
                              </span>
                            </p>
                            <p style={{ margin: "6px 0 0" }}>
                              <strong>Service:</strong> {h.service || h.reason}
                            </p>
                            {h.treatment || h.prescription ? (
                              <p className="hs-stat-meta" style={{ marginTop: 4 }}>
                                Prescription: {h.treatment || h.prescription}
                              </p>
                            ) : null}
                          </div>
                        ))}
                        {!historyRows.length ? (
                          <EmptyStateMessage
                            compact
                            icon={FileText}
                            title="No consultation history available."
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (isDentistUser) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const qLen = dentistQueueRows.length;
      const proceduresToday = consultationRows.length;
      const avgWaitMins = qLen ? Math.min(45, 11 + qLen * 3) : 0;
      const followWeekCount = dentalFollowupRows.length;
      const currentPt =
        dentistQueueRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS) ||
        dentistQueueRows[0] ||
        null;
      const todayAppts = appointmentsList.filter((a) => a.dateSort === todayIso).slice(0, 8);
      const queueSnap = dentistQueueRows.slice(0, 4);
      const recentProc = consultationRows.slice(0, 4);
      return (
        <div className="hs-dent-shell">
          <div className="hs-dent-kpi-row">
            {[
              { label: "Patients in Queue", value: String(qLen), Icon: Users, tone: "blue" },
              { label: "Procedures Today", value: String(proceduresToday), Icon: CheckCircle, tone: "green" },
              { label: "Avg Wait Time", value: qLen ? `${avgWaitMins}m` : "—", Icon: Clock, tone: "purple" },
              { label: "Follow-ups This Week", value: String(followWeekCount), Icon: CalendarDays, tone: "orange" },
            ].map((s) => (
              <div key={s.label} className="hs-stat-card hs-dent-kpi-card">
                <div className="hs-stat-card-top">
                  <p className="hs-stat-value">{s.value}</p>
                  <div className={`hs-dent-kpi-icon hs-dent-kpi-icon--${s.tone}`} aria-hidden>
                    <s.Icon size={18} strokeWidth={1.8} />
                  </div>
                </div>
                <p className="hs-stat-label">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="hs-dent-main-grid">
            <div className="hs-dent-left-col">
              <div className="cases-panel hs-panel-elevated hs-dent-card">
                <div className="hs-dent-card-pad">
                  <p className="hs-dent-kicker">CURRENT</p>
                  {currentPt ? (
                    <>
                      <h3 className="hs-dent-patient-name">{currentPt.student}</h3>
                      <p className="hs-stat-meta">
                        {currentPt.studentId || "—"} · {currentPt.service || "BSA-2"} ·{" "}
                        <span className="hs-dent-priority">Nursing Priority</span>
                      </p>
                      <p className="hs-dent-concern">
                        Concern: {currentPt.consultationType || currentPt.purpose || "Dental check"}
                      </p>
                      <div className="hs-dent-btn-stack">
                        <button type="button" className="hs-btn-primary hs-dent-btn" onClick={() => setActiveNav("dentalChart")}>
                          Open Dental Chart
                        </button>
                        <button type="button" className="hs-btn-secondary hs-dent-btn" onClick={() => setActiveNav("dentalQueue")}>
                          View Queue
                        </button>
                      </div>
                    </>
                  ) : (
                    <EmptyStateMessage
                      icon={Users}
                      title="No patient in chair."
                      description="When students are queued for the dentist station, the current patient will appear here."
                    />
                  )}
                </div>
              </div>
              <div className="cases-panel hs-panel-elevated hs-dent-card">
                <div className="hs-dent-card-head">
                  <div className="cases-panel-title cases-panel-title--strong">Today&apos;s Appointments</div>
                  <button type="button" className="hs-link-action" onClick={() => setActiveNav("dentalFollowups")}>
                    + Schedule
                  </button>
                </div>
                <div className="hs-dent-appt-list">
                  {todayAppts.length ? (
                    todayAppts.map((a) => (
                      <div key={a.id} className="hs-dent-appt-row">
                        <span className="hs-dent-appt-time">{a.time || "—"}</span>
                        <div>
                          <strong>{a.student}</strong>
                          <p className="hs-stat-meta">{a.consultationType || a.purpose || "Dental"}</p>
                        </div>
                        <span className={pillClass(statusLabel(a.workflowStatus || a.status))}>
                          {statusLabel(a.workflowStatus || a.status)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="hs-stat-meta">No appointments scheduled for today.</p>
                  )}
                </div>
              </div>
              <div className="cases-panel hs-panel-elevated hs-dent-card">
                <div className="cases-panel-header">
                  <div>
                    <div className="cases-panel-title cases-panel-title--strong">Queue Snapshot</div>
                    <p className="hs-list-sub hs-list-sub--tight">Next patient in waiting</p>
                  </div>
                </div>
                <div className="cc-modal-body">
                  {queueSnap.length ? (
                    queueSnap.map((r) => (
                      <div key={r.id} className="hs-dent-queue-pill">
                        <div>
                          <strong>{`Q${String(r.queueNumber || 0).padStart(2, "0")}`}</strong>
                          <p>{r.student}</p>
                          <p className="hs-stat-meta">{r.consultationType || r.purpose || "Dental check"}</p>
                        </div>
                        <span className="hs-stat-meta">{`${Math.max(5, (r.queueNumber || 1) * 2)}m Waiting`}</span>
                      </div>
                    ))
                  ) : (
                    <p className="hs-stat-meta">No patients waiting in dentist queue.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="hs-dent-right-col">
              <div className="cases-panel hs-panel-elevated hs-dent-card">
                <div className="cases-panel-header hs-dent-panel-head--compact">
                  <div className="cases-panel-title cases-panel-title--strong">Quick Actions</div>
                </div>
                <div className="hs-dent-quick-list">
                  {[
                    { label: "Dental Chart", Icon: Activity, nav: "dentalChart" },
                    { label: "Dental Queue", Icon: FileText, nav: "dentalQueue" },
                    { label: "Schedule Follow-up", Icon: CalendarDays, nav: "dentalFollowups" },
                    { label: "Patient Records", Icon: Folder, nav: "dentalRecords" },
                  ].map((q) => (
                    <button key={q.label} type="button" className="hs-dent-quick-row" onClick={() => setActiveNav(q.nav)}>
                      <q.Icon size={16} strokeWidth={1.7} aria-hidden />
                      <span>{q.label}</span>
                      <ChevronRight size={16} className="hs-dent-quick-chevron" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
              <div className="cases-panel hs-panel-elevated hs-dent-card">
                <div className="cases-panel-header">
                  <div>
                    <div className="cases-panel-title cases-panel-title--strong">This Week</div>
                    <p className="hs-list-sub hs-list-sub--tight">Procedure breakdown</p>
                  </div>
                </div>
                <div className="hs-dent-week-chart">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={dentalWeekBarData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis hide />
                      <Tooltip />
                      <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                        {dentalWeekBarData.map((entry, index) => (
                          <Cell key={entry.day} fill={["#3b82f6", "#6366f1", "#8b5cf6", "#f97316", "#eab308"][index % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="cases-panel hs-panel-elevated hs-dent-card">
                <div className="cases-panel-header">
                  <div>
                    <div className="cases-panel-title cases-panel-title--strong">Recent Procedures</div>
                    <p className="hs-list-sub hs-list-sub--tight">Last completed</p>
                  </div>
                </div>
                <div className="hs-dent-recent-list">
                  {recentProc.length ? (
                    recentProc.map((c) => (
                      <div key={c.id} className="hs-dent-recent-row">
                        <span className="hs-dent-recent-dot" aria-hidden />
                        <div>
                          <strong>{c.student}</strong>
                          <p className="hs-stat-meta">{c.reason || "Procedure"}</p>
                          <p className="hs-stat-meta">{c.date || "Today"}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="hs-stat-meta">No recent procedures logged.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    const totalPatientsToday = new Set(
      appointmentsList
        .filter((a) => a.dateSort === new Date().toISOString().slice(0, 10))
        .map((a) => a.studentId || a.student),
    ).size;
    const activeQueues = queueStats.waitingNurse + queueStats.waitingProvider + queueStats.inProgress;
    const staffsOnDuty = staffingSummary.onDuty;
    return (
      <>
        <section className="do-home-metrics" aria-label="Admin dashboard metrics">
          <div className="do-metric-card hs-do-metric--visits">
            <div className="do-metric-body">
              <p className="do-metric-value">{totalPatientsToday}</p>
              <p className="do-metric-label">Total Patients Today</p>
              <p className="do-metric-hint">Unique student visits</p>
            </div>
            <div className="do-metric-icon" aria-hidden>
              <Sparkles size={24} strokeWidth={2} />
            </div>
          </div>
          <div className="do-metric-card hs-do-metric--appts">
            <div className="do-metric-body">
              <p className="do-metric-value">{activeQueues}</p>
              <p className="do-metric-label">Active Queues</p>
              <p className="do-metric-hint">Nurse + physician + dentist</p>
            </div>
            <div className="do-metric-icon" aria-hidden>
              <CalendarDays size={24} strokeWidth={2} />
            </div>
          </div>
          <div className="do-metric-card hs-do-metric--cases">
            <div className="do-metric-body">
              <p className="do-metric-value">{staffsOnDuty}</p>
              <p className="do-metric-label">Staffs on Duty</p>
              <p className="do-metric-hint">Ready for patient handling</p>
            </div>
            <div className="do-metric-icon" aria-hidden>
              <Users size={24} strokeWidth={2} />
            </div>
          </div>
        </section>

        <div className="do-home-split">
          <div className="do-panel">
            <div className="do-panel-header">
              <h2 className="do-panel-title">Daily Visits</h2>
              <p className="do-panel-sub">Last 7 days</p>
            </div>
            <div className="do-panel-body" style={{ padding: "18px 22px" }}>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={dailyVisitsTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="visits" stroke="#2563eb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="do-panel">
            <div className="do-panel-header">
              <h2 className="do-panel-title">Peak Hours</h2>
              <p className="do-panel-sub">Today</p>
            </div>
            <div className="do-panel-body" style={{ padding: "18px 22px" }}>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={peakHoursSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="cases-panel hs-panel-elevated" style={{ marginTop: 20 }}>
          <div className="cases-panel-header">
            <div className="cases-panel-title cases-panel-title--strong">Staff Availability</div>
          </div>
          <div className="cases-table-wrapper">
            <table className="cases-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Patient Load</th>
                </tr>
              </thead>
              <tbody>
                {approvedClinicalStaffRows.map((r) => (
                  <tr key={r.id}>
                    <td className="cell-text">{prefixedName(r)}</td>
                    <td className="cell-text">{r.role}</td>
                    <td><span className={pillClass(r.status)}>{r.status === "on-duty" ? "On-Duty" : "Off-Duty"}</span></td>
                    <td className="cell-text">{r.patientLoad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  // --- Nurse Side: Check-In Desk ---
  const renderCheckin = () => (
    isNurseUser ? (
      <>
        <div className="cases-panel hs-panel-elevated">
          <div className="cases-panel-header">
            <div className="cases-panel-title cases-panel-title--strong">Student Check-In & Validation</div>
          </div>
          <div className="cc-modal-body">
            <div className="hs-modal-grid">
              <div className="hs-modal-field">
                <label htmlFor="hs-nurse-checkin-code">Check-In Code</label>
                <input
                  id="hs-nurse-checkin-code"
                  placeholder="e.g. CH-0001"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="numeric"
                  title="Check-in code format: CH- followed by digits (e.g. CH-0001)"
                  value={checkinCodeInput}
                  onChange={(e) => setCheckinCodeInput(sanitizeCheckinCodeInput(e.target.value))}
                />
              </div>
            </div>
            <div className="hs-modal-footer" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="hs-btn-secondary" onClick={verifyCheckinCode}>
                Verify
              </button>
            </div>
            {checkinPreview ? (
              <div className="do-panel hs-checkin-fetched" style={{ marginTop: 14 }}>
                <div className="do-panel-header">
                  <h2 className="do-panel-title">Appointment details</h2>
                </div>
                <div className="do-panel-body" style={{ padding: "12px 16px" }}>
                  <p className="cell-text"><strong>Student:</strong> {checkinPreview.student}</p>
                  <p className="cell-text"><strong>Student ID:</strong> {checkinPreview.studentId || "—"}</p>
                  <p className="cell-text"><strong>Designation:</strong> {hsoDesignationLabel(checkinPreview.designation)}</p>
                  <p className="cell-text"><strong>Service:</strong> {checkinPreview.service || "—"}</p>
                  <p className="cell-text"><strong>Date:</strong> {checkinPreview.date || "—"}</p>
                  <p className="cell-text"><strong>Time:</strong> {checkinPreview.time || "—"}</p>
                  <p className="cell-text"><strong>Reason:</strong> {checkinPreview.consultationType || checkinPreview.purpose || "—"}</p>
                  <p className="cell-text"><strong>Check-in code:</strong> {checkinPreview.checkinCode || "—"}</p>
                  <button type="button" className="hs-btn-primary" onClick={handleCheckinByCode}>
                    Confirm and assign queue number
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </>
    ) : (
    <>
      <div className="hs-stat-row">
        <div className="hs-stat-card">
          <div className="hs-stat-card-top"><p className="hs-stat-value">{queueStats.checkinOpen}</p></div>
          <p className="hs-stat-label">Check-in Open</p>
          <p className="hs-stat-meta">Codes currently valid</p>
        </div>
        <div className="hs-stat-card">
          <div className="hs-stat-card-top"><p className="hs-stat-value">{queueStats.waitingNurse}</p></div>
          <p className="hs-stat-label">Waiting Nurse</p>
          <p className="hs-stat-meta">Queued from nurse desk</p>
        </div>
      </div>
      <div className="cases-panel hs-panel-elevated">
        <div className="cases-panel-header">
          <div className="cases-panel-title cases-panel-title--strong">Check-in Validation</div>
          <p className="hs-list-sub hs-list-sub--tight">
            Format <strong>CH-####</strong> — matches <strong>health_appointments.check_in_code</strong>.
          </p>
        </div>
        <div className="cc-modal-body">
          <div className="hs-modal-grid">
            <div className="hs-modal-field">
              <label htmlFor="hs-admin-checkin-code">Check-in code</label>
              <input
                id="hs-admin-checkin-code"
                placeholder="CH-0001"
                autoComplete="off"
                spellCheck={false}
                inputMode="numeric"
                title="Check-in code format: CH- followed by digits (e.g. CH-0001)"
                value={checkinCodeInput}
                onChange={(e) => setCheckinCodeInput(sanitizeCheckinCodeInput(e.target.value))}
              />
            </div>
          </div>
          <div className="hs-modal-footer" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="cc-btn-primary" onClick={handleCheckinByCode}>
              Validate and Queue
            </button>
          </div>
        </div>
      </div>
    </>
    )
  );

  // --- Nurse Side: Queue Management ---
  const renderQueue = () => (
    isNurseUser ? (
      <>
        <div className="hs-nurse-queue-layout">
          <div className="cases-panel hs-panel-elevated hs-nurse-card">
            <div className="cases-panel-header hs-queue-serving-header">
              <div className="hs-queue-serving-header__status">{queueStationStatusBadge(nurseStationOnline)}</div>
              <p className="hs-nurse-serving-label">NOW SERVING</p>
              <h2 className="hs-nurse-serving-title">QUEUING NUMBER</h2>
            </div>
            <div className="cc-modal-body">
              <div className="hs-nurse-serving-box">
                {(() => {
                  const raw = activeNurseSession?.queueNumber ?? nurseNowServing?.queueNumber;
                  if (raw === undefined || raw === null || raw === "") return "0000";
                  const n = Number(raw);
                  return Number.isFinite(n) && n > 0 ? String(n).padStart(4, "0") : "0000";
                })()}
              </div>
              <div className="hs-nurse-quick-title">QUICK ACTIONS</div>
              <div className="hs-nurse-quick-grid">
                <button type="button" className="hs-btn-secondary" onClick={handleNurseComplete} disabled={!activeNurseSession}>
                  <CheckCircle size={13} /> Complete
                </button>
                <button type="button" className="hs-btn-secondary" onClick={handleNurseNext}>
                  <Send size={13} /> Next
                </button>
                <button type="button" className="hs-btn-secondary" onClick={handleNurseTransfer} disabled={!activeNurseSession}>
                  <Route size={13} /> Transfer
                </button>
                <button type="button" className="hs-btn-secondary" onClick={handleNurseQueueStationStart}>
                  <Activity size={13} /> Start
                </button>
                <button type="button" className="hs-btn-secondary" onClick={handleNurseQueueStationClose}>
                  <X size={13} /> Close
                </button>
                <button type="button" className="hs-btn-secondary" onClick={() => setAddVisitorOpen(true)}>
                  <UserPlus size={13} /> Add Visitor
                </button>
              </div>
            </div>
          </div>
          <div className="cases-panel hs-panel-elevated hs-nurse-card">
            <div className="cases-panel-header">
              <div className="cases-panel-title cases-panel-title--strong">Up Next</div>
              <p className="hs-stat-meta">{`${nurseWaitlistPendingRows.length} in line`}</p>
            </div>
            <div className="cc-modal-body">
              {nurseWaitlistPendingRows.length ? (
                nurseWaitlistPendingRows.slice(0, 5).map((r) => (
                  <div key={r.id} className="hs-nurse-ticket hs-nurse-ticket--upnext">
                    <div className="hs-nurse-ticket-no">
                      <span>TICKET</span>
                      <strong>{String(r.queueNumber || 0).padStart(4, "0")}</strong>
                    </div>
                    <div>
                      <strong>{r.name}</strong>
                      <p>{String(r.reason || "Physician").includes("Dental") ? "Dentist" : "Physician"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyStateMessage
                  icon={Users}
                  title="Queue is empty."
                  description="No patients are waiting. The next check-in will appear here."
                />
              )}
            </div>
          </div>
        </div>
      </>
    ) : (
    <>
      <div className="hs-stat-row-4">
        {[
          { label: "Total Waiting", value: queueStats.waitingNurse + queueStats.waitingProvider },
          { label: "Nurse Queue", value: stationQueueRows.nurse.length },
          { label: "Physician Queue", value: stationQueueRows.physician.length },
          { label: "Dentist Queue", value: stationQueueRows.dentist.length },
        ].map((s) => (
          <div key={s.label} className="hs-stat-card">
            <div className="hs-stat-card-top"><p className="hs-stat-value">{s.value}</p></div>
            <p className="hs-stat-label">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="do-home-split">
        {[
          { title: "Nurse", rows: stationQueueRows.nurse },
          { title: "Physician", rows: stationQueueRows.physician },
          { title: "Dentist", rows: stationQueueRows.dentist },
        ].map((col) => (
          <div className="do-panel" key={col.title}>
            <div className="do-panel-header">
              <h2 className="do-panel-title">{col.title}</h2>
              <p className="do-panel-sub">Station queue</p>
            </div>
            <div className="do-panel-body" style={{ padding: "0 16px 16px" }}>
              {col.rows.length ? (
                col.rows.map((r) => (
                  <div key={r.id} className="hs-consult-row" style={{ gridTemplateColumns: "1fr auto", marginBottom: 8 }}>
                    <div>
                      <p className="hs-consult-name">{r.queueNumber ? String(r.queueNumber).padStart(4, "0") : "—"}</p>
                      <p className="hs-consult-meta">{r.student}</p>
                    </div>
                    <span className={pillClass(statusLabel(r.workflowStatus))}>{statusLabel(r.workflowStatus)}</span>
                  </div>
                ))
              ) : (
                <EmptyStateMessage compact icon={Users} title="No patients in queue." description="Waiting students will list here." />
              )}
            </div>
          </div>
        ))}
      </div>
    </>
    )
  );

  // --- Physician Side: Consultation Workspace ---
  const renderConsultation = () => (
    isPhysicianUser ? (
      <div className="hs-phys-shell">
        <div className="hs-phys-kpi-row">
          <div className="hs-stat-card hs-phys-kpi"><p className="hs-stat-value">{physicianProviderQueueRows.length}</p><p className="hs-stat-label">In Queue</p></div>
          <div className="hs-stat-card hs-phys-kpi"><p className="hs-stat-value">{consultationRows.length}</p><p className="hs-stat-label">Consultations Today</p></div>
          <div className="hs-stat-card hs-phys-kpi"><p className="hs-stat-value">{certificatesList.length}</p><p className="hs-stat-label">Certificates Issued</p></div>
        </div>
        <div className="hs-phys-main-grid">
          <div className="cases-panel hs-panel-elevated hs-phys-card">
            <div className="cases-panel-header"><div className="cases-panel-title cases-panel-title--strong">Physician Queue</div></div>
            <div className="cc-modal-body">
              {physicianProviderQueueRows.slice(0, 5).map((r) => (
                <div className="hs-nurse-ticket hs-nurse-ticket--upnext" key={r.id}>
                  <div className="hs-nurse-ticket-no"><span>TICKET</span><strong>{String(r.queueNumber || 0).padStart(3, "0")}</strong></div>
                  <div><strong>{r.student}</strong><p>{r.reason || "Consultation"}</p></div>
                </div>
              ))}
              {!physicianProviderQueueRows.length ? (
                <EmptyStateMessage
                  icon={Users}
                  title="No waiting patients at the moment."
                  description="New patients will appear here once done with checking the vital signs."
                />
              ) : null}
            </div>
          </div>
          <div className="cases-panel hs-panel-elevated hs-phys-card">
            <div className="cases-panel-header">
              <div className="cases-panel-title cases-panel-title--strong">{physicianProviderQueueRows[0]?.student || "No active patient"}</div>
            </div>
            {!physicianProviderQueueRows[0] ? (
              <div className="cc-modal-body">
                <EmptyStateMessage
                  icon={Stethoscope}
                  title="No active patient selected."
                  description="Select a student from the queue to begin consultation."
                />
              </div>
            ) : (
              <div className="cc-modal-body">
                <div className="hs-phys-vitals-grid" style={{ marginBottom: 14 }}>
                  <div><span>Temp</span><strong>{physicianProviderQueueRows[0]?.nurseVitals?.temperature || "—"}</strong></div>
                  <div><span>BP</span><strong>{physicianProviderQueueRows[0]?.nurseVitals?.bloodPressure || "—"}</strong></div>
                  <div><span>Pulse</span><strong>{physicianProviderQueueRows[0]?.nurseVitals?.pulse || "—"}</strong></div>
                  <div><span>Resp</span><strong>{physicianProviderQueueRows[0]?.nurseVitals?.respiratoryRate || "—"}</strong></div>
                </div>
                <div className="hs-nurse-quick-title">QUICK ACTIONS</div>
                <div className="hs-nurse-quick-grid">
                  {physicianProviderQueueRows[0]?.studentId ? (
                    <button
                      type="button"
                      className="hs-btn-secondary"
                      onClick={() => openPhysicianChart(physicianProviderQueueRows[0].studentId)}
                    >
                      <FileText size={13} /> Open Chart
                    </button>
                  ) : null}
                  <button type="button" className="hs-btn-secondary" onClick={handlePhysicianQueueCompleteOnly}>
                    <CheckCircle size={13} /> Complete
                  </button>
                  <button type="button" className="hs-btn-secondary" onClick={handlePhysicianQueueNext}>
                    <Send size={13} /> Next
                  </button>
                  <button type="button" className="hs-btn-secondary" onClick={handlePhysicianQueueTransfer}>
                    <Route size={13} /> Transfer
                  </button>
                  <button type="button" className="hs-btn-secondary" onClick={handlePhysicianQueueStart}>
                    <Activity size={13} /> Start
                  </button>
                  <button type="button" className="hs-btn-secondary" onClick={handlePhysicianQueueClose}>
                    <X size={13} /> Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ) : (
    <div className="cases-panel hs-panel-elevated">
      <div className="cases-panel-header">
        <div className="cases-panel-title cases-panel-title--strong">Provider Queue</div>
      </div>
      <div className="cases-table-wrapper">
        <table className="cases-table">
          <thead><tr><th>Queue #</th><th>Student</th><th>Provider</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {providerQueueRows.map((a) => (
              <tr key={a.id}>
                <td className="cell-case-id">{a.queueNumber ? String(a.queueNumber).padStart(4, "0") : "—"}</td>
                <td><p className="cell-student-name">{a.student}</p><p className="cell-student-id">{a.studentId}</p></td>
                <td className="cell-text" style={{ textTransform: "capitalize" }}>{a.providerQueue || a.designation || "physician"}</td>
                <td><span className={pillClass(statusLabel(a.workflowStatus))}>{statusLabel(a.workflowStatus)}</span></td>
                <td>
                  {a.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER ? (
                    <button type="button" className="hs-btn-primary" onClick={() => startProviderConsultation(a)}>Start</button>
                  ) : (
                    <button type="button" className="hs-btn-primary" onClick={() => completeProviderConsultation(a)}>Complete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    )
  );

  const renderHealthServicesAnalytics = () => {
    const pad = hsoAnalyticsData;
    const peakTotal = pad.peakMonthSeries.reduce((s, x) => s + x.total, 0);
    const schoolPieActive = pad.schoolPieData.filter((x) => x.value > 0);
    return (
      <>
        <div className="hs-reports-toolbar hs-reports-toolbar--card hs-phys-analytics-toolbar">
          <div className="hs-reports-toolbar-row">
            <div className="hs-phys-analytics-period">
              <span className="hs-reports-period-label">Filters</span>
              <div className="hs-phys-analytics-period-btns" role="group" aria-label="Report period">
                {[
                  { id: "today", label: "Today" },
                  { id: "month", label: "Month" },
                  { id: "year", label: "This Year" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`hs-phys-analytics-period-btn${hsoAnalyticsPeriod === p.id ? " hs-phys-analytics-period-btn--active" : ""}`}
                    onClick={() => setHsoAnalyticsPeriod(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="hs-reports-actions">
              <button type="button" className="hs-reports-btn-outline" onClick={exportHsoAnalyticsCsv}>
                <Download size={16} strokeWidth={1.75} aria-hidden /> CSV
              </button>
              <button type="button" className="hs-reports-btn-pdf" onClick={exportHsoAnalyticsPdf}>
                <Printer size={16} strokeWidth={1.75} aria-hidden /> PDF
              </button>
            </div>
          </div>
        </div>

        <div className="hs-reports-kpi-row hs-reports-kpi-row--hso3">
          <div className="hs-reports-kpi">
            <div className="hs-reports-kpi-top">
              <div className="hs-reports-kpi-icon hs-reports-kpi-icon--blue">
                <Users size={20} strokeWidth={1.75} aria-hidden />
              </div>
            </div>
            <p className="hs-reports-kpi-value">{pad.totalQueues}</p>
            <p className="hs-reports-kpi-label">Total queues</p>
            <p className="hs-reports-kpi-hint">Check-in or queue number in range</p>
          </div>
          <div className="hs-reports-kpi">
            <div className="hs-reports-kpi-top">
              <div className="hs-reports-kpi-icon hs-reports-kpi-icon--teal">
                <FileText size={20} strokeWidth={1.75} aria-hidden />
              </div>
            </div>
            <p className="hs-reports-kpi-value">{pad.certCount}</p>
            <p className="hs-reports-kpi-label">Medical certificates issued</p>
            <p className="hs-reports-kpi-hint">Consultation rows in range</p>
          </div>
          <div className="hs-reports-kpi">
            <div className="hs-reports-kpi-top">
              <div className="hs-reports-kpi-icon hs-reports-kpi-icon--orange">
                <Timer size={20} strokeWidth={1.75} aria-hidden />
              </div>
            </div>
            <p className="hs-reports-kpi-value">{pad.avgWaitMin || "—"}</p>
            <p className="hs-reports-kpi-label">Average waiting time</p>
            <p className="hs-reports-kpi-hint">Minutes from check-in to consult start</p>
          </div>
        </div>

        <div className="do-panel" style={{ marginBottom: 20 }}>
          <div className="do-panel-header">
            <h2 className="do-panel-title">Peak month</h2>
          </div>
          <div className="do-panel-body" style={{ padding: "16px 20px 24px" }}>
            <p className="hs-stat-meta" style={{ marginTop: 0 }}>
              Students visiting HSO by calendar month for {pad.end.getFullYear()}: each visit is counted in the month of the consultation record ({peakTotal} visit(s) in the selected filter).
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={pad.peakMonthSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="hs-reports-charts-grid">
          <div className="hs-reports-chart-panel do-panel">
            <div className="do-panel-header">
              <h2 className="do-panel-title">School visits</h2>
            </div>
            <div className="do-panel-body" style={{ padding: "16px 20px 24px" }}>
              {schoolPieActive.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={schoolPieActive}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {schoolPieActive.map((entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={PHYSICIAN_ANALYTICS_SCHOOL_COLORS[entry.name] || HSO_ANALYTICS_PIE_COLORS[i % HSO_ANALYTICS_PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="hs-stat-meta">No SECA / SASE / SBMA matches in student program text for this period.</p>
              )}
            </div>
          </div>
          <div className="hs-reports-chart-panel do-panel">
            <div className="do-panel-header">
              <h2 className="do-panel-title">Program visits</h2>
            </div>
            <div className="do-panel-body" style={{ padding: "16px 20px 24px" }}>
              {pad.programPieData.length ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pad.programPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {pad.programPieData.map((entry, i) => (
                          <Cell key={entry.name} fill={HSO_ANALYTICS_PIE_COLORS[i % HSO_ANALYTICS_PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="hs-stat-meta" style={{ marginTop: 12 }}>
                    Program from <strong>students.program</strong> (per consultation in range).
                  </p>
                </>
              ) : (
                <p className="hs-stat-meta">No program data for consultations in this period.</p>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  // --- Admin Side: User Management (shared welfare-style accounts UI) ---
  const renderUserManagement = () => (
    <div className="hs-user-mgmt-embed">
      <UserManagement filterOffices={["health"]} />
    </div>
  );

  // --- Admin Side: Staff Scheduling ---
  const renderStaffScheduling = () => (
    <>
      <WeeklyStaffSchedulePanel
        supabase={supabase}
        staffRows={approvedClinicalStaffRows.map((r) => ({
          id: r.id,
          name: r.name,
          titlePrefix: r.titlePrefix,
          role: r.role,
        }))}
        mode="health"
      />
      <div className="cases-panel hs-panel-elevated" style={{ marginTop: 16 }}>
        <div className="cases-panel-header"><div className="cases-panel-title cases-panel-title--strong">Clinic & Nursing Office Hours</div></div>
        <div className="cc-modal-body">
          <p className="hs-consult-meta">Monday to Friday: 7:00 AM - 9:00 PM</p>
          <p className="hs-consult-meta" style={{ marginTop: 8 }}>Saturday: 7:00 AM - 7:00 PM</p>
        </div>
      </div>
    </>
  );

  // --- Dentist Side: Queue ---
  const renderDentistQueue = () => {
    const serving = dentistQueueRows[0];
    const rest = dentistQueueRows.slice(1);
    const avgWait = dentistQueueRows.length ? Math.min(40, 7 + dentistQueueRows.length * 2) : 0;
    return (
      <div className="hs-phys-queue-layout hs-dent-queue-page">
        <div className="cases-panel hs-panel-elevated hs-phys-card">
          <div className="cases-panel-header hs-dent-queue-serving-head hs-queue-serving-header">
            <div className="hs-queue-serving-header__status">{queueStationStatusBadge(dentistStationOnline)}</div>
            <p className="hs-nurse-serving-label">NOW SERVING</p>
            <h2 className="hs-nurse-serving-title">QUEUING NUMBER</h2>
          </div>
          <div className="cc-modal-body">
            <div className="hs-nurse-serving-box hs-dent-q-badge">
              {serving?.queueNumber ? `Q${String(serving.queueNumber).padStart(2, "0")}` : "—"}
            </div>
            {!dentistQueueRows.length ? (
              <EmptyStateMessage
                compact
                icon={Users}
                title="No patients in dentist queue."
                description="Patients routed from triage will appear here."
              />
            ) : null}
            <div className="hs-nurse-quick-title">QUICK ACTIONS</div>
            <div className="hs-nurse-quick-grid">
              <button type="button" className="hs-btn-secondary" onClick={handleDentistQueueCompleteOnly}>
                <CheckCircle size={13} /> Complete
              </button>
              <button type="button" className="hs-btn-secondary" onClick={handleDentistQueueNext}>
                <Send size={13} /> Next
              </button>
              <button type="button" className="hs-btn-secondary" onClick={handleDentistQueueTransfer}>
                <Route size={13} /> Transfer
              </button>
              <button type="button" className="hs-btn-secondary" onClick={handleDentistQueueStart}>
                <Activity size={13} /> Start
              </button>
              <button type="button" className="hs-btn-secondary" onClick={handleDentistQueueClose}>
                <X size={13} /> Close
              </button>
            </div>
          </div>
        </div>
        <div className="cases-panel hs-panel-elevated hs-phys-card">
          <div className="cases-panel-header hs-dent-upnext-head">
            <div className="cases-panel-title cases-panel-title--strong">Up Next</div>
            <div className="hs-dent-upnext-meta">
              <span>
                <Clock size={14} aria-hidden /> Avg. wait {avgWait}m
              </span>
              <span>
                <Users size={14} aria-hidden /> {dentistQueueRows.length} in line
              </span>
            </div>
          </div>
          <div className="cc-modal-body">
            {rest.length ? (
              rest.map((r) => (
                <div className="hs-dent-queue-row" key={r.id}>
                  <div className="hs-dent-queue-ticket">
                    <span className="hs-dent-queue-ticket-label">TICKET</span>
                    <strong>{`Q${String(r.queueNumber || 0).padStart(2, "0")}`}</strong>
                  </div>
                  <div className="hs-dent-queue-info">
                    <strong>{r.student}</strong>
                    <p className="hs-stat-meta">Dentist</p>
                  </div>
                  <div className="hs-dent-queue-wait">
                    <Clock size={12} aria-hidden />
                    <span>~{Math.max(5, (r.queueNumber || 1) * 2)}m Waiting</span>
                  </div>
                </div>
              ))
            ) : serving ? (
              <p className="hs-stat-meta">No other patients waiting after the current ticket.</p>
            ) : (
              <EmptyStateMessage icon={Users} title="Queue is empty." description="Upcoming dentist tickets will list here." />
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- Dentist Side: Patient Records ---
  const renderDentistPatientRecords = () => {
    const q = dentalRecordsSearch.trim().toLowerCase();
    const filtered = healthRecordsRows.filter((r) => {
      if (!q) return true;
      return `${r.student || ""} ${r.studentId || ""}`.toLowerCase().includes(q);
    });
    const selected = healthRecordsRows.find((r) => String(r.id) === String(dentalRecordsSelectedId)) || null;
    const procRows = selected
      ? consultationRows
          .filter((row) =>
            selected.studentId
              ? String(row.studentId || "").toLowerCase() === String(selected.studentId || "").toLowerCase()
              : String(row.student || "").toLowerCase() === String(selected.student || "").toLowerCase(),
          )
          .slice(0, 12)
      : [];
    return (
      <div className="hs-dent-records-grid">
        <div className="cases-panel hs-panel-elevated hs-dent-card">
          <div className="cc-modal-body hs-dent-records-search">
            <div className="search-bar-wrapper" style={{ marginBottom: 0 }}>
              <span className="search-icon" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5.333" stroke="#64748B" strokeWidth="1.5" />
                  <path d="M13.333 13.333L10 10" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <input
                className="search-input"
                placeholder="Search patient..."
                value={dentalRecordsSearch}
                onChange={(e) => setDentalRecordsSearch(e.target.value)}
              />
            </div>
            <div className="hs-dent-record-list">
              {filtered.length ? (
                filtered.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`hs-dent-record-item${String(r.id) === String(dentalRecordsSelectedId) ? " hs-dent-record-item--active" : ""}`}
                    onClick={() => setDentalRecordsSelectedId(r.id)}
                  >
                    <strong>{r.student}</strong>
                    <p className="hs-stat-meta">{r.program || r.studentId || "—"}</p>
                  </button>
                ))
              ) : (
                <p className="hs-stat-meta">No patients match your search.</p>
              )}
            </div>
          </div>
        </div>
        <div className="cases-panel hs-panel-elevated hs-dent-card">
          {selected ? (
            <>
              <div className="hs-dent-detail-head">
                <div>
                  <p className="hs-dent-kicker">PATIENT</p>
                  <h3 className="hs-dent-patient-name">{selected.student}</h3>
                  <p className="hs-stat-meta">
                    {selected.program || "—"} · Last visit {selected.last || formatVisitDateLabel(new Date())}
                  </p>
                </div>
                <button type="button" className="hs-btn-secondary hs-dent-open-chart" onClick={() => setActiveNav("dentalChart")}>
                  <Smile size={14} aria-hidden />
                  Open Chart
                </button>
              </div>
              <div className="hs-dent-detail-tabs">
                {[
                  { id: "procedures", label: "Procedure History" },
                  { id: "xrays", label: "X-rays" },
                  { id: "pfollow", label: "Follow-ups" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`hs-dent-detail-tab${dentalPatientTab === t.id ? " hs-dent-detail-tab--active" : ""}`}
                    onClick={() => setDentalPatientTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="cc-modal-body hs-dent-detail-body">
                {dentalPatientTab === "procedures" ? (
                  procRows.length ? (
                    <div className="hs-dent-proc-list">
                      {procRows.map((row) => (
                        <div key={row.id} className="hs-dent-proc-card">
                          <div className="hs-dent-proc-icon" aria-hidden>
                            <Smile size={16} />
                          </div>
                          <div>
                            <p className="hs-stat-meta">{row.date || "—"}</p>
                            <strong>{row.reason || "Dental procedure"}</strong>
                            <p className="hs-stat-meta">{row.notes || "No complications"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyStateMessage compact icon={FileText} title="No procedure history for this patient." />
                  )
                ) : null}
                {dentalPatientTab === "xrays" ? (
                  <EmptyStateMessage
                    compact
                    icon={FileText}
                    title="No imaging on file."
                    description="Upload or link radiographs from the charting workflow."
                  />
                ) : null}
                {dentalPatientTab === "pfollow" ? (
                  dentalFollowupRows.filter((f) => f.studentId === selected.studentId || f.student === selected.student).length ? (
                    <div className="hs-dent-proc-list">
                      {dentalFollowupRows
                        .filter((f) => f.studentId === selected.studentId || f.student === selected.student)
                        .map((f) => (
                          <div key={f.id} className="hs-dent-proc-card">
                            <div className="hs-dent-proc-icon" aria-hidden>
                              <CalendarDays size={16} />
                            </div>
                            <div>
                              <strong>{f.dateSort || "—"}</strong>
                              <p className="hs-stat-meta">
                                {f.time} · {f.reason}
                              </p>
                              <span className={pillClass(f.status)}>{f.status}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <EmptyStateMessage compact icon={CalendarDays} title="No follow-ups scheduled." />
                  )
                ) : null}
              </div>
            </>
          ) : (
            <div className="cc-modal-body">
              <EmptyStateMessage
                icon={Users}
                title="No patient selected."
                description="Choose a patient from the list to view dental records."
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Dentist Side: Dental Chart Workspace ---
  const renderDentistChartWorkspace = () => {
    const chartQueue = dentistQueueRows.slice(0, 5);
    const paintOpts = [
      { id: "healthy", label: "Healthy" },
      { id: "caries", label: "Caries" },
      { id: "filled", label: "Filled" },
      { id: "missing", label: "Missing" },
    ];
    const procOpts = ["Cleaning", "Filling", "Extraction", "Root Canal", "X-ray", "Sealant", "Fluoride", "Whitening"];
    return (
      <div className="hs-dent-chart-shell">
        <div className="hs-phys-kpi-row hs-dent-chart-kpis">
          <div className="hs-stat-card hs-phys-kpi">
            <div className="hs-stat-card-top">
              <p className="hs-stat-value">{dentistQueueRows.length}</p>
              <Users size={18} className="hs-dent-kpi-inline-icon" aria-hidden />
            </div>
            <p className="hs-stat-label">IN QUEUE</p>
          </div>
          <div className="hs-stat-card hs-phys-kpi">
            <div className="hs-stat-card-top">
              <p className="hs-stat-value">{consultationRows.length}</p>
              <Activity size={18} className="hs-dent-kpi-inline-icon" aria-hidden />
            </div>
            <p className="hs-stat-label">PROCEDURES TODAY</p>
          </div>
          <div className="hs-stat-card hs-phys-kpi">
            <div className="hs-stat-card-top">
              <p className="hs-stat-value">{dentalFollowupRows.length}</p>
              <CalendarDays size={18} className="hs-dent-kpi-inline-icon" aria-hidden />
            </div>
            <p className="hs-stat-label">FOLLOW-UPS SCHEDULED</p>
          </div>
        </div>
        <div className="hs-dent-chart-grid">
          <div className="cases-panel hs-panel-elevated hs-dent-card">
            <div className="cases-panel-header">
              <div className="cases-panel-title cases-panel-title--strong">Doctor Queue</div>
            </div>
            <div className="cc-modal-body hs-dent-doc-queue-body">
              {chartQueue.length ? (
                chartQueue.map((r) => (
                  <div className="hs-dent-doc-queue-row" key={r.id}>
                    <div className="hs-dent-queue-ticket hs-dent-queue-ticket--wide">
                      <span className="hs-dent-queue-ticket-label">TICKET</span>
                      <strong>{String(r.queueNumber || 0).padStart(4, "0")}</strong>
                    </div>
                    <div className="hs-dent-queue-info">
                      <strong>{r.student}</strong>
                      <p className="hs-stat-meta">{r.consultationType || r.purpose || "Dental visit"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyStateMessage compact icon={Users} title="No patients in queue." />
              )}
            </div>
          </div>
          <div className="cases-panel hs-panel-elevated hs-dent-card hs-dent-chart-main">
            <div className="hs-odont-header">
              <div>
                <div className="cases-panel-title cases-panel-title--strong">Odontogram</div>
                <p className="hs-list-sub hs-list-sub--tight">FDI / ISO 3950 numbering · clinician&apos;s view</p>
              </div>
              <div className="hs-odont-toggle" role="group" aria-label="Dentition type">
                <button
                  type="button"
                  className={dentalOdontogramArch === "permanent" ? "hs-odont-toggle-btn hs-odont-toggle-btn--on" : "hs-odont-toggle-btn"}
                  onClick={() => setDentalOdontogramArch("permanent")}
                >
                  Permanent (32)
                </button>
                <button
                  type="button"
                  className={dentalOdontogramArch === "primary" ? "hs-odont-toggle-btn hs-odont-toggle-btn--on" : "hs-odont-toggle-btn"}
                  onClick={() => setDentalOdontogramArch("primary")}
                >
                  Primary (20)
                </button>
              </div>
            </div>
            <div className="hs-odont-paint-row">
              {paintOpts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`hs-odont-paint${dentalOdontogramPaint === p.id ? " hs-odont-paint--active" : ""}`}
                  onClick={() => setDentalOdontogramPaint(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="hs-dent-odont-wrap">
              <DentistOdontogram
                arch={dentalOdontogramArch === "primary" ? "primary" : "permanent"}
                paintStatus={dentalOdontogramPaint}
                teethStatus={dentalToothStatus}
                onTeethChange={(num, status) => setDentalToothStatus((prev) => ({ ...prev, [num]: status }))}
              />
            </div>
            <div className="hs-dent-proc-pills">
              {procOpts.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`hs-dent-proc-pill${dentalProcedurePick === p ? " hs-dent-proc-pill--active" : ""}`}
                  onClick={() => setDentalProcedurePick(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="hs-dent-chart-split">
              <div className="hs-dent-chart-notes">
                <label className="hs-stat-meta">Prescription</label>
                <textarea className="hs-dent-textarea" placeholder="Mefenamic 500mg - q6h - 5 days." rows={3} />
                <label className="hs-stat-meta">Notes</label>
                <textarea className="hs-dent-textarea" placeholder="Procedure notes..." rows={3} />
              </div>
              <div className="hs-dent-follow-card">
                <strong>Follow-up</strong>
                <div className="hs-modal-field">
                  <label>Date</label>
                  <input type="date" />
                </div>
                <div className="hs-modal-field">
                  <label>Time</label>
                  <input type="time" />
                </div>
                <div className="hs-modal-field">
                  <label>Reason</label>
                  <input placeholder="Recall - Continued treatment" />
                </div>
                <button type="button" className="hs-btn-secondary hs-dent-btn hs-dent-btn--block">
                  Schedule Follow-up
                </button>
              </div>
            </div>
            <div className="hs-dent-save-wrap">
              <button type="button" className="hs-btn-primary hs-dent-btn hs-dent-btn--block">
                Save &amp; Complete Visit
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Dentist Side: Follow-up Appointments ---
  const renderDentistFollowups = () => {
    const q = dentalFollowupSearch.trim().toLowerCase();
    const list = dentalFollowupRows.filter((r) => {
      if (!q) return true;
      return `${r.student} ${r.studentId} ${r.reason}`.toLowerCase().includes(q);
    });
    const upcoming = dentalFollowupRows.length;
    const confirmed = dentalFollowupRows.filter((r) => r.status === "confirmed").length;
    const pending = dentalFollowupRows.filter((r) => r.status === "pending").length;
    const thisWeek = Math.min(upcoming, 5);
    return (
      <>
        <div className="hs-dent-kpi-row">
          {[
            { label: "UPCOMING", value: String(upcoming), Icon: CalendarDays, tone: "blue" },
            { label: "CONFIRMED", value: String(confirmed), Icon: CheckCircle, tone: "green" },
            { label: "PENDING", value: String(pending), Icon: Phone, tone: "orange" },
            { label: "THIS WEEK", value: String(thisWeek), Icon: Clock, tone: "purple" },
          ].map((s) => (
            <div key={s.label} className="hs-stat-card hs-dent-kpi-card">
              <div className="hs-stat-card-top">
                <p className="hs-stat-value">{s.value}</p>
                <div className={`hs-dent-kpi-icon hs-dent-kpi-icon--${s.tone}`} aria-hidden>
                  <s.Icon size={18} strokeWidth={1.8} />
                </div>
              </div>
              <p className="hs-stat-label">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="cases-panel hs-panel-elevated hs-dent-card">
          <div className="cases-panel-header hs-dent-fu-head">
            <div className="cases-panel-title cases-panel-title--strong">Scheduled Follow-ups</div>
            <input
              className="hs-filter-input hs-dent-fu-search"
              placeholder="Search patient..."
              value={dentalFollowupSearch}
              onChange={(e) => setDentalFollowupSearch(e.target.value)}
            />
          </div>
          <div className="cc-modal-body hs-dent-fu-list">
            {list.length ? (
              list.map((r) => {
                const ds = r.dateSort ? String(r.dateSort) : "";
                const [yy, mm, dd] = ds.split("-");
                const monthLbl = ds
                  ? new Date(Number(yy), Number(mm) - 1, Number(dd)).toLocaleString("en-US", { month: "short" }).toUpperCase()
                  : "—";
                return (
                  <div key={r.id} className="hs-dent-fu-row">
                    <div className="hs-dent-fu-datebox">
                      <span className="hs-dent-fu-mon">{monthLbl}</span>
                      <strong>{dd || "—"}</strong>
                    </div>
                    <div className="hs-dent-fu-main">
                      <strong>{r.student}</strong>
                      <p className="hs-stat-meta">
                        {r.time} · {r.reason}
                      </p>
                    </div>
                    <span className={`hs-dent-fu-status ${pillClass(r.status)}`}>{r.status}</span>
                    <button type="button" className="hs-dent-reschedule">
                      <Phone size={14} aria-hidden />
                      Reschedule
                    </button>
                  </div>
                );
              })
            ) : (
              <EmptyStateMessage
                icon={CalendarDays}
                title="No follow-ups scheduled."
                description="Schedule recalls from the dental chart or appointments."
              />
            )}
          </div>
        </div>
      </>
    );
  };

  // --- Visits View: Physician and Nurse Listing ---
  const renderVisits = () => {
    if (isPhysicianUser) {
      const physicianQueueRows = workflowRows
        .filter((r) =>
          [HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER, HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS].includes(r.workflowStatus),
        )
        .filter((r) => (r.providerQueue || r.designation || "").toLowerCase() === "physician")
        .slice(0, 5);
      return (
        <div className="hs-phys-queue-layout">
          <div className="cases-panel hs-panel-elevated hs-phys-card">
            <div className="cases-panel-header hs-queue-serving-header">
              <div className="hs-queue-serving-header__status">{queueStationStatusBadge(physicianStationOnline)}</div>
              <p className="hs-nurse-serving-label">NOW SERVING</p>
              <h2 className="hs-nurse-serving-title">QUEUING NUMBER</h2>
            </div>
            <div className="cc-modal-body">
              <div className="hs-nurse-serving-box">
                {physicianQueueRows[0]?.queueNumber
                  ? String(physicianQueueRows[0].queueNumber).padStart(4, "0")
                  : "----"}
              </div>
              {!physicianQueueRows.length ? (
                <EmptyStateMessage
                  compact
                  icon={Users}
                  title="No waiting patients at the moment."
                  description="New patients will appear here once done with checking the vital signs."
                />
              ) : null}
              <div className="hs-nurse-quick-title">QUICK ACTIONS</div>
              <div className="hs-nurse-quick-grid">
                {physicianQueueRows[0]?.studentId ? (
                  <button
                    type="button"
                    className="hs-btn-secondary"
                    onClick={() => openPhysicianChart(physicianQueueRows[0].studentId)}
                  >
                    <FileText size={13} /> Open Chart
                  </button>
                ) : null}
                <button type="button" className="hs-btn-secondary" onClick={handlePhysicianQueueCompleteOnly}>
                  <CheckCircle size={13} /> Complete
                </button>
                <button type="button" className="hs-btn-secondary" onClick={handlePhysicianQueueNext}>
                  <Send size={13} /> Next
                </button>
                <button type="button" className="hs-btn-secondary" onClick={handlePhysicianQueueTransfer}>
                  <Route size={13} /> Transfer
                </button>
                <button type="button" className="hs-btn-secondary" onClick={handlePhysicianQueueStart}>
                  <Activity size={13} /> Start
                </button>
                <button type="button" className="hs-btn-secondary" onClick={handlePhysicianQueueClose}>
                  <X size={13} /> Close
                </button>
              </div>
            </div>
          </div>
          <div className="cases-panel hs-panel-elevated hs-phys-card">
            <div className="cases-panel-header"><div className="cases-panel-title cases-panel-title--strong">Up Next</div></div>
            <div className="cc-modal-body">
              {physicianQueueRows.map((r) => (
                <div className="hs-nurse-ticket hs-nurse-ticket--upnext" key={r.id}>
                  <div className="hs-nurse-ticket-no"><span>TICKET</span><strong>{String(r.queueNumber || 0).padStart(4, "0")}</strong></div>
                  <div><strong>{r.studentLabel}</strong><p>{r.providerQueue || r.reason || "Physician"}</p></div>
                </div>
              ))}
              {!physicianQueueRows.length ? (
                <EmptyStateMessage
                  icon={Users}
                  title="No waiting patients at the moment."
                  description="New patients will appear here once done with checking the vital signs."
                />
              ) : null}
            </div>
          </div>
        </div>
      );
    }
    const qv = search.toLowerCase();
    const todayStr = formatVisitDateLabel(new Date());
    const filtered = consultationRows.filter((c) => {
      if (visitTab === "today") return c.date === todayStr;
      if (visitTab === "followups") return c.followup;
      return true;
    }).filter((c) => {
      if (!qv) return true;
      return `${c.student} ${c.studentId} ${c.reason}`.toLowerCase().includes(qv);
    });
    return (
      <>
        <div className="hs-stat-row-4">
          {[
            { icon: Sparkles, label: "Today's Visits", value: String(visitTabStats.todayTotal), sub: "Matching today’s date" },
            { icon: Stethoscope, label: "Walk-ins", value: String(visitTabStats.walkins), sub: "All time in list" },
            { icon: CalendarDays, label: "Scheduled", value: String(visitTabStats.scheduled), sub: "Visit type" },
            { icon: AlertCircle, label: "Follow-ups", value: String(visitTabStats.followups), sub: "Flagged follow-up" },
          ].map((s) => (
            <div key={s.label} className="hs-stat-card">
              <div className="hs-stat-card-top">
                <div className="hs-stat-icon" aria-hidden>
                  <s.icon size={20} strokeWidth={1.5} />
                </div>
                <p className="hs-stat-value">{s.value}</p>
              </div>
              <p className="hs-stat-label">{s.label}</p>
              <p className="hs-stat-meta">{s.sub}</p>
            </div>
          ))}
        </div>
        <div className="hs-filter-card">
          <div className="search-bar-wrapper" style={{ marginBottom: 0 }}>
            <span className="search-icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5.333" stroke="#64748B" strokeWidth="1.5" />
                <path d="M13.333 13.333L10 10" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="search-input"
              placeholder="Search by student name, ID, or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="hs-select" aria-label="Visit type filter" defaultValue="all">
            <option value="all">All Types</option>
            <option value="walkin">Walk-in</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
        <div className="hs-tabs">
          {[
            { id: "all", label: "All Consultations" },
            { id: "today", label: "Today" },
            { id: "followups", label: "Follow-ups Required" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`hs-tab${visitTab === t.id ? " hs-tab-active" : ""}`}
              onClick={() => setVisitTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="cases-panel hs-panel-elevated">
          <div className="cases-panel-header">
            <div className="cases-panel-top">
              <div>
                <div className="cases-panel-title cases-panel-title--strong">All Consultations ({filtered.length})</div>
                <p className="hs-list-sub hs-list-sub--tight">Confidential — medical staff only</p>
              </div>
            </div>
          </div>
          <div className="cases-table-wrapper hs-recent-list" style={{ paddingTop: 4 }}>
            {filtered.map((c) => {
              const statusLabel = consultStatusToLabel(c.status);
              return (
                <div key={c.id} className="hs-recent-item hs-recent-item--wide">
                  <div className="hs-recent-main">
                    <p className="hs-recent-name">
                      {c.student}
                      <span className="hs-recent-time">• {c.time}</span>
                    </p>
                    <p className="hs-recent-reason">{c.reason}</p>
                    <p className="hs-consult-meta hs-consult-meta--inline">
                      {c.studentId} · {c.type}
                      {c.followup ? " · Follow-up" : ""}
                    </p>
                  </div>
                  <div className="hs-recent-actions">
                    <span className={`${pillClass(statusLabel)} hs-recent-status`}>{statusLabel.toLowerCase()}</span>
                    <select
                      className="hs-select hs-visit-status-select"
                      aria-label={`Status for visit ${c.id}`}
                      value={String(c.status || "pending").toLowerCase()}
                      onChange={(e) => {
                        e.stopPropagation();
                        persistVisitDisposition(c.id, e.target.value);
                      }}
                    >
                      {HS_VISIT_DISPOSITIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="hs-link-action" onClick={() => setConsultDetail(c)}>
                      <Eye size={14} strokeWidth={1.5} aria-hidden />
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  };

  const renderRecords = () => (
    isPhysicianUser ? (
      <div className="hs-phys-records-grid">
        <div className="cases-panel hs-panel-elevated hs-phys-card">
          <div className="cc-modal-body hs-phys-records-left">
            {physicianSidebarRecords.length ? (
              <>
                <div className="hs-modal-field hs-phys-records-search">
                  <input className="hs-filter-input" placeholder="Search patient…" readOnly title="Filter coming soon" />
                </div>
                <div className="hs-phys-records-list">
                  {physicianSidebarRecords.slice(0, 24).map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      className={`hs-nurse-ticket hs-phys-records-pick${
                        normalizeStudentIdMatch(selectedPhysicianSidebarPatient?.studentId) ===
                        normalizeStudentIdMatch(r.studentId)
                          ? " hs-phys-records-pick--active"
                          : ""
                      }`}
                      onClick={() => setPhysicianRecordsStudentId(r.studentId)}
                    >
                      <strong>{r.student}</strong>
                      <p>{r.studentId} • {r.allergies || "No known allergies"}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <EmptyStateMessage
                compact
                icon={Users}
                title="No patients in roster yet."
                description="Students appear here from medical records or from today’s appointment queue."
              />
            )}
          </div>
        </div>
        <div className="cases-panel hs-panel-elevated hs-phys-card">
          {selectedPhysicianSidebarPatient ? (
            <>
              <div className="cases-panel-header hs-phys-records-header">
                <div>
                  <div className="cases-panel-title cases-panel-title--strong">{selectedPhysicianSidebarPatient.student}</div>
                  <p className="hs-stat-meta">{selectedPhysicianSidebarPatient.studentId} · {selectedPhysicianSidebarPatient.allergies || "No known allergies"}</p>
                </div>
                <button type="button" className="hs-btn-secondary" onClick={() => openPhysicianChart(selectedPhysicianSidebarPatient.studentId)}>
                  Open Chart
                </button>
              </div>
              <div className="cc-modal-body hs-phys-records-right hs-phys-records-detail">
                <div className="hs-phys-tab-row hs-phys-tab-row--records">
                  {[
                    { id: "timeline", label: "Timeline" },
                    { id: "prescriptions", label: "Prescription" },
                    { id: "documents", label: "Documents" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`hs-phys-tab-btn${physicianRecordsSubTab === tab.id ? " hs-phys-tab-btn--active" : ""}`}
                      onClick={() => setPhysicianRecordsSubTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {physicianRecordsSubTab === "timeline" ? (
                  physicianRecordTimelineRows.length ? (
                    <div className="hs-phys-records-list hs-phys-records-list--timeline">
                      <p className="hs-phys-records-hint">
                        Consultation history (date, time, and service). Medical history and exam details stay in Open Chart.
                      </p>
                      {physicianRecordTimelineRows.map((c) => {
                        const serviceLabel =
                          String(c.service || "").trim() && String(c.service).trim() !== "—"
                            ? c.service
                            : c.reason;
                        const drLine = formatPhysicianTimelineDoctor(c.doctor);
                        const st = String(c.status || "").toLowerCase();
                        const statusMod =
                          st === "completed" || st === "complete"
                            ? "hs-phys-pr-status-pill--success"
                            : st === "cancelled" || st === "canceled"
                              ? "hs-phys-pr-status-pill--muted"
                              : "hs-phys-pr-status-pill--neutral";
                        return (
                          <div key={c.id} className="hs-phys-pr-timeline-card">
                            <div className="hs-phys-pr-timeline-card__row hs-phys-pr-timeline-card__row--top">
                              <span className="hs-phys-pr-timeline-card__when">
                                {c.date}
                                <span className="hs-phys-pr-timeline-card__dot"> · </span>
                                {c.time}
                              </span>
                              <span className={`hs-phys-pr-status-pill ${statusMod}`}>
                                {consultStatusToLabel(c.status)}
                              </span>
                            </div>
                            <div className="hs-phys-pr-timeline-card__row hs-phys-pr-timeline-card__row--detail">
                              <span className="hs-phys-pr-timeline-card__svc">
                                <span className="hs-phys-pr-timeline-card__svc-label">Service</span>
                                <span className="hs-phys-pr-timeline-card__svc-value">{serviceLabel}</span>
                              </span>
                              {drLine ? <span className="hs-phys-pr-timeline-card__dr">{drLine}</span> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyStateMessage
                      compact
                      icon={FileText}
                      title="No consultation history yet."
                      description="When a visit is completed from the physician queue, it appears here with date, time, and service."
                    />
                  )
                ) : null}
                {physicianRecordsSubTab === "prescriptions" ? (
                  <div className="hs-phys-records-list">
                    <p className="hs-phys-records-hint">
                      Rows are dated from completed visits (physician queue) or from the latest{" "}
                      <strong>Save chart</strong> when the prescription field is filled. Click a row for full text.
                    </p>
                    <div className="hs-phys-student-accordion hs-phys-rx-accordion hs-phys-rx-accordion--records">
                      {selectedPhysicianPrescriptionHistoryRows.length ? (
                        selectedPhysicianPrescriptionHistoryRows.map((c) => {
                          const expanded = physicianRecordsRxExpandedId === c.id;
                          const rxText = c.prescription || c.treatment;
                          return (
                            <div key={c.id} className="hs-phys-student-group hs-nurse-ticket hs-phys-pr-rx-card">
                              <button
                                type="button"
                                className="hs-phys-student-group-header"
                                aria-expanded={expanded}
                                onClick={() =>
                                  setPhysicianRecordsRxExpandedId((cur) => (cur === c.id ? null : c.id))
                                }
                              >
                                <div style={{ minWidth: 0 }}>
                                  <strong className="hs-phys-pr-rx-card__title">
                                    Consultation · {c.date}
                                    <span className="hs-phys-pr-rx-card__time">{c.time}</span>
                                  </strong>
                                  <p className="hs-phys-pr-rx-card__subtitle">
                                    {c.service || c.reason}
                                    {c.doctor && c.doctor !== "—"
                                      ? ` · ${formatPhysicianTimelineDoctor(c.doctor)}`
                                      : ""}
                                  </p>
                                  {!expanded ? (
                                    <p
                                      className="hs-stat-meta hs-phys-rx-list-preview"
                                      style={{ margin: "8px 0 0" }}
                                    >
                                      {prescriptionRowListPreview(rxText)}
                                    </p>
                                  ) : null}
                                </div>
                                <ChevronRight
                                  size={18}
                                  aria-hidden
                                  style={{
                                    flexShrink: 0,
                                    transform: expanded ? "rotate(90deg)" : "none",
                                    transition: "transform 0.15s ease",
                                  }}
                                />
                              </button>
                              {expanded ? (
                                <div className="hs-phys-rx-acc-detail">
                                  <p style={{ margin: 0, fontWeight: 600 }}>Prescription</p>
                                  <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                                    {rxText?.trim()
                                      ? rxText
                                      : "No prescription was recorded for this visit."}
                                  </p>
                                  {c.diagnosis ? (
                                    <p className="hs-stat-meta" style={{ marginTop: 12 }}>
                                      <strong>Diagnosis:</strong> {c.diagnosis}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      ) : null}
                    </div>
                    {!selectedPhysicianPrescriptionHistoryRows.length ? (
                      <EmptyStateMessage
                        compact
                        icon={FileText}
                        title="No prescription history yet."
                        description="Complete a visit from the physician queue, or save the chart with prescription text so a dated row is logged for this student."
                      />
                    ) : null}
                  </div>
                ) : null}
                {physicianRecordsSubTab === "documents" ? (
                  <div className="hs-phys-records-doc-wrap">
                    <p className="hs-phys-records-hint">
                      Uploaded files (labs, imaging) and issued medical certificates. Preview opens below without downloading.
                    </p>
                    {selectedPhysicianCertificateDocs.length ? (
                      <div className="hs-phys-records-doc-section">
                        <strong>Medical certificates</strong>
                        <ul className="hs-phys-chart-doc-list hs-phys-chart-doc-list--compact">
                          {selectedPhysicianCertificateDocs.map((cert) => (
                            <li key={cert.id} className="hs-phys-chart-doc-row">
                              <button
                                type="button"
                                className="hs-phys-doc-preview-btn"
                                onClick={() =>
                                  setPhysicianRecordDocPreview({
                                    kind: "certificate",
                                    title: `Certificate · ${cert.consultationDateTimeLabel || cert.date}`,
                                    body: [
                                      `Reason: ${cert.certificateReason || cert.certReason}`,
                                      cert.certificatePeriod ? `Period: ${cert.certificatePeriod}` : "",
                                      cert.certificateStatus ? `Status: ${cert.certificateStatus}` : "",
                                    ]
                                      .filter(Boolean)
                                      .join("\n"),
                                  })
                                }
                              >
                                <FileText size={14} aria-hidden />
                                <span>View certificate — {cert.consultationDateTimeLabel || cert.date}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {selectedPhysicianHealthRecord?.physicianDocumentsAttachments?.length ? (
                      <div className="hs-phys-records-doc-section">
                        <strong>Uploaded files</strong>
                        <ul className="hs-phys-chart-doc-list hs-phys-chart-doc-list--compact">
                          {selectedPhysicianHealthRecord.physicianDocumentsAttachments.map((a) => (
                            <li key={a.path || a.url} className="hs-phys-chart-doc-row">
                              <button
                                type="button"
                                className="hs-phys-doc-preview-btn"
                                onClick={() => {
                                  const url = a.url;
                                  if (patientRecordDocUrlIsImage(url)) {
                                    setPhysicianRecordDocPreview({ kind: "image", url, title: a.name || "Image" });
                                  } else if (patientRecordDocUrlIsPdf(url)) {
                                    setPhysicianRecordDocPreview({ kind: "pdf", url, title: a.name || "PDF" });
                                  } else {
                                    setPhysicianRecordDocPreview({
                                      kind: "other",
                                      url,
                                      title: a.name || "File",
                                    });
                                  }
                                }}
                              >
                                <Eye size={14} aria-hidden />
                                <span>Preview — {a.name || "File"}</span>
                              </button>
                              {a.uploadedAt ? (
                                <span className="hs-stat-meta">{new Date(a.uploadedAt).toLocaleString()}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {selectedPhysicianHealthRecord?.physicianDocumentsNotes ? (
                      <div className="hs-phys-records-doc-section hs-phys-records-doc-section--notes">
                        <strong>Document notes</strong>
                        <p className="hs-stat-meta" style={{ whiteSpace: "pre-wrap" }}>
                          {selectedPhysicianHealthRecord.physicianDocumentsNotes}
                        </p>
                      </div>
                    ) : null}
                    {physicianRecordDocPreview ? (
                      <div className="hs-phys-doc-preview-panel hs-phys-doc-preview-panel--records">
                        <div className="hs-phys-doc-preview-head">
                          <strong>{physicianRecordDocPreview.title || "Preview"}</strong>
                          <button
                            type="button"
                            className="hs-icon-btn"
                            aria-label="Close preview"
                            onClick={() => setPhysicianRecordDocPreview(null)}
                          >
                            <X size={16} aria-hidden />
                          </button>
                        </div>
                        {physicianRecordDocPreview.kind === "certificate" ? (
                          <pre className="hs-phys-doc-preview-text">{physicianRecordDocPreview.body || ""}</pre>
                        ) : null}
                        {physicianRecordDocPreview.kind === "image" && physicianRecordDocPreview.url ? (
                          <img
                            className="hs-phys-doc-preview-img"
                            src={physicianRecordDocPreview.url}
                            alt={physicianRecordDocPreview.title || ""}
                          />
                        ) : null}
                        {physicianRecordDocPreview.kind === "pdf" && physicianRecordDocPreview.url ? (
                          <iframe
                            className="hs-phys-doc-preview-iframe"
                            title={physicianRecordDocPreview.title || "PDF"}
                            src={physicianRecordDocPreview.url}
                          />
                        ) : null}
                        {physicianRecordDocPreview.kind === "other" && physicianRecordDocPreview.url ? (
                          <p className="hs-stat-meta">
                            <a href={physicianRecordDocPreview.url} target="_blank" rel="noopener noreferrer">
                              Open in new tab
                            </a>{" "}
                            if preview is not supported.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {!selectedPhysicianHealthRecord?.physicianDocumentsAttachments?.length &&
                    !selectedPhysicianHealthRecord?.physicianDocumentsNotes &&
                    !selectedPhysicianCertificateDocs.length ? (
                      <EmptyStateMessage
                        compact
                        icon={Folder}
                        title="No documents on file yet."
                        description="Issue a certificate or attach files from Open Chart."
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="cc-modal-body">
              <EmptyStateMessage
                icon={FileText}
                title="No patient selected."
                description="Choose a student on the left (from records or active queue)."
              />
            </div>
          )}
        </div>
      </div>
    ) : isNurseUser ? (
      <>
        <div className="cases-panel hs-panel-elevated">
          <div className="cases-panel-header">
            <div>
              <div className="cases-panel-title cases-panel-title--strong">Patient Records</div>
              <p className="hs-list-sub hs-list-sub--tight">
                One row per student — consolidates visits recorded under physician and dentist (health consultations) plus your medical record file dates.
              </p>
            </div>
          </div>
          <div className="cc-modal-body">
            <div className="hs-modal-field" style={{ maxWidth: 420 }}>
              <label>Search by Student ID, Name, or Program</label>
              <input
                className="hs-filter-input"
                value={recordsQuery}
                onChange={(e) => setRecordsQuery(e.target.value)}
                placeholder="e.g., 2023-12345, Maria, or BS Nursing"
              />
            </div>
          </div>
          <div className="cases-table-wrapper">
            <table className="cases-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Student Name</th>
                  <th>Program</th>
                  <th>Last Visit</th>
                  <th style={{ width: 140 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {nursePatientRecordsFiltered.map((row) => (
                  <tr key={row.studentId}>
                    <td className="cell-text cell-student-id">{row.studentId}</td>
                    <td className="cell-text">{row.studentName}</td>
                    <td className="cell-text">{row.program}</td>
                    <td className="cell-text">{row.lastVisit}</td>
                    <td>
                      <button
                        type="button"
                        className="hs-btn-secondary hs-nurse-records-view-btn"
                        onClick={() => openPhysicianChart(row.studentId)}
                      >
                        <Eye size={14} strokeWidth={1.75} aria-hidden />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {!nursePatientRecordsFiltered.length ? (
                  <tr>
                    <td className="cell-text" colSpan={5}>
                      {nursePatientRecordsRoster.length
                        ? "No students match your search."
                        : "No student records yet — they appear after consultations or medical records are saved."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="cases-panel hs-panel-elevated" style={{ marginTop: 16 }}>
          <div className="cases-panel-header">
            <div className="cases-panel-title cases-panel-title--strong">Visitor Archive</div>
          </div>
          <div className="cases-table-wrapper">
            <table className="cases-table">
              <thead><tr><th>Name</th><th>Purpose</th><th>Disposition</th><th>Timestamp</th></tr></thead>
              <tbody>
                {visitorArchive.map((v) => (
                  <tr key={v.id}>
                    <td className="cell-text">{v.name}</td>
                    <td className="cell-text">{v.reason || "—"}</td>
                    <td className="cell-text">{v.disposition || "Completed"}</td>
                    <td className="cell-text">{v.completedAt ? new Date(v.completedAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
                {!visitorArchive.length ? (
                  <tr><td className="cell-text" colSpan={4}>No archived visitors yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </>
    ) : (
    <>
      <div className="hs-stat-row">
        <div className="hs-stat-card">
          <div className="hs-stat-card-top">
            <div className="hs-stat-icon" aria-hidden>
              <FileHeart size={20} strokeWidth={1.5} />
            </div>
            <p className="hs-stat-value">{recordsTabStats.total.toLocaleString()}</p>
          </div>
          <p className="hs-stat-label">Total Health Records</p>
          <p className="hs-stat-meta">On file</p>
        </div>
        <div className="hs-stat-card">
          <div className="hs-stat-card-top">
            <div className="hs-stat-icon hs-stat-icon--warn" aria-hidden>
              <Activity size={20} strokeWidth={1.5} />
            </div>
            <p className="hs-stat-value hs-stat-value--warn">{recordsTabStats.ongoing}</p>
          </div>
          <p className="hs-stat-label">Ongoing Treatment</p>
          <p className="hs-stat-meta">Records tagged follow-up</p>
        </div>
        <div className="hs-stat-card">
          <div className="hs-stat-card-top">
            <div className="hs-stat-icon" aria-hidden>
              <CalendarDays size={20} strokeWidth={1.5} />
            </div>
            <p className="hs-stat-value">{recordsTabStats.checkupsWeek}</p>
          </div>
          <p className="hs-stat-label">Checkups This Week</p>
          <p className="hs-stat-meta">Last checkup in past 7 days</p>
        </div>
      </div>
      <div className="cases-panel hs-panel-elevated">
        <div className="cases-panel-header">
          <div className="cases-panel-top">
            <div>
              <div className="cases-panel-title cases-panel-title--strong">Search Health Records</div>
              <p className="hs-list-sub hs-list-sub--tight">Filter and export student medical information</p>
            </div>
          </div>
        </div>
        <div className="cases-table-wrapper" style={{ paddingBottom: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div className="search-bar-wrapper hs-search-wide" style={{ flex: 1, marginBottom: 0 }}>
              <span className="search-icon" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5.333" stroke="#64748B" strokeWidth="1.5" />
                  <path d="M13.333 13.333L10 10" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <input
                className="search-input"
                placeholder="Search by name, student ID, or blood type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="button" className="btn-export" onClick={openRecordFiltersModal}>
              Filters
            </button>
            <button type="button" className="btn-export">
              <Download size={14} strokeWidth={1.5} aria-hidden />
              Export
            </button>
          </div>
        </div>
      </div>
      <div className="cases-panel hs-panel-elevated">
        <div className="cases-panel-header">
          <div className="cases-panel-top">
            <div>
              <div className="cases-panel-title cases-panel-title--strong">Student Health Records</div>
              <p className="hs-list-sub hs-list-sub--tight">Confidential — medical staff only</p>
            </div>
          </div>
          <div className="hs-banner-warn" style={{ marginTop: 8 }}>
            Confidential Medical Information — HIPAA protected
          </div>
        </div>
        <div className="cases-table-wrapper">
          <table className="cases-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Program</th>
                <th>Blood Type</th>
                <th>Allergies</th>
                <th>Last Checkup</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => (
                <tr key={r.id}>
                  <td>
                    <p className="cell-student-name">{r.student}</p>
                    <p className="cell-student-id">{r.studentId}</p>
                    <div className="hs-consult-badges" style={{ marginTop: 6 }}>
                      {r.badges.map((b) => (
                        <span key={b} className="hs-pill hs-pill-ongoing" style={{ textTransform: "capitalize" }}>
                          {b}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="cell-text">{r.program}</td>
                  <td className="cell-text">{r.blood}</td>
                  <td className="cell-text">{r.allergies}</td>
                  <td className="cell-date">{r.last}</td>
                  <td>
                    <button type="button" className="hs-link-action" onClick={() => setRecordDetail(r)}>
                      <Eye size={14} strokeWidth={1.5} aria-hidden />
                      View Record
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
    )
  );

  const renderAppointments = () => (
    isPhysicianUser ? (
      (() => {
        const certQuery = String(certificateSearch || "").trim().toLowerCase();
        const filteredCertGroups = certificatesByStudent.filter((g) => {
          if (!certQuery) return true;
          const hay = `${g.studentId} ${g.studentName}`.toLowerCase();
          return hay.includes(certQuery);
        });
        const pendingPickup = certificatesList.filter((row) => String(row.status).toLowerCase() === "pending").length;
        return (
          <>
            <div className="hs-phys-kpi-row hs-phys-cert-kpis">
              <div className="hs-stat-card hs-phys-kpi">
                <div className="hs-stat-card-top">
                  <p className="hs-stat-value">{certificatesList.length}</p>
                  <div className="hs-stat-icon" aria-hidden><FileText size={16} strokeWidth={1.8} /></div>
                </div>
                <p className="hs-stat-label">Issued This Week</p>
              </div>
              <div className="hs-stat-card hs-phys-kpi">
                <div className="hs-stat-card-top">
                  <p className="hs-stat-value">{certificatesList.filter((row) => String(row.status).toLowerCase() === "active").length}</p>
                  <div className="hs-stat-icon hs-stat-icon--success" aria-hidden><CheckCircle size={16} strokeWidth={1.8} /></div>
                </div>
                <p className="hs-stat-label">Active Certificates</p>
              </div>
              <div className="hs-stat-card hs-phys-kpi">
                <div className="hs-stat-card-top">
                  <p className="hs-stat-value">{pendingPickup}</p>
                  <div className="hs-stat-icon hs-stat-icon--warn" aria-hidden><Clock size={16} strokeWidth={1.8} /></div>
                </div>
                <p className="hs-stat-label">Pending Pickup</p>
              </div>
            </div>
            <div className="cases-panel hs-panel-elevated hs-phys-card">
              {certificatesByStudent.length ? (
                <div className="cases-panel-header hs-phys-cert-header">
                  <div className="cases-panel-title cases-panel-title--strong">Students with certificates</div>
                </div>
              ) : null}
              <div className="cases-table-wrapper">
                {certificatesByStudent.length ? (
                  <>
                    <div className="hs-phys-cert-table-tools">
                      <div className="hs-phys-cert-search-wrap">
                        <input
                          className="hs-filter-input"
                          placeholder="Search by student name or ID..."
                          value={certificateSearch}
                          onChange={(e) => setCertificateSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="cc-modal-body hs-phys-student-accordion">
                      {filteredCertGroups.map((g) => (
                        <div key={g.studentId} className="hs-phys-student-group">
                          <button
                            type="button"
                            className="hs-phys-student-group-header"
                            onClick={() =>
                              setCertExpandedStudentId((cur) => (cur === g.studentId ? null : g.studentId))
                            }
                          >
                            <div>
                              <strong>{g.studentName}</strong>
                              <p className="hs-stat-meta">{g.studentId} · {g.entries.length} certificate(s)</p>
                            </div>
                            <ChevronRight
                              size={18}
                              aria-hidden
                              style={{
                                flexShrink: 0,
                                transform: certExpandedStudentId === g.studentId ? "rotate(90deg)" : "none",
                                transition: "transform 0.15s ease",
                              }}
                            />
                          </button>
                          {certExpandedStudentId === g.studentId ? (
                            <ul className="hs-phys-student-group-body">
                              {g.entries.map((row) => (
                                <li key={row.id}>
                                  <strong>{row.consultationDateTimeLabel || `${row.date} ${row.time}`}</strong>
                                  <p>{row.certificateReason || row.certReason}</p>
                                  <p className="hs-stat-meta">
                                    Period: {row.certificatePeriod || "—"} ·{" "}
                                    {statusLabel(row.certificateStatus || row.status)}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                      {!filteredCertGroups.length ? (
                        <p className="hs-stat-meta" style={{ padding: 16 }}>No students match your search.</p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="cc-modal-body">
                    <EmptyStateMessage
                      icon={FileText}
                      title="No medical certificates issued yet."
                      description="Use Issue Certificate from the physician dashboard after a visit, or complete the certificate workflow."
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()
    ) : (
    <>
      <div className="hs-stat-row">
        <div className="hs-stat-card">
          <div className="hs-stat-card-top">
            <div className="hs-stat-icon" aria-hidden>
              <CalendarDays size={20} strokeWidth={1.5} />
            </div>
            <p className="hs-stat-value">{appointmentsTabStats.todayCount}</p>
          </div>
          <p className="hs-stat-label">Today&apos;s Appointments</p>
          <p className="hs-stat-meta">Date = today</p>
        </div>
        <div className="hs-stat-card">
          <div className="hs-stat-card-top">
            <div className="hs-stat-icon" aria-hidden>
              <Users size={20} strokeWidth={1.5} />
            </div>
            <p className="hs-stat-value">{appointmentsTabStats.confirmed}</p>
          </div>
          <p className="hs-stat-label">Confirmed</p>
          <p className="hs-stat-meta">Status confirmed</p>
        </div>
        <div className="hs-stat-card">
          <div className="hs-stat-card-top">
            <div className="hs-stat-icon" aria-hidden>
              <Clock size={20} strokeWidth={1.5} />
            </div>
            <p className="hs-stat-value">{appointmentsTabStats.pending}</p>
          </div>
          <p className="hs-stat-label">Pending</p>
          <p className="hs-stat-meta">Awaiting confirmation</p>
        </div>
      </div>
      <div className="cases-panel hs-panel-elevated">
        <div className="cases-panel-header">
          <div className="cases-panel-top">
            <div>
              <div className="cases-panel-title cases-panel-title--strong">Today&apos;s Schedule</div>
              <p className="hs-list-sub hs-list-sub--tight">Medical appointments and room assignments</p>
            </div>
          </div>
        </div>
        <div className="cases-table-wrapper">
          {appointmentsList.map((a) => (
            <div key={a.id} className="hs-appt-card">
              <div className="hs-appt-main">
                <h4>{a.student}</h4>
                <p className="hs-appt-line">
                  <CalendarDays size={14} strokeWidth={1.5} aria-hidden />
                  {a.time}
                  <span style={{ color: "#cbd5e1" }}>•</span>
                  {a.room} · {statusLabel(a.workflowStatus || a.status)}
                </p>
                <p className="hs-appt-service">{a.service} · {a.consultationType || a.purpose}</p>
              </div>
              <div className="hs-appt-actions">
                <span className={pillClass(statusLabel(a.workflowStatus || a.status))}>
                  {statusLabel(a.workflowStatus || a.status)}
                </span>
                <button type="button" className="hs-btn-outline" onClick={() => setSelectedAppointment(a)}>
                  <Eye size={14} strokeWidth={1.5} aria-hidden />
                  View
                </button>
                {normalizeWorkflowStatus(a.workflowStatus) === HSO_WORKFLOW_STATUS.BOOKED ? (
                  <button
                    type="button"
                    className="hs-btn-primary"
                    style={{ height: 34, fontSize: 13 }}
                    onClick={() => persistAppointmentWorkflow(a.id, { workflow_status: HSO_WORKFLOW_STATUS.CHECKIN_WINDOW_OPEN })}
                  >
                    Open Check-in
                  </button>
                ) : (
                  <button
                    type="button"
                    className="hs-btn-outline"
                    onClick={() => persistAppointmentWorkflow(a.id, { workflow_status: HSO_WORKFLOW_STATUS.CANCELLED, status: "cancelled" })}
                  >
                    <X size={14} strokeWidth={1.5} aria-hidden />
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
    )
  );

  const renderReferrals = () => (
    <>
      <div className="hs-stat-row-4">
        {[
          { icon: Send, label: "Sent (Pending)", value: String(referralsTabStats.sent), meta: "Awaiting response" },
          { icon: Clock, label: "In Progress", value: String(referralsTabStats.inProg), meta: "Being handled" },
          { icon: FileText, label: "Completed", value: String(referralsTabStats.done), meta: "Closed / accepted" },
          { icon: AlertCircle, label: "Urgent Cases", value: String(referralsTabStats.urgent), meta: "Priority" },
        ].map((s) => (
          <div key={s.label} className="hs-stat-card">
            <div className="hs-stat-card-top">
              <div className="hs-stat-icon" aria-hidden>
                <s.icon size={20} strokeWidth={1.5} />
              </div>
              <p className="hs-stat-value">{s.value}</p>
            </div>
            <p className="hs-stat-label">{s.label}</p>
            <p className="hs-stat-meta">{s.meta}</p>
          </div>
        ))}
      </div>
      <div className="hs-filter-card">
        <div className="search-bar-wrapper" style={{ marginBottom: 0, flex: 1 }}>
          <span className="search-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.333" stroke="#64748B" strokeWidth="1.5" />
              <path d="M13.333 13.333L10 10" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            className="search-input"
            placeholder="Search by referral ID, student name, student ID, office, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="hs-select" defaultValue="all">
          <option value="all">All Status</option>
        </select>
      </div>
      {(() => {
        const q = search.trim().toLowerCase();
        const includesQ = (value) => String(value || "").toLowerCase().includes(q);
        const filteredOutgoingReferrals = referralsList.filter((r) => (
          !q ||
          includesQ(r.id) ||
          includesQ(r.referenceId) ||
          includesQ(r.student) ||
          includesQ(r.studentId) ||
          includesQ(r.program) ||
          includesQ(r.office) ||
          includesQ(r.reason)
        ));
        const filteredDisciplineIncoming = disciplineIncomingReferrals.filter((r) => (
          !q ||
          includesQ(r.referralId) ||
          includesQ(r.studentName) ||
          includesQ(r.studentId) ||
          includesQ(r.status) ||
          includesQ("discipline")
        ));
        const filteredSdaoIncoming = sdaoIncomingReferrals.filter((r) => (
          !q ||
          includesQ(r.referralId) ||
          includesQ(r.studentName) ||
          includesQ(r.studentId) ||
          includesQ(r.status) ||
          includesQ("sdao")
        ));

        return (
          <>
            <div className="cases-panel hs-panel-elevated">
              <div className="cases-panel-header">
                <div className="cases-panel-top">
                  <div>
                    <div className="cases-panel-title cases-panel-title--strong">
                      Referrals from HSO to other departments ({filteredOutgoingReferrals.length})
                    </div>
                    <p className="hs-list-sub hs-list-sub--tight">
                      Referrals are sent directly to the partner office for review.
                    </p>
                  </div>
                </div>
              </div>
              <div className="cases-table-wrapper">
                {filteredOutgoingReferrals.length === 0 ? (
                  <p className="hs-list-sub" style={{ padding: "16px 12px", margin: 0 }}>
                    No outgoing referrals matched your search.
                  </p>
                ) : (
                  filteredOutgoingReferrals.map((r) => (
                    <div key={r.id} className="hs-consult-row">
                      <div>
                        <p className="hs-consult-name">{r.student}</p>
                        <p className="hs-consult-meta">{r.studentId || "—"} · {r.program || "—"}</p>
                        <p className="hs-consult-meta">{r.office}</p>
                        <div className="hs-consult-badges" style={{ marginTop: 8 }}>
                          {r.urgent ? <span className="hs-badge-urgent">URGENT</span> : null}
                          <span className={pillClass(r.status)}>{r.status}</span>
                        </div>
                      </div>
                      <div>
                        <p className="hs-consult-meta">{r.reason}</p>
                        <p className="hs-consult-meta">
                          {r.date} · {r.by}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <button type="button" className="hs-link-action" onClick={() => setSelectedReferral(r)}>
                          <Eye size={14} strokeWidth={1.5} aria-hidden />
                          View
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <h3 className="hs-section-title" style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
                Referrals from other departments to HSO
              </h3>
              <p className="hs-list-sub hs-list-sub--tight" style={{ marginBottom: 16 }}>
                Incoming referrals from Discipline Office and SDAO for Health Services review.
              </p>

              <div className="cases-panel hs-panel-elevated">
                <div className="cases-panel-header">
                  <div className="cases-panel-top">
                    <div>
                      <div className="cases-panel-title cases-panel-title--strong">
                        Incoming from Discipline Office ({filteredDisciplineIncoming.length})
                      </div>
                      <p className="hs-list-sub hs-list-sub--tight">
                        Approve or decline referrals from Discipline Office sent to Health Services.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="cases-table-wrapper">
                  <table className="cases-table">
                    <thead>
                      <tr>
                        <th>Referral ID</th>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDisciplineIncoming.map((r) => (
                        <tr key={r.referralId}>
                          <td className="cell-case-id">{r.referralId}</td>
                          <td>
                            <p className="cell-student-name">{r.studentName}</p>
                            <p className="cell-student-id">{r.studentId}</p>
                          </td>
                          <td>
                            <span className={pillClass(r.status)}>{r.status}</span>
                          </td>
                          <td className="cell-date">{r.date}</td>
                          <td>
                            <button
                              type="button"
                              className="hs-link-action"
                              onClick={() => setSelectedReferral({ ...r, disciplineIncoming: true })}
                            >
                              <Eye size={14} strokeWidth={1.5} aria-hidden />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredDisciplineIncoming.length === 0 ? (
                    <p className="hs-list-sub" style={{ padding: "16px 12px", margin: 0 }}>
                      No incoming referrals from Discipline Office.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="cases-panel hs-panel-elevated" style={{ marginTop: 24 }}>
                <div className="cases-panel-header">
                  <div className="cases-panel-top">
                    <div>
                      <div className="cases-panel-title cases-panel-title--strong">
                        Incoming from SDAO ({filteredSdaoIncoming.length})
                      </div>
                      <p className="hs-list-sub hs-list-sub--tight">
                        Approve or decline referrals from Student Development Affairs sent to Health Services.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="cases-table-wrapper">
                  <table className="cases-table">
                    <thead>
                      <tr>
                        <th>Referral ID</th>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSdaoIncoming.map((r) => (
                        <tr key={r.referralId}>
                          <td className="cell-case-id">{r.referralId}</td>
                          <td>
                            <p className="cell-student-name">{r.studentName}</p>
                            <p className="cell-student-id">{r.studentId}</p>
                          </td>
                          <td>
                            <span className={pillClass(r.status)}>{r.status}</span>
                          </td>
                          <td className="cell-date">{r.date}</td>
                          <td>
                            <button
                              type="button"
                              className="hs-link-action"
                              onClick={() => setSelectedReferral({ ...r, sdaoIncoming: true })}
                            >
                              <Eye size={14} strokeWidth={1.5} aria-hidden />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredSdaoIncoming.length === 0 ? (
                    <p className="hs-list-sub" style={{ padding: "16px 12px", margin: 0 }}>
                      No incoming referrals from SDAO.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </>
  );

  const renderDocRequests = () => (
    <>
      <div className="hs-stat-row-4">
        {[
          { icon: FileText, label: "Total Requests", value: String(docTabStats.total), meta: "All items" },
          { icon: Clock, label: "Pending", value: String(docTabStats.pending), meta: "Awaiting partner office" },
          { icon: Upload, label: "Uploaded", value: String(docTabStats.uploaded), meta: "Ready to receive" },
          { icon: CheckCircle, label: "Received", value: String(docTabStats.received), meta: "Completed" },
        ].map((s) => (
          <div key={s.label} className="hs-stat-card">
            <div className="hs-stat-card-top">
              <div className="hs-stat-icon" aria-hidden>
                <s.icon size={20} strokeWidth={1.5} />
              </div>
              <p className="hs-stat-value">{s.value}</p>
            </div>
            <p className="hs-stat-label">{s.label}</p>
            <p className="hs-stat-meta">{s.meta}</p>
          </div>
        ))}
      </div>
      <div className="hs-filter-card">
        <div className="search-bar-wrapper" style={{ marginBottom: 0, flex: 1 }}>
          <span className="search-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.333" stroke="#64748B" strokeWidth="1.5" />
              <path d="M13.333 13.333L10 10" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            className="search-input"
            placeholder="Search by request ID, office, or document type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="hs-select" value={docStatusFilter} onChange={(e) => setDocStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="pendingApproval">Pending approval</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="fulfilled">Fulfilled</option>
        </select>
      </div>
      {(() => {
        const outgoingDocs = filteredDocs.filter((d) => d.direction === "outgoing");
        const incomingDocs = filteredDocs.filter((d) => d.direction === "incoming");
        const renderDocTable = (rows) => (
          <table className="cases-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Partner office</th>
                <th>Document Type</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="cell-case-id">{d.id}</td>
                  <td className="cell-text" style={{ fontSize: 13 }}>
                    <span
                      className="hs-pill"
                      style={{
                        fontSize: 11,
                        marginRight: 6,
                        background: "#f1f5f9",
                        color: "#334155",
                        padding: "2px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {d.direction === "incoming" ? "From" : "To"}
                    </span>
                    {labelForOfficeKey(d.partnerOffice)}
                  </td>
                  <td className="cell-text">{d.doc}</td>
                  <td>
                    <span
                      className="hs-pill"
                      style={{
                        background: d.priority === "Urgent" ? "#fee2e2" : d.priority === "High" ? "#ffedd5" : "#dbeafe",
                        color: d.priority === "Urgent" ? "#991b1b" : d.priority === "High" ? "#9a3412" : "#1e40af",
                      }}
                    >
                      {d.priority}
                    </span>
                  </td>
                  <td>
                    <span className={pillClass(d.status)}>{d.status}</span>
                  </td>
                  <td className="cell-date">{d.date}</td>
                  <td>
                    <button type="button" className="hs-link-action" onClick={() => setSelectedDocRequest(d)}>
                      <Eye size={14} strokeWidth={1.5} aria-hidden />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

        return (
          <>
            <div className="hs-banner-warn" style={{ marginBottom: 16 }} role="status">
              Document Request is for staff coordination only between HSO, Discipline Office, and SDAO. No student referral records are handled here.
            </div>
            <div className="cases-panel hs-panel-elevated">
              <div className="cases-panel-header">
                <div className="cases-panel-top">
                  <div>
                    <div className="cases-panel-title cases-panel-title--strong">
                      Requests from HSO to other departments ({outgoingDocs.length})
                    </div>
                    <p className="hs-list-sub hs-list-sub--tight">
                      Outgoing {outgoingDocs.length} · Incoming {incomingDocs.length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="cases-table-wrapper">
                {outgoingDocs.length === 0 ? (
                  <p className="hs-list-sub" style={{ padding: "16px 12px", margin: 0 }}>
                    No outgoing document requests found.
                  </p>
                ) : (
                  renderDocTable(outgoingDocs)
                )}
              </div>
            </div>

            <div className="cases-panel hs-panel-elevated" style={{ marginTop: 24 }}>
              <div className="cases-panel-header">
                <div className="cases-panel-top">
                  <div>
                    <div className="cases-panel-title cases-panel-title--strong">
                      Requests from other departments to HSO ({incomingDocs.length})
                    </div>
                    <p className="hs-list-sub hs-list-sub--tight">
                      Incoming requests from Discipline Office and SDAO that need HSO action.
                    </p>
                  </div>
                </div>
              </div>
              <div className="cases-table-wrapper">
                {incomingDocs.length === 0 ? (
                  <p className="hs-list-sub" style={{ padding: "16px 12px", margin: 0 }}>
                    No incoming document requests found.
                  </p>
                ) : (
                  renderDocTable(incomingDocs)
                )}
              </div>
            </div>
          </>
        );
      })()}
    </>
  );

  const renderAdminReports = () => (
    <>
      <div className="hs-reports-toolbar hs-reports-toolbar--card">
        <div className="hs-reports-toolbar-row">
          <div className="hs-reports-period-wrap">
            <label htmlFor="hs-reports-period" className="hs-reports-period-label">Filter</label>
            <select id="hs-reports-period" className="hs-reports-select" value={reportsTimeFilter} onChange={(e) => setReportsTimeFilter(e.target.value)}>
              <option value="week">This week</option>
              <option value="month">This Month</option>
              <option value="quarter">3 months</option>
              <option value="year">This year</option>
            </select>
          </div>
        </div>
      </div>
      <div className="hs-stat-row">
        <div className="hs-stat-card"><div className="hs-stat-card-top"><p className="hs-stat-value">{appointmentsList.length}</p></div><p className="hs-stat-label">Visits</p></div>
        <div className="hs-stat-card"><div className="hs-stat-card-top"><p className="hs-stat-value">11</p></div><p className="hs-stat-label">Avg Waiting Time (min)</p></div>
        <div className="hs-stat-card"><div className="hs-stat-card-top"><p className="hs-stat-value">{consultationRows.length}</p></div><p className="hs-stat-label">Consultations</p></div>
      </div>
      <div className="do-home-split">
        <div className="do-panel">
          <div className="do-panel-header"><h2 className="do-panel-title">Visit Trend</h2></div>
          <div className="do-panel-body" style={{ padding: "16px 20px" }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyVisitsTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Line type="monotone" dataKey="visits" stroke="#2563eb" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="do-panel">
          <div className="do-panel-header"><h2 className="do-panel-title">Station Mix</h2></div>
          <div className="do-panel-body" style={{ padding: "16px 20px" }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={reportsDonutData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78}>{reportsDonutData.map((x) => <Cell key={x.name} fill={x.color} />)}</Pie><Legend /><Tooltip /></PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="do-home-split" style={{ marginTop: 16 }}>
        <div className="do-panel">
          <div className="do-panel-header"><h2 className="do-panel-title">Peak Hours</h2></div>
          <div className="do-panel-body" style={{ padding: "16px 20px" }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={peakHoursSeries}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" /><YAxis /><Tooltip /><Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="do-panel">
          <div className="do-panel-header"><h2 className="do-panel-title">Top Complaints</h2></div>
          <div className="do-panel-body" style={{ padding: "12px 20px" }}>
            {topComplaints.map((c) => (
              <div key={c.label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{c.label}</span><strong>{c.count}</strong></div>
                <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999, marginTop: 4 }}>
                  <div style={{ height: "100%", width: `${Math.max(12, c.count * 10)}%`, background: "#2563eb", borderRadius: 999 }} />
                </div>
              </div>
            ))}
            {!topComplaints.length ? <p className="hs-stat-meta">No complaint data yet.</p> : null}
          </div>
        </div>
      </div>
    </>
  );

  const hsoTabPrimaryAction = (() => {
    if (isPhysicianUser) {
      if (activeNav === "appointments") return { label: "Issue Certificate", onClick: () => {}, Icon: Plus };
      return null;
    }
    if (isDentistUser) {
      if (activeNav === "dentalFollowups") return { label: "Schedule Follow-up", onClick: () => {}, Icon: Plus };
      return null;
    }
    switch (activeNav) {
      case "dashboard":
        return null;
      case "userManagement":
        return null;
      case "staffScheduling":
        return { label: "New Appointment", onClick: openNewAppointmentModal, Icon: CalendarDays };
      case "checkin":
        return null;
      case "queue":
        return null;
      case "consultation":
        return userDesignation === "admin" || userDesignation === "physician" || userDesignation === "dentist"
          ? { label: "New Consultation Note", onClick: openNewConsultationModal, Icon: Stethoscope }
          : null;
      case "visits":
        return { label: "New Consultation", onClick: openNewConsultationModal, Icon: Stethoscope };
      case "records":
        return { label: "New Record", onClick: openNewRecordModal, Icon: Activity };
      case "appointments":
        return userDesignation === "admin" || userDesignation === "nurse"
          ? { label: "New Appointment", onClick: openNewAppointmentModal, Icon: CalendarDays }
          : null;
      case "referrals":
        return userDesignation === "admin" || userDesignation === "nurse"
          ? {
              label: userDesignation === "nurse" ? "Student referral" : "Create Referral",
              onClick: openNewReferralModal,
              Icon: UserPlus,
            }
          : null;
      case "docrequests":
        return canInterOfficeDocRequest && (userDesignation === "admin" || userDesignation === "nurse")
          ? { label: "New Document Request", onClick: openNewDocModal, Icon: FileText }
          : null;
      case "reports":
        return null;
      default:
        return null;
    }
  })();

  const TabPrimaryIcon = hsoTabPrimaryAction?.Icon;

  const body = (() => {
    switch (activeNav) {
      case "userManagement":
        return renderUserManagement();
      case "staffScheduling":
        return renderStaffScheduling();
      case "checkin":
        return renderCheckin();
      case "queue":
        return renderQueue();
      case "consultation":
        return renderConsultation();
      case "visits":
        return renderVisits();
      case "records":
        return renderRecords();
      case "appointments":
        return renderAppointments();
      case "referrals":
        return renderReferrals();
      case "docrequests":
        return renderDocRequests();
      case "reports":
        if (isNurseUser || isPhysicianUser || isDentistUser) return renderHealthServicesAnalytics();
        return renderAdminReports();
      case "dentalQueue":
        return renderDentistQueue();
      case "dentalRecords":
        return renderDentistPatientRecords();
      case "dentalChart":
        return renderDentistChartWorkspace();
      case "dentalFollowups":
        return renderDentistFollowups();
      default:
        return renderDashboard();
    }
  })();

  if (embedReportsOnly) {
    return (
      <div className="sa-embed-hso hs-office-shell">
        <main className="dashboard-content hs-page hs-office-shell">
          <section className="hs-tab-page-heading">
            <div className="page-title-row">
              <div>
                <h1 className="hs-tab-page-title">{meta.title}</h1>
                <p className="hs-tab-page-subtitle">{meta.subtitle}</p>
              </div>
            </div>
          </section>
          {hsoLoading ? (
            <p className="hs-stat-meta" style={{ marginBottom: 12 }}>
              Loading Health Services data from Supabase…
            </p>
          ) : null}
          {hsoLoadError ? (
            <div className="hs-banner-warn" style={{ marginBottom: 16 }} role="alert">
              {hsoLoadError}
            </div>
          ) : null}
          {body}
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout health-services-layout hs-office-shell">
      <Sidebar
        brandTitle="CampusCare Welfare Management"
        navItems={healthNavItems}
        activeNavId={activeNav}
        onNavSelect={setActiveNav}
        onLogoutRequest={() => setLogoutOpen(true)}
        profileSettingsPath={PROFILE_SETTINGS_PATH_HEALTH}
      />
      <div className="dashboard-main">
        <OfficeHeader
          userName={userName}
          userRole={userRole}
          notifications={HS_NOTIFICATIONS}
          notificationSlot={<StaffNotificationBell />}
          avatar={
            session?.profileAvatarDataUrl ? (
              <img src={session.profileAvatarDataUrl} alt="" className="header-avatar-img" />
            ) : undefined
          }
        />
        <main className="dashboard-content hs-page hs-office-shell">
          <section className="hs-tab-page-heading">
            <div className="page-title-row">
              <div>
                <h1 className="hs-tab-page-title">{meta.title}</h1>
                <p className="hs-tab-page-subtitle">{meta.subtitle}</p>
              </div>
              {hsoTabPrimaryAction && TabPrimaryIcon ? (
                <button type="button" className="btn-new-case" onClick={hsoTabPrimaryAction.onClick}>
                  <TabPrimaryIcon size={16} strokeWidth={2} aria-hidden />
                  {hsoTabPrimaryAction.label}
                </button>
              ) : null}
            </div>
          </section>
          {hsoLoading ? (
            <p className="hs-stat-meta" style={{ marginBottom: 12 }}>
              Loading Health Services data from Supabase…
            </p>
          ) : null}
          {hsoLoadError ? (
            <div className="hs-banner-warn" style={{ marginBottom: 16 }} role="alert">
              {hsoLoadError}
            </div>
          ) : null}
          {body}
        </main>
      </div>

      <CCModal open={logoutOpen} title="Logout" onClose={() => setLogoutOpen(false)} centered showHeader={false}>
        <div className="sidebar-logout-modal">
          <div className="sidebar-logout-body">
            <div className="sidebar-logout-icon-wrap" aria-hidden>
              <LogOut size={20} strokeWidth={1.75} />
            </div>
            <div className="sidebar-logout-copy">
              <h2 className="sidebar-logout-title" id="sidebar-logout-heading">
                Logout Confirmation
              </h2>
              <p className="sidebar-logout-text">
                Are you sure you want to logout? Any unsaved changes will be lost.
              </p>
            </div>
          </div>
          <div className="sidebar-logout-footer">
            <button type="button" className="sidebar-logout-btn sidebar-logout-btn--secondary" onClick={() => setLogoutOpen(false)}>
              Cancel
            </button>
            <button type="button" className="sidebar-logout-btn sidebar-logout-btn--primary" onClick={confirmLogout}>
              Yes, Logout
            </button>
          </div>
        </div>
      </CCModal>

      <CCModal
        modalClassName="hs-cc-modal"
        open={physicianCertModalOpen}
        title="Issue Medical Certificate"
        onClose={() => setPhysicianCertModalOpen(false)}
        centered
        wide
      >
        <div className="cc-modal-body">
          <p className="hs-modal-lead">
            For {workflowRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS)?.studentLabel || "selected patient"}
          </p>
          <div className="hs-modal-field">
            <label>Reason</label>
            <input
              placeholder="e.g. Acute viral pharyngitis"
              value={physicianConsultForm.certReason}
              onChange={(e) => setPhysicianConsultForm((f) => ({ ...f, certReason: e.target.value }))}
            />
          </div>
          <div className="hs-modal-grid">
            <div className="hs-modal-field">
              <label>Rest from</label>
              <input
                type="date"
                value={physicianConsultForm.certFrom}
                onChange={(e) => setPhysicianConsultForm((f) => ({ ...f, certFrom: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Until</label>
              <input
                type="date"
                value={physicianConsultForm.certUntil}
                onChange={(e) => setPhysicianConsultForm((f) => ({ ...f, certUntil: e.target.value }))}
              />
            </div>
          </div>
          <div className="hs-modal-field">
            <label>Recommendation</label>
            <textarea
              placeholder="Recommended rest and follow-up..."
              value={physicianConsultForm.certRecommendation}
              onChange={(e) => setPhysicianConsultForm((f) => ({ ...f, certRecommendation: e.target.value }))}
            />
          </div>
          <div className="hs-modal-footer">
            <button type="button" className="hs-btn-secondary" onClick={() => setPhysicianCertModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="hs-btn-primary" onClick={issuePhysicianCertificate}>
              Issue &amp; save
            </button>
          </div>
        </div>
      </CCModal>

      <CCModal
        modalClassName="hs-cc-modal hs-phys-chart-modal"
        open={physicianChartOpen}
        title={isNurseUser ? "Student clinical record" : "Medical record"}
        onClose={closePhysicianChart}
        centered
        wide
      >
        <div className="cc-modal-body hs-phys-chart-modal-body">
          {physicianChartLoading ? <p className="hs-stat-meta">Loading student profile and chart…</p> : null}
          {isNurseUser ? (
            <p className="hs-stat-meta" style={{ marginBottom: 12 }}>
              Read-only access — nurses can review the chart but cannot edit or save clinical notes.
            </p>
          ) : null}
          <section className="hs-phys-chart-section hs-phys-chart-section--readonly">
            <h4 className="hs-phys-chart-section-title">Personal information</h4>
            <p className="hs-stat-meta">Maintained on the student mobile profile. Physicians can review only.</p>
            <div className="hs-phys-chart-readonly-grid">
              <div>
                <span className="hs-phys-chart-label">Name</span>
                <p className="hs-phys-chart-value">
                  {physicianChartRoster
                    ? [physicianChartRoster.lastName, physicianChartRoster.firstName, physicianChartRoster.middleInitial]
                        .filter(Boolean)
                        .join(", ") || physicianChartRoster.fullName || "—"
                    : "—"}
                </p>
              </div>
              <div>
                <span className="hs-phys-chart-label">Course</span>
                <p className="hs-phys-chart-value">{physicianChartRoster?.course || "—"}</p>
              </div>
              <div>
                <span className="hs-phys-chart-label">Student ID</span>
                <p className="hs-phys-chart-value">{physicianChartStudentId || "—"}</p>
              </div>
              <div>
                <span className="hs-phys-chart-label">Year level</span>
                <p className="hs-phys-chart-value">{physicianChartRoster?.yearLevel || "—"}</p>
              </div>
              <div className="hs-phys-chart-span-2">
                <span className="hs-phys-chart-label">Address</span>
                <p className="hs-phys-chart-value">{physicianChartRoster?.address || "—"}</p>
              </div>
              <div>
                <span className="hs-phys-chart-label">Contact no.</span>
                <p className="hs-phys-chart-value">{physicianChartRoster?.contactNo || "—"}</p>
              </div>
              <div>
                <span className="hs-phys-chart-label">Birthdate</span>
                <p className="hs-phys-chart-value">{formatRosterBirthdate(physicianChartRoster?.birthdate)}</p>
              </div>
              <div>
                <span className="hs-phys-chart-label">Age</span>
                <p className="hs-phys-chart-value">{physicianChartRoster?.age || "—"}</p>
              </div>
              <div>
                <span className="hs-phys-chart-label">Sex</span>
                <p className="hs-phys-chart-value">{physicianChartRoster?.sex || "—"}</p>
              </div>
              <div>
                <span className="hs-phys-chart-label">Status</span>
                <p className="hs-phys-chart-value">{physicianChartRoster?.maritalStatus || "—"}</p>
              </div>
              <div>
                <span className="hs-phys-chart-label">Religion</span>
                <p className="hs-phys-chart-value">{physicianChartRoster?.religion || "—"}</p>
              </div>
              <div className="hs-phys-chart-span-2">
                <span className="hs-phys-chart-label">Person to notify (emergency)</span>
                <p className="hs-phys-chart-value">{physicianChartRoster?.emergencyContactName || "—"}</p>
              </div>
              <div>
                <span className="hs-phys-chart-label">Relationship</span>
                <p className="hs-phys-chart-value">{physicianChartRoster?.emergencyRelationship || "—"}</p>
              </div>
              <div>
                <span className="hs-phys-chart-label">Nationality</span>
                <p className="hs-phys-chart-value">{physicianChartRoster?.nationality || "—"}</p>
              </div>
              <div>
                <span className="hs-phys-chart-label">Emergency contact no.</span>
                <p className="hs-phys-chart-value">{physicianChartRoster?.emergencyContactNo || "—"}</p>
              </div>
            </div>
          </section>

          <section className="hs-phys-chart-section">
            <h4 className="hs-phys-chart-section-title">Medical history</h4>
            <div className="hs-phys-chart-fields">
              {PHYSICIAN_MEDICAL_HISTORY_FIELDS.map(({ key, label }) => (
                <div className="hs-modal-field hs-phys-chart-field-line" key={key}>
                  <label>{label}</label>
                  <input
                    className="hs-filter-input"
                    readOnly={isNurseUser}
                    value={physicianChartDraft.medicalHistory[key] ?? ""}
                    onChange={(e) =>
                      setPhysicianChartDraft((d) => ({
                        ...d,
                        medicalHistory: { ...d.medicalHistory, [key]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="hs-phys-chart-section">
            <h4 className="hs-phys-chart-section-title">Physical examination</h4>
            <div className="hs-phys-chart-vitals-block">
              <h5 className="hs-phys-chart-subtitle">Vital signs (from nurse station)</h5>
              <p className="hs-stat-meta">Taken at triage and stored on the appointment. Shown read-only for physicians and dentists.</p>
              <div className="hs-phys-chart-readonly-grid">
                <div>
                  <span className="hs-phys-chart-label">Blood pressure</span>
                  <p className="hs-phys-chart-value">{physicianChartVitalsDisplay.bloodPressure}</p>
                </div>
                <div>
                  <span className="hs-phys-chart-label">Pulse rate</span>
                  <p className="hs-phys-chart-value">{physicianChartVitalsDisplay.pulse}</p>
                </div>
                <div>
                  <span className="hs-phys-chart-label">Temperature</span>
                  <p className="hs-phys-chart-value">{physicianChartVitalsDisplay.temperature}</p>
                </div>
                <div>
                  <span className="hs-phys-chart-label">Height</span>
                  <p className="hs-phys-chart-value">{physicianChartVitalsDisplay.heightCm}</p>
                </div>
                <div>
                  <span className="hs-phys-chart-label">Weight</span>
                  <p className="hs-phys-chart-value">{physicianChartVitalsDisplay.weightKg}</p>
                </div>
                <div>
                  <span className="hs-phys-chart-label">O₂ (SpO₂)</span>
                  <p className="hs-phys-chart-value">{physicianChartVitalsDisplay.spo2}</p>
                </div>
              </div>
            </div>
            <div className="hs-phys-chart-fields">
              {PHYSICIAN_PHYSICAL_EXAM_FIELDS.map(({ key, label }) => (
                <div className="hs-modal-field hs-phys-chart-field-line" key={key}>
                  <label>{label}</label>
                  <input
                    className="hs-filter-input"
                    readOnly={isNurseUser}
                    value={physicianChartDraft.physicalExam[key] ?? ""}
                    onChange={(e) =>
                      setPhysicianChartDraft((d) => ({
                        ...d,
                        physicalExam: { ...d.physicalExam, [key]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="hs-phys-chart-section">
            <h4 className="hs-phys-chart-section-title">Prescription</h4>
            <div className="hs-phys-chart-latest-rx hs-phys-chart-section--readonly">
              <h5 className="hs-phys-chart-subtitle">Latest prescription on file</h5>
              <p className="hs-stat-meta">
                {clinicalLatestPrescriptionSnapshot.detail || "—"}
                {clinicalLatestRxTimestampLabel ? ` · ${clinicalLatestRxTimestampLabel}` : null}
              </p>
              {clinicalLatestPrescriptionSnapshot.text ? (
                <pre className="hs-phys-chart-latest-rx-pre">{clinicalLatestPrescriptionSnapshot.text}</pre>
              ) : (
                <p className="hs-stat-meta">No prescription recorded yet.</p>
              )}
            </div>
            {!isNurseUser ? (
              <>
                <p className="hs-stat-meta" style={{ marginTop: 14 }}>
                  Update prescription notes below — saved to the medical record when you click Save chart.
                </p>
                <textarea
                  className="hs-filter-input hs-phys-chart-textarea"
                  rows={5}
                  placeholder="Drug name, dose, route, frequency, duration…"
                  value={physicianChartDraft.prescriptionNotes}
                  onChange={(e) => setPhysicianChartDraft((d) => ({ ...d, prescriptionNotes: e.target.value }))}
                />
              </>
            ) : (
              <p className="hs-stat-meta" style={{ marginTop: 12 }}>
                Nurses see the latest prescription above (from saved chart notes or the most recent consultation).
              </p>
            )}
          </section>

          <section className="hs-phys-chart-section">
            <h4 className="hs-phys-chart-section-title">Documents</h4>
            <p className="hs-stat-meta">
              All documents stored on this student&apos;s medical record ({clinicalChartDocumentsSorted.length}{" "}
              file{clinicalChartDocumentsSorted.length === 1 ? "" : "s"}).
            </p>
            {clinicalChartDocumentsSorted.length ? (
              <ul className="hs-phys-chart-doc-list">
                {clinicalChartDocumentsSorted.map((a) => (
                  <li key={a.path || a.url} className="hs-phys-chart-doc-row">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hs-phys-chart-doc-link"
                    >
                      <FileText size={14} aria-hidden />
                      <span>{a.name || "File"}</span>
                    </a>
                    <span className="hs-stat-meta">
                      {a.uploadedAt ? new Date(a.uploadedAt).toLocaleString() : ""}
                    </span>
                    {!isNurseUser ? (
                      <button
                        type="button"
                        className="hs-icon-btn"
                        aria-label={`Remove ${a.name || "file"}`}
                        onClick={() => a.path && handleRemovePhysicianChartDocument(a.path)}
                      >
                        <X size={14} aria-hidden />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hs-stat-meta">No documents attached yet.</p>
            )}
            {!isNurseUser ? (
              <>
                <input
                  ref={physicianChartFileInputRef}
                  type="file"
                  className="hs-phys-chart-file-input"
                  onChange={handlePhysicianChartDocumentUpload}
                />
                <div className="hs-phys-chart-doc-actions">
                  <button
                    type="button"
                    className="hs-btn-secondary"
                    disabled={physicianChartDocUploading || physicianChartLoading}
                    onClick={() => physicianChartFileInputRef.current?.click()}
                  >
                    <Upload size={14} aria-hidden />
                    {physicianChartDocUploading ? "Uploading…" : "Attach file"}
                  </button>
                </div>
              </>
            ) : null}
            <div className="hs-modal-field" style={{ marginTop: 14 }}>
              <label>Notes (optional)</label>
              <textarea
                className="hs-filter-input hs-phys-chart-textarea"
                rows={3}
                readOnly={isNurseUser}
                placeholder="Short summary or references to go with the attachments…"
                value={physicianChartDraft.documentsNotes}
                onChange={(e) => setPhysicianChartDraft((d) => ({ ...d, documentsNotes: e.target.value }))}
              />
            </div>
          </section>

          <div className="hs-modal-footer">
            <button type="button" className="hs-btn-secondary" onClick={closePhysicianChart}>
              Close
            </button>
            {!isNurseUser ? (
              <button
                type="button"
                className="hs-btn-primary"
                disabled={physicianChartSaving || physicianChartLoading}
                onClick={savePhysicianChart}
              >
                {physicianChartSaving ? "Saving…" : "Save chart"}
              </button>
            ) : null}
          </div>
        </div>
      </CCModal>

      <CCModal
        modalClassName="hs-cc-modal"
        open={addVisitorOpen}
        title="Add Visitor"
        onClose={() => setAddVisitorOpen(false)}
        centered
      >
        <div className="cc-modal-body">
          <p className="hs-modal-lead">Register non-institutional guest</p>
          <div className="hs-modal-grid">
            <div className="hs-modal-field">
              <label>Name</label>
              <input
                value={newVisitorForm.name}
                onChange={(e) => setNewVisitorForm((prev) => ({ ...prev, name: sanitizePersonNameInput(e.target.value) }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Contact Number</label>
              <input
                value={newVisitorForm.contactNumber}
                onChange={(e) => setNewVisitorForm((prev) => ({ ...prev, contactNumber: sanitizeDigitsOnlyInput(e.target.value) }))}
              />
            </div>
            <div className="hs-modal-field" style={{ gridColumn: "1 / -1" }}>
              <label>Purpose of Visit</label>
              <textarea
                value={newVisitorForm.purpose}
                onChange={(e) => setNewVisitorForm((prev) => ({ ...prev, purpose: e.target.value }))}
              />
            </div>
          </div>
          <div className="hs-modal-footer">
            <button type="button" className="cc-btn-secondary" onClick={() => setAddVisitorOpen(false)}>Cancel</button>
            <button type="button" className="cc-btn-primary" onClick={handleAddVisitor}>Add Visitor</button>
          </div>
        </div>
      </CCModal>

      <CCModal
        modalClassName="hs-cc-modal"
        open={newConsultOpen}
        title="New Consultation"
        onClose={closeNewConsultationModal}
        centered
        wide
      >
        <div className="cc-modal-body">
          <p className="hs-modal-lead">Record a new student health consultation</p>
          <div className="hs-modal-grid">
            <div className="hs-modal-field">
              <label>Student Name</label>
              <input
                placeholder="Full name"
                value={newConsultForm.studentName}
                onChange={(e) =>
                  setNewConsultForm((f) => ({ ...f, studentName: sanitizePersonNameInput(e.target.value) }))
                }
              />
            </div>
            <div className="hs-modal-field">
              <label>Student ID</label>
              <input
                placeholder="ID number"
                value={newConsultForm.studentId}
                onChange={(e) =>
                  setNewConsultForm((f) => ({ ...f, studentId: sanitizeDigitsOnlyInput(e.target.value) }))
                }
              />
            </div>
            <div className="hs-modal-field">
              <label>Visit Type</label>
              <select
                value={newConsultForm.visitType}
                onChange={(e) => setNewConsultForm((f) => ({ ...f, visitType: e.target.value }))}
              >
                <option value="walkin">Walk-in</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            <div className="hs-modal-field">
              <label>Time</label>
              <input
                type="time"
                value={newConsultForm.visitTime}
                onChange={(e) => setNewConsultForm((f) => ({ ...f, visitTime: e.target.value }))}
              />
            </div>
          </div>
          <div className="hs-modal-field" style={{ marginTop: 12 }}>
            <label>Chief Complaint</label>
            <textarea
              placeholder="Describe presenting concern..."
              value={newConsultForm.chiefComplaint}
              onChange={(e) => setNewConsultForm((f) => ({ ...f, chiefComplaint: e.target.value }))}
            />
          </div>
          <p className="hs-modal-section-title">Vital Signs</p>
          <div className="hs-modal-grid">
            <div className="hs-modal-field">
              <label>Blood Pressure</label>
              <input
                placeholder="120/80"
                value={newConsultForm.bloodPressure}
                onChange={(e) => setNewConsultForm((f) => ({ ...f, bloodPressure: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Temperature (°C)</label>
              <input
                placeholder="36.5"
                value={newConsultForm.temperature}
                onChange={(e) => setNewConsultForm((f) => ({ ...f, temperature: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Heart Rate (bpm)</label>
              <input
                placeholder="72"
                value={newConsultForm.heartRate}
                onChange={(e) => setNewConsultForm((f) => ({ ...f, heartRate: e.target.value }))}
              />
            </div>
          </div>
          <div className="hs-lock-box" style={{ marginTop: 12 }}>
            <Lock size={16} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong>Diagnosis</strong> is available after a doctor completes the checkup and the consultation is marked{" "}
              <strong>Completed</strong>.
            </span>
          </div>
        </div>
        <div className="hs-modal-footer">
          <button type="button" className="cc-btn-secondary hs-modal-btn-cancel" onClick={closeNewConsultationModal}>
            Cancel
          </button>
          <button type="button" className="cc-btn-primary" disabled={consultSaving} onClick={saveNewConsultation}>
            {consultSaving ? "Saving…" : "Save Consultation"}
          </button>
        </div>
      </CCModal>

      <CCModal
        modalClassName="hs-cc-modal"
        open={newApptOpen}
        title="New Appointment"
        onClose={() => setNewApptOpen(false)}
        centered
        wide
      >
        <div className="cc-modal-body">
          <p className="hs-modal-lead">Create a new medical appointment for a student</p>
          <div className="hs-modal-field">
            <label>Student Name</label>
            <input
              value={newApptForm.studentName}
              onChange={(e) =>
                setNewApptForm((f) => ({ ...f, studentName: sanitizePersonNameInput(e.target.value) }))
              }
            />
          </div>
          <div className="hs-modal-field">
            <label>Student ID</label>
            <input
              value={newApptForm.studentId}
              onChange={(e) =>
                setNewApptForm((f) => ({ ...f, studentId: sanitizeDigitsOnlyInput(e.target.value) }))
              }
            />
          </div>
          <div className="hs-modal-grid">
            <div className="hs-modal-field">
              <label>Email</label>
              <input
                type="email"
                value={newApptForm.email}
                onChange={(e) => setNewApptForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Phone</label>
              <input
                value={newApptForm.phone}
                onChange={(e) => setNewApptForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Date</label>
              <input
                type="date"
                value={newApptForm.date}
                onChange={(e) => setNewApptForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Time</label>
              <input
                type="time"
                value={newApptForm.time}
                onChange={(e) => setNewApptForm((f) => ({ ...f, time: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Designation</label>
              <select
                value={newApptForm.designation}
                onChange={(e) => setNewApptForm((f) => ({ ...f, designation: e.target.value }))}
              >
                <option value="physician">Physician</option>
                <option value="dentist">Dentist</option>
              </select>
            </div>
            <div className="hs-modal-field">
              <label>Consultation Form</label>
              <select
                value={newApptForm.consultationType}
                onChange={(e) =>
                  setNewApptForm((f) => ({ ...f, consultationType: e.target.value, purpose: e.target.value }))
                }
              >
                {consultationTypeOptions().map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="hs-modal-field">
            <label>Additional Comments</label>
            <textarea
              rows={2}
              value={newApptForm.additionalComments}
              onChange={(e) => setNewApptForm((f) => ({ ...f, additionalComments: e.target.value }))}
            />
          </div>
        </div>
        <div className="hs-modal-footer">
          <button type="button" className="cc-btn-secondary hs-modal-btn-cancel" onClick={() => setNewApptOpen(false)}>
            Cancel
          </button>
          <button type="button" className="cc-btn-primary" disabled={apptSaving} onClick={saveNewAppointment}>
            {apptSaving ? "Saving…" : "+ Create Appointment"}
          </button>
        </div>
      </CCModal>

      <CCModal
        modalClassName="hs-cc-modal"
        open={newReferralOpen}
        title="Student referral to another office"
        onClose={() => setNewReferralOpen(false)}
        centered
        wide
      >
        <div className="cc-modal-body">
          <p className="hs-modal-lead" style={{ marginTop: 0 }}>
            Refer this student to another welfare department within CampusCare. The receiving office gets the details below so both teams can coordinate next steps.
          </p>
          <p className="hs-modal-section-title" style={{ marginTop: 12 }}>
            Student Information
          </p>
          <p className="hs-stat-meta" style={{ marginBottom: 12 }}>
            Enter <strong>Student ID</strong> first (year <strong>2022–2027</strong>, then <strong>6–7</strong> digits). The hyphen appears after the year; name, school email, and program load from the roster when the ID is valid.
          </p>
          <div className="hs-modal-field">
            <label htmlFor="hs-referral-student-id">Student ID *</label>
            <input
              id="hs-referral-student-id"
              autoComplete="off"
              spellCheck={false}
              inputMode="numeric"
              placeholder="e.g. 2023-171863"
              title="Format: YYYY-####### (year 2022–2027, hyphen, 6–7 digit unique ID)"
              value={newReferralForm.studentId}
              onChange={(e) =>
                setNewReferralForm((f) => ({ ...f, studentId: formatReferralStudentIdInput(e.target.value) }))
              }
            />
            {referralStudentLookup.status === "loading" ? (
              <p className="hs-stat-meta" style={{ marginTop: 6 }}>
                Loading student from roster…
              </p>
            ) : null}
            {referralStudentLookup.message ? (
              <p className="hs-stat-meta" style={{ marginTop: 6, color: "#b45309" }} role="status">
                {referralStudentLookup.message}
              </p>
            ) : null}
          </div>
          <div className="hs-modal-grid">
            <div className="hs-modal-field">
              <label>Student Name</label>
              <input readOnly className="hs-input-readonly-roster" value={newReferralForm.studentName} placeholder="—" />
              <span className="hs-stat-meta">From students table</span>
            </div>
            <div className="hs-modal-field">
              <label>School Email</label>
              <input
                readOnly
                className="hs-input-readonly-roster"
                type="email"
                value={newReferralForm.email}
                placeholder="—"
              />
              <span className="hs-stat-meta">From students table</span>
            </div>
            <div className="hs-modal-field" style={{ gridColumn: "1 / -1" }}>
              <label>Program</label>
              <input readOnly className="hs-input-readonly-roster" value={newReferralForm.program} placeholder="—" />
              <span className="hs-stat-meta">From students table</span>
            </div>
          </div>
          <p className="hs-modal-section-title">Referral Details</p>
          <div className="hs-modal-field">
            <label>Referring Office</label>
            <input readOnly value="Health Services Office" />
          </div>
            <div className="hs-modal-field">
              <label>Receiving Office *</label>
              <select
                value={newReferralForm.receivingOffice}
                onChange={(e) => setNewReferralForm((f) => ({ ...f, receivingOffice: e.target.value }))}
              >
                {HS_REFERRAL_OFFICES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          <div className="hs-modal-field">
            <label>Reason for Referral</label>
            <textarea
              rows={3}
              value={newReferralForm.reason}
              onChange={(e) => setNewReferralForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>
        </div>
        <div className="hs-modal-footer">
          <button type="button" className="cc-btn-secondary hs-modal-btn-cancel" onClick={() => setNewReferralOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="cc-btn-primary"
            disabled={referralSaving || referralStudentLookup.status === "loading"}
            onClick={saveNewReferral}
          >
            {referralSaving ? "Sending…" : "Send Referral"}
          </button>
        </div>
      </CCModal>

      <CCModal
        modalClassName="hs-cc-modal"
        open={newRecordOpen}
        title="New Health Record"
        onClose={closeNewRecordModal}
        centered
        wide
      >
        <div className="cc-modal-body">
          <div className="hs-banner-warn" style={{ marginTop: 0, marginBottom: 16 }}>
            Confidential Medical Information
          </div>
          <div className="hs-modal-grid">
            <div className="hs-modal-field">
              <label>Name</label>
              <input
                placeholder="Student full name"
                value={newRecordForm.studentName}
                onChange={(e) =>
                  setNewRecordForm((f) => ({ ...f, studentName: sanitizePersonNameInput(e.target.value) }))
                }
              />
            </div>
            <div className="hs-modal-field">
              <label>Student ID</label>
              <input
                placeholder="e.g., 2023-10234"
                value={newRecordForm.studentId}
                onChange={(e) =>
                  setNewRecordForm((f) => ({ ...f, studentId: sanitizeDigitsOnlyInput(e.target.value) }))
                }
              />
            </div>
            <div className="hs-modal-field">
              <label>Program *</label>
              <select
                value={newRecordForm.program}
                onChange={(e) => setNewRecordForm((f) => ({ ...f, program: e.target.value }))}
              >
                <option value="">Select program</option>
                {NU_PROGRAM_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="hs-modal-field">
              <label>Blood Type *</label>
              <select
                value={newRecordForm.bloodType}
                onChange={(e) => setNewRecordForm((f) => ({ ...f, bloodType: e.target.value }))}
              >
                <option value="">Select blood type</option>
                {HS_BLOOD_TYPE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="hs-modal-field">
              <label>Allergies *</label>
              <select
                value={newRecordForm.allergyCategory}
                onChange={(e) =>
                  setNewRecordForm((f) => ({
                    ...f,
                    allergyCategory: e.target.value,
                    allergyOther: e.target.value === "Other" ? f.allergyOther : "",
                  }))
                }
              >
                {HS_ALLERGY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            {newRecordForm.allergyCategory === "Other" ? (
              <div className="hs-modal-field">
                <label>Specify allergies *</label>
                <input
                  value={newRecordForm.allergyOther}
                  onChange={(e) => setNewRecordForm((f) => ({ ...f, allergyOther: e.target.value }))}
                  placeholder="Describe allergies"
                />
              </div>
            ) : null}
            <div className="hs-modal-field">
              <label>Last Checkup</label>
              <input
                type="date"
                value={newRecordForm.lastCheckup}
                onChange={(e) => setNewRecordForm((f) => ({ ...f, lastCheckup: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="student@nu-dasma.edu.ph"
                value={newRecordForm.email}
                onChange={(e) => setNewRecordForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Phone</label>
              <input
                placeholder="09XX-XXX-XXXX"
                value={newRecordForm.phone}
                onChange={(e) => setNewRecordForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Chronic Conditions *</label>
              <select
                value={newRecordForm.chronicCategory}
                onChange={(e) =>
                  setNewRecordForm((f) => ({
                    ...f,
                    chronicCategory: e.target.value,
                    chronicOther: e.target.value === "Other" ? f.chronicOther : "",
                  }))
                }
              >
                {HS_CHRONIC_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            {newRecordForm.chronicCategory === "Other" ? (
              <div className="hs-modal-field">
                <label>Specify chronic conditions *</label>
                <input
                  value={newRecordForm.chronicOther}
                  onChange={(e) => setNewRecordForm((f) => ({ ...f, chronicOther: e.target.value }))}
                  placeholder="Describe chronic conditions"
                />
              </div>
            ) : null}
            <div className="hs-modal-field">
              <label>Emergency Contact</label>
              <input
                placeholder="Name, relation, number"
                value={newRecordForm.emergencyContact}
                onChange={(e) => setNewRecordForm((f) => ({ ...f, emergencyContact: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Medications</label>
              <input
                placeholder="Current medications"
                value={newRecordForm.medications}
                onChange={(e) => setNewRecordForm((f) => ({ ...f, medications: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Weight (kg)</label>
              <input
                placeholder="e.g., 52"
                value={newRecordForm.weight}
                onChange={(e) => setNewRecordForm((f) => ({ ...f, weight: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Blood Pressure</label>
              <input
                placeholder="120/80"
                value={newRecordForm.bloodPressure}
                onChange={(e) => setNewRecordForm((f) => ({ ...f, bloodPressure: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Height (cm)</label>
              <input
                placeholder="e.g., 160"
                value={newRecordForm.height}
                onChange={(e) => setNewRecordForm((f) => ({ ...f, height: e.target.value }))}
              />
            </div>
          </div>
          <div className="hs-modal-field" style={{ marginTop: 12 }}>
            <label>Notes</label>
            <textarea
              rows={3}
              placeholder="Additional notes…"
              value={newRecordForm.notes}
              onChange={(e) => setNewRecordForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
        <div className="hs-modal-footer">
          <button type="button" className="cc-btn-secondary hs-modal-btn-cancel" onClick={closeNewRecordModal}>
            Close
          </button>
          <button type="button" className="cc-btn-primary" disabled={recordSaving} onClick={saveNewMedicalRecord}>
            {recordSaving ? "Saving…" : "Save Record"}
          </button>
        </div>
      </CCModal>

      <CCModal
        modalClassName="hs-cc-modal"
        open={recordFilterOpen}
        title="Filter Health Records"
        onClose={cancelRecordFiltersModal}
        centered
        wide
      >
        <div className="cc-modal-body">
          <p className="hs-modal-lead">Narrow the table by status, checkup date, or student.</p>
          <div className="hs-modal-field">
            <label>Status (badge)</label>
            <select value={recordFilterStatus} onChange={(e) => setRecordFilterStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="cleared">cleared</option>
              <option value="followup">followup</option>
              <option value="vaccinated">Vaccinated</option>
              <option value="new">new</option>
            </select>
          </div>
          <div className="hs-modal-grid">
            <div className="hs-modal-field">
              <label>Last checkup from</label>
              <input type="date" value={recordFilterDateFrom} onChange={(e) => setRecordFilterDateFrom(e.target.value)} />
            </div>
            <div className="hs-modal-field">
              <label>Last checkup to</label>
              <input type="date" value={recordFilterDateTo} onChange={(e) => setRecordFilterDateTo(e.target.value)} />
            </div>
          </div>
          <div className="hs-modal-field">
            <label>Student name or ID contains</label>
            <input
              placeholder="Additional filter (search bar still applies)"
              value={recordFilterStudent}
              onChange={(e) => setRecordFilterStudent(e.target.value)}
            />
          </div>
        </div>
        <div className="hs-modal-footer">
          <button type="button" className="cc-btn-secondary hs-modal-btn-cancel" onClick={resetRecordFiltersInModal}>
            Reset
          </button>
          <button type="button" className="cc-btn-secondary hs-modal-btn-cancel" onClick={cancelRecordFiltersModal}>
            Cancel
          </button>
          <button type="button" className="cc-btn-primary" onClick={applyRecordFiltersModal}>
            Apply
          </button>
        </div>
      </CCModal>

      <CCModal
        modalClassName="hs-cc-modal"
        open={Boolean(selectedAppointment)}
        title="Appointment Details"
        onClose={() => setSelectedAppointment(null)}
        centered
        wide
      >
        {selectedAppointment ? (
          <>
            <div className="cc-modal-body">
              <p className="hs-modal-lead">View the details of the appointment.</p>
              <dl className="hs-detail-grid">
                <div className="hs-detail-item">
                  <dt>Student Name</dt>
                  <dd>{selectedAppointment.student}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Student ID</dt>
                  <dd>{selectedAppointment.studentId}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Phone</dt>
                  <dd>{selectedAppointment.phone}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Email</dt>
                  <dd>{selectedAppointment.email}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Date</dt>
                  <dd>{selectedAppointment.date}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Time</dt>
                  <dd>{selectedAppointment.time}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Location</dt>
                  <dd>{selectedAppointment.room}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Doctor</dt>
                  <dd>{selectedAppointment.doctor}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Service</dt>
                  <dd>{selectedAppointment.service}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Duration</dt>
                  <dd>{selectedAppointment.duration}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Status</dt>
                  <dd>{statusLabel(selectedAppointment.workflowStatus || selectedAppointment.status)}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Designation</dt>
                  <dd style={{ textTransform: "capitalize" }}>{selectedAppointment.designation || "physician"}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Check-in Code</dt>
                  <dd>{selectedAppointment.checkinCode || "—"}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Code Validity</dt>
                  <dd>
                    {selectedAppointment.checkinValidFrom
                      ? new Date(selectedAppointment.checkinValidFrom).toLocaleString()
                      : "—"}
                    {" - "}
                    {selectedAppointment.checkinValidUntil
                      ? new Date(selectedAppointment.checkinValidUntil).toLocaleString()
                      : "—"}
                  </dd>
                </div>
              </dl>
              <p className="hs-modal-section-title">Purpose</p>
              <p className="hs-consult-meta">{selectedAppointment.purpose}</p>
              <p className="hs-modal-section-title">Notes</p>
              <p className="hs-consult-meta">{selectedAppointment.notes?.trim() ? selectedAppointment.notes : "—"}</p>
            </div>
            <div className="hs-modal-footer">
              <button type="button" className="cc-btn-secondary hs-modal-btn-cancel" onClick={() => setSelectedAppointment(null)}>
                Close
              </button>
            </div>
          </>
        ) : null}
      </CCModal>

      <CCModal
        modalClassName="hs-cc-modal"
        open={Boolean(selectedReferral)}
        title="Referral Details"
        onClose={() => setSelectedReferral(null)}
        centered
        wide
      >
        {selectedReferral ? (
          <>
            <div className="cc-modal-body">
              <p className="hs-modal-lead">Complete referral information and tracking</p>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <span className="hs-pill hs-pill-scheduled">
                  {selectedReferral.disciplineIncoming || selectedReferral.sdaoIncoming ? selectedReferral.referralId : selectedReferral.referenceId}
                </span>
              </div>
              {!selectedReferral.disciplineIncoming && !selectedReferral.sdaoIncoming && selectedReferral.urgent ? (
                <div className="hs-banner-warn" style={{ marginBottom: 16 }}>
                  URGENT REFERRAL — Status: {selectedReferral.status}
                </div>
              ) : null}
              <p className="hs-modal-section-title">Student</p>
              <dl className="hs-detail-grid">
                <div className="hs-detail-item">
                  <dt>Name</dt>
                  <dd>{selectedReferral.student ?? selectedReferral.studentName}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Student ID</dt>
                  <dd>{selectedReferral.studentId}</dd>
                </div>
                {!selectedReferral.disciplineIncoming && !selectedReferral.sdaoIncoming ? (
                  <>
                    <div className="hs-detail-item">
                      <dt>Email</dt>
                      <dd>{selectedReferral.email}</dd>
                    </div>
                    <div className="hs-detail-item">
                      <dt>Phone</dt>
                      <dd>{selectedReferral.phone}</dd>
                    </div>
                    <div className="hs-detail-item">
                      <dt>Program</dt>
                      <dd>{selectedReferral.program}</dd>
                    </div>
                  </>
                ) : null}
              </dl>
              <p className="hs-modal-section-title">Referral</p>
              <dl className="hs-detail-grid">
                <div className="hs-detail-item">
                  <dt>From</dt>
                  <dd>
                    {selectedReferral.disciplineIncoming
                      ? labelForOfficeKey(selectedReferral.referringOffice)
                      : selectedReferral.sdaoIncoming
                        ? labelForOfficeKey(selectedReferral.referringOffice)
                        : selectedReferral.referringLabel || "Health Services Office"}
                  </dd>
                </div>
                <div className="hs-detail-item">
                  <dt>To</dt>
                  <dd>
                    {selectedReferral.disciplineIncoming || selectedReferral.sdaoIncoming
                      ? "Health Services (HSO)"
                      : selectedReferral.office}
                  </dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Date</dt>
                  <dd>{selectedReferral.date}</dd>
                </div>
                {!selectedReferral.disciplineIncoming && !selectedReferral.sdaoIncoming ? (
                  <div className="hs-detail-item">
                    <dt>Created By</dt>
                    <dd>{selectedReferral.by}</dd>
                  </div>
                ) : null}
                <div className="hs-detail-item">
                  <dt>Status</dt>
                  <dd>{selectedReferral.status}</dd>
                </div>
              </dl>
              {(selectedReferral.disciplineIncoming || selectedReferral.sdaoIncoming) && canReceivingOfficeReviewReferral(selectedReferral.status) ? (
                <p className="hs-consult-meta" style={{ marginTop: 12 }}>
                  Approve or decline this referral for Health Services.
                </p>
              ) : null}
              {!selectedReferral.disciplineIncoming &&
              (isReferralPendingPartnerReview(selectedReferral.status) ||
                normalizeReferralStatus(selectedReferral.status).includes("pending referring")) ? (
                <p className="hs-consult-meta" style={{ marginTop: 12 }}>
                  Waiting for {selectedReferral.office} to approve or decline.
                </p>
              ) : null}
              <p className="hs-modal-section-title">Reason</p>
              <p className="hs-consult-meta">{selectedReferral.reason}</p>
              {!selectedReferral.disciplineIncoming && !selectedReferral.sdaoIncoming ? (
                <>
                  <p className="hs-modal-section-title">Health observations</p>
                  <p className="hs-consult-meta">{selectedReferral.observations}</p>
                  <p className="hs-modal-section-title">Recommended action</p>
                  <p className="hs-consult-meta">{selectedReferral.recommendedAction}</p>
                </>
              ) : null}
              {(selectedReferral.disciplineIncoming || selectedReferral.sdaoIncoming) && Array.isArray(selectedReferral.evidence) && selectedReferral.evidence.length ? (
                <>
                  <p className="hs-modal-section-title">Attachments</p>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 14 }}>
                    {selectedReferral.evidence.map((ev, i) => (
                      <li key={i}>{ev.name || ev.label || "File"}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {!selectedReferral.disciplineIncoming && !selectedReferral.sdaoIncoming && selectedReferral.attachments?.length ? (
                <>
                  <p className="hs-modal-section-title">Attachments</p>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 14 }}>
                    {selectedReferral.attachments.map((att) => (
                      <li key={att.label}>{att.label}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {!selectedReferral.disciplineIncoming && !selectedReferral.sdaoIncoming && selectedReferral.timeline?.length ? (
                <>
                  <p className="hs-modal-section-title">Timeline</p>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 14 }}>
                    {selectedReferral.timeline.map((ev) => (
                      <li key={ev.label + ev.when}>
                        {ev.label} — {ev.when} · {ev.by}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
            <div className="hs-modal-footer" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="cc-btn-secondary hs-modal-btn-cancel" onClick={() => setSelectedReferral(null)}>
                Close
              </button>
              {(selectedReferral.disciplineIncoming || selectedReferral.sdaoIncoming) && canReceivingOfficeReviewReferral(selectedReferral.status) ? (
                <>
                  <button
                    type="button"
                    className="cc-btn-secondary"
                    onClick={async () => {
                      try {
                        if (isSupabaseConfigured() && supabase) {
                          const tableName = selectedReferral.sdaoIncoming ? "sdao_referrals" : "discipline_referrals";
                          const { error } = await supabase
                            .from(tableName)
                            .update({
                              status: DISCIPLINE_REFERRAL_STATUS.DECLINED,
                              updated_at: new Date().toISOString(),
                            })
                            .eq("id", selectedReferral.referralId);
                          if (error) throw error;
                        }
                        if (selectedReferral.sdaoIncoming) {
                          setSdaoIncomingReferrals((prev) =>
                            prev.map((x) =>
                              x.referralId === selectedReferral.referralId
                                ? { ...x, status: DISCIPLINE_REFERRAL_STATUS.DECLINED }
                                : x,
                            ),
                          );
                        } else {
                          setDisciplineIncomingReferrals((prev) =>
                            prev.map((x) =>
                              x.referralId === selectedReferral.referralId
                                ? { ...x, status: DISCIPLINE_REFERRAL_STATUS.DECLINED }
                                : x,
                            ),
                          );
                        }
                        setSelectedReferral((prev) =>
                          prev ? { ...prev, status: DISCIPLINE_REFERRAL_STATUS.DECLINED } : null,
                        );
                        showToast("Referral declined.", { variant: "success" });
                      } catch (err) {
                        showToast(err?.message || "Could not update referral.", { variant: "error" });
                      }
                    }}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className="cc-btn-primary"
                    onClick={async () => {
                      try {
                        if (isSupabaseConfigured() && supabase) {
                          const tableName = selectedReferral.sdaoIncoming ? "sdao_referrals" : "discipline_referrals";
                          const { error } = await supabase
                            .from(tableName)
                            .update({
                              status: DISCIPLINE_REFERRAL_STATUS.APPROVED,
                              updated_at: new Date().toISOString(),
                            })
                            .eq("id", selectedReferral.referralId);
                          if (error) throw error;
                        }
                        if (selectedReferral.sdaoIncoming) {
                          setSdaoIncomingReferrals((prev) =>
                            prev.map((x) =>
                              x.referralId === selectedReferral.referralId
                                ? { ...x, status: DISCIPLINE_REFERRAL_STATUS.APPROVED }
                                : x,
                            ),
                          );
                        } else {
                          setDisciplineIncomingReferrals((prev) =>
                            prev.map((x) =>
                              x.referralId === selectedReferral.referralId
                                ? { ...x, status: DISCIPLINE_REFERRAL_STATUS.APPROVED }
                                : x,
                            ),
                          );
                        }
                        setSelectedReferral((prev) =>
                          prev ? { ...prev, status: DISCIPLINE_REFERRAL_STATUS.APPROVED } : null,
                        );
                        showToast("Referral approved.", { variant: "success" });
                      } catch (err) {
                        showToast(err?.message || "Could not update referral.", { variant: "error" });
                      }
                    }}
                  >
                    Approve
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </CCModal>

      <CCModal
        modalClassName="hs-cc-modal"
        open={Boolean(selectedDocRequest)}
        title="Request Details"
        onClose={() => setSelectedDocRequest(null)}
        centered
        wide
      >
        {selectedDocRequest ? (
          <>
            <div className="cc-modal-body">
              {selectedDocRequest.statusBanner ? (
                <div className="hs-banner-warn" style={{ marginTop: 0, marginBottom: 16, background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" }}>
                  <strong>{selectedDocRequest.statusBanner}</strong>
                  {selectedDocRequest.pendingSince ? (
                    <span style={{ display: "block", fontWeight: 400, marginTop: 6 }}>
                      Request pending since: {selectedDocRequest.pendingSince}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <dl className="hs-detail-grid">
                <div className="hs-detail-item">
                  <dt>Request ID</dt>
                  <dd>{selectedDocRequest.id}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Document Type</dt>
                  <dd>{selectedDocRequest.doc}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Priority</dt>
                  <dd>{selectedDocRequest.priority}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Status</dt>
                  <dd>{selectedDocRequest.status}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>{selectedDocRequest.direction === "incoming" ? "From office" : "To office"}</dt>
                  <dd>{labelForOfficeKey(selectedDocRequest.partnerOffice)}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Date</dt>
                  <dd>{selectedDocRequest.date}</dd>
                </div>
              </dl>
              <p className="hs-modal-section-title">Attachments</p>
              <div style={{ marginBottom: 16 }}>
                {(selectedDocRequest.evidence || []).length === 0 ? (
                  <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>No attachments yet.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 14 }}>
                    {(selectedDocRequest.evidence || []).map((ev, idx) => (
                      <li key={`${ev.name}-${idx}-${ev.url || ""}`} style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          {ev.source === "target"
                            ? "Accepting office · "
                            : selectedDocRequest.direction === "outgoing"
                              ? "Included with request · "
                              : "Requesting office · "}
                        </span>
                        {ev.url ? (
                          <a href={ev.url} target="_blank" rel="noopener noreferrer">
                            {ev.name}
                          </a>
                        ) : (
                          ev.name
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {selectedDocRequest.direction === "incoming" ? (
                  <div style={{ marginTop: 12 }}>
                    {isDocRequestPendingApproval(selectedDocRequest.status) ? (
                      <p className="hs-consult-meta" style={{ marginBottom: 8 }}>
                        Approve this request first; then you can attach the file for the requesting office.
                      </p>
                    ) : null}
                    {isDocRequestDeclined(selectedDocRequest.status) ? (
                      <p className="hs-consult-meta" style={{ marginBottom: 8 }}>
                        This request was declined — uploads are disabled.
                      </p>
                    ) : null}
                    <label htmlFor="hso-doc-accept-upload" style={{ display: "block", fontWeight: 600 }}>
                      Add attachment (your office)
                    </label>
                    <input
                      id="hso-doc-accept-upload"
                      type="file"
                      disabled={
                        docAcceptingUploadBusy || !canReceivingOfficeUploadDoc(selectedDocRequest.status)
                      }
                      onChange={handleHsoAcceptingOfficeUpload}
                      style={{ marginTop: 8, width: "100%", maxWidth: 360 }}
                    />
                    {docAcceptingUploadBusy ? (
                      <span style={{ fontSize: 12, color: "#64748b", display: "block", marginTop: 6 }}>
                        Uploading…
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <p className="hs-modal-section-title">Request notes</p>
              <div className="hs-banner-info" style={{ marginBottom: 0 }}>
                {selectedDocRequest.notes}
              </div>
            </div>
            <div className="hs-modal-footer" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span className="hs-stat-meta">Requested by: {selectedDocRequest.requestedBy}</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {selectedDocRequest.direction === "incoming" && isDocRequestPendingApproval(selectedDocRequest.status) ? (
                  <>
                    <button
                      type="button"
                      className="cc-btn-secondary"
                      onClick={async () => {
                        try {
                          if (isSupabaseConfigured() && supabase) {
                            const { error } = await supabase
                              .from("inter_office_document_requests")
                              .update({ status: INTER_OFFICE_DOC_STATUS.DECLINED, updated_at: new Date().toISOString() })
                              .eq("id", selectedDocRequest.id);
                            if (error) throw error;
                          }
                          setDocRequestsRows((prev) =>
                            prev.map((d) =>
                              d.id === selectedDocRequest.id ? { ...d, status: INTER_OFFICE_DOC_STATUS.DECLINED } : d,
                            ),
                          );
                          setSelectedDocRequest((prev) =>
                            prev ? { ...prev, status: INTER_OFFICE_DOC_STATUS.DECLINED } : null,
                          );
                          showToast("Request declined.", { variant: "success" });
                        } catch (err) {
                          showToast(err?.message || "Could not update request.", { variant: "error" });
                        }
                      }}
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      className="cc-btn-primary"
                      onClick={async () => {
                        try {
                          if (isSupabaseConfigured() && supabase) {
                            const { error } = await supabase
                              .from("inter_office_document_requests")
                              .update({ status: INTER_OFFICE_DOC_STATUS.APPROVED, updated_at: new Date().toISOString() })
                              .eq("id", selectedDocRequest.id);
                            if (error) throw error;
                          }
                          setDocRequestsRows((prev) =>
                            prev.map((d) =>
                              d.id === selectedDocRequest.id ? { ...d, status: INTER_OFFICE_DOC_STATUS.APPROVED } : d,
                            ),
                          );
                          setSelectedDocRequest((prev) =>
                            prev ? { ...prev, status: INTER_OFFICE_DOC_STATUS.APPROVED } : null,
                          );
                          showToast("Request approved. You can now attach the file.", { variant: "success" });
                        } catch (err) {
                          showToast(err?.message || "Could not update request.", { variant: "error" });
                        }
                      }}
                    >
                      Approve
                    </button>
                  </>
                ) : null}
                <button type="button" className="cc-btn-secondary hs-modal-btn-cancel" onClick={() => setSelectedDocRequest(null)}>
                  Close
                </button>
              </div>
            </div>
          </>
        ) : null}
      </CCModal>

      <InterOfficeNewDocumentRequestModal
        key={hsoNewDocModalKey}
        open={newDocOpen}
        onClose={() => setNewDocOpen(false)}
        viewerOfficeKey="health"
        submitting={docSaving}
        onSubmit={handleHsoNewDocumentRequestSubmit}
      />

      {consultDetail ? (
        <div className="hs-drawer-overlay" role="presentation" onMouseDown={() => setConsultDetail(null)}>
          <aside className="hs-drawer" onMouseDown={(e) => e.stopPropagation()}>
            <div className="hs-drawer-header">
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Consultation Details</h2>
                <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{consultDetail.id}</p>
              </div>
              <button type="button" className="cc-modal-close" aria-label="Close" onClick={() => setConsultDetail(null)}>
                ✕
              </button>
            </div>
            <div className="hs-drawer-body">
              <dl className="hs-detail-grid">
                <div className="hs-detail-item">
                  <dt>Name</dt>
                  <dd>{consultDetail.student}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Student ID</dt>
                  <dd>{consultDetail.studentId}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Date</dt>
                  <dd>{consultDetail.date}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Time</dt>
                  <dd>{consultDetail.time}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Visit Type</dt>
                  <dd>{consultDetail.type}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Attended By</dt>
                  <dd>{consultDetail.doctor}</dd>
                </div>
              </dl>
              <p className="hs-modal-section-title">Chief Complaint</p>
              <p className="hs-consult-meta">{consultDetail.reason}</p>
              <p className="hs-modal-section-title">Vital Signs</p>
              <div className="hs-vital-chips">
                <div className="hs-vital-chip">
                  <span>Blood Pressure</span>
                  <strong>{consultDetail.bloodPressure?.trim() ? consultDetail.bloodPressure : "—"}</strong>
                </div>
                <div className="hs-vital-chip">
                  <span>Temperature</span>
                  <strong>
                    {consultDetail.temperature?.trim() ? `${consultDetail.temperature}°C` : "—"}
                  </strong>
                </div>
                <div className="hs-vital-chip">
                  <span>Heart Rate</span>
                  <strong>{consultDetail.heartRate?.trim() ? `${consultDetail.heartRate} bpm` : "—"}</strong>
                </div>
              </div>
              <div className="hs-lock-box">
                <Lock size={16} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>CONFIDENTIAL</strong> — Medical Staff Only. Student chart summary for preview; full notes in EMR.
                </span>
              </div>
            </div>
            <div className="hs-modal-footer" style={{ margin: 0 }}>
              <button type="button" className="cc-btn-secondary hs-modal-btn-cancel" onClick={() => setConsultDetail(null)}>
                Close
              </button>
              <button type="button" className="hs-btn-outline">
                <Printer size={14} strokeWidth={1.5} aria-hidden />
                Print Record
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <CCModal
        modalClassName="hs-cc-modal hs-cc-modal--record"
        open={Boolean(recordDetail)}
        title={recordDetail ? `Medical record — ${recordDetail.student}` : ""}
        onClose={() => setRecordDetail(null)}
        centered
        wide
      >
        {recordDetail ? (
          <>
            <div className="cc-modal-body hs-record-detail-body">
              <p className="hs-banner-warn" style={{ marginTop: 0 }}>
                Confidential — medical staff only. Verify identity before care.
              </p>
              <dl className="hs-detail-grid hs-record-detail-grid">
                <div className="hs-detail-item">
                  <dt>Student ID</dt>
                  <dd>{recordDetail.studentId}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Program</dt>
                  <dd>{recordDetail.program}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Blood type</dt>
                  <dd>{recordDetail.blood}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Last checkup</dt>
                  <dd>{recordDetail.last}</dd>
                </div>
                <div className="hs-detail-item hs-detail-item--full">
                  <dt>Allergies</dt>
                  <dd>{recordDetail.allergies}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Email</dt>
                  <dd>{recordDetail.email || "—"}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Phone</dt>
                  <dd>{recordDetail.phone || "—"}</dd>
                </div>
                <div className="hs-detail-item hs-detail-item--full">
                  <dt>Emergency contact</dt>
                  <dd>{recordDetail.emergencyContact || "—"}</dd>
                </div>
                <div className="hs-detail-item hs-detail-item--full">
                  <dt>Medications</dt>
                  <dd>{recordDetail.medications || "—"}</dd>
                </div>
                <div className="hs-detail-item hs-detail-item--full">
                  <dt>Chronic conditions</dt>
                  <dd>{recordDetail.chronicConditions || "—"}</dd>
                </div>
                <div className="hs-detail-item hs-detail-item--full">
                  <dt>Vaccinations</dt>
                  <dd>{recordDetail.vaccinations || "—"}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Weight</dt>
                  <dd>{recordDetail.weightKg != null && recordDetail.weightKg !== "" ? `${recordDetail.weightKg} kg` : "—"}</dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Height</dt>
                  <dd>{recordDetail.heightCm != null && recordDetail.heightCm !== "" ? `${recordDetail.heightCm} cm` : "—"}</dd>
                </div>
              </dl>
            </div>
            <div className="hs-modal-footer">
              <button type="button" className="cc-btn-secondary hs-modal-btn-cancel" onClick={() => setRecordDetail(null)}>
                Close
              </button>
              <button type="button" className="cc-btn-primary">
                Edit
              </button>
            </div>
          </>
        ) : null}
      </CCModal>
    </div>
  );
}

export default HealthServices;
