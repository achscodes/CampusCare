import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Clock,
  Download,
  Eye,
  FileText,
  FileHeart,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Plus,
  Printer,
  Send,
  Sparkles,
  Stethoscope,
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

const iconProps = { size: 16, strokeWidth: 1.5 };

const PAGE_META = {
  dashboard: {
    title: "Health Services",
    subtitle: "Monitor student health visits, appointments, and inter-office referrals",
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
};

export const HEALTH_NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard {...iconProps} /> },
  { id: "visits", label: "Student Visits", icon: <Stethoscope {...iconProps} /> },
  { id: "records", label: "Medical Records", icon: <FileHeart {...iconProps} /> },
  { id: "appointments", label: "Appointments", icon: <CalendarDays {...iconProps} /> },
  { id: "referrals", label: "Referrals", icon: <UserPlus {...iconProps} /> },
  { id: "docrequests", label: "Document Requests", icon: <FileText {...iconProps} /> },
  { id: "reports", label: "Reports & Analytics", icon: <BarChart3 {...iconProps} /> },
];

/** Empty by default — notifications can be wired to Supabase or a store later */
export const HS_NOTIFICATIONS = [];

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
  purpose: "",
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
  const [appointmentsList, setAppointmentsList] = useState(() => []);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [referralsList, setReferralsList] = useState(() => []);
  const [disciplineIncomingReferrals, setDisciplineIncomingReferrals] = useState(() => []);
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
  const recordFiltersSnapshot = useRef(null);

  const session = useMemo(() => {
    return readCampusCareSession();
  }, []);

  useDONotificationsRealtime();

  const canInterOfficeDocRequest = canCreateDocumentRequest(session?.office);
  const healthNavItems = useMemo(() => {
    if (canInterOfficeDocRequest) return HEALTH_NAV_ITEMS;
    return HEALTH_NAV_ITEMS.filter((i) => i.id !== "docrequests");
  }, [canInterOfficeDocRequest]);

  const userName = session?.name || "Priscilla C. Pelayo";
  const userRole = session?.role || "Admin";

  const meta = PAGE_META[activeNav] ?? PAGE_META.dashboard;

  useEffect(() => {
    if (!canInterOfficeDocRequest && activeNav === "docrequests") setActiveNav("dashboard");
  }, [canInterOfficeDocRequest, activeNav]);

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
      const res = await loadHsoFromSupabase(supabase);
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

  const openNewDocModal = () => {
    if (!canInterOfficeDocRequest) return;
    setHsoNewDocModalKey((k) => k + 1);
    setNewDocOpen(true);
  };

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
    if (!newApptForm.purpose.trim()) miss.push("Purpose of visit");
    if (miss.length) {
      showToast(`Please complete all fields: ${miss.join(", ")}.`, { variant: "warning" });
      return;
    }
    const payload = {
      student_name: newApptForm.studentName.trim(),
      student_id: newApptForm.studentId.trim(),
      student_email: newApptForm.email.trim(),
      student_phone: newApptForm.phone.trim(),
      appointment_date: newApptForm.date,
      appointment_time: newApptForm.time.trim(),
      purpose: newApptForm.purpose.trim(),
      status: "pending",
      room: "Medical Room 1",
      service: "Medical visit",
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

  const filteredReportConcerns = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return REPORTS_CONCERNS_ROWS.filter((row) => {
      const itemDate = parseIsoDateOnly(row.reportedAt);
      if (!itemDate) return true;
      if (reportsTimeFilter === "day") {
        return itemDate.toDateString() === startOfDay.toDateString();
      }
      if (reportsTimeFilter === "week") {
        const weekAgo = new Date(startOfDay);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return itemDate >= weekAgo && itemDate <= now;
      }
      if (reportsTimeFilter === "month") {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [reportsTimeFilter]);

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

  const hsoDashboardMetrics = useMemo(() => {
    const today = formatVisitDateLabel(new Date());
    const visitsToday = consultationRows.filter((c) => c.date === today).length;
    const todayIso = new Date().toISOString().slice(0, 10);
    const apptsToday = appointmentsList.filter((a) => a.dateSort === todayIso).length;
    const isClosedVisit = (s) => {
      const x = String(s || "").toLowerCase();
      return x === "completed" || x === "complete" || x === "cancelled" || x === "canceled";
    };
    const activeCases = consultationRows.filter((c) => !isClosedVisit(c.status)).length;
    return { visitsToday, apptsToday, activeCases };
  }, [consultationRows, appointmentsList]);

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

  const urgentCasesPanel = useMemo(() => {
    return referralsList
      .filter((r) => r.urgent)
      .slice(0, 6)
      .map((r) => ({ student: r.student, desc: r.reason, ago: r.date }));
  }, [referralsList]);

  const reportsMonthlyTrend = useMemo(() => [], []);
  const reportsDonutData = useMemo(() => [], []);

  const reportsServiceBreakdown = useMemo(() => {
    const consultations = consultationRows.length;
    const referralCount = referralsList.length;
    const followups = consultationRows.filter((c) => c.followup).length;
    const apptCount = appointmentsList.length;
    const sum = consultations + referralCount + followups + apptCount;
    const pct = (n) => (sum > 0 ? `${((n / sum) * 100).toFixed(1)}%` : "0%");
    return [
      { label: "Consultations", value: consultations, pct: pct(consultations), accent: "hs-breakdown-card--blue" },
      { label: "Referrals", value: referralCount, pct: pct(referralCount), accent: "hs-breakdown-card--purple" },
      { label: "Follow-ups flagged", value: followups, pct: pct(followups), accent: "hs-breakdown-card--green" },
      { label: "Appointments", value: apptCount, pct: pct(apptCount), accent: "hs-breakdown-card--orange" },
    ];
  }, [consultationRows, referralsList, appointmentsList]);

  const reportsKpi = useMemo(() => {
    const urgent = referralsList.filter((r) => r.urgent).length;
    return {
      studentsServed: healthRecordsRows.length,
      totalConsultations: consultationRows.length,
      urgentCases: urgent,
    };
  }, [healthRecordsRows, consultationRows, referralsList]);

  const renderDashboard = () => {
    const recentForTable = consultationRows.slice(0, 4);
    return (
      <>
        <section className="do-home-metrics" aria-label="Visit and appointment summary">
          <div className="do-metric-card hs-do-metric--visits">
            <div className="do-metric-body">
              <p className="do-metric-value">{hsoDashboardMetrics.visitsToday}</p>
              <p className="do-metric-label">Today&apos;s Visits</p>
              <p className="do-metric-hint">Recorded for {formatVisitDateLabel(new Date())}</p>
            </div>
            <div className="do-metric-icon" aria-hidden>
              <Sparkles size={24} strokeWidth={2} />
            </div>
          </div>
          <div className="do-metric-card hs-do-metric--appts">
            <div className="do-metric-body">
              <p className="do-metric-value">{hsoDashboardMetrics.apptsToday}</p>
              <p className="do-metric-label">Appointments</p>
              <p className="do-metric-hint">Scheduled for today</p>
            </div>
            <div className="do-metric-icon" aria-hidden>
              <CalendarDays size={24} strokeWidth={2} />
            </div>
          </div>
          <div className="do-metric-card hs-do-metric--cases">
            <div className="do-metric-body">
              <p className="do-metric-value">{hsoDashboardMetrics.activeCases}</p>
              <p className="do-metric-label">Active Cases</p>
              <p className="do-metric-hint">Consultations not marked completed</p>
            </div>
            <div className="do-metric-icon" aria-hidden>
              <Users size={24} strokeWidth={2} />
            </div>
          </div>
        </section>

        <div className="do-home-split">
          <div className="do-panel">
            <div className="do-panel-header">
              <h2 className="do-panel-title">Recent Consultations</h2>
              <p className="do-panel-sub">Today&apos;s student visits</p>
            </div>
            <div className="do-panel-body" style={{ padding: "0 22px" }}>
              <div className="cases-table-wrapper" style={{ padding: "0 0 8px" }}>
                <table className="cases-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Time</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentForTable.map((c) => {
                      const statusLabel = consultStatusToLabel(c.status);
                      return (
                        <tr key={c.id}>
                          <td>
                            <p className="cell-student-name">{c.student}</p>
                            <p className="cell-student-id">{c.studentId}</p>
                          </td>
                          <td className="cell-date">{c.time}</td>
                          <td className="cell-text">{c.reason}</td>
                          <td>
                            <span className={`${pillClass(statusLabel)}`} style={{ textTransform: "lowercase" }}>
                              {statusLabel}
                            </span>
                          </td>
                          <td>
                            <button type="button" className="btn-view" onClick={() => setConsultDetail(c)}>
                              <Eye size={16} strokeWidth={2} aria-hidden />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="do-panel-footer">
              <button
                type="button"
                className="do-panel-btn"
                onClick={() => {
                  setActiveNav("visits");
                  setVisitTab("all");
                }}
              >
                View All Consultations
              </button>
            </div>
          </div>

          <div className="do-panel">
            <div className="do-panel-header">
              <h2 className="do-panel-title">Urgent Cases</h2>
              <p className="do-panel-sub">Require immediate attention</p>
            </div>
            <div className="do-panel-body">
              {urgentCasesPanel.length ? (
                urgentCasesPanel.map((u) => (
                  <div key={u.student + u.ago} className="do-hearing-item">
                    <p className="do-hearing-name">{u.student}</p>
                    <p className="do-hearing-meta">
                      {u.desc}
                      <br />
                      {u.ago}
                    </p>
                  </div>
                ))
              ) : (
                <p className="hs-stat-meta" style={{ padding: "8px 0" }}>
                  No urgent referrals flagged.
                </p>
              )}
            </div>
            <div className="do-panel-footer">
              <button
                type="button"
                className="do-panel-btn"
                onClick={() => {
                  setActiveNav("visits");
                  setVisitTab("followups");
                }}
              >
                View All Alerts
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderVisits = () => {
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
  );

  const renderAppointments = () => (
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
                  {a.room}
                </p>
                <p className="hs-appt-service">{a.service}</p>
              </div>
              <div className="hs-appt-actions">
                <span className={pillClass(a.status === "confirmed" ? "Completed" : "Waiting")}>
                  {a.status}
                </span>
                <button type="button" className="hs-btn-outline" onClick={() => setSelectedAppointment(a)}>
                  <Eye size={14} strokeWidth={1.5} aria-hidden />
                  View
                </button>
                {a.status === "pending" ? (
                  <button type="button" className="hs-btn-primary" style={{ height: 34, fontSize: 13 }}>
                    Confirm
                  </button>
                ) : (
                  <button type="button" className="hs-btn-outline">
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
            <label htmlFor="hs-reports-period" className="hs-reports-period-label">
              Period
            </label>
            <select
              id="hs-reports-period"
              className="hs-reports-select"
              value={reportsTimeFilter}
              onChange={(e) => setReportsTimeFilter(e.target.value)}
            >
              <option value="day">This Day</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
          <div className="hs-reports-actions">
            <button type="button" className="hs-reports-btn-outline" onClick={() => window.print()}>
              <Printer size={16} strokeWidth={1.5} aria-hidden />
              Print
            </button>
            <button type="button" className="hs-reports-btn-outline">
              <Mail size={16} strokeWidth={1.5} aria-hidden />
              Email
            </button>
            <button type="button" className="hs-reports-btn-pdf">
              <Download size={16} strokeWidth={1.5} aria-hidden />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <section className="hs-reports-kpi-row" aria-label="Key metrics">
        <article className="hs-reports-kpi">
          <div className="hs-reports-kpi-top">
            <div className="hs-reports-kpi-icon hs-reports-kpi-icon--teal">
              <Activity size={22} strokeWidth={1.75} aria-hidden />
            </div>
            <span className="hs-reports-kpi-badge hs-reports-kpi-badge--green">Live</span>
          </div>
          <p className="hs-reports-kpi-value">{reportsKpi.studentsServed.toLocaleString()}</p>
          <p className="hs-reports-kpi-label">Students Served</p>
          <p className="hs-reports-kpi-hint">Medical records on file</p>
        </article>
        <article className="hs-reports-kpi">
          <div className="hs-reports-kpi-top">
            <div className="hs-reports-kpi-icon hs-reports-kpi-icon--blue">
              <Users size={22} strokeWidth={1.75} aria-hidden />
            </div>
            <span className="hs-reports-kpi-badge hs-reports-kpi-badge--blue">Live</span>
          </div>
          <p className="hs-reports-kpi-value">{reportsKpi.totalConsultations.toLocaleString()}</p>
          <p className="hs-reports-kpi-label">Total Consultations</p>
          <p className="hs-reports-kpi-hint">All visits logged</p>
        </article>
        <article className="hs-reports-kpi">
          <div className="hs-reports-kpi-top">
            <div className="hs-reports-kpi-icon hs-reports-kpi-icon--orange">
              <AlertTriangle size={22} strokeWidth={1.75} aria-hidden />
            </div>
            <span className="hs-reports-kpi-badge hs-reports-kpi-badge--orange">Live</span>
          </div>
          <p className="hs-reports-kpi-value hs-reports-kpi-value--alert">{reportsKpi.urgentCases}</p>
          <p className="hs-reports-kpi-label">Urgent Cases</p>
          <p className="hs-reports-kpi-hint">Referrals marked urgent</p>
        </article>
      </section>

      <div className="hs-reports-charts-grid">
        <div className="hs-chart-panel hs-panel-elevated hs-reports-chart-panel">
          <h3>Monthly Consultations Trend</h3>
          <p className="hs-chart-caption">Consultations breakdown by type (Last 7 months)</p>
          <div className="hs-reports-chart-inner">
            {reportsMonthlyTrend.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportsMonthlyTrend} margin={{ top: 4, right: 12, left: 4, bottom: 4 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 340]}
                    tickCount={8}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                    labelStyle={{ fontWeight: 600, color: "#0f172a" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
                  <Bar dataKey="total" name="Total Consultations" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="treatments" name="Treatments" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="checkups" name="Checkups" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="hs-chart-caption" style={{ margin: 0, padding: "48px 16px", textAlign: "center" }}>
                Not enough history to chart yet. Trend analytics can be connected to your database aggregates later.
              </p>
            )}
          </div>
        </div>
        <div className="hs-chart-panel hs-panel-elevated hs-reports-chart-panel">
          <h3>Common Health Issues</h3>
          <p className="hs-chart-caption">Distribution of reported health concerns</p>
          <div className="hs-reports-donut-inner">
            {reportsDonutData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={reportsDonutData}
                    cx="42%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {reportsDonutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="#fff" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    wrapperStyle={{ fontSize: 12, paddingLeft: 8, maxWidth: 200 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="hs-chart-caption" style={{ margin: 0, padding: "48px 16px", textAlign: "center" }}>
                No coded diagnosis aggregates yet. Issue distribution can be derived from visit reasons when available.
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="hs-reports-concerns hs-panel-elevated" aria-label="Top health concerns">
        <header className="hs-reports-concerns-head">
          <div>
            <h3 className="hs-reports-concerns-title">Top Health Concerns</h3>
            <p className="hs-reports-concerns-sub">Most reported health issues with trends</p>
          </div>
        </header>
        <ul className="hs-reports-concern-list">
          {filteredReportConcerns.length ? (
            filteredReportConcerns.map((row) => (
              <li key={row.concern} className="hs-reports-concern-item">
                <div className="hs-reports-concern-main">
                  <span className="hs-reports-concern-name">{row.concern}</span>
                  {row.priority === "medium" ? (
                    <span className="hs-pill hs-reports-priority--medium">medium</span>
                  ) : row.priority === "low" ? (
                    <span className="hs-pill hs-reports-priority--low">low</span>
                  ) : (
                    <span className="hs-pill hs-reports-priority--high">high</span>
                  )}
                </div>
                <span
                  className={`hs-reports-trend${row.trendUp ? " hs-reports-trend--warn" : " hs-reports-trend--favorable"}`}
                >
                  {row.trend}
                </span>
                <p className="hs-reports-concern-meta">{row.cases.toLocaleString()} cases this month</p>
              </li>
            ))
          ) : (
            <li className="hs-reports-concern-empty">No concerns in this time range.</li>
          )}
        </ul>
      </section>

      <section className="hs-reports-breakdown" aria-label="Monthly health services breakdown">
        <h3 className="hs-reports-breakdown-heading">Monthly Health Services Breakdown</h3>
        <div className="hs-reports-breakdown-grid">
          {reportsServiceBreakdown.map((b) => (
            <article key={b.label} className={`hs-breakdown-card ${b.accent}`}>
              <p className="hs-breakdown-label">{b.label}</p>
              <p className="hs-breakdown-value">{b.value.toLocaleString()}</p>
              <p className="hs-breakdown-pct">{b.pct} of combined activity</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );

  const hsoTabPrimaryAction = useMemo(() => {
    switch (activeNav) {
      case "dashboard":
        return { label: "New Consultation", onClick: openNewConsultationModal, Icon: Plus };
      case "visits":
        return { label: "New Consultation", onClick: openNewConsultationModal, Icon: Stethoscope };
      case "records":
        return { label: "New Record", onClick: openNewRecordModal, Icon: Activity };
      case "appointments":
        return { label: "New Appointment", onClick: openNewAppointmentModal, Icon: CalendarDays };
      case "referrals":
        return { label: "Create Referral", onClick: openNewReferralModal, Icon: UserPlus };
      case "docrequests":
        return canInterOfficeDocRequest
          ? { label: "New Request", onClick: openNewDocModal, Icon: FileText }
          : null;
      default:
        return null;
    }
  }, [activeNav, canInterOfficeDocRequest]);

  const TabPrimaryIcon = hsoTabPrimaryAction?.Icon;

  const body = (() => {
    switch (activeNav) {
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
          </div>
          <div className="hs-modal-field">
            <label>Purpose of Visit</label>
            <textarea
              rows={2}
              value={newApptForm.purpose}
              onChange={(e) => setNewApptForm((f) => ({ ...f, purpose: e.target.value }))}
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
                  <dd>{selectedAppointment.status}</dd>
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
