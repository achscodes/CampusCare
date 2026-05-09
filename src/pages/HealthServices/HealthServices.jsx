import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
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
import { showToast } from "../../utils/toast";
import Sidebar from "../../components/Sidebar/Sidebar";
import OfficeHeader from "../../components/OfficeHeader/OfficeHeader";
import StaffNotificationBell from "../../components/common/StaffNotificationBell";
import CCModal from "../../components/common/CCModal";
import { useDONotificationsRealtime } from "../../hooks/useDONotificationsRealtime";
import InterOfficeNewDocumentRequestModal from "../../components/interOffice/InterOfficeNewDocumentRequestModal";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import {
  loadHsoFromSupabase,
  loadHsoStaffFromSupabase,
  mapAppointmentRow,
  mapReferralRow,
} from "../../services/hsoSupabase";
import {
  interOfficeDocumentRequestToInsert,
  interOfficeRowToHsoDocumentRequest,
} from "../../services/interOfficeDocumentRequests";
import { appendEvidenceToInterOfficeRequest } from "../../services/interOfficeDocumentEvidence";
import { logoutCampusCare } from "../../utils/campusCareAuth";
import { PROFILE_SETTINGS_PATH_HEALTH } from "../../utils/profileSettingsRoutes";
import { readCampusCareSession } from "../../utils/campusCareSession";
import { canCreateDocumentRequest, labelForOfficeKey } from "../../constants/documentRequestAccess";
import { NU_PROGRAM_OPTIONS } from "../../data/nuPrograms";
import "../DODashboard/DO.css";
import "./HealthServices.css";
import { sanitizeDigitsOnlyInput, sanitizePersonNameInput } from "../../utils/signupFieldValidation";
import { hsoDesignationLabel, normalizeHsoDesignation } from "../../utils/hsoAccess";
import { HEALTH_NAV_ITEMS, HS_NOTIFICATIONS } from "./hsoNavConfig";
import DentistOdontogram from "./DentistOdontogram";
import {
  HSO_WORKFLOW_STATUS,
  computeCheckinWindow,
  consultationTypeOptions,
  designationToService,
  generateCheckinCode,
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
  referrals: {
    title: "Referrals",
    subtitle: "Create and track referrals to other offices and external partners",
  },
  docrequests: {
    title: "Document Requests",
    subtitle: "Request student documents from the Discipline Office (DO) or Student Development (SDAO), and track requests from partner offices",
  },
  reports: {
    title: "Reports & Analytics",
    subtitle: "Health services statistics, metrics, and insights",
  },
  settings: {
    title: "Settings",
    subtitle: "Configure queue policies, check-in windows, and operational defaults",
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

const HEALTH_NAV_BY_DESIGNATION = {
  // Admin scope intentionally limited to screens present in provided UI reference.
  admin: ["dashboard", "userManagement", "staffScheduling", "queue", "reports", "settings"],
  nurse: ["dashboard", "appointments", "checkin", "queue", "records", "settings"],
  physician: ["dashboard", "visits", "records", "appointments", "queueDisplay"],
  dentist: ["dashboard", "dentalQueue", "dentalRecords", "dentalChart", "dentalFollowups"],
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
  phone: "",
  receivingOffice: "Discipline Office (DO)",
  reason: "",
};

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
 * When true, renders only Reports & Analytics (no office sidebar/header) for Super Admin embed.
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
  const [adminStaffRows, setAdminStaffRows] = useState(() => []);
  const [pendingApprovalRows, setPendingApprovalRows] = useState(() => []);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [docRequestsRows, setDocRequestsRows] = useState(() => []);
  const [selectedDocRequest, setSelectedDocRequest] = useState(null);
  const [reportsTimeFilter, setReportsTimeFilter] = useState("week");
  const [hsoLoading, setHsoLoading] = useState(false);
  const [hsoLoadError, setHsoLoadError] = useState(null);
  const [newApptForm, setNewApptForm] = useState(() => ({ ...INITIAL_NEW_APPT }));
  const [newReferralForm, setNewReferralForm] = useState(() => ({ ...INITIAL_NEW_REFERRAL }));
  const [apptSaving, setApptSaving] = useState(false);
  const [referralSaving, setReferralSaving] = useState(false);
  const [docSaving, setDocSaving] = useState(false);
  const [docAcceptingUploadBusy, setDocAcceptingUploadBusy] = useState(false);
  const [checkinCodeInput, setCheckinCodeInput] = useState("");
  const [nurseQueueCounter, setNurseQueueCounter] = useState(0);
  const [checkinPreview, setCheckinPreview] = useState(null);
  const [nurseStationOnline, setNurseStationOnline] = useState(false);
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

  const session = useMemo(() => {
    return readCampusCareSession();
  }, []);

  useDONotificationsRealtime();

  const canInterOfficeDocRequest = canCreateDocumentRequest(session?.office);
  const userDesignation = normalizeHsoDesignation(session?.designation);
  const isNurseUser = userDesignation === "nurse";
  const isPhysicianUser = userDesignation === "physician";
  const isDentistUser = userDesignation === "dentist";
  const allowedNavSet = useMemo(
    () => new Set(HEALTH_NAV_BY_DESIGNATION[userDesignation] || HEALTH_NAV_BY_DESIGNATION.admin),
    [userDesignation],
  );
  const healthNavItems = useMemo(() => {
    const filtered = HEALTH_NAV_ITEMS.filter(
      (i) => allowedNavSet.has(i.id) && (canInterOfficeDocRequest || i.id !== "docrequests"),
    );
    if (userDesignation === "nurse") {
      const nurseLabelMap = {
        dashboard: "Dashboard",
        checkin: "Patient Check-In",
        queue: "Nurse Queue",
        appointments: "Triage Management",
        records: "Patient Records",
        settings: "Settings",
      };
      return filtered.map((item) => ({ ...item, label: nurseLabelMap[item.id] || item.label }));
    }
    if (userDesignation === "physician") {
      const physicianLabelMap = {
        dashboard: "Dashboard",
        visits: "Physician Queue",
        records: "Patient Record",
        appointments: "Medical Certificate",
        queueDisplay: "Prescription History",
      };
      return filtered.map((item) => ({ ...item, label: physicianLabelMap[item.id] || item.label }));
    }
    if (userDesignation === "dentist") {
      const dentistLabelMap = {
        dashboard: "Dashboard",
        dentalQueue: "Dental Queue",
        dentalRecords: "Patients Records",
        dentalChart: "Dental Chart",
        dentalFollowups: "Follow-ups",
      };
      return filtered.map((item) => ({ ...item, label: dentistLabelMap[item.id] || item.label }));
    }
    return filtered;
  }, [allowedNavSet, canInterOfficeDocRequest, userDesignation]);

  const userName = session?.name || "Priscilla C. Pelayo";
  const userRole = `${hsoDesignationLabel(userDesignation)} · ${session?.role || "Staff"}`;

  const nurseMetaByNav = {
    dashboard: { title: "Dashboard", subtitle: "Nurse station overview and patient management" },
    checkin: { title: "Patient Check-In", subtitle: "Nurse station overview and patient management" },
    queue: { title: "Queue Management", subtitle: "Live ticketing across all stations." },
    appointments: { title: "Vital Signs", subtitle: "Capture and review patient vitals before consultation." },
    records: { title: "Patient Records", subtitle: "Read-only view for nurses - diagnoses are restricted to physicians." },
    settings: { title: "Settings", subtitle: "Configure queue and station preferences." },
  };
  const physicianMetaByNav = {
    dashboard: { title: "Physician Workspace", subtitle: "Review vitals, consult patients, manage prescriptions." },
    visits: { title: "Physician Queue", subtitle: "Manage patient queue and flow." },
    records: { title: "Patient Records", subtitle: "Full clinical history with prescriptions and vitals." },
    consultation: { title: "Consultation", subtitle: "Review vitals, consult patients, manage prescriptions." },
    appointments: { title: "Medical Certificates", subtitle: "Issue and track medical certifications." },
    queueDisplay: { title: "Prescription History", subtitle: "All prescriptions issued from your workspace." },
  };
  const dentistMetaByNav = {
    dashboard: { title: "Dentist Dashboard", subtitle: "Track patients, procedures and follow-ups." },
    dentalQueue: { title: "Queue Management", subtitle: "Live ticketing in Dentist Station." },
    dentalRecords: { title: "Patient Records", subtitle: "Dental history, charts and follow-ups." },
    dentalChart: { title: "Dental Dashboard", subtitle: "Charting, procedures and follow-ups." },
    dentalFollowups: { title: "Follow-up Appointments", subtitle: "Recall visits, post-procedure reviews and check-backs." },
  };
  const meta = isNurseUser
    ? (nurseMetaByNav[activeNav] || nurseMetaByNav.dashboard)
    : isPhysicianUser
      ? (physicianMetaByNav[activeNav] || physicianMetaByNav.dashboard)
      : isDentistUser
        ? (dentistMetaByNav[activeNav] ?? dentistMetaByNav.dashboard)
        : (PAGE_META[activeNav] ?? PAGE_META.dashboard);

  useEffect(() => {
    if (!canInterOfficeDocRequest && activeNav === "docrequests") setActiveNav("dashboard");
  }, [canInterOfficeDocRequest, activeNav]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured() || !supabase) return;
      const { data: authData } = await supabase.auth.getSession();
      if (!authData?.session) return;
      setHsoLoading(true);
      setHsoLoadError(null);
      const [res, staffRes] = await Promise.all([
        loadHsoFromSupabase(supabase),
        loadHsoStaffFromSupabase(supabase),
      ]);
      if (cancelled) return;
      setHsoLoading(false);
      if (!res.ok) {
        setHsoLoadError(res.error?.message || "Could not load Health Services data from Supabase.");
        return;
      }
      setConsultationRows(res.consultations);
      setHealthRecordsRows(res.records);
      setAppointmentsList(res.appointments);
      setReferralsList(res.referrals);
      setDocRequestsRows(res.documents);
      setDisciplineIncomingReferrals(res.disciplineReferralsIncoming || []);
      if (staffRes.ok) {
        setAdminStaffRows(staffRes.staffRows || []);
        setPendingApprovalRows(staffRes.pendingApprovals || []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmLogout = async () => {
    setLogoutOpen(false);
    await logoutCampusCare();
    navigate("/");
  };

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
    const checkinCode = generateCheckinCode();
    const { validFrom, validUntil } = computeCheckinWindow(newApptForm.date, newApptForm.time);
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
      checkin_code: checkinCode,
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
            checkinCode,
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

  const persistAppointmentWorkflow = async (appointmentId, patch) => {
    const rowId = String(appointmentId);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from("health_appointments").update(patch).eq("id", rowId);
        if (error) throw error;
      }
      setAppointmentsList((prev) =>
        prev.map((a) => (String(a.id) === rowId ? { ...a, ...patch, workflowStatus: patch.workflow_status ?? a.workflowStatus } : a)),
      );
      return true;
    } catch (err) {
      showToast(err?.message || "Could not update queue workflow.", { variant: "error" });
      return false;
    } finally {
      // no-op
    }
  };

  const verifyCheckinCode = () => {
    const code = checkinCodeInput.trim();
    if (!code) {
      showToast("Enter check-in code.", { variant: "warning" });
      return;
    }
    const target = appointmentsList.find((a) => a.checkinCode === code);
    if (!target) {
      setCheckinPreview(null);
      showToast("Invalid check-in code.", { variant: "warning" });
      return;
    }
    setCheckinPreview(target);
  };

  const handleCheckinByCode = async () => {
    const target = checkinPreview;
    if (!target) {
      showToast("Verify appointment code first.", { variant: "warning" });
      return;
    }
    if (!nowInWindow(target.checkinValidFrom, target.checkinValidUntil)) {
      await persistAppointmentWorkflow(target.id, { workflow_status: HSO_WORKFLOW_STATUS.EXPIRED_CODE });
      showToast("Check-in code expired or not active yet.", { variant: "warning" });
      return;
    }
    const nextQueue = nurseQueueCounter + 1;
    setNurseQueueCounter(nextQueue);
    const ok = await persistAppointmentWorkflow(target.id, {
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
    const queueNumber = nurseQueueCounter + 1;
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
    const nextRow = nurseWaitlistRows.find((r) => r.status === HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE);
    if (!nextRow) {
      showToast("No pending students in queue.", { variant: "warning" });
      return;
    }
    setActiveNurseSessionId(nextRow.id);
    setNurseTriageForm({ ...INITIAL_NURSE_TRIAGE });
    if (nextRow.source === "student") {
      await persistAppointmentWorkflow(nextRow.appointmentId, {
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
  };

  const handleNurseComplete = async () => {
    if (!activeNurseSession) return;
    if (activeNurseSession.source === "student") {
      await persistAppointmentWorkflow(activeNurseSession.appointmentId, {
        workflow_status: HSO_WORKFLOW_STATUS.COMPLETED,
        consultation_completed_at: new Date().toISOString(),
        nurse_vitals: nurseTriageForm,
        status: "completed",
      });
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
      action: "Completed triage",
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

  const startProviderConsultation = async (appt) => {
    await persistAppointmentWorkflow(appt.id, {
      workflow_status: HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS,
      consultation_started_at: new Date().toISOString(),
    });
  };

  const completeProviderConsultation = async (appt) => {
    const ok = await persistAppointmentWorkflow(appt.id, {
      workflow_status: HSO_WORKFLOW_STATUS.COMPLETED,
      consultation_completed_at: new Date().toISOString(),
      status: "completed",
    });
    if (ok) {
      const row = {
        id: `from-appt-${appt.id}-${Date.now()}`,
        student: appt.student,
        studentId: appt.studentId,
        type: "Scheduled",
        followup: false,
        reason: appt.consultationType || appt.purpose || "Consultation",
        date: appt.date || formatVisitDateLabel(new Date()),
        time: appt.time || "—",
        doctor: userName,
        status: "completed",
        bloodPressure: appt.nurseVitals?.bloodPressure || "",
        temperature: appt.nurseVitals?.temperature || "",
        heartRate: appt.nurseVitals?.pulse || "",
        diagnosis: "",
        treatment: "",
      };
      setConsultationRows((prev) => [row, ...prev]);
      showToast("Consultation completed and logged.", { variant: "success" });
    }
  };

  const saveNewReferral = async () => {
    const miss = [];
    if (!newReferralForm.studentName.trim()) miss.push("Student name");
    if (!newReferralForm.studentId.trim()) miss.push("Student ID");
    if (!newReferralForm.email.trim()) miss.push("Email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newReferralForm.email.trim())) {
      showToast("Enter a valid email address.", { variant: "warning" });
      return;
    }
    if (!newReferralForm.phone.trim()) miss.push("Contact number");
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
      program: null,
      student_email: newReferralForm.email.trim() || null,
      student_phone: newReferralForm.phone.trim() || null,
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
            program: "—",
            email: payload.student_email || "—",
            phone: payload.student_phone || "—",
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
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Could not send referral.", { variant: "error" });
    } finally {
      setReferralSaving(false);
    }
  };

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
        d.student.toLowerCase().includes(q) ||
        d.sid.includes(q) ||
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

  const physicianPrescriptionRows = useMemo(
    () =>
      consultationRows
        .filter((row) => String(row.prescription || "").trim())
        .map((row, index) => ({
          id: row.id || `rx-${index}`,
          patient: row.student || row.patient || "—",
          drug: row.prescription,
          instructions: row.notes || "—",
          date: row.date || "—",
          status: row.status || "active",
        })),
    [consultationRows],
  );

  const workflowRows = useMemo(
    () =>
      appointmentsList.map((a) => ({
        ...a,
        workflowStatus: normalizeWorkflowStatus(a.workflowStatus || a.status),
      })),
    [appointmentsList],
  );

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

  const pendingStaffApprovalRows = useMemo(
    () => pendingApprovalRows.filter((r) => ["nurse", "physician", "dentist"].includes(String(r.designation || "").toLowerCase())),
    [pendingApprovalRows],
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

  const approvePendingStaff = async (row) => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from("profiles")
          .update({ account_status: "approved" })
          .eq("id", row.id)
          .eq("office", "health");
        if (error) throw error;
      }
      setAdminStaffRows((prev) =>
        prev.map((r) =>
          String(r.id) === String(row.id)
            ? { ...r, accountStatus: "approved", status: "on-duty" }
            : r,
        ),
      );
      setPendingApprovalRows((prev) => prev.filter((r) => String(r.id) !== String(row.id)));
      showToast("Staff account approved.", { variant: "success" });
    } catch (err) {
      showToast(err?.message || "Could not approve staff account.", { variant: "error" });
    }
  };

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

  const activeNurseSession = useMemo(
    () => nurseWaitlistRows.find((r) => String(r.id) === String(activeNurseSessionId)) || null,
    [nurseWaitlistRows, activeNurseSessionId],
  );

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
    const maxAppointmentQueue = appointmentsList.reduce(
      (max, row) => Math.max(max, Number(row.queueNumber || 0)),
      0,
    );
    const maxVisitorQueue = nurseVisitors.reduce((max, row) => Math.max(max, Number(row.queueNumber || 0)), 0);
    const nextBaseline = Math.max(maxAppointmentQueue, maxVisitorQueue);
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


  const renderDashboard = () => {
    if (isNurseUser) {
      const dashboardQueueRows = nurseWaitlistRows.slice(0, 5);
      const servingQueueNum = nurseNowServing?.queueNumber
        ? String(nurseNowServing.queueNumber).padStart(4, "0")
        : "0001";
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
                {dashboardQueueRows.map((row) => (
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
                ))}
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
                    <span className="hs-pill hs-pill-ongoing">In Progress</span>
                  </div>
                </div>
              </div>
              <div className="cases-panel hs-panel-elevated hs-nurse-card hs-nurse-form">
                <div className="cases-panel-header">
                  <div className="cases-panel-title cases-panel-title--strong">Patient Check-In</div>
                  <p className="hs-list-sub hs-list-sub--tight">Enter patient check-in code</p>
                </div>
                <div className="cc-modal-body">
                  <div className="hs-modal-field">
                    <label>Check-In Code</label>
                    <input
                      placeholder="Enter code"
                      value={checkinCodeInput}
                      onChange={(e) => setCheckinCodeInput(sanitizeDigitsOnlyInput(e.target.value))}
                    />
                  </div>
                  <button type="button" className="hs-btn-primary hs-nurse-full-btn" onClick={verifyCheckinCode} style={{ marginTop: 10 }}>
                    Check In Patient
                  </button>
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
                  <div className="hs-modal-field"><label>Temperature (°C)</label><input value={nurseTriageForm.temperature || "36.5"} onChange={(e) => setNurseTriageForm((f) => ({ ...f, temperature: e.target.value }))} /></div>
                  <div className="hs-modal-field"><label>Blood Pressure</label><input value={nurseTriageForm.bloodPressure || "120/80"} onChange={(e) => setNurseTriageForm((f) => ({ ...f, bloodPressure: e.target.value }))} /></div>
                  <div className="hs-modal-field"><label>Pulse</label><input value={nurseTriageForm.pulse || "72 bpm"} onChange={(e) => setNurseTriageForm((f) => ({ ...f, pulse: e.target.value }))} /></div>
                  <div className="hs-modal-field"><label>Resp. Rate</label><input value={nurseTriageForm.respiratoryRate || "16 rpm"} onChange={(e) => setNurseTriageForm((f) => ({ ...f, respiratoryRate: e.target.value }))} /></div>
                  <div className="hs-modal-field"><label>Notes</label><textarea placeholder="Observations, concerns, allergies..." value={nurseTriageForm.remarks} onChange={(e) => setNurseTriageForm((f) => ({ ...f, remarks: e.target.value }))} /></div>
                  <div className="hs-nurse-vitals-actions">
                    <button type="button" className="hs-btn-success" onClick={handleNurseComplete}>Complete</button>
                    <button type="button" className="hs-btn-primary" onClick={handleNurseNext}>Next</button>
                  </div>
                </div>
              </div>
              <div className="cases-panel hs-panel-elevated hs-nurse-card">
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
            : String(row.student || "").toLowerCase() === String(active?.student || "").toLowerCase(),
        )
        .slice(0, 6);
      const activeRow = active || physicianQueueRows[0] || null;
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
                      <strong>{r.student}</strong>
                      <p>{r.reason || "—"}</p>
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
                    <div className="cases-panel-title cases-panel-title--strong">{activeRow?.student || "No active patient selected."}</div>
                    {activeRow ? (
                      <p className="hs-stat-meta">{`${activeRow?.studentId || "—"} · ${activeRow?.reason || "—"}`}</p>
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
                      onClick={() => setPhysicianCertModalOpen(true)}
                    >
                      Medical Certificate
                    </button>
                    <button type="button" className="hs-btn-primary">Complete</button>
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
                          <div><span>Temp</span><strong>{activeRow?.nurseVitals?.temperature || "—"}</strong></div>
                          <div><span>BP</span><strong>{activeRow?.nurseVitals?.bloodPressure || "—"}</strong></div>
                          <div><span>Pulse</span><strong>{activeRow?.nurseVitals?.pulse || "—"}</strong></div>
                          <div><span>Resp</span><strong>{activeRow?.nurseVitals?.respiratoryRate || "—"}</strong></div>
                        </div>
                        <p className="hs-stat-meta" style={{ marginTop: 10 }}>Recorded by triage nurse.</p>
                      </div>
                    ) : null}
                    {physicianPanelTab === "history" ? (
                      <div>
                        {historyRows.map((h) => (
                          <div className="hs-nurse-ticket" key={h.id}>
                            <p style={{ margin: 0, color: "#64748b" }}>{h.date}</p>
                            <strong>{h.reason} · Rx {h.treatment || "No prescription recorded"}</strong>
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

  const renderCheckin = () => (
    isNurseUser ? (
      <>
        <div className="cases-panel hs-panel-elevated">
          <div className="cases-panel-header">
            <div className="cases-panel-title cases-panel-title--strong">Student Check-In & Validation</div>
            <p className="hs-list-sub hs-list-sub--tight">Enter appointment code, verify profile, then confirm queueing.</p>
          </div>
          <div className="cc-modal-body">
            <div className="hs-modal-grid">
              <div className="hs-modal-field">
                <label>Appointment Code</label>
                <input value={checkinCodeInput} onChange={(e) => setCheckinCodeInput(sanitizeDigitsOnlyInput(e.target.value))} />
              </div>
            </div>
            <div className="hs-modal-footer" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="hs-btn-secondary" onClick={verifyCheckinCode}>
                Verify
              </button>
            </div>
            {checkinPreview ? (
              <div className="do-panel" style={{ marginTop: 14 }}>
                <div className="do-panel-header">
                  <h2 className="do-panel-title">Verification Profile</h2>
                </div>
                <div className="do-panel-body" style={{ padding: "12px 16px" }}>
                  <p className="cell-text"><strong>Photo & Name:</strong> [No photo] {checkinPreview.student}</p>
                  <p className="cell-text"><strong>Appointment Time:</strong> {checkinPreview.time || "—"}</p>
                  <p className="cell-text"><strong>Reason:</strong> {checkinPreview.consultationType || checkinPreview.purpose || "—"}</p>
                  <button type="button" className="hs-btn-primary" onClick={handleCheckinByCode}>
                    Confirm & Assign Queue Number
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
          <p className="hs-list-sub hs-list-sub--tight">Enter student check-in code to queue for nurse assessment.</p>
        </div>
        <div className="cc-modal-body">
          <div className="hs-modal-grid">
            <div className="hs-modal-field">
              <label>Check-in code</label>
              <input value={checkinCodeInput} onChange={(e) => setCheckinCodeInput(sanitizeDigitsOnlyInput(e.target.value))} />
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

  const renderQueue = () => (
    isNurseUser ? (
      <>
        <div className="hs-nurse-queue-layout">
          <div className="cases-panel hs-panel-elevated hs-nurse-card">
            <div className="cases-panel-header">
              <p className="hs-nurse-serving-label">NOW SERVING</p>
              <h2 className="hs-nurse-serving-title">QUEUING NUMBER</h2>
            </div>
            <div className="cc-modal-body">
              <div className="hs-nurse-serving-box">
                {String((activeNurseSession?.queueNumber || nurseNowServing?.queueNumber || 1)).padStart(4, "0")}
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
                <button type="button" className="hs-btn-secondary" onClick={() => setNurseStationOnline(true)}>
                  <Activity size={13} /> Start
                </button>
                <button type="button" className="hs-btn-secondary" onClick={() => { setNurseStationOnline(false); setActiveNurseSessionId(null); }}>
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
              <p className="hs-stat-meta">{`${nurseWaitlistRows.length} in line`}</p>
            </div>
            <div className="cc-modal-body">
              {nurseWaitlistRows.slice(0, 5).map((r) => (
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
              ))}
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
              {col.rows.map((r) => (
                <div key={r.id} className="hs-consult-row" style={{ gridTemplateColumns: "1fr auto", marginBottom: 8 }}>
                  <div>
                    <p className="hs-consult-name">{r.queueNumber ? String(r.queueNumber).padStart(4, "0") : "—"}</p>
                    <p className="hs-consult-meta">{r.student}</p>
                  </div>
                  <span className={pillClass(statusLabel(r.workflowStatus))}>{statusLabel(r.workflowStatus)}</span>
                </div>
              ))}
              {col.rows.length === 0 ? <p className="hs-stat-meta">No waiting patients.</p> : null}
            </div>
          </div>
        ))}
      </div>
    </>
    )
  );

  const renderConsultation = () => (
    isPhysicianUser ? (
      <div className="hs-phys-shell">
        <div className="hs-phys-kpi-row">
          <div className="hs-stat-card hs-phys-kpi"><p className="hs-stat-value">{providerQueueRows.length}</p><p className="hs-stat-label">In Queue</p></div>
          <div className="hs-stat-card hs-phys-kpi"><p className="hs-stat-value">{consultationRows.length}</p><p className="hs-stat-label">Consultations Today</p></div>
          <div className="hs-stat-card hs-phys-kpi"><p className="hs-stat-value">3</p><p className="hs-stat-label">Certificates Issued</p></div>
        </div>
        <div className="hs-phys-main-grid">
          <div className="cases-panel hs-panel-elevated hs-phys-card">
            <div className="cases-panel-header"><div className="cases-panel-title cases-panel-title--strong">Physician Queue</div></div>
            <div className="cc-modal-body">
              {providerQueueRows.slice(0, 5).map((r) => (
                <div className="hs-nurse-ticket hs-nurse-ticket--upnext" key={r.id}>
                  <div className="hs-nurse-ticket-no"><span>TICKET</span><strong>{String(r.queueNumber || 0).padStart(3, "0")}</strong></div>
                  <div><strong>{r.student}</strong><p>{r.reason || "Consultation"}</p></div>
                </div>
              ))}
              {!providerQueueRows.length ? (
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
              <div className="cases-panel-title cases-panel-title--strong">{providerQueueRows[0]?.student || "No active patient"}</div>
              {providerQueueRows[0] ? <button type="button" className="hs-btn-primary">Complete</button> : null}
            </div>
            {!providerQueueRows[0] ? (
              <div className="cc-modal-body">
                <EmptyStateMessage
                  icon={Stethoscope}
                  title="No active patient selected."
                  description="Select a student from the queue to begin consultation."
                />
              </div>
            ) : (
              <div className="cc-modal-body hs-phys-vitals-grid">
                <div><span>Temp</span><strong>{providerQueueRows[0]?.nurseVitals?.temperature || "—"}</strong></div>
                <div><span>BP</span><strong>{providerQueueRows[0]?.nurseVitals?.bloodPressure || "—"}</strong></div>
                <div><span>Pulse</span><strong>{providerQueueRows[0]?.nurseVitals?.pulse || "—"}</strong></div>
                <div><span>Resp</span><strong>{providerQueueRows[0]?.nurseVitals?.respiratoryRate || "—"}</strong></div>
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

  const renderQueueDisplay = () => {
    if (isPhysicianUser) {
      const issuedToday = physicianPrescriptionRows.filter((r) => r.date === formatVisitDateLabel(new Date())).length;
      return (
        <>
          <div className="hs-phys-kpi-row">
            <div className="hs-stat-card hs-phys-kpi"><p className="hs-stat-value">{issuedToday}</p><p className="hs-stat-label">Issued Today</p></div>
            <div className="hs-stat-card hs-phys-kpi"><p className="hs-stat-value">{physicianPrescriptionRows.length}</p><p className="hs-stat-label">Active</p></div>
            <div className="hs-stat-card hs-phys-kpi"><p className="hs-stat-value">0</p><p className="hs-stat-label">Refill Requests</p></div>
          </div>
          <div className="cases-panel hs-panel-elevated hs-phys-card">
            {physicianPrescriptionRows.length ? (
              <div className="cases-panel-header"><div className="cases-panel-title cases-panel-title--strong">All Prescriptions</div></div>
            ) : null}
            <div className="cases-table-wrapper">
              {physicianPrescriptionRows.length ? (
                <table className="cases-table">
                  <thead><tr><th>RX ID</th><th>Patient</th><th>Drug</th><th>Instructions</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {physicianPrescriptionRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td>{row.patient}</td>
                        <td>{row.drug}</td>
                        <td>{row.instructions}</td>
                        <td>{row.date}</td>
                        <td><span className={pillClass(statusLabel(row.status))}>{statusLabel(row.status)}</span></td>
                        <td>Refill • Print</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="cc-modal-body">
                  <EmptyStateMessage
                    icon={FileText}
                    title="No prescription history available."
                    description="Issued prescriptions will appear here once consultations include medication orders."
                  />
                </div>
              )}
            </div>
          </div>
        </>
      );
    }
    const nowServing = providerQueueRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS);
    return (
      <div className="cases-panel hs-panel-elevated">
        <div className="cases-panel-header">
          <div className="cases-panel-title cases-panel-title--strong">Patient Queue Display</div>
          <p className="hs-list-sub hs-list-sub--tight">Read-only board intended for TV monitor.</p>
        </div>
        <div className="cc-modal-body">
          <h2 style={{ marginTop: 0, color: "#0f172a" }}>
            Now Serving: {nowServing?.queueNumber ? String(nowServing.queueNumber).padStart(4, "0") : "----"}
          </h2>
          <div className="cases-table-wrapper">
            <table className="cases-table">
              <thead><tr><th>Queue #</th><th>Station</th><th>Status</th></tr></thead>
              <tbody>
                {providerQueueRows.slice(0, 10).map((r) => (
                  <tr key={r.id}>
                    <td className="cell-case-id">{r.queueNumber ? String(r.queueNumber).padStart(4, "0") : "—"}</td>
                    <td className="cell-text" style={{ textTransform: "capitalize" }}>{r.providerQueue || r.designation || "physician"}</td>
                    <td><span className={pillClass(statusLabel(r.workflowStatus))}>{statusLabel(r.workflowStatus)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderUserManagement = () => (
    <>
      <div className="hs-stat-row">
        <div className="hs-stat-card"><div className="hs-stat-card-top"><p className="hs-stat-value">{staffingSummary.total}</p></div><p className="hs-stat-label">Total Staff</p></div>
        <div className="hs-stat-card"><div className="hs-stat-card-top"><p className="hs-stat-value">{staffingSummary.onDuty}</p></div><p className="hs-stat-label">On Duty</p></div>
        <div className="hs-stat-card"><div className="hs-stat-card-top"><p className="hs-stat-value">{staffingSummary.offDuty}</p></div><p className="hs-stat-label">Off Duty</p></div>
      </div>
      <div className="cases-panel hs-panel-elevated">
        <div className="cases-panel-header"><div className="cases-panel-title cases-panel-title--strong">All Accounts</div></div>
        <div className="cases-table-wrapper">
          <table className="cases-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
            <tbody>
              {approvedClinicalStaffRows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-text">{prefixedName(r)}</td>
                  <td className="cell-text">{r.email}</td>
                  <td className="cell-text">{r.role}</td>
                  <td><span className={pillClass(r.status)}>{r.status === "on-duty" ? "On-Duty" : "Off-Duty"}</span></td>
                  <td className="cell-text">{r.lastLogin}</td>
                  <td className="cell-text"><button type="button" className="hs-link-action">Update</button> <button type="button" className="hs-link-action">Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="cases-panel hs-panel-elevated" style={{ marginTop: 16 }}>
        <div className="cases-panel-header"><div className="cases-panel-title cases-panel-title--strong">Account Approval</div></div>
        <div className="cases-table-wrapper">
          <table className="cases-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Requested At</th><th>Action</th></tr></thead>
            <tbody>
              {pendingStaffApprovalRows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-text">{r.name}</td>
                  <td className="cell-text">{r.email}</td>
                  <td className="cell-text">{r.role}</td>
                  <td className="cell-text">{r.requestedAt}</td>
                  <td>
                    <button
                      type="button"
                      className="hs-btn-primary"
                      style={{ height: 30, fontSize: 12 }}
                      onClick={() => approvePendingStaff(r)}
                    >
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderStaffScheduling = () => (
    <>
      <div className="cases-panel hs-panel-elevated">
        <div className="cases-panel-header">
          <div className="cases-panel-title cases-panel-title--strong">Weekly Schedule</div>
        </div>
        <div className="cases-table-wrapper">
          <table className="cases-table">
            <thead><tr><th>Staff</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Shift</th></tr></thead>
            <tbody>
              {approvedClinicalStaffRows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-text">{prefixedName(r)}</td>
                  <td className="cell-text">{r.schedule.mon}</td>
                  <td className="cell-text">{r.schedule.tue}</td>
                  <td className="cell-text">{r.schedule.wed}</td>
                  <td className="cell-text">{r.schedule.thu}</td>
                  <td className="cell-text">{r.schedule.fri}</td>
                  <td className="cell-text">{r.schedule.sat}</td>
                  <td className="cell-text">{r.shift}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="cases-panel hs-panel-elevated" style={{ marginTop: 16 }}>
        <div className="cases-panel-header"><div className="cases-panel-title cases-panel-title--strong">Clinic & Nursing Office Hours</div></div>
        <div className="cc-modal-body">
          <p className="hs-consult-meta">Monday to Friday: 7:00 AM - 9:00 PM</p>
          <p className="hs-consult-meta" style={{ marginTop: 8 }}>Saturday: 7:00 AM - 7:00 PM</p>
        </div>
      </div>
    </>
  );

  const renderDentistQueue = () => {
    const serving = dentistQueueRows[0];
    const rest = dentistQueueRows.slice(1);
    const avgWait = dentistQueueRows.length ? Math.min(40, 7 + dentistQueueRows.length * 2) : 0;
    return (
      <div className="hs-phys-queue-layout hs-dent-queue-page">
        <div className="cases-panel hs-panel-elevated hs-phys-card">
          <div className="cases-panel-header hs-dent-queue-serving-head">
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
              <button type="button" className="hs-btn-secondary">
                <CheckCircle size={13} /> Complete
              </button>
              <button type="button" className="hs-btn-secondary">
                <Send size={13} /> Next
              </button>
              <button type="button" className="hs-btn-secondary">
                <Route size={13} /> Transfer
              </button>
              <button type="button" className="hs-btn-secondary">
                <Activity size={13} /> Start
              </button>
              <button type="button" className="hs-btn-secondary">
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

  const renderSettings = () => (
    <div className="cases-panel hs-panel-elevated">
      <div className="cases-panel-header">
        <div className="cases-panel-title cases-panel-title--strong">HSO Operational Settings</div>
      </div>
      <div className="cc-modal-body">
        <div className="hs-modal-grid">
          <div className="hs-modal-field">
            <label>Check-in window</label>
            <input value="1 hour before appointment" readOnly />
          </div>
          <div className="hs-modal-field">
            <label>Queue prefix format</label>
            <input value="4-digit sequential" readOnly />
          </div>
          <div className="hs-modal-field">
            <label>No-show grace period</label>
            <input value="15 minutes" readOnly />
          </div>
          <div className="hs-modal-field">
            <label>Monitor refresh</label>
            <input value="8 seconds" readOnly />
          </div>
        </div>
      </div>
    </div>
  );

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
            <div className="cases-panel-header">
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
                <button type="button" className="hs-btn-secondary"><CheckCircle size={13} /> Complete</button>
                <button type="button" className="hs-btn-secondary"><Send size={13} /> Next</button>
                <button type="button" className="hs-btn-secondary"><Route size={13} /> Transfer</button>
                <button type="button" className="hs-btn-secondary"><Activity size={13} /> Start</button>
                <button type="button" className="hs-btn-secondary"><X size={13} /> Close</button>
              </div>
            </div>
          </div>
          <div className="cases-panel hs-panel-elevated hs-phys-card">
            <div className="cases-panel-header"><div className="cases-panel-title cases-panel-title--strong">Up Next</div></div>
            <div className="cc-modal-body">
              {physicianQueueRows.map((r) => (
                <div className="hs-nurse-ticket hs-nurse-ticket--upnext" key={r.id}>
                  <div className="hs-nurse-ticket-no"><span>TICKET</span><strong>{String(r.queueNumber || 0).padStart(4, "0")}</strong></div>
                  <div><strong>{r.student}</strong><p>{r.providerQueue || "Physician"}</p></div>
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
        {(() => {
          const selectedPatient = healthRecordsRows[0] || null;
          const patientTimelineRows = consultationRows
            .filter((row) =>
              selectedPatient?.studentId
                ? String(row.studentId || "").toLowerCase() === String(selectedPatient.studentId || "").toLowerCase()
                : String(row.student || "").toLowerCase() === String(selectedPatient?.student || "").toLowerCase(),
            )
            .slice(0, 5);
          return (
            <>
        <div className="cases-panel hs-panel-elevated hs-phys-card">
          <div className="cc-modal-body hs-phys-records-left">
            {healthRecordsRows.length ? (
              <>
                <div className="hs-modal-field hs-phys-records-search">
                  <input className="hs-filter-input" placeholder="Search patient..." />
                </div>
                <div className="hs-phys-records-list">
                  {healthRecordsRows.slice(0, 7).map((r) => (
                    <div key={r.id} className="hs-nurse-ticket">
                      <strong>{r.student}</strong>
                      <p>{r.studentId} • {r.allergies || "No known allergies"}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyStateMessage
                compact
                icon={Users}
                title="No patient records available."
                description="Student medical records will appear here after initial visits."
              />
            )}
          </div>
        </div>
        <div className="cases-panel hs-panel-elevated hs-phys-card">
          {selectedPatient ? (
            <>
              <div className="cases-panel-header hs-phys-records-header">
                <div>
                  <div className="cases-panel-title cases-panel-title--strong">{selectedPatient.student}</div>
                  <p className="hs-stat-meta">{selectedPatient.studentId} · {selectedPatient.allergies || "No known allergies"}</p>
                </div>
                <button type="button" className="hs-btn-secondary">Open Chart</button>
              </div>
              <div className="cc-modal-body hs-phys-records-right">
                <div className="hs-phys-tab-row">
                  {[
                    { id: "timeline", label: "Timeline" },
                    { id: "prescriptions", label: "Prescription" },
                    { id: "documents", label: "Documents" },
                  ].map((tab, idx) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`hs-phys-tab-btn ${idx === 0 ? "hs-phys-tab-btn--active" : ""}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {patientTimelineRows.length ? (
                  <div className="hs-phys-records-list">
                    {patientTimelineRows.map((c) => (
                      <div key={c.id} className="hs-nurse-ticket">
                        <strong>{c.date}</strong>
                        <p>{c.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyStateMessage
                    compact
                    icon={FileText}
                    title="No consultation notes available."
                    description="Completed consultation entries will appear in this patient chart."
                  />
                )}
              </div>
            </>
          ) : (
            <div className="cc-modal-body">
              <EmptyStateMessage
                icon={FileText}
                title="No patient selected."
                description="Select a student record from the left panel to open patient chart details."
              />
            </div>
          )}
        </div>
            </>
          );
        })()}
      </div>
    ) : isNurseUser ? (
      <>
        <div className="cases-panel hs-panel-elevated">
          <div className="cases-panel-header">
            <div className="cases-panel-title cases-panel-title--strong">Patient Records</div>
          </div>
          <div className="cc-modal-body">
            <div className="hs-modal-field" style={{ maxWidth: 340 }}>
              <label>Search by Student ID or Name</label>
              <input
                className="hs-filter-input"
                value={recordsQuery}
                onChange={(e) => setRecordsQuery(e.target.value)}
                placeholder="e.g., 2023-12345 or Maria"
              />
            </div>
          </div>
          <div className="cases-table-wrapper">
            <table className="cases-table">
              <thead><tr><th>Date & Time</th><th>Student</th><th>Vitals Summary</th></tr></thead>
              <tbody>
                {consultationRows
                  .filter((r) => {
                    const q = String(recordsQuery || "").trim().toLowerCase();
                    if (!q) return true;
                    return String(r.student || "").toLowerCase().includes(q) || String(r.studentId || "").toLowerCase().includes(q);
                  })
                  .slice(0, 20)
                  .map((r) => (
                    <tr key={r.id}>
                      <td className="cell-text">{`${r.date || "—"} ${r.time || ""}`.trim()}</td>
                      <td><p className="cell-student-name">{r.student}</p><p className="cell-student-id">{r.studentId}</p></td>
                      <td className="cell-text">{`${r.bloodPressure || "—"} / ${r.temperature || "—"}°C / ${r.heartRate || "—"} BPM`}</td>
                    </tr>
                  ))}
                {!consultationRows.length ? (
                  <tr><td className="cell-text" colSpan={3}>No visit timeline records yet.</td></tr>
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
        const filteredCertificates = certificatesList.filter((row) => {
          if (!certQuery) return true;
          return `${row.id} ${row.patient} ${row.reason}`.toLowerCase().includes(certQuery);
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
              {certificatesList.length ? (
                <div className="cases-panel-header hs-phys-cert-header">
                  <div className="cases-panel-title cases-panel-title--strong">Recently Issued</div>
                </div>
              ) : null}
              <div className="cases-table-wrapper">
                {certificatesList.length ? (
                  <>
                    <div className="hs-phys-cert-table-tools">
                      <div className="hs-phys-cert-search-wrap">
                        <input
                          className="hs-filter-input"
                          placeholder="Search by patient or ID..."
                          value={certificateSearch}
                          onChange={(e) => setCertificateSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <table className="cases-table">
                      <thead><tr><th>Cert ID</th><th>Patient</th><th>Reason</th><th>Period</th><th>Issued</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        {filteredCertificates.map((row) => (
                          <tr key={row.id}>
                            <td className="cell-text">{row.id}</td>
                            <td className="cell-text">{row.patient}</td>
                            <td className="cell-text">{row.reason}</td>
                            <td className="cell-text">{row.period}</td>
                            <td className="cell-text">{row.issuedAt}</td>
                            <td><span className={pillClass(statusLabel(row.status))}>{statusLabel(row.status)}</span></td>
                            <td>
                              <div className="hs-phys-cert-row-actions">
                                <button type="button" className="hs-icon-btn" aria-label={`Print ${row.id}`}>
                                  <Printer size={13} strokeWidth={1.9} aria-hidden />
                                </button>
                                <button type="button" className="hs-icon-btn" aria-label={`View ${row.id}`}>
                                  <Eye size={13} strokeWidth={1.9} aria-hidden />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!filteredCertificates.length ? (
                          <tr>
                            <td className="cell-text" colSpan={7}>No certificates match your search.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div className="cc-modal-body">
                    <EmptyStateMessage
                      icon={FileText}
                      title="No medical certificates issued yet."
                      description="Issued certificates will appear here once consultations are completed."
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
          <input className="search-input" placeholder="Search referrals..." readOnly />
        </div>
        <select className="hs-select" defaultValue="all">
          <option value="all">All Status</option>
        </select>
      </div>
      <div className="cases-panel hs-panel-elevated">
        <div className="cases-panel-header">
          <div className="cases-panel-top">
            <div>
              <div className="cases-panel-title cases-panel-title--strong">
                Outgoing referrals (Health Services) ({referralsList.length})
              </div>
              <p className="hs-list-sub hs-list-sub--tight">
                Referrals are sent directly to the partner office for review.
              </p>
            </div>
          </div>
        </div>
        <div className="cases-table-wrapper">
          {referralsList.map((r) => (
            <div key={r.id} className="hs-consult-row">
              <div>
                <p className="hs-consult-name">{r.student}</p>
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
          ))}
        </div>
      </div>

      <div className="cases-panel hs-panel-elevated" style={{ marginTop: 24 }}>
        <div className="cases-panel-header">
          <div className="cases-panel-top">
            <div>
              <div className="cases-panel-title cases-panel-title--strong">
                Incoming from Discipline Office ({disciplineIncomingReferrals.length})
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
              {disciplineIncomingReferrals.map((r) => (
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
          {disciplineIncomingReferrals.length === 0 ? (
            <p className="hs-list-sub" style={{ padding: "16px 12px", margin: 0 }}>
              No incoming referrals from Discipline Office.
            </p>
          ) : null}
        </div>
      </div>
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
      <div className="cases-panel hs-panel-elevated">
        <div className="cases-panel-header">
          <div className="cases-panel-top">
            <div>
              <div className="cases-panel-title cases-panel-title--strong">My Document Requests</div>
              <p className="hs-list-sub hs-list-sub--tight">Outgoing requests and incoming requests from partner offices share one list</p>
            </div>
          </div>
        </div>
        <div className="cases-table-wrapper">
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
              {filteredDocs.map((d) => (
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
        </div>
      </div>
    </>
  );

  const renderReports = () => (
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
    if (isNurseUser) return null;
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
        return { label: "New Appointment", onClick: openNewAppointmentModal, Icon: Plus };
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
        return userDesignation === "admin"
          ? { label: "Create Referral", onClick: openNewReferralModal, Icon: UserPlus }
          : null;
      case "docrequests":
        return canInterOfficeDocRequest && userDesignation === "admin"
          ? { label: "New Request", onClick: openNewDocModal, Icon: FileText }
          : null;
      case "reports":
        return null;
      case "settings":
        return null;
      case "queueDisplay":
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
        return renderReports();
      case "settings":
        return renderSettings();
      case "queueDisplay":
        return renderQueueDisplay();
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
          {isNurseUser && activeNav === "queue" ? (
            <section className="cases-panel hs-panel-elevated" style={{ marginBottom: 16 }}>
              <div className="cases-panel-header">
                <div className="cases-panel-title cases-panel-title--strong">Station Control Header</div>
              </div>
              <div className="cc-modal-body" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="hs-btn-success" onClick={() => setNurseStationOnline(true)}>
                  <CheckCircle size={14} strokeWidth={1.8} /> Start
                </button>
                <button
                  type="button"
                  className="hs-btn-secondary"
                  onClick={() => {
                    setNurseStationOnline(false);
                    setActiveNurseSessionId(null);
                  }}
                >
                  <X size={14} strokeWidth={1.8} /> Close
                </button>
                <span className="hs-stat-meta">
                  Nurse Station 1 - {nurseStationOnline ? "Active (Online)" : "Inactive (Offline)"}
                </span>
              </div>
            </section>
          ) : null}
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
            For {workflowRows.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS)?.student || "selected patient"}
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
            <button type="button" className="hs-btn-primary" onClick={() => setPhysicianCertModalOpen(false)}>
              Issue &amp; Print
            </button>
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
        title="Create New Referral"
        onClose={() => setNewReferralOpen(false)}
        centered
        wide
      >
        <div className="cc-modal-body">
          <p className="hs-modal-section-title" style={{ marginTop: 0 }}>
            Student Information
          </p>
          <div className="hs-modal-grid">
            <div className="hs-modal-field">
              <label>Student Name</label>
              <input
                value={newReferralForm.studentName}
                onChange={(e) =>
                  setNewReferralForm((f) => ({ ...f, studentName: sanitizePersonNameInput(e.target.value) }))
                }
              />
            </div>
            <div className="hs-modal-field">
              <label>Student ID</label>
              <input
                value={newReferralForm.studentId}
                onChange={(e) =>
                  setNewReferralForm((f) => ({ ...f, studentId: sanitizeDigitsOnlyInput(e.target.value) }))
                }
              />
            </div>
            <div className="hs-modal-field">
              <label>Email</label>
              <input
                type="email"
                value={newReferralForm.email}
                onChange={(e) => setNewReferralForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="hs-modal-field">
              <label>Contact Number</label>
              <input
                value={newReferralForm.phone}
                onChange={(e) => setNewReferralForm((f) => ({ ...f, phone: e.target.value }))}
              />
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
          <button type="button" className="cc-btn-primary" disabled={referralSaving} onClick={saveNewReferral}>
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
                  {selectedReferral.disciplineIncoming ? selectedReferral.referralId : selectedReferral.referenceId}
                </span>
              </div>
              {!selectedReferral.disciplineIncoming && selectedReferral.urgent ? (
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
                {!selectedReferral.disciplineIncoming ? (
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
                      : selectedReferral.referringLabel || "Health Services Office"}
                  </dd>
                </div>
                <div className="hs-detail-item">
                  <dt>To</dt>
                  <dd>
                    {selectedReferral.disciplineIncoming
                      ? "Health Services (HSO)"
                      : selectedReferral.office}
                  </dd>
                </div>
                <div className="hs-detail-item">
                  <dt>Date</dt>
                  <dd>{selectedReferral.date}</dd>
                </div>
                {!selectedReferral.disciplineIncoming ? (
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
              {selectedReferral.disciplineIncoming && canReceivingOfficeReviewReferral(selectedReferral.status) ? (
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
              {!selectedReferral.disciplineIncoming ? (
                <>
                  <p className="hs-modal-section-title">Health observations</p>
                  <p className="hs-consult-meta">{selectedReferral.observations}</p>
                  <p className="hs-modal-section-title">Recommended action</p>
                  <p className="hs-consult-meta">{selectedReferral.recommendedAction}</p>
                </>
              ) : null}
              {selectedReferral.disciplineIncoming && Array.isArray(selectedReferral.evidence) && selectedReferral.evidence.length ? (
                <>
                  <p className="hs-modal-section-title">Attachments</p>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 14 }}>
                    {selectedReferral.evidence.map((ev, i) => (
                      <li key={i}>{ev.name || ev.label || "File"}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {!selectedReferral.disciplineIncoming && selectedReferral.attachments?.length ? (
                <>
                  <p className="hs-modal-section-title">Attachments</p>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 14 }}>
                    {selectedReferral.attachments.map((att) => (
                      <li key={att.label}>{att.label}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {!selectedReferral.disciplineIncoming && selectedReferral.timeline?.length ? (
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
              {selectedReferral.disciplineIncoming && canReceivingOfficeReviewReferral(selectedReferral.status) ? (
                <>
                  <button
                    type="button"
                    className="cc-btn-secondary"
                    onClick={async () => {
                      try {
                        if (isSupabaseConfigured() && supabase) {
                          const { error } = await supabase
                            .from("discipline_referrals")
                            .update({
                              status: DISCIPLINE_REFERRAL_STATUS.DECLINED,
                              updated_at: new Date().toISOString(),
                            })
                            .eq("id", selectedReferral.referralId);
                          if (error) throw error;
                        }
                        setDisciplineIncomingReferrals((prev) =>
                          prev.map((x) =>
                            x.referralId === selectedReferral.referralId
                              ? { ...x, status: DISCIPLINE_REFERRAL_STATUS.DECLINED }
                              : x,
                          ),
                        );
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
                          const { error } = await supabase
                            .from("discipline_referrals")
                            .update({
                              status: DISCIPLINE_REFERRAL_STATUS.APPROVED,
                              updated_at: new Date().toISOString(),
                            })
                            .eq("id", selectedReferral.referralId);
                          if (error) throw error;
                        }
                        setDisciplineIncomingReferrals((prev) =>
                          prev.map((x) =>
                            x.referralId === selectedReferral.referralId
                              ? { ...x, status: DISCIPLINE_REFERRAL_STATUS.APPROVED }
                              : x,
                          ),
                        );
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
