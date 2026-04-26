import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  Info,
  LayoutDashboard,
  Lock,
  LogOut,
  Plus,
  Send,
  Settings2,
  User,
  Users,
} from "lucide-react";
import { showToast } from "../../utils/toast";
import Sidebar from "../../components/Sidebar/Sidebar";
import OfficeHeader from "../../components/OfficeHeader/OfficeHeader";
import StaffNotificationBell from "../../components/common/StaffNotificationBell";
import CCModal from "../../components/common/CCModal";
import { useDONotificationsRealtime } from "../../hooks/useDONotificationsRealtime";
import InterOfficeNewDocumentRequestModal from "../../components/interOffice/InterOfficeNewDocumentRequestModal";
import { logoutCampusCare } from "../../utils/campusCareAuth";
import { canCreateDocumentRequest, labelForOfficeKey } from "../../constants/documentRequestAccess";
import { isStudentLikeCampusRole } from "../../utils/officeSession";
import { readCampusCareSession } from "../../utils/campusCareSession";
import { NU_PROGRAM_OPTIONS } from "../../data/nuPrograms";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { interOfficeDocumentRequestToInsert } from "../../services/interOfficeDocumentRequests";
import {
  loadSdaoFromSupabase,
  insertSdaoBeneficiary,
  updateSdaoBeneficiary,
  insertSdaoReferral,
  updateApplicationDisbursed,
} from "../../services/sdaoSupabase";
import { appendEvidenceToInterOfficeRequest } from "../../services/interOfficeDocumentEvidence";
import { PROFILE_SETTINGS_PATH_DEVELOPMENT } from "../../utils/profileSettingsRoutes";
import "../DODashboard/DO.css";
import "./SDAO.css";
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
import "../HealthServices/HealthServices.css";

const iconProps = { size: 16, strokeWidth: 1.5 };

const PAGE_META = {
  dashboard: {
    title: "SDAO Dashboard",
    subtitle: "Scholarship management overview with reports and analytics",
  },
  scholars: {
    title: "Scholars Management",
    subtitle: "Manage student scholarship and benefit recipients",
  },
  scholarshipTypes: {
    title: "Scholarship Types",
    subtitle: "Review and process student scholarship and benefit applications",
  },
  clearance: {
    title: "Clearance Management",
    subtitle: "Monitor and manage student clearance status and requirements",
  },
  docrequests: {
    title: "Document Requests",
    subtitle: "Request documents from Discipline Office (DO) or Health Services (HSO), and track requests from partner offices",
  },
  referrals: {
    title: "Referrals",
    subtitle: "Coordinate referrals with partner offices and programs",
  },
};

export const SDAO_NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard {...iconProps} /> },
  { id: "scholars", label: "Scholars Management", icon: <Users {...iconProps} /> },
  { id: "scholarshipTypes", label: "Scholarship Types", icon: <Award {...iconProps} /> },
  { id: "clearance", label: "Clearance Management", icon: <ClipboardCheck {...iconProps} /> },
  { id: "docrequests", label: "Document Requests", icon: <FileText {...iconProps} /> },
  { id: "referrals", label: "Referrals", icon: <Send {...iconProps} /> },
];

export const SDAO_NOTIFICATIONS = [];

const SCHOLARSHIP_TYPE_COLORS = {
  "White Scholarship": "#2563eb",
  "Blue Scholarship": "#7c3aed",
  "UAEB Scholarship": "#16a34a",
  "SM Scholarship": "#ea580c",
  "Armed Forces of the Philippines": "#dc2626",
};

const DISTRIBUTION_FALLBACK_COLORS = ["#2563eb", "#7c3aed", "#16a34a", "#ea580c", "#dc2626", "#0ea5e9"];

const SCHOLARSHIP_TYPE_OPTIONS = [
  "White Scholarship",
  "Blue Scholarship",
  "UAEB Scholarship",
  "SM Scholarship",
  "Armed Forces of the Philippines",
];

const YEAR_LEVEL_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

/** Inter-office referrals only (parity with HSO / DO). */
const SDAO_INTER_OFFICE_REFERRALS = ["Discipline Office (DO)", "Health Services (HSO)"];

const URGENCY_OPTIONS = [
  { value: "normal", label: "Normal — Routine referral" },
  { value: "high", label: "High — Priority follow-up" },
  { value: "urgent", label: "Urgent — Immediate attention" },
];

function pillClass(status) {
  const s = String(status).toLowerCase();
  if (s.includes("completed")) return "badge badge-closed";
  if (s.includes("processing")) return "badge badge-ongoing";
  if (s.includes("pending")) return "badge badge-ongoing";
  if (s.includes("ready")) return "badge badge-closed";
  if (s.includes("incomplete")) return "badge badge-pending";
  if (s.includes("probation")) return "badge badge-pending";
  if (s.includes("active")) return "badge badge-closed";
  if (s.includes("review")) return "badge badge-pending";
  if (s.includes("validated")) return "badge badge-closed";
  if (s.includes("disbursed")) return "badge badge-pending";
  if (s.includes("uploaded")) return "badge badge-ongoing";
  if (s.includes("received")) return "badge badge-closed";
  if (s.includes("declined") || s.includes("rejected")) return "badge badge-pending";
  if (s.includes("approved")) return "badge badge-closed";
  return "badge badge-new";
}

function applicationStatusBadgeClass(status) {
  const s = String(status).toLowerCase();
  if (s === "pending") return "sdao-pill sdao-pill--pending";
  if (s === "validated") return "sdao-pill sdao-pill--validated";
  if (s === "disbursed") return "sdao-pill sdao-pill--disbursed";
  return "sdao-pill sdao-pill--muted";
}

function clearanceRowBadgeClass(statusKey) {
  const s = String(statusKey).toLowerCase();
  if (s === "completed") return "sdao-pill sdao-pill--validated";
  if (s === "incomplete") return "sdao-pill sdao-pill--warn";
  if (s === "pending") return "sdao-pill sdao-pill--pending";
  return "sdao-pill sdao-pill--muted";
}

function clearanceBarTone(statusKey, progress) {
  const s = String(statusKey).toLowerCase();
  if (s === "completed" || progress === 100) return "#22c55e";
  if (s === "incomplete") return "#f97316";
  return "#3b82f6";
}

function docRequestStatusLabel(status) {
  const s = String(status).toLowerCase();
  if (s.includes("declined") || s.includes("rejected")) return "Declined";
  if (s.includes("fulfilled")) return "Fulfilled";
  if (s.includes("approved")) return "Approved";
  if (s.includes("pending approval") || s === "pending") return "Pending approval";
  if (s === "ready") return "Ready";
  if (s === "processing") return "Processing";
  return status;
}

const INITIAL_BENEFICIARY_FORM = {
  fullName: "",
  studentId: "",
  program: "",
  yearLevel: YEAR_LEVEL_OPTIONS[0],
  scholarshipType: SCHOLARSHIP_TYPE_OPTIONS[0],
  gpa: "",
  email: "",
  contact: "",
};

const INITIAL_REFERRAL_FORM = {
  studentName: "",
  studentId: "",
  program: "",
  email: "",
  receivingOffice: "",
  urgency: "normal",
  reason: "",
  referralNotes: "",
};

/**
 * @param {{ embedDashboardOnly?: boolean }} props
 * When true, renders only the SDAO dashboard body (no sidebar) for Super Admin embed.
 */
function SDAO({ embedDashboardOnly = false } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeNav, setActiveNav] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedClearance, setSelectedClearance] = useState(null);
  const [selectedDocRequest, setSelectedDocRequest] = useState(null);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [beneficiaryForm, setBeneficiaryForm] = useState(() => ({ ...INITIAL_BENEFICIARY_FORM }));
  const [manageScholarForm, setManageScholarForm] = useState({
    scholarshipType: "",
    scholarStatus: "active",
    internalNotes: "",
  });
  const [referralForm, setReferralForm] = useState(() => ({ ...INITIAL_REFERRAL_FORM }));
  const [clearanceSearch, setClearanceSearch] = useState("");
  const [clearanceFilter, setClearanceFilter] = useState("all");
  const [docSearch, setDocSearch] = useState("");
  const [referralSearch, setReferralSearch] = useState("");

  const [beneficiaries, setBeneficiaries] = useState([]);
  const [applications, setApplications] = useState([]);
  const [clearanceRecords, setClearanceRecords] = useState([]);
  const [docRequests, setDocRequests] = useState([]);
  const [referralsList, setReferralsList] = useState([]);
  const [disciplineIncomingReferrals, setDisciplineIncomingReferrals] = useState([]);
  const [sdaoLoading, setSdaoLoading] = useState(true);
  const [sdaoError, setSdaoError] = useState(null);
  const [sdaoDocAcceptingUploadBusy, setSdaoDocAcceptingUploadBusy] = useState(false);
  const [sdaoDocRequestSubmitting, setSdaoDocRequestSubmitting] = useState(false);
  const [sdaoNewDocModalKey, setSdaoNewDocModalKey] = useState(0);

  const refreshSdao = useMemo(() => {
    return async () => {
      if (!isSupabaseConfigured() || !supabase) {
        setSdaoLoading(false);
        setSdaoError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
        setBeneficiaries([]);
        setApplications([]);
        setClearanceRecords([]);
        setDocRequests([]);
        setReferralsList([]);
        setDisciplineIncomingReferrals([]);
        return;
      }
      setSdaoError(null);
      setSdaoLoading(true);
      const res = await loadSdaoFromSupabase(supabase);
      setSdaoLoading(false);
      if (!res.ok) {
        setSdaoError(res.error?.message || String(res.error || "Could not load SDAO data."));
        return;
      }
      setBeneficiaries(res.beneficiaries);
      setApplications(res.applications);
      setClearanceRecords(res.clearanceRecords);
      setDocRequests(res.documentRequests);
      setReferralsList(res.referrals);
      setDisciplineIncomingReferrals(res.disciplineReferralsIncoming || []);
    };
  }, []);

  useEffect(() => {
    refreshSdao();
  }, [refreshSdao]);

  const dashboardDistribution = useMemo(() => {
    const counts = {};
    for (const b of beneficiaries) {
      const t = b.scholarshipType?.trim() || "Other";
      counts[t] = (counts[t] || 0) + 1;
    }
    const total = beneficiaries.length || 1;
    const entries = Object.entries(counts);
    let colorIdx = 0;
    return entries.map(([label, count]) => {
      const pct = Math.round((count / total) * 1000) / 10;
      const color =
        SCHOLARSHIP_TYPE_COLORS[label] ||
        DISTRIBUTION_FALLBACK_COLORS[colorIdx % DISTRIBUTION_FALLBACK_COLORS.length];
      colorIdx += 1;
      return { label, count, pct, color };
    });
  }, [beneficiaries]);

  const programsCompact = useMemo(() => {
    const counts = {};
    for (const b of beneficiaries) {
      const t = b.scholarshipType?.trim() || "Other";
      if (!counts[t]) counts[t] = 0;
      counts[t] += 1;
    }
    const total = beneficiaries.length || 1;
    return Object.entries(counts).map(([name, scholars], i) => ({
      name,
      scholars,
      amount: "—",
      pct: Math.round((scholars / total) * 100),
      bar: SCHOLARSHIP_TYPE_COLORS[name] || DISTRIBUTION_FALLBACK_COLORS[i % DISTRIBUTION_FALLBACK_COLORS.length],
    }));
  }, [beneficiaries]);

  const topPrograms = useMemo(() => {
    const counts = {};
    for (const b of beneficiaries) {
      const p = b.program?.trim() || "—";
      counts[p] = (counts[p] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([program, count]) => ({ program, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [beneficiaries]);

  const beneficiarySummaryCards = useMemo(() => {
    const total = beneficiaries.length;
    const byType = (t) => beneficiaries.filter((b) => b.scholarshipType === t).length;
    return [
      { key: "total", title: "Total Beneficiaries", value: total, sub: "All programs" },
      { key: "white", title: "White Scholars", value: byType("White Scholarship"), sub: "100% Tuition Fee" },
      { key: "blue", title: "Blue Scholars", value: byType("Blue Scholarship"), sub: "100% Tuition & Misc" },
      { key: "uaeb", title: "UAEB Grantees", value: byType("UAEB Scholarship"), sub: "100% Tuition & Misc" },
      { key: "sm", title: "SM Scholars", value: byType("SM Scholarship"), sub: "100% Tuition & Misc" },
      {
        key: "afp",
        title: "Armed Forces of the Philippines",
        value: byType("Armed Forces of the Philippines"),
        sub: "100% Tuition & Misc",
      },
    ];
  }, [beneficiaries]);

  const dashboardKpis = useMemo(() => {
    const active = beneficiaries.filter((b) => b.scholarStatus === "active").length;
    const probation = beneficiaries.filter((b) => b.scholarStatus === "probation").length;
    const pendingClearance = clearanceRecords.filter((c) => c.statusKey !== "completed").length;
    const missingReq = clearanceRecords.reduce((sum, c) => sum + (c.pendingCount || 0), 0);
    return { active, probation, pendingClearance, missingReq };
  }, [beneficiaries, clearanceRecords]);

  const performanceMetrics = useMemo(() => {
    const gpas = beneficiaries
      .map((b) => parseFloat(String(b.gpa).replace(/[^\d.]/g, "")))
      .filter((n) => !Number.isNaN(n));
    const avgGpa =
      gpas.length > 0 ? (gpas.reduce((a, b) => a + b, 0) / gpas.length).toFixed(2) : "—";
    const totalApps = applications.length;
    const approved = applications.filter((a) => a.status === "validated" || a.status === "disbursed").length;
    const approvalPct = totalApps > 0 ? Math.round((approved / totalApps) * 100) : "—";
    const active = beneficiaries.filter((b) => b.scholarStatus === "active").length;
    const totalBen = beneficiaries.length || 1;
    const retention = Math.round((active / totalBen) * 100);
    return { avgGpa, approvalPct, totalApps, approved, retention };
  }, [beneficiaries, applications]);

  const applicationStats = useMemo(
    () => ({
      pending: applications.filter((a) => a.status === "pending").length,
      validated: applications.filter((a) => a.status === "validated").length,
      declined: applications.filter((a) => a.status === "declined").length,
      disbursed: applications.filter((a) => a.status === "disbursed").length,
    }),
    [applications],
  );

  const docRequestStats = useMemo(() => {
    const total = docRequests.length;
    const pending = docRequests.filter((d) => isDocRequestPendingApproval(d.status)).length;
    const processing = docRequests.filter((d) => isDocRequestApprovedForFulfillment(d.status)).length;
    const received = docRequests.filter((d) => normalizeInterOfficeDocStatus(d.status) === "fulfilled").length;
    return { total, pending, processing, received };
  }, [docRequests]);

  const referralStats = useMemo(() => {
    const total = referralsList.length;
    const urgent = referralsList.filter((r) => String(r.urgency).toLowerCase() === "urgent").length;
    const completed = referralsList.filter((r) => String(r.status).toLowerCase().includes("completed")).length;
    const inProgress = referralsList.filter((r) => {
      const s = String(r.status).toLowerCase();
      return s.includes("progress") || s === "in-progress" || s === "sent";
    }).length;
    return { total, urgent, completed, inProgress };
  }, [referralsList]);

  const session = useMemo(() => {
    return readCampusCareSession();
  }, []);

  useDONotificationsRealtime();

  const canInterOfficeDocRequest = canCreateDocumentRequest(session?.office);
  const isStudentSession = isStudentLikeCampusRole(session?.role);
  const showSdaoDocRequestNav = canInterOfficeDocRequest || isStudentSession;
  /** Staff (inter-office) and students may both create document requests from SDAO. */
  const canCreateSdaoDocRequest = canInterOfficeDocRequest || isStudentSession;

  const sdaoNavItems = useMemo(() => {
    if (showSdaoDocRequestNav) return SDAO_NAV_ITEMS;
    return SDAO_NAV_ITEMS.filter((i) => i.id !== "docrequests");
  }, [showSdaoDocRequestNav]);

  const userName = session?.name || "Ms. Lourdes Virginia G. Dorios";
  const userRole = session?.role || "Senior Supervisor";

  const meta = PAGE_META[activeNav] ?? PAGE_META.dashboard;

  useEffect(() => {
    if (!showSdaoDocRequestNav && activeNav === "docrequests") setActiveNav("dashboard");
  }, [showSdaoDocRequestNav, activeNav]);

  useEffect(() => {
    if (embedDashboardOnly && activeNav !== "dashboard") setActiveNav("dashboard");
  }, [embedDashboardOnly, activeNav]);

  useEffect(() => {
    const id = location.state?.restoreNav;
    if (!id || typeof id !== "string") return;
    setActiveNav(id);
    navigate("/sdao", { replace: true, state: {} });
  }, [location.state, navigate]);

  const closeFeatureModal = () => {
    setActiveModal(null);
    setSelectedBeneficiary(null);
    setSelectedApplication(null);
    setSelectedClearance(null);
    setSelectedDocRequest(null);
    setSelectedReferral(null);
  };

  const openAddBeneficiary = () => {
    setBeneficiaryForm({ ...INITIAL_BENEFICIARY_FORM });
    setActiveModal("addBeneficiary");
  };

  const openViewBeneficiary = (row) => {
    setSelectedBeneficiary(row);
    setActiveModal("viewBeneficiary");
  };

  const openManageBeneficiary = (row) => {
    const target = row || selectedBeneficiary;
    if (!target) return;
    setSelectedBeneficiary(target);
    setManageScholarForm({
      scholarshipType: target.scholarshipType,
      scholarStatus: target.scholarStatus,
      internalNotes: target.internalNotes || "",
    });
    setActiveModal("manageBeneficiary");
  };

  const submitBeneficiaryForm = async () => {
    if (!supabase || !isSupabaseConfigured()) {
      showToast("Supabase is not configured.", { variant: "error" });
      return;
    }
    if (!beneficiaryForm.fullName.trim() || !beneficiaryForm.studentId.trim()) {
      showToast("Full name and student ID are required.", { variant: "warning" });
      return;
    }
    const { error } = await insertSdaoBeneficiary(supabase, beneficiaryForm);
    if (error) {
      showToast(error.message || "Could not add beneficiary.", { variant: "error" });
      return;
    }
    showToast("Beneficiary added.", { variant: "success" });
    closeFeatureModal();
    await refreshSdao();
  };

  const saveManageScholar = async () => {
    if (!selectedBeneficiary || !supabase) return;
    const { error } = await updateSdaoBeneficiary(supabase, selectedBeneficiary.id, {
      scholarshipType: manageScholarForm.scholarshipType,
      scholarStatus: manageScholarForm.scholarStatus,
      internalNotes: manageScholarForm.internalNotes,
    });
    if (error) {
      showToast(error.message || "Could not update scholar.", { variant: "error" });
      return;
    }
    showToast("Scholar record updated.", { variant: "success" });
    closeFeatureModal();
    await refreshSdao();
  };

  const openApplicationDetails = (app) => {
    setSelectedApplication(app);
    setActiveModal("applicationDetails");
  };

  const processDisbursement = async () => {
    if (!selectedApplication || !supabase) return;
    const { error } = await updateApplicationDisbursed(supabase, selectedApplication.id);
    if (error) {
      showToast(error.message || "Could not record disbursement.", { variant: "error" });
      return;
    }
    showToast("Disbursement recorded.", { variant: "success" });
    closeFeatureModal();
    await refreshSdao();
  };

  const openClearanceDetails = (row) => {
    setSelectedClearance(row);
    setActiveModal("clearanceDetails");
  };

  const sendClearanceReminder = () => {
    if (!selectedClearance) return;
    console.info("[SDAO] Placeholder reminder", { id: selectedClearance.id });
    closeFeatureModal();
  };

  const openNewDocRequest = () => {
    if (!canCreateSdaoDocRequest) return;
    setSdaoNewDocModalKey((k) => k + 1);
    setActiveModal("newDocRequest");
  };

  const submitSdaoInterOfficeDocumentRequest = async (payload) => {
    if (!canCreateSdaoDocRequest) return;
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    }
    const docLabel =
      String(payload.documentType).toLowerCase() === "other" && payload.documentTypeOther?.trim()
        ? `Other: ${payload.documentTypeOther.trim()}`
        : payload.documentType.trim();
    const id = `REQ-SDAO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    const row = interOfficeDocumentRequestToInsert(
      id,
      {
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
      },
      "development",
      userName,
    );
    setSdaoDocRequestSubmitting(true);
    try {
      const { error } = await supabase.from("inter_office_document_requests").insert(row).select("*").single();
      if (error) throw error;
      showToast("Document request submitted.", { variant: "success" });
      closeFeatureModal();
      await refreshSdao();
    } finally {
      setSdaoDocRequestSubmitting(false);
    }
  };

  const openDocRequestDetails = (row) => {
    setSelectedDocRequest(row);
    setActiveModal("docRequestDetails");
  };

  const handleSdaoAcceptingOfficeUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedDocRequest || selectedDocRequest.direction !== "incoming") return;
    if (!canReceivingOfficeUploadDoc(selectedDocRequest.status)) {
      showToast("Approve the request first before attaching a file.", { variant: "warning" });
      return;
    }
    try {
      setSdaoDocAcceptingUploadBusy(true);
      if (isSupabaseConfigured() && supabase) {
        const { evidence } = await appendEvidenceToInterOfficeRequest(supabase, selectedDocRequest.id, file);
        setSelectedDocRequest((prev) => (prev ? { ...prev, evidence } : null));
        setDocRequests((prev) =>
          prev.map((d) => (d.id === selectedDocRequest.id ? { ...d, evidence } : d)),
        );
      } else {
        const newItem = { name: file.name, source: "target", uploadedAt: new Date().toISOString() };
        const next = [...(selectedDocRequest.evidence || []), newItem];
        setSelectedDocRequest((prev) => (prev ? { ...prev, evidence: next } : null));
        setDocRequests((prev) =>
          prev.map((d) => (d.id === selectedDocRequest.id ? { ...d, evidence: next } : d)),
        );
      }
      showToast("Attachment uploaded.", { variant: "success" });
    } catch (err) {
      showToast(err?.message || "Could not upload attachment.", { variant: "error" });
    } finally {
      setSdaoDocAcceptingUploadBusy(false);
    }
  };

  const openCreateReferral = () => {
    setReferralForm({ ...INITIAL_REFERRAL_FORM });
    setActiveModal("createReferral");
  };

  const submitReferral = async () => {
    if (!supabase) return;
    if (!referralForm.studentName.trim()) {
      showToast("Student name is required.", { variant: "warning" });
      return;
    }
    if (!referralForm.studentId.trim()) {
      showToast("Student ID is required.", { variant: "warning" });
      return;
    }
    if (!referralForm.program.trim()) {
      showToast("Program is required.", { variant: "warning" });
      return;
    }
    if (!referralForm.email.trim()) {
      showToast("Email is required.", { variant: "warning" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referralForm.email.trim())) {
      showToast("Enter a valid email address.", { variant: "warning" });
      return;
    }
    if (!referralForm.receivingOffice.trim()) {
      showToast("Please select a receiving office.", { variant: "warning" });
      return;
    }
    if (!SDAO_INTER_OFFICE_REFERRALS.includes(referralForm.receivingOffice.trim())) {
      showToast("Receiving office must be Discipline Office (DO) or Health Services (HSO).", { variant: "warning" });
      return;
    }
    if (!referralForm.urgency) {
      showToast("Please select urgency.", { variant: "warning" });
      return;
    }
    if (!referralForm.reason.trim()) {
      showToast("Please enter a reason for the referral.", { variant: "warning" });
      return;
    }
    if (!referralForm.referralNotes.trim()) {
      showToast("Please add notes under Reason for Referral.", { variant: "warning" });
      return;
    }
    const { error } = await insertSdaoReferral(supabase, referralForm, userName);
    if (error) {
      showToast(error.message || "Could not create referral.", { variant: "error" });
      return;
    }
    showToast("Referral created.", { variant: "success" });
    closeFeatureModal();
    await refreshSdao();
  };

  const openReferralDetails = (row) => {
    setSelectedReferral(row);
    setActiveModal("referralDetails");
  };

  const confirmLogout = async () => {
    await logoutCampusCare();
    setLogoutOpen(false);
    navigate("/");
  };

  const renderDashboard = () => {
    const totalScholars = beneficiaries.length;
    const totalLabel = totalScholars.toLocaleString();
    return (
      <>
        <div className="sdao-kpi-row">
          <div className="sdao-kpi-stat">
            <div className="sdao-kpi-stat-icon" style={{ background: "#eff6ff", color: "#1a368d" }}>
              <User size={20} strokeWidth={1.5} />
            </div>
            <p className="sdao-kpi-stat-label">Total Active Scholars</p>
            <p className="sdao-kpi-stat-value">{dashboardKpis.active.toLocaleString()}</p>
            <p className="sdao-kpi-stat-sub">Recorded beneficiaries (active)</p>
          </div>
          <div className="sdao-kpi-stat">
            <div className="sdao-kpi-stat-icon" style={{ background: "#fff7ed", color: "#ea580c" }}>
              <AlertTriangle size={20} strokeWidth={1.5} />
            </div>
            <p className="sdao-kpi-stat-label">Scholars Under Probation</p>
            <p className="sdao-kpi-stat-value">{dashboardKpis.probation.toLocaleString()}</p>
            <p className="sdao-kpi-stat-sub">Requires monitoring</p>
          </div>
          <div className="sdao-kpi-stat">
            <div className="sdao-kpi-stat-icon" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
              <ClipboardCheck size={20} strokeWidth={1.5} />
            </div>
            <p className="sdao-kpi-stat-label">Pending Clearance Cases</p>
            <p className="sdao-kpi-stat-value">{dashboardKpis.pendingClearance.toLocaleString()}</p>
            <p className="sdao-kpi-stat-sub">Not completed</p>
          </div>
          <div className="sdao-kpi-stat">
            <div className="sdao-kpi-stat-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>
              <FileText size={20} strokeWidth={1.5} />
            </div>
            <p className="sdao-kpi-stat-label">Total Pending Requirements</p>
            <p className="sdao-kpi-stat-value">{dashboardKpis.missingReq.toLocaleString()}</p>
            <p className="sdao-kpi-stat-sub">Across clearance records</p>
          </div>
        </div>

        <div className="sdao-distribution-card">
          <div className="sdao-distribution-head">
            <div>
              <h2 className="sdao-distribution-title">
                <Award size={18} strokeWidth={1.5} aria-hidden />
                Scholarship Distribution by Type
              </h2>
              <p className="sdao-distribution-sub">
                Current semester enrollment breakdown — Total: {totalLabel} scholars
              </p>
            </div>
          </div>
          {dashboardDistribution.length === 0 ? (
            <p className="hs-stat-meta" style={{ padding: "12px 0" }}>
              No beneficiary records yet. Add scholars under Scholars Management.
            </p>
          ) : (
            dashboardDistribution.map((d) => (
              <div key={d.label} className="sdao-bar-row">
                <span className="sdao-bar-label">{d.label}</span>
                <div className="sdao-bar-track">
                  <div className="sdao-bar-fill" style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
                <span className="sdao-bar-meta">
                  {d.count} ({d.pct}%)
                </span>
              </div>
            ))
          )}
        </div>

        <div className="sdao-mid-grid">
          <div className="cases-panel">
            <div className="cases-panel-header">
              <div className="cases-panel-title">Scholarship Programs</div>
            </div>
            <div className="cases-table-wrapper">
              <ul className="sdao-program-list">
                {programsCompact.length === 0 ? (
                  <li className="hs-stat-meta">No data</li>
                ) : (
                  programsCompact.map((p) => (
                    <li key={p.name}>
                      <span>
                        <strong>{p.name}</strong>
                        <span style={{ color: "#9ca3af" }}>
                          {" "}
                          · {p.scholars} scholars · {p.amount}
                        </span>
                      </span>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: "#f3f4f6",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        {p.pct}%
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
          <div className="cases-panel">
            <div className="cases-panel-header">
              <div className="cases-panel-title">Top Performing Programs</div>
            </div>
            <div className="cases-table-wrapper">
              <ul className="sdao-program-list">
                {topPrograms.length === 0 ? (
                  <li className="hs-stat-meta">No data</li>
                ) : (
                  topPrograms.map((p) => (
                    <li key={p.program}>
                      <span>{p.program}</span>
                      <strong>{p.count} scholars</strong>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="cases-panel">
          <div className="cases-panel-header">
            <div className="cases-panel-title">Scholarship Performance Metrics</div>
          </div>
          <div className="cases-table-wrapper">
            <div className="sdao-metrics-row">
              <div className="sdao-metric-card">
                <p className="sdao-metric-label">Average GPA of Scholars</p>
                <p className="sdao-metric-value">{performanceMetrics.avgGpa}</p>
                <p className="sdao-metric-trend">From beneficiary records</p>
              </div>
              <div className="sdao-metric-card">
                <p className="sdao-metric-label">Scholarship Retention Rate</p>
                <p className="sdao-metric-value">
                  {beneficiaries.length === 0 ? "—" : `${performanceMetrics.retention}%`}
                </p>
                <p className="sdao-metric-trend">Active / total beneficiaries</p>
              </div>
              <div className="sdao-metric-card">
                <p className="sdao-metric-label">Application Approval Rate</p>
                <p className="sdao-metric-value">
                  {applications.length === 0 ? "—" : `${performanceMetrics.approvalPct}%`}
                </p>
                <p className="sdao-metric-muted">
                  {performanceMetrics.approved} of {performanceMetrics.totalApps} applications
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderScholars = () => {
    const q = search.trim().toLowerCase();
    const filtered = beneficiaries.filter(
      (r) =>
        !q ||
        r.fullName.toLowerCase().includes(q) ||
        r.studentId.includes(q) ||
        r.scholarshipType.toLowerCase().includes(q),
    );
    return (
      <>
        <div className="sdao-beneficiary-summary-row">
          {beneficiarySummaryCards.map((c) => (
            <div key={c.key} className="sdao-beneficiary-summary-card">
              <p className="sdao-beneficiary-summary-title">{c.title}</p>
              <p className="sdao-beneficiary-summary-value">{c.value}</p>
              <p className="sdao-beneficiary-summary-sub">{c.sub}</p>
            </div>
          ))}
        </div>

        <div className="sdao-search-block">
          <div className="sdao-search-block-text">
            <h2 className="sdao-search-heading">Search Beneficiaries</h2>
            <p className="sdao-search-desc">Find records by name, ID, or scholarship type.</p>
          </div>
          <div className="sdao-search-filter-row">
            <div className="search-bar-wrapper sdao-search-bar-full">
              <span className="search-icon" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5.333" stroke="#64748B" strokeWidth="1.5" />
                  <path d="M13.333 13.333L10 10" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <input
                className="search-input"
                placeholder="Search by name, student ID, or scholarship type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="button" className="sdao-btn-filter">
              <Filter size={16} strokeWidth={1.75} aria-hidden />
              Filters
            </button>
          </div>
        </div>

        <div className="sdao-confidential-strip">
          <Lock size={14} strokeWidth={2} aria-hidden />
          Confidential — Student financial information
        </div>

        <div className="sdao-beneficiary-list">
          {filtered.map((r) => (
            <div key={r.id} className="sdao-beneficiary-row">
              <div className="sdao-beneficiary-col sdao-beneficiary-col--name">
                <p className="sdao-beneficiary-name">{r.fullName}</p>
                <p className="sdao-beneficiary-id">{r.studentId}</p>
              </div>
              <div className="sdao-beneficiary-col sdao-beneficiary-col--badges">
                <span className="sdao-scholarship-badge">{r.scholarshipType}</span>
                <span
                  className={
                    r.scholarStatus === "probation" ? "sdao-pill sdao-pill--warn" : "sdao-pill sdao-pill--validated"
                  }
                >
                  {r.scholarStatus === "probation" ? "On Probation" : "Active"}
                </span>
              </div>
              <div className="sdao-beneficiary-col sdao-beneficiary-col--meta">
                <span className="sdao-beneficiary-meta-line">{r.program}</span>
                <span className="sdao-beneficiary-meta-line sdao-beneficiary-meta-muted">{r.yearLevel}</span>
                <span className="sdao-beneficiary-gpa">{r.gpa}</span>
              </div>
              <div className="sdao-beneficiary-col sdao-beneficiary-col--actions">
                <button type="button" className="sdao-btn-outline" onClick={() => openViewBeneficiary(r)}>
                  <Eye size={16} strokeWidth={1.75} aria-hidden />
                  View
                </button>
                <button type="button" className="sdao-btn-solid" onClick={() => openManageBeneficiary(r)}>
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderScholarshipTypes = () => {
    const pendingReview = applicationStats.pending;
    const validatedCount = applicationStats.validated;
    const declinedCount = applicationStats.declined;
    const disbursedCount = applicationStats.disbursed;
    return (
      <>
      <div className="sdao-type-stat-row">
        <div className="sdao-type-stat">
          <p className="sdao-type-stat-label">Pending Review</p>
          <p className="sdao-type-stat-value">{pendingReview}</p>
          <p className="sdao-type-stat-hint">Awaiting validation</p>
        </div>
        <div className="sdao-type-stat sdao-type-stat--validated">
          <p className="sdao-type-stat-label">Validated</p>
          <p className="sdao-type-stat-value">{validatedCount}</p>
          <p className="sdao-type-stat-hint">Ready for next step</p>
        </div>
        <div className="sdao-type-stat sdao-type-stat--declined">
          <p className="sdao-type-stat-label">Declined</p>
          <p className="sdao-type-stat-value">{declinedCount}</p>
          <p className="sdao-type-stat-hint">Requires resubmission</p>
        </div>
        <div className="sdao-type-stat sdao-type-stat--disbursed">
          <p className="sdao-type-stat-label">Disbursed</p>
          <p className="sdao-type-stat-value">{disbursedCount}</p>
          <p className="sdao-type-stat-hint">Completed cycle</p>
        </div>
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
            placeholder="Search by student name, ID, or scholarship type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className="sdao-btn-filter">
          <Filter size={16} strokeWidth={1.75} aria-hidden />
          Filters
        </button>
      </div>
      <div className="cases-panel">
        <div className="cases-panel-header">
          <div className="cases-panel-title">Scholarship Applications</div>
        </div>
        <div className="cases-table-wrapper">
          {applications
            .filter(
              (a) =>
                !search ||
                a.student.toLowerCase().includes(search.toLowerCase()) ||
                a.type.toLowerCase().includes(search.toLowerCase()) ||
                a.sid.includes(search),
            )
            .map((a) => (
            <div key={a.id} className="sdao-app-card">
              <div className="sdao-app-head">
                <p className="sdao-app-name">{a.student}</p>
                <span className={applicationStatusBadgeClass(a.status)}>{a.status}</span>
              </div>
              <p className="sdao-app-meta">
                ID: {a.sid} · {a.degree}
              </p>
              <div className="sdao-app-grid">
                <span className="sdao-app-scholarship-type">{a.type}</span>
                <span>GPA {a.gpa}</span>
                <span className="cell-date">{a.submitted}</span>
                <button type="button" className="hs-link-action sdao-link-view" onClick={() => openApplicationDetails(a)}>
                  <Eye size={14} strokeWidth={1.5} aria-hidden />
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
    );
  };

  const renderClearance = () => {
    const q = clearanceSearch.trim().toLowerCase();
    const filtered = clearanceRecords.filter((r) => {
      const matchQ =
        !q ||
        r.student.toLowerCase().includes(q) ||
        r.sid.includes(q) ||
        r.program.toLowerCase().includes(q);
      const matchF =
        clearanceFilter === "all" || r.statusKey.toLowerCase() === clearanceFilter.toLowerCase();
      return matchQ && matchF;
    });
    return (
      <>
        <div className="hs-filter-card sdao-filter-card">
          <div className="search-bar-wrapper" style={{ marginBottom: 0, flex: 1 }}>
            <span className="search-icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5.333" stroke="#64748B" strokeWidth="1.5" />
                <path d="M13.333 13.333L10 10" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="search-input"
              placeholder="Search by student name, ID, or program..."
              value={clearanceSearch}
              onChange={(e) => setClearanceSearch(e.target.value)}
            />
          </div>
          <select className="hs-select" value={clearanceFilter} onChange={(e) => setClearanceFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="incomplete">Incomplete</option>
            <option value="pending">Pending</option>
          </select>
          <button type="button" className="btn-export" aria-label="Download">
            <Download size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="cases-panel">
          <div className="cases-panel-header">
            <div className="cases-panel-title">Student Clearance Status</div>
            <div className="sdao-confidential-strip sdao-confidential-strip--panel">
              <Lock size={14} strokeWidth={2} aria-hidden />
              Confidential — handle with discretion
            </div>
          </div>
          <div className="cases-table-wrapper">
            <table className="cases-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Program &amp; Year</th>
                  <th>Scholarship</th>
                  <th>Completion</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <p className="cell-student-name">{r.student}</p>
                      <p className="cell-student-id">{r.sid}</p>
                    </td>
                    <td className="cell-text">
                      {r.program} · {r.yearLevel}
                    </td>
                    <td className="cell-text">{r.scholarship}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="sdao-clear-bar" style={{ flex: 1, maxWidth: 120 }}>
                          <div
                            className="sdao-clear-fill"
                            style={{
                              width: `${r.progress}%`,
                              background: clearanceBarTone(r.statusKey, r.progress),
                            }}
                          />
                        </div>
                        <span className="cell-text">{r.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={clearanceRowBadgeClass(r.statusKey)}>{r.statusKey}</span>
                    </td>
                    <td>
                      <button type="button" className="hs-link-action sdao-link-view" onClick={() => openClearanceDetails(r)}>
                        <Eye size={14} strokeWidth={1.5} aria-hidden />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hs-stat-meta" style={{ padding: "12px 0 0", margin: 0 }}>
              Showing {filtered.length} of {clearanceRecords.length} students
            </p>
          </div>
        </div>
      </>
    );
  };

  const renderDocRequests = () => {
    const q = docSearch.trim().toLowerCase();
    const filteredDocs = docRequests.filter((d) => {
      if (!q) return true;
      const partner = labelForOfficeKey(d.partnerOffice).toLowerCase();
      return (
        d.student.toLowerCase().includes(q) ||
        d.sid.includes(q) ||
        d.doc.toLowerCase().includes(q) ||
        partner.includes(q) ||
        (d.partnerOffice || "").toLowerCase().includes(q)
      );
    });
    return (
      <>
      <div className="sdao-doc-stat-row">
        <div className="sdao-doc-stat sdao-doc-stat--total">
          <p className="sdao-type-stat-value">{docRequestStats.total}</p>
          <p className="sdao-type-stat-label">Total Requests</p>
          <p className="sdao-type-stat-hint">All time</p>
        </div>
        <div className="sdao-doc-stat sdao-doc-stat--pending">
          <p className="sdao-type-stat-value">{docRequestStats.pending}</p>
          <p className="sdao-type-stat-label">Pending</p>
          <p className="sdao-type-stat-hint">Awaiting partner office</p>
        </div>
        <div className="sdao-doc-stat sdao-doc-stat--uploaded">
          <p className="sdao-type-stat-value">{docRequestStats.processing}</p>
          <p className="sdao-type-stat-label">In progress</p>
          <p className="sdao-type-stat-hint">Processing / uploaded</p>
        </div>
        <div className="sdao-doc-stat sdao-doc-stat--received">
          <p className="sdao-type-stat-value">{docRequestStats.received}</p>
          <p className="sdao-type-stat-label">Completed</p>
          <p className="sdao-type-stat-hint">Ready / received</p>
        </div>
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
            value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
          />
        </div>
        <select className="hs-select" defaultValue="all">
          <option value="all">All Status</option>
        </select>
      </div>
      <div className="cases-panel">
        <div className="cases-panel-header">
          <div className="cases-panel-title">My Document Requests</div>
          <p className="hs-list-sub">Outgoing and incoming inter-office requests appear in one list</p>
        </div>
        <div className="cases-table-wrapper">
          <table className="cases-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Partner office</th>
                <th>Document</th>
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
                    <span className="sdao-pill sdao-pill--muted" style={{ marginRight: 8 }}>
                      {d.direction === "incoming" ? "From" : "To"}
                    </span>
                    {labelForOfficeKey(d.partnerOffice)}
                  </td>
                  <td className="cell-text">{d.doc}</td>
                  <td>
                    <span className={pillClass(d.priority === "Urgent" ? "pending" : "new")}>{d.priority}</span>
                  </td>
                  <td>
                    <span className={pillClass(d.status)}>{docRequestStatusLabel(d.status)}</span>
                  </td>
                  <td className="cell-date">{d.date}</td>
                  <td>
                    <button type="button" className="hs-link-action sdao-link-view" onClick={() => openDocRequestDetails(d)}>
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
  };

  const renderReferrals = () => {
    const q = referralSearch.trim().toLowerCase();
    const filteredRef = referralsList.filter(
      (r) => !q || r.student.toLowerCase().includes(q) || r.studentId.includes(q),
    );
    return (
      <>
      <div className="hs-ref-stat-row">
        {[
          { icon: Send, label: "Total referrals", value: String(referralStats.total) },
          { icon: Activity, label: "In progress", value: String(referralStats.inProgress) },
          { icon: FileText, label: "Completed", value: String(referralStats.completed) },
          { icon: AlertTriangle, label: "Urgent", value: String(referralStats.urgent) },
        ].map((s) => (
          <div key={s.label} className="hs-ref-stat">
            <div className="hs-ref-stat-icon" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
              <s.icon size={18} strokeWidth={1.5} />
            </div>
            <div>
              <p className="hs-ref-stat-value">{s.value}</p>
              <p className="hs-ref-stat-label">{s.label}</p>
            </div>
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
            placeholder="Search by student name..."
            value={referralSearch}
            onChange={(e) => setReferralSearch(e.target.value)}
          />
        </div>
        <select className="hs-select" defaultValue="all">
          <option value="all">All Status</option>
        </select>
      </div>
      <div className="cases-panel">
        <div className="cases-panel-header">
          <div className="cases-panel-title">Outgoing referrals (SDAO) ({filteredRef.length})</div>
          <p className="hs-list-sub" style={{ margin: "4px 0 0" }}>
            Referrals are sent directly to the partner office for review.
          </p>
        </div>
        <div className="cases-table-wrapper">
          {filteredRef.map((r) => (
            <div key={r.refId} className="hs-consult-row sdao-referral-row">
              <div>
                <p className="hs-consult-name">{r.student}</p>
                <p className="hs-consult-meta">{r.receivingOffice}</p>
                <div className="hs-consult-badges" style={{ marginTop: 8 }}>
                  {r.urgency === "urgent" ? <span className="hs-badge-urgent">URGENT</span> : null}
                  <span className="hs-pill hs-pill-scheduled sdao-ref-pill">{r.status}</span>
                </div>
              </div>
              <div>
                <p className="hs-consult-meta">{r.reason}</p>
                <p className="hs-consult-meta">
                  {r.createdAt} · {r.createdBy}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <button type="button" className="hs-link-action sdao-link-referral" onClick={() => openReferralDetails(r)}>
                  <Eye size={14} strokeWidth={1.5} aria-hidden />
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="cases-panel" style={{ marginTop: 24 }}>
        <div className="cases-panel-header">
          <div className="cases-panel-title">Incoming from Discipline Office ({disciplineIncomingReferrals.length})</div>
          <p className="hs-list-sub" style={{ margin: "4px 0 0" }}>
            Approve or decline referrals from Discipline Office sent to SDAO.
          </p>
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
                      className="hs-link-action sdao-link-referral"
                      onClick={() => {
                        setSelectedReferral({ ...r, disciplineIncoming: true });
                        setActiveModal("referralDetails");
                      }}
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
  };

  /** Primary actions in the page header (same shell as Dashboard: title left, actions right). */
  const sdaoHeaderActions = useMemo(() => {
    switch (activeNav) {
      case "dashboard":
        return (
          <button type="button" className="sdao-btn-export" onClick={() => window.print()}>
            <Download size={16} strokeWidth={1.5} aria-hidden />
            Export Report
          </button>
        );
      case "scholars":
        return (
          <button type="button" className="sdao-btn-primary-lg" onClick={openAddBeneficiary}>
            <Plus size={18} strokeWidth={2} aria-hidden />
            Add Beneficiary
          </button>
        );
      case "scholarshipTypes":
        return (
          <button type="button" className="sdao-btn-export" onClick={() => window.print()}>
            <Download size={16} strokeWidth={1.5} aria-hidden />
            Export
          </button>
        );
      case "docrequests":
        return canCreateSdaoDocRequest ? (
          <button type="button" className="cc-btn-primary sdao-doc-new-btn" onClick={openNewDocRequest}>
            <FileText size={16} strokeWidth={1.5} aria-hidden />
            <Plus size={16} strokeWidth={2} aria-hidden />
            New Request
          </button>
        ) : null;
      case "referrals":
        return (
          <button type="button" className="sdao-btn-referral-primary" onClick={openCreateReferral}>
            <Send size={16} strokeWidth={1.5} aria-hidden />
            Create Referral
          </button>
        );
      case "clearance":
      default:
        return null;
    }
  }, [activeNav, canCreateSdaoDocRequest]);

  const body = (() => {
    switch (activeNav) {
      case "scholars":
        return renderScholars();
      case "scholarshipTypes":
        return renderScholarshipTypes();
      case "clearance":
        return renderClearance();
      case "docrequests":
        return renderDocRequests();
      case "referrals":
        return renderReferrals();
      default:
        return renderDashboard();
    }
  })();

  const sdaoPageMain = (
    <main className="dashboard-content sdao-page">
      <header className="sdao-page-header">
        <div className="sdao-page-header-text">
          <h1 className="sdao-page-header-title">{meta.title}</h1>
          <p className="sdao-page-header-sub">{meta.subtitle}</p>
        </div>
        {sdaoHeaderActions ? <div className="sdao-page-header-actions">{sdaoHeaderActions}</div> : null}
      </header>
      {sdaoLoading ? (
        <p className="hs-stat-meta" style={{ margin: 0 }}>
          Loading scholarship data from Supabase…
        </p>
      ) : null}
      {sdaoError ? (
        <div className="hs-banner-warn" role="alert" style={{ marginBottom: 8 }}>
          {sdaoError}
        </div>
      ) : null}
      {body}
    </main>
  );

  return (
    <>
      {embedDashboardOnly ? (
        <div className="sa-embed-sdao sdao-layout">{sdaoPageMain}</div>
      ) : (
        <div className="dashboard-layout sdao-layout">
          <Sidebar
            departmentTag="Scholarship Management"
            navItems={sdaoNavItems}
            activeNavId={activeNav}
            onNavSelect={setActiveNav}
            onLogoutRequest={() => setLogoutOpen(true)}
            profileSettingsPath={PROFILE_SETTINGS_PATH_DEVELOPMENT}
          />
          <div className="dashboard-main">
            <OfficeHeader
              userName={userName}
              userRole={userRole}
              notifications={SDAO_NOTIFICATIONS}
              notificationSlot={<StaffNotificationBell />}
            />
            {sdaoPageMain}
          </div>
        </div>
      )}

      <CCModal
        open={activeModal === "addBeneficiary"}
        onClose={closeFeatureModal}
        centered
        wide
        showHeader={false}
      >
        <div className="sdao-figma-modal">
          <div className="sdao-figma-modal-head">
            <div className="sdao-figma-modal-icon">
              <GraduationCap size={22} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="sdao-figma-modal-title">Add New Beneficiary</h2>
              <p className="sdao-figma-modal-sub">Register a student scholarship beneficiary record</p>
            </div>
          </div>
          <div className="cc-modal-body sdao-figma-modal-body">
            <div className="cc-modal-row">
              <div className="cc-field">
                <label className="cc-label">Full Name</label>
                <input
                  className="cc-input"
                  value={beneficiaryForm.fullName}
                  onChange={(e) =>
                    setBeneficiaryForm((f) => ({ ...f, fullName: sanitizePersonNameInput(e.target.value) }))
                  }
                  placeholder="Full name as on record"
                />
              </div>
              <div className="cc-field">
                <label className="cc-label">Student ID</label>
                <input
                  className="cc-input"
                  value={beneficiaryForm.studentId}
                  onChange={(e) =>
                    setBeneficiaryForm((f) => ({ ...f, studentId: sanitizeDigitsOnlyInput(e.target.value) }))
                  }
                  placeholder="e.g., 2023-10234"
                />
              </div>
            </div>
            <div className="cc-modal-row">
              <div className="cc-field">
                <label className="cc-label">Program</label>
                <input
                  className="cc-input"
                  value={beneficiaryForm.program}
                  onChange={(e) => setBeneficiaryForm((f) => ({ ...f, program: e.target.value }))}
                  placeholder="Program"
                />
              </div>
              <div className="cc-field">
                <label className="cc-label">Year Level</label>
                <select
                  className="cc-input"
                  value={beneficiaryForm.yearLevel}
                  onChange={(e) => setBeneficiaryForm((f) => ({ ...f, yearLevel: e.target.value }))}
                >
                  {YEAR_LEVEL_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="cc-modal-row">
              <div className="cc-field">
                <label className="cc-label">Scholarship Type</label>
                <select
                  className="cc-input"
                  value={beneficiaryForm.scholarshipType}
                  onChange={(e) => setBeneficiaryForm((f) => ({ ...f, scholarshipType: e.target.value }))}
                >
                  {SCHOLARSHIP_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cc-field">
                <label className="cc-label">Current GPA</label>
                <input
                  className="cc-input"
                  value={beneficiaryForm.gpa}
                  onChange={(e) => setBeneficiaryForm((f) => ({ ...f, gpa: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="cc-modal-row">
              <div className="cc-field">
                <label className="cc-label">Email Address</label>
                <input
                  className="cc-input"
                  type="email"
                  value={beneficiaryForm.email}
                  onChange={(e) => setBeneficiaryForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="student@nu-dasma.edu.ph"
                />
              </div>
              <div className="cc-field">
                <label className="cc-label">Contact Number</label>
                <input
                  className="cc-input"
                  value={beneficiaryForm.contact}
                  onChange={(e) => setBeneficiaryForm((f) => ({ ...f, contact: e.target.value }))}
                  placeholder="09XX-XXX-XXXX"
                />
              </div>
            </div>
          </div>
          <div className="cc-modal-actions sdao-figma-modal-actions">
            <button type="button" className="sdao-btn-text" onClick={closeFeatureModal}>
              Cancel
            </button>
            <button type="button" className="sdao-btn-solid" onClick={submitBeneficiaryForm}>
              Add Beneficiary
            </button>
          </div>
        </div>
      </CCModal>

      <CCModal
        open={activeModal === "viewBeneficiary" && !!selectedBeneficiary}
        onClose={closeFeatureModal}
        centered
        wide
        showHeader={false}
      >
        {selectedBeneficiary ? (
          <div className="sdao-figma-modal">
            <div className="sdao-figma-modal-head">
              <div className="sdao-figma-modal-icon">
                <FileText size={22} strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="sdao-figma-modal-title">Scholar Profile</h2>
                <p className="sdao-figma-modal-sub">View beneficiary information</p>
              </div>
            </div>
            <div className="cc-modal-body sdao-figma-modal-body">
              <div className="sdao-profile-hero">
                <div className="sdao-profile-hero-top">
                  <div>
                    <p className="sdao-profile-hero-name">{selectedBeneficiary.fullName}</p>
                    <p className="sdao-profile-hero-id">{selectedBeneficiary.studentId}</p>
                  </div>
                  <span
                    className={
                      selectedBeneficiary.scholarStatus === "probation"
                        ? "sdao-pill sdao-pill--warn"
                        : "sdao-pill sdao-pill--validated"
                    }
                  >
                    {selectedBeneficiary.scholarStatus === "probation" ? "On Probation" : "Active"}
                  </span>
                </div>
                <div className="sdao-profile-grid">
                  <div>
                    <span className="sdao-dl-label">Program</span>
                    <p className="sdao-dl-value">{selectedBeneficiary.program}</p>
                  </div>
                  <div>
                    <span className="sdao-dl-label">Year Level</span>
                    <p className="sdao-dl-value">{selectedBeneficiary.yearLevel}</p>
                  </div>
                  <div>
                    <span className="sdao-dl-label">Email</span>
                    <p className="sdao-dl-value">{selectedBeneficiary.email}</p>
                  </div>
                  <div>
                    <span className="sdao-dl-label">Contact</span>
                    <p className="sdao-dl-value">{selectedBeneficiary.contact}</p>
                  </div>
                </div>
              </div>
              <div className="sdao-profile-grid sdao-profile-grid--border">
                <div>
                  <span className="sdao-dl-label">Scholarship Type</span>
                  <p className="sdao-dl-value sdao-dl-value--blue">{selectedBeneficiary.scholarshipType}</p>
                </div>
                <div>
                  <span className="sdao-dl-label">Current GPA</span>
                  <p className="sdao-dl-value">{selectedBeneficiary.gpa}</p>
                </div>
              </div>
            </div>
            <div className="cc-modal-actions sdao-figma-modal-actions">
              <button type="button" className="sdao-btn-outline" onClick={closeFeatureModal}>
                Close
              </button>
              <button type="button" className="sdao-btn-solid" onClick={() => openManageBeneficiary(selectedBeneficiary)}>
                <Settings2 size={16} strokeWidth={1.75} aria-hidden />
                Manage Scholar
              </button>
            </div>
          </div>
        ) : null}
      </CCModal>

      <CCModal
        open={activeModal === "manageBeneficiary" && !!selectedBeneficiary}
        onClose={closeFeatureModal}
        centered
        wide
        showHeader={false}
      >
        {selectedBeneficiary ? (
          <div className="sdao-figma-modal">
            <div className="sdao-figma-modal-head">
              <div className="sdao-figma-modal-icon">
                <Settings2 size={22} strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="sdao-figma-modal-title">Manage Scholar</h2>
                <p className="sdao-figma-modal-sub">Update scholarship status and internal notes</p>
              </div>
            </div>
            <div className="cc-modal-body sdao-figma-modal-body">
              <div className="sdao-profile-hero sdao-profile-hero--compact">
                <p className="sdao-profile-hero-name">{selectedBeneficiary.fullName}</p>
                <p className="sdao-profile-hero-id">
                  {selectedBeneficiary.studentId} · {selectedBeneficiary.program}
                </p>
              </div>
              <div className="cc-modal-row">
                <div className="cc-field">
                  <label className="cc-label">Scholarship Type</label>
                  <select
                    className="cc-input"
                    value={manageScholarForm.scholarshipType}
                    onChange={(e) => setManageScholarForm((f) => ({ ...f, scholarshipType: e.target.value }))}
                  >
                    {SCHOLARSHIP_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="cc-field">
                  <label className="cc-label">Scholar Status</label>
                  <select
                    className="cc-input"
                    value={manageScholarForm.scholarStatus}
                    onChange={(e) => setManageScholarForm((f) => ({ ...f, scholarStatus: e.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="probation">On Probation</option>
                  </select>
                </div>
              </div>
              <div className="cc-field">
                <label className="cc-label">Internal Notes (Staff Only)</label>
                <textarea
                  className="cc-textarea sdao-textarea-tall"
                  value={manageScholarForm.internalNotes}
                  onChange={(e) => setManageScholarForm((f) => ({ ...f, internalNotes: e.target.value }))}
                  placeholder="Notes visible to SDAO staff only"
                />
              </div>
            </div>
            <div className="cc-modal-actions sdao-figma-modal-actions">
              <button type="button" className="sdao-btn-text" onClick={closeFeatureModal}>
                Cancel
              </button>
              <button type="button" className="sdao-btn-solid" onClick={saveManageScholar}>
                Save Changes
              </button>
            </div>
          </div>
        ) : null}
      </CCModal>

      <CCModal
        open={activeModal === "applicationDetails" && !!selectedApplication}
        onClose={closeFeatureModal}
        centered
        wide
        showHeader={false}
      >
        {selectedApplication ? (
          <div className="sdao-figma-modal">
            <div className="sdao-figma-modal-head">
              <div className="sdao-figma-modal-icon">
                <FileText size={22} strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="sdao-figma-modal-title">Application Details</h2>
                <p className="sdao-figma-modal-sub">Complete scholarship application information</p>
              </div>
            </div>
            <div className="cc-modal-body sdao-figma-modal-body">
              <div className="sdao-profile-hero">
                <div className="sdao-profile-hero-top">
                  <div>
                    <p className="sdao-profile-hero-name">{selectedApplication.student}</p>
                    <p className="sdao-profile-hero-id">{selectedApplication.sid}</p>
                  </div>
                  <span className={applicationStatusBadgeClass(selectedApplication.status)}>{selectedApplication.status}</span>
                </div>
                <div className="sdao-profile-grid sdao-profile-grid--3">
                  <div>
                    <span className="sdao-dl-label">Program</span>
                    <p className="sdao-dl-value">{selectedApplication.degree}</p>
                  </div>
                  <div>
                    <span className="sdao-dl-label">GPA</span>
                    <p className="sdao-dl-value">{selectedApplication.gpa}</p>
                  </div>
                  <div>
                    <span className="sdao-dl-label">Submitted</span>
                    <p className="sdao-dl-value">{selectedApplication.submitted}</p>
                  </div>
                </div>
              </div>
              <div className="sdao-scholarship-type-box">
                <span className="sdao-dl-label">Scholarship Type</span>
                <p className="sdao-scholarship-type-value">{selectedApplication.type}</p>
              </div>
              {selectedApplication.status?.toLowerCase() === "disbursed" && selectedApplication.disbursedOn ? (
                <div className="sdao-disbursed-banner">
                  <CheckCircle2 size={22} strokeWidth={2} className="sdao-disbursed-banner-icon" aria-hidden />
                  <div>
                    <p className="sdao-disbursed-banner-title">Scholarship Disbursed</p>
                    <p className="sdao-disbursed-banner-sub">Disbursed on: {selectedApplication.disbursedOn}</p>
                  </div>
                </div>
              ) : null}
              <div>
                <h3 className="sdao-docs-section-title">Documents Submitted</h3>
                <div className="sdao-docs-grid">
                  {(selectedApplication.documents || []).map((doc) => (
                    <div
                      key={doc}
                      className={
                        selectedApplication.documentPresentation === "outlined"
                          ? "sdao-doc-tag sdao-doc-tag--outline"
                          : "sdao-doc-tag sdao-doc-tag--tinted"
                      }
                    >
                      <CheckCircle2 size={16} strokeWidth={2} className="sdao-doc-tag-check" aria-hidden />
                      <span>{doc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="cc-modal-actions sdao-figma-modal-actions">
              {selectedApplication.status?.toLowerCase() === "validated" ? (
                <>
                  <button type="button" className="sdao-btn-outline" onClick={closeFeatureModal}>
                    Close
                  </button>
                  <button type="button" className="sdao-btn-solid" onClick={processDisbursement}>
                    Process Disbursement
                  </button>
                </>
              ) : (
                <button type="button" className="sdao-btn-outline sdao-btn-full-right" onClick={closeFeatureModal}>
                  Close
                </button>
              )}
            </div>
          </div>
        ) : null}
      </CCModal>

      <CCModal
        open={activeModal === "clearanceDetails" && !!selectedClearance}
        onClose={closeFeatureModal}
        centered
        wide
        showHeader={false}
      >
        {selectedClearance ? (
          <div className="sdao-figma-modal sdao-figma-modal--tall">
            <div className="sdao-figma-modal-head">
              <div className="sdao-figma-modal-icon">
                <ClipboardCheck size={22} strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="sdao-figma-modal-title">Clearance Details</h2>
                <p className="sdao-figma-modal-sub">Complete clearance status and requirements information</p>
              </div>
            </div>
            <div className="cc-modal-body sdao-figma-modal-body">
              <div className="sdao-profile-hero">
                <div className="sdao-profile-hero-top">
                  <div>
                    <p className="sdao-profile-hero-name">{selectedClearance.student}</p>
                    <p className="sdao-profile-hero-id">{selectedClearance.sid}</p>
                  </div>
                  <span className={clearanceRowBadgeClass(selectedClearance.statusKey)}>{selectedClearance.statusKey}</span>
                </div>
                <div className="sdao-profile-grid sdao-profile-grid--3">
                  <div>
                    <span className="sdao-dl-label">Program</span>
                    <p className="sdao-dl-value">{selectedClearance.program}</p>
                  </div>
                  <div>
                    <span className="sdao-dl-label">Year Level</span>
                    <p className="sdao-dl-value">{selectedClearance.yearLevel}</p>
                  </div>
                  <div>
                    <span className="sdao-dl-label">Scholarship</span>
                    <p className="sdao-dl-value">{selectedClearance.scholarship}</p>
                  </div>
                </div>
              </div>
              <div className="sdao-clearance-progress-block">
                <div className="sdao-clearance-progress-head">
                  <span className="sdao-clearance-progress-label">Clearance Progress</span>
                  <span className="sdao-clearance-progress-pct">{selectedClearance.progress}%</span>
                </div>
                <div className="sdao-clear-bar sdao-clear-bar--lg">
                  <div
                    className="sdao-clear-fill"
                    style={{
                      width: `${selectedClearance.progress}%`,
                      background: clearanceBarTone(selectedClearance.statusKey, selectedClearance.progress),
                    }}
                  />
                </div>
                <p className="sdao-clearance-progress-foot">{selectedClearance.progressLabel}</p>
              </div>
              <h3 className="sdao-docs-section-title">Clearance Requirements</h3>
              <ul className="sdao-req-list">
                {(selectedClearance.requirements || []).map((req) => (
                  <li key={req.id} className="sdao-req-card">
                    <div className="sdao-req-card-icon">
                      {req.state === "completed" ? (
                        <CheckCircle2 size={20} strokeWidth={2} className="sdao-req-ok" />
                      ) : (
                        <Clock size={20} strokeWidth={2} className="sdao-req-wait" />
                      )}
                    </div>
                    <div className="sdao-req-card-body">
                      <div className="sdao-req-card-top">
                        <span className="sdao-req-name">{req.name}</span>
                        <span className={req.state === "completed" ? "sdao-pill sdao-pill--validated" : "sdao-pill sdao-pill--warn"}>
                          {req.state === "completed" ? "Completed" : "Pending"}
                        </span>
                      </div>
                      <p className="sdao-req-detail">{req.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div
                className={
                  selectedClearance.footerVariant === "success" ? "sdao-clear-footer sdao-clear-footer--ok" : "sdao-clear-footer sdao-clear-footer--warn"
                }
              >
                {selectedClearance.footerVariant === "success" ? (
                  <CheckCircle2 size={22} strokeWidth={2} aria-hidden />
                ) : (
                  <AlertTriangle size={22} strokeWidth={2} aria-hidden />
                )}
                <p>{selectedClearance.footerMessage}</p>
              </div>
            </div>
            <div className="cc-modal-actions sdao-figma-modal-actions">
              <button type="button" className="sdao-btn-outline" onClick={closeFeatureModal}>
                Close
              </button>
              {selectedClearance.statusKey?.toLowerCase() !== "completed" ? (
                <button type="button" className="sdao-btn-solid" onClick={sendClearanceReminder}>
                  <Clock size={16} strokeWidth={1.75} aria-hidden />
                  Send Reminder
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CCModal>

      <InterOfficeNewDocumentRequestModal
        key={sdaoNewDocModalKey}
        open={activeModal === "newDocRequest"}
        onClose={closeFeatureModal}
        viewerOfficeKey="development"
        submitting={sdaoDocRequestSubmitting}
        onSubmit={submitSdaoInterOfficeDocumentRequest}
      />

      <CCModal
        open={activeModal === "docRequestDetails" && !!selectedDocRequest}
        onClose={closeFeatureModal}
        centered
        wide
        showHeader={false}
      >
        {selectedDocRequest ? (
          <div className="sdao-figma-modal">
            <div className="sdao-figma-modal-head">
              <div className="sdao-figma-modal-icon">
                <FileText size={22} strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="sdao-figma-modal-title">Request Details</h2>
                <p className="sdao-figma-modal-sub">Complete information about the document request</p>
              </div>
            </div>
            <div className="cc-modal-body sdao-figma-modal-body">
              {isDocRequestDeclined(selectedDocRequest.status) ? (
                <div className="sdao-doc-pending-banner" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
                  <Clock size={22} strokeWidth={2} aria-hidden />
                  <div>
                    <p className="sdao-doc-ready-title">Request declined</p>
                    <p className="sdao-doc-ready-sub">This inter-office request was declined. No further uploads.</p>
                  </div>
                </div>
              ) : selectedDocRequest.status === "ready" && selectedDocRequest.uploadedAt ? (
                <div className="sdao-doc-ready-banner">
                  <CheckCircle2 size={22} strokeWidth={2} aria-hidden />
                  <div>
                    <p className="sdao-doc-ready-title">Document Ready</p>
                    <p className="sdao-doc-ready-sub">Uploaded by partner office on: {selectedDocRequest.uploadedAt}</p>
                  </div>
                </div>
              ) : (
                <div className="sdao-doc-pending-banner">
                  <Clock size={22} strokeWidth={2} aria-hidden />
                  <div>
                    <p className="sdao-doc-ready-title">Request In Progress</p>
                    <p className="sdao-doc-ready-sub">
                      {selectedDocRequest.direction === "outgoing"
                        ? isDocRequestPendingApproval(selectedDocRequest.status)
                          ? `${labelForOfficeKey(selectedDocRequest.partnerOffice)} must approve before fulfilling this request.`
                          : `${labelForOfficeKey(selectedDocRequest.partnerOffice)} is processing this request.`
                        : isDocRequestPendingApproval(selectedDocRequest.status)
                          ? `Approve this request first, then attach the file for ${labelForOfficeKey(selectedDocRequest.partnerOffice)}.`
                          : `${labelForOfficeKey(selectedDocRequest.partnerOffice)} initiated this request — SDAO is the target office.`}
                    </p>
                  </div>
                </div>
              )}
              <div className="sdao-doc-detail-grid">
                <div>
                  <span className="sdao-dl-label">Request ID</span>
                  <p className="sdao-dl-value">{selectedDocRequest.id}</p>
                  <span className="sdao-dl-label">Document Type</span>
                  <p className="sdao-dl-value">{selectedDocRequest.doc}</p>
                  <span className="sdao-dl-label">Priority</span>
                  <p className="sdao-dl-value">
                    <span className="sdao-priority-pill">{selectedDocRequest.priority}</span>
                  </p>
                </div>
                <div>
                  <span className="sdao-dl-label">
                    {selectedDocRequest.direction === "outgoing" ? "Request to" : "Request from"}
                  </span>
                  <p className="sdao-dl-value">{labelForOfficeKey(selectedDocRequest.partnerOffice)}</p>
                </div>
              </div>
              <div className="sdao-notes-box" style={{ marginBottom: 0 }}>
                <span className="sdao-dl-label">Attachments</span>
                {(selectedDocRequest.evidence || []).length === 0 ? (
                  <p className="sdao-notes-text" style={{ marginTop: 8 }}>
                    No attachments yet.
                  </p>
                ) : (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#334155", fontSize: 14 }}>
                    {(selectedDocRequest.evidence || []).map((ev, idx) => (
                      <li key={`${ev.name}-${idx}-${ev.url || ""}`} style={{ marginBottom: 6 }}>
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
                      <p className="hs-stat-meta" style={{ marginBottom: 8 }}>
                        Approve this request first; then you can attach the file for the requesting office.
                      </p>
                    ) : null}
                    <label htmlFor="sdao-doc-accept-upload" className="sdao-dl-label" style={{ display: "block" }}>
                      Add attachment (your office)
                    </label>
                    <input
                      id="sdao-doc-accept-upload"
                      type="file"
                      className="cc-input"
                      disabled={
                        sdaoDocAcceptingUploadBusy || !canReceivingOfficeUploadDoc(selectedDocRequest.status)
                      }
                      onChange={handleSdaoAcceptingOfficeUpload}
                      style={{ marginTop: 8, maxWidth: 400 }}
                    />
                    {sdaoDocAcceptingUploadBusy ? (
                      <p className="hs-stat-meta" style={{ marginTop: 6 }}>
                        Uploading…
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="sdao-notes-box">
                <span className="sdao-dl-label">Request Notes:</span>
                <p className="sdao-notes-text">{selectedDocRequest.notes}</p>
              </div>
            </div>
            <div className="cc-modal-actions sdao-figma-modal-actions sdao-doc-detail-footer" style={{ flexWrap: "wrap", gap: 8 }}>
              <p className="sdao-doc-requested-by">
                Requested by: <strong>{selectedDocRequest.requestedBy}</strong>
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {selectedDocRequest.direction === "incoming" && isDocRequestPendingApproval(selectedDocRequest.status) ? (
                  <>
                    <button
                      type="button"
                      className="sdao-btn-outline"
                      onClick={async () => {
                        try {
                          if (!isSupabaseConfigured() || !supabase) return;
                          const { error } = await supabase
                            .from("inter_office_document_requests")
                            .update({ status: INTER_OFFICE_DOC_STATUS.DECLINED, updated_at: new Date().toISOString() })
                            .eq("id", selectedDocRequest.id);
                          if (error) throw error;
                          const next = INTER_OFFICE_DOC_STATUS.DECLINED.toLowerCase();
                          setDocRequests((prev) =>
                            prev.map((d) => (d.id === selectedDocRequest.id ? { ...d, status: next } : d)),
                          );
                          setSelectedDocRequest((prev) => (prev ? { ...prev, status: next } : null));
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
                      className="sdao-btn-solid"
                      onClick={async () => {
                        try {
                          if (!isSupabaseConfigured() || !supabase) return;
                          const { error } = await supabase
                            .from("inter_office_document_requests")
                            .update({ status: INTER_OFFICE_DOC_STATUS.APPROVED, updated_at: new Date().toISOString() })
                            .eq("id", selectedDocRequest.id);
                          if (error) throw error;
                          const next = INTER_OFFICE_DOC_STATUS.APPROVED.toLowerCase();
                          setDocRequests((prev) =>
                            prev.map((d) => (d.id === selectedDocRequest.id ? { ...d, status: next } : d)),
                          );
                          setSelectedDocRequest((prev) => (prev ? { ...prev, status: next } : null));
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
                <button type="button" className="sdao-btn-outline" onClick={closeFeatureModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </CCModal>

      <CCModal open={activeModal === "createReferral"} onClose={closeFeatureModal} centered wide showHeader={false}>
        <div className="sdao-figma-modal sdao-figma-modal--tall">
          <div className="sdao-figma-modal-head">
            <div>
              <h2 className="sdao-figma-modal-title">Create New Referral</h2>
              <p className="sdao-figma-modal-sub">
                Refer a student to another Student Welfare Office for comprehensive support
              </p>
            </div>
          </div>
          <div className="cc-modal-body sdao-figma-modal-body">
            <h3 className="sdao-form-section-title">Student Information</h3>
            <div className="cc-modal-row">
              <div className="cc-field">
                <label className="cc-label sdao-label-strong">Student Name *</label>
                <input
                  className="cc-input"
                  value={referralForm.studentName}
                  onChange={(e) =>
                    setReferralForm((f) => ({ ...f, studentName: sanitizePersonNameInput(e.target.value) }))
                  }
                  placeholder="Enter student full name"
                />
              </div>
              <div className="cc-field">
                <label className="cc-label sdao-label-strong">Student ID *</label>
                <input
                  className="cc-input"
                  value={referralForm.studentId}
                  onChange={(e) =>
                    setReferralForm((f) => ({ ...f, studentId: sanitizeDigitsOnlyInput(e.target.value) }))
                  }
                  placeholder="e.g., 2023-10234"
                />
              </div>
            </div>
            <div className="cc-modal-row">
              <div className="cc-field">
                <label className="cc-label sdao-label-strong">Email Address *</label>
                <input
                  className="cc-input"
                  type="email"
                  value={referralForm.email}
                  onChange={(e) => setReferralForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="student@nu-dasma.edu.ph"
                />
              </div>
              <div className="cc-field">
                <label className="cc-label sdao-label-strong">Program *</label>
                <select
                  className="cc-input"
                  value={referralForm.program}
                  onChange={(e) => setReferralForm((f) => ({ ...f, program: e.target.value }))}
                >
                  <option value="">Select program</option>
                  {NU_PROGRAM_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <h3 className="sdao-form-section-title">Referral Details</h3>
            <div className="cc-modal-row">
              <div className="cc-field">
                <label className="cc-label">Referring Office</label>
                <input className="cc-input sdao-input-readonly" readOnly value="SDAO — Student Development & Activities Office" />
              </div>
              <div className="cc-field">
                <label className="cc-label sdao-label-strong">Receiving Office *</label>
                <select
                  className="cc-input"
                  value={referralForm.receivingOffice}
                  onChange={(e) => setReferralForm((f) => ({ ...f, receivingOffice: e.target.value }))}
                >
                  <option value="">Select office</option>
                  {SDAO_INTER_OFFICE_REFERRALS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="cc-field">
              <label className="cc-label sdao-label-strong">Urgency Level *</label>
              <select
                className="cc-input"
                value={referralForm.urgency}
                onChange={(e) => setReferralForm((f) => ({ ...f, urgency: e.target.value }))}
              >
                {URGENCY_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="cc-field">
              <label className="cc-label sdao-label-strong">Reason for Referral *</label>
              <textarea
                className="cc-textarea"
                value={referralForm.reason}
                onChange={(e) => setReferralForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Describe the reason for this referral"
              />
            </div>
            <div className="cc-field">
              <label className="cc-label sdao-label-strong">Notes *</label>
              <textarea
                className="cc-textarea"
                value={referralForm.referralNotes}
                onChange={(e) => setReferralForm((f) => ({ ...f, referralNotes: e.target.value }))}
                placeholder="Additional context, observations, or instructions for the receiving office"
              />
            </div>
            <div className="cc-field">
              <label className="cc-label">Attachments (Optional)</label>
              <div className="sdao-upload-zone">Upload supporting documents (activity records, assessments, recommendations)</div>
            </div>
          </div>
          <div className="cc-modal-actions sdao-figma-modal-actions">
            <button type="button" className="sdao-btn-outline" onClick={closeFeatureModal}>
              Cancel
            </button>
            <button type="button" className="sdao-btn-referral-primary" onClick={submitReferral}>
              <Send size={16} strokeWidth={1.75} aria-hidden />
              Send Referral
            </button>
          </div>
        </div>
      </CCModal>

      <CCModal
        open={activeModal === "referralDetails" && !!selectedReferral}
        onClose={closeFeatureModal}
        centered
        wide
        showHeader={false}
      >
        {selectedReferral ? (
          <div className="sdao-figma-modal sdao-figma-modal--tall">
            <div className="sdao-ref-detail-head">
              <div>
                <h2 className="sdao-figma-modal-title">Referral Details</h2>
                <p className="sdao-figma-modal-sub">Complete referral information and tracking</p>
              </div>
              <div className="sdao-ref-id-pill">
                {selectedReferral.disciplineIncoming ? selectedReferral.referralId : selectedReferral.refId}
                <button type="button" className="sdao-ref-id-close" aria-label="Close" onClick={closeFeatureModal}>
                  ✕
                </button>
              </div>
            </div>
            <div className="cc-modal-body sdao-figma-modal-body">
              <div className="sdao-ref-banner">
                <div className="sdao-ref-banner-left">
                  <Info size={18} strokeWidth={2} aria-hidden />
                  <span>{selectedReferral.disciplineIncoming ? "Discipline referral" : "Standard Referral"}</span>
                </div>
                <span className="sdao-ref-status-purple">
                  {selectedReferral.disciplineIncoming
                    ? selectedReferral.status
                    : selectedReferral.statusDetail || selectedReferral.status}
                </span>
              </div>
              <div className="sdao-ref-student-box">
                <div className="sdao-ref-student-grid">
                  <div>
                    <span className="sdao-dl-label">Name</span>
                    <p className="sdao-dl-value">{selectedReferral.student || selectedReferral.studentName}</p>
                  </div>
                  <div>
                    <span className="sdao-dl-label">Student ID</span>
                    <p className="sdao-dl-value">{selectedReferral.studentId}</p>
                  </div>
                  {!selectedReferral.disciplineIncoming ? (
                    <>
                      <div>
                        <span className="sdao-dl-label">Email</span>
                        <p className="sdao-dl-value">{selectedReferral.email}</p>
                      </div>
                      <div className="sdao-ref-span-2">
                        <span className="sdao-dl-label">Program</span>
                        <p className="sdao-dl-value">{selectedReferral.program}</p>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="sdao-ref-info-grid">
                <div>
                  <span className="sdao-dl-label">From (Referring Office)</span>
                  <p className="sdao-dl-value">
                    {selectedReferral.disciplineIncoming
                      ? labelForOfficeKey(selectedReferral.referringOffice)
                      : selectedReferral.referringOffice}
                  </p>
                </div>
                <div>
                  <span className="sdao-dl-label">To (Receiving Office)</span>
                  <p className="sdao-dl-value">
                    {selectedReferral.disciplineIncoming
                      ? "SDAO — Student Development"
                      : selectedReferral.receivingOffice}
                  </p>
                </div>
                <div>
                  <span className="sdao-dl-label">Date</span>
                  <p className="sdao-dl-value">
                    {selectedReferral.disciplineIncoming ? selectedReferral.date : selectedReferral.createdAt}
                  </p>
                </div>
                {!selectedReferral.disciplineIncoming ? (
                  <div>
                    <span className="sdao-dl-label">Created By</span>
                    <p className="sdao-dl-value">{selectedReferral.createdBy}</p>
                  </div>
                ) : null}
              </div>
              {selectedReferral.disciplineIncoming && canReceivingOfficeReviewReferral(selectedReferral.status) ? (
                <p className="hs-stat-meta" style={{ margin: "0 0 12px" }}>
                  Approve or decline this referral for SDAO.
                </p>
              ) : null}
              {!selectedReferral.disciplineIncoming &&
              (isReferralPendingPartnerReview(selectedReferral.status) ||
                normalizeReferralStatus(selectedReferral.status).includes("pending referring")) ? (
                <p className="hs-stat-meta" style={{ margin: "0 0 12px" }}>
                  Waiting for {selectedReferral.receivingOffice} to approve or decline.
                </p>
              ) : null}
              <div className="sdao-ref-text-block">
                <span className="sdao-dl-label">Reason for Referral</span>
                <p>{selectedReferral.reason}</p>
              </div>
              {!selectedReferral.disciplineIncoming && selectedReferral.developmentDetails ? (
                <div className="sdao-ref-text-block">
                  <span className="sdao-dl-label">Notes</span>
                  <p>{selectedReferral.developmentDetails}</p>
                </div>
              ) : null}
              {selectedReferral.disciplineIncoming && Array.isArray(selectedReferral.evidence) && selectedReferral.evidence.length ? (
                <div className="sdao-ref-attachments">
                  <span className="sdao-dl-label">Attachments</span>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#334155", fontSize: 14 }}>
                    {selectedReferral.evidence.map((ev, i) => (
                      <li key={i}>{ev.name || ev.label || "File"}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!selectedReferral.disciplineIncoming && selectedReferral.attachments?.length ? (
                <div className="sdao-ref-attachments">
                  <span className="sdao-dl-label">Attachments</span>
                  <div className="sdao-ref-attach-row">
                    {selectedReferral.attachments.map((a) => (
                      <span key={a.name} className="sdao-ref-attach-pill">
                        <FileText size={14} strokeWidth={1.75} aria-hidden />
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {!selectedReferral.disciplineIncoming ? (
                <>
                  <h3 className="sdao-form-section-title">Referral Timeline</h3>
                  <ul className="sdao-timeline">
                    {(selectedReferral.timeline || []).map((ev) => (
                      <li key={ev.id} className="sdao-timeline-item">
                        <span
                          className={
                            ev.tone === "active" ? "sdao-timeline-dot sdao-timeline-dot--active" : "sdao-timeline-dot"
                          }
                          aria-hidden
                        />
                        <div>
                          <p className="sdao-timeline-title">{ev.title}</p>
                          <p className="sdao-timeline-meta">
                            {ev.date} · {ev.by}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
            <div className="cc-modal-actions sdao-figma-modal-actions" style={{ flexWrap: "wrap", gap: 8 }}>
              <button type="button" className="sdao-btn-outline" onClick={closeFeatureModal}>
                Close
              </button>
              {selectedReferral.disciplineIncoming && canReceivingOfficeReviewReferral(selectedReferral.status) ? (
                <>
                  <button
                    type="button"
                    className="sdao-btn-outline"
                    onClick={async () => {
                      try {
                        if (!isSupabaseConfigured() || !supabase) return;
                        const { error } = await supabase
                          .from("discipline_referrals")
                          .update({
                            status: DISCIPLINE_REFERRAL_STATUS.DECLINED,
                            updated_at: new Date().toISOString(),
                          })
                          .eq("id", selectedReferral.referralId);
                        if (error) throw error;
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
                    className="sdao-btn-referral-primary"
                    onClick={async () => {
                      try {
                        if (!isSupabaseConfigured() || !supabase) return;
                        const { error } = await supabase
                          .from("discipline_referrals")
                          .update({
                            status: DISCIPLINE_REFERRAL_STATUS.APPROVED,
                            updated_at: new Date().toISOString(),
                          })
                          .eq("id", selectedReferral.referralId);
                        if (error) throw error;
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
          </div>
        ) : null}
      </CCModal>

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
    </>
  );
}

export default SDAO;
