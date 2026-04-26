import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  Info,
  Plus,
  TrendingUp,
  User,
} from "lucide-react";
import { showToast } from "../../utils/toast";
import Sidebar from "../../components/Sidebar/Sidebar";
import ProgramSelect from "../../components/common/ProgramSelect";
import { CASE_TYPE_OPTIONS, PRIORITY_OPTIONS } from "../../data/mockCases";
import { NU_PROGRAM_OPTIONS } from "../../data/nuPrograms";
import { canCreateDocumentRequest, labelForOfficeKey } from "../../constants/documentRequestAccess";
import { CONFERENCE_DURATION_OPTIONS, MOCK_CONFERENCES } from "../../data/mockConferences";
import { DO_CONFERENCES_SEED } from "../../data/doOfficeSeeds";
import { DO_STUDENT_RECORDS_SEED } from "../../data/doOfficeSeeds";
import { DO_DOCUMENT_REQUESTS_SEED } from "../../data/doOfficeSeeds";
import { DO_REFERRALS_SEED } from "../../data/doOfficeSeeds";
import { DO_SANCTIONS_SEED } from "../../data/doOfficeSeeds";
import { useCases } from "../../hooks/useCases";
import {
  useCaseConferences,
  useDocumentRequests,
  useReferrals,
  useSanctions,
  useStudentRecords,
} from "../../hooks/useDisciplineOfficeData";
import {
  buildMonthGrid,
  dateKey,
  effectiveConferenceStatus,
  conferenceTimeState,
  endOfWeekSunday,
  fromDateInputToLabel,
  parseConferenceDate,
  startOfWeekSunday,
  toDateInputValue,
} from "../../utils/conferenceCalendar";
import { isStaffCampusRole } from "../../utils/officeSession";
import { PROFILE_SETTINGS_PATH_DISCIPLINE } from "../../utils/profileSettingsRoutes";
import { formatCaseDateFromIso, formatCaseId } from "../../utils/disciplineCaseMapper";
import {
  sanitizeDigitsOnlyInput,
  sanitizePersonNameInput,
  validatePersonName,
  validateStrictNumericStudentId,
} from "../../utils/signupFieldValidation";
import {
  STANDING_LABELS,
  mergeStudentRecordsFromCases,
} from "../../utils/studentRecordsFromCases";
import {
  PERIOD_OPTIONS,
  buildReportsAnalytics,
  exportAnalyticsCsv,
} from "../../utils/reportsAnalytics";
import { useDONotificationStore } from "../../stores/doNotificationStore";
import OfficeHeader from "../../components/OfficeHeader/OfficeHeader";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { appendEvidenceToInterOfficeRequest } from "../../services/interOfficeDocumentEvidence";
import InterOfficeNewDocumentRequestModal from "../../components/interOffice/InterOfficeNewDocumentRequestModal";
import "./DO.css";


function DONotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = useDONotificationStore((s) => s.notifications);
  const markRead = useDONotificationStore((s) => s.markNotificationRead);
  const markAllRead = useDONotificationStore((s) => s.markAllNotificationsRead);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div style={{ position: "relative" }}>
      <button
        className="header-notifications"
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M15 6.667A5 5 0 005 6.667C5 10.833 3.333 12.5 3.333 12.5h13.334S15 10.833 15 6.667zM11.442 17.5a1.667 1.667 0 01-2.884 0"
            stroke="#374151"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 ? <span className="notif-badge">{unreadCount}</span> : null}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 44,
            width: 320,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0px 18px 60px rgba(15, 23, 42, 0.15)",
            padding: 12,
            zIndex: 2500,
          }}
          role="menu"
        >
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              color: "#0f172a",
              fontSize: 14,
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            Notifications
            <button
              type="button"
              className="cc-btn-secondary"
              style={{ height: 28, padding: "0 10px" }}
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>No notifications.</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    padding: 8,
                    borderRadius: 10,
                    cursor: "pointer",
                    border: n.unread ? "1px solid #e9d5ff" : "1px solid transparent",
                  }}
                  onClick={() => markRead(n.id)}
                >
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{n.title}</div>
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{n.body}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{n.createdAt}</div>
                </button>
              ))
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              type="button"
              className="cc-btn-secondary"
              style={{ height: 30, padding: "0 12px" }}
              onClick={() => markAllRead()}
            >
              Mark all as read
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Simple top bar (notifications + user). Page titles live in each view's content area. */
export function DisciplineOfficeTopBar() {
  const session = useMemo(() => {
    try {
      return JSON.parse(window.localStorage.getItem("campuscare_session_v1") || "null");
    } catch {
      return null;
    }
  }, []);
  const userName = session?.name || "Arny Lynne Saragina";
  const userRole = session?.role || "Discipline Coordinator";

  return (
    <OfficeHeader
      userName={userName}
      userRole={userRole}
      notifications={[]}
      notificationSlot={<DONotificationBell />}
    />
  );
}

const DO_StatusBadge = ({ status }) => (
  <span className={`badge badge-${status}`}>{status}</span>
);

const DO_SCHOOL_OPTIONS = ["SECA", "SBMA", "SASE"];
const DO_OFFENSE_TYPE_OPTIONS = ["Minor Offense", "Major Offense"];

/** School → Programs mapping for filtering */
const SCHOOL_PROGRAM_MAP = {
  "SECA": [
    "BS Architecture",
    "BS Civil Engineering",
    "BS Computer Science with specialization in Machine Learning",
    "BS Information Technology with specialization in Mobile and Web Applications",
  ],
  "SBMA": [
    "BS Accountancy",
    "BS Management Accounting",
    "BS Business Administration (BSBA) major in Financial Management",
    "BSBA major in Marketing Management",
    "BSBA major in Human Resource Management",
  ],
  "SASE": [
    "AB Communication",
    "BS Psychology",
    "BS Nursing",
    "Bachelor of Science in Pharmacy",
    "Bachelor of Physical Education (BPEd)",
    "BS Hospitality Management",
    "BS Tourism Management",
    "STEM: Science, Technology, Engineering, and Mathematics",
    "ABM: Accountancy, Business, and Management",
    "HUMSS: Humanities and Social Sciences",
  ],
};

/** Offense Type → Case Types mapping */
const OFFENSE_TYPE_CASE_TYPE_MAP = {
  "Major Offense": [
    "Academic Dishonesty",
    "Plagiarism",
    "Cheating",
    "Falsification of Records",
    "Property Damage",
  ],
  "Minor Offense": [
    "Code of Conduct Violation",
    "Attendance Violation",
    "Disruptive Behavior",
  ],
};

/** Get programs for a selected school */
function getProgramsForSchool(school) {
  return SCHOOL_PROGRAM_MAP[school] || [];
}

/** Get case types for a selected offense type */
function getCaseTypesForOffenseType(offenseType) {
  return OFFENSE_TYPE_CASE_TYPE_MAP[offenseType] || [];
}

/** Custom select dropdown matching ProgramSelect design */
function CustomSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled,
  isOpen,
  onOpen,
  onClose,
}) {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isOpen, onClose]);

  const display = value?.trim() ? value : "";

  return (
    <div className="program-select" ref={wrapRef}>
      <button
        id={id}
        type="button"
        className={`program-select-trigger${error ? " program-select-trigger--error" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => !disabled && onOpen()}
      >
        {display || placeholder}
      </button>
      {isOpen && (
        <ul className="program-select-dropdown" role="listbox" aria-labelledby={id}>
          <li
            className="program-select-option program-select-option--placeholder"
            role="option"
            aria-selected={!display}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              onClose();
            }}
          >
            {placeholder}
          </li>
          {options.map((opt) => (
            <li
              key={opt}
              className="program-select-option"
              role="option"
              aria-selected={value === opt}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt);
                onClose();
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function parseCaseMeta(caseRow) {
  const desc = String(caseRow?.description || "");
  let program = caseRow?.program || "";
  let reportedBy = "";
  const chunks = [];
  for (const part of desc.split("\n\n")) {
    if (part.startsWith("Program: ")) {
      program = program || part.slice(9).trim();
    } else if (part.startsWith("Reported by: ")) {
      reportedBy = part.slice(13).trim();
    } else {
      chunks.push(part);
    }
  }
  return {
    program: program || "—",
    reportedBy: reportedBy || caseRow?.officer || "—",
    body: chunks.join("\n\n").trim() || desc,
  };
}

function evidenceToTags(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) return [];
  return evidence.map((e) => (typeof e === "string" ? e : e?.name)).filter(Boolean);
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [selectedCase, setSelectedCase] = useState(null);
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const {
    cases,
    loading: casesLoading,
    fetchError: casesError,
    refresh: refreshCases,
    createCase,
    updateCaseStatus,
  } = useCases([]);

  const [newCaseForm, setNewCaseForm] = useState({
    student: "",
    studentId: "",
    school: "",
    program: "",
    caseType: "",
    offenseType: "",
    description: "",
    reportedBy: "",
  });
  const [newCaseEvidence, setNewCaseEvidence] = useState(null);
  const [newCaseErrors, setNewCaseErrors] = useState({});
  const [statusUpdate, setStatusUpdate] = useState("pending");
  const [statusNote, setStatusNote] = useState("");
  const [caseModalError, setCaseModalError] = useState(null);

  useEffect(() => {
    setCaseModalError(null);
  }, [selectedCase]);

  const stats = useMemo(() => {
    const newCount = cases.filter((c) => c.status === "new").length;
    const pendingCount = cases.filter((c) => c.status === "pending").length;
    const closedCount = cases.filter((c) => c.status === "closed").length;
    return { newCount, pendingCount, closedCount };
  }, [cases]);

  const recentCases = useMemo(() => cases.slice(0, 5), [cases]);

  const upcomingHearings = useMemo(() => {
    return MOCK_CONFERENCES.filter((c) => c.status === "scheduled")
      .sort((a, b) => a.day - b.day)
      .slice(0, 4);
  }, []);

  const selectedMeta = selectedCase ? parseCaseMeta(selectedCase) : null;

  return (
    <div className="dashboard-layout do-office-layout">
      <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />

      <div className="dashboard-main">
        <DisciplineOfficeTopBar />

        <main className="dashboard-content do-office-shell">
          {(casesError || (casesLoading && cases.length === 0)) && (
            <div
              role="status"
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: casesError ? "#fef2f2" : "#f8fafc",
                border: `1px solid ${casesError ? "#fecaca" : "#e2e8f0"}`,
                color: casesError ? "#991b1b" : "#475569",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span>
                {casesError
                  ? `Could not load cases: ${casesError}`
                  : "Loading cases…"}
              </span>
              {casesError && (
                <button
                  type="button"
                  className="cc-btn-secondary"
                  style={{ height: 32, padding: "0 12px" }}
                  onClick={() => refreshCases()}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <div className="page-title-row">
            <div>
              <h1>Discipline Office Dashboard</h1>
              <p>Comprehensive overview of disciplinary cases and activities</p>
            </div>
            <button
              className="btn-new-case"
              type="button"
              onClick={() => setIsNewCaseOpen(true)}
            >
              <Plus size={16} strokeWidth={2} aria-hidden />
              New Case
            </button>
          </div>

          <section className="do-home-metrics" aria-label="Case summary">
            <div className="do-metric-card do-metric-card--new">
                <div className="do-metric-body">
                <p className="do-metric-value">{stats.newCount}</p>
                <p className="do-metric-label">New Cases</p>
                <p className="do-metric-hint">Unreviewed</p>
              </div>
              <div className="do-metric-icon" aria-hidden>
                <ClipboardList size={24} strokeWidth={2} />
              </div>
            </div>
            <div className="do-metric-card do-metric-card--pending">
              <div className="do-metric-body">
                <p className="do-metric-value">{stats.pendingCount}</p>
                <p className="do-metric-label">Pending Cases</p>
                <p className="do-metric-hint">Awaiting action</p>
              </div>
              <div className="do-metric-icon" aria-hidden>
                <Clock size={24} strokeWidth={2} />
              </div>
            </div>
            <div className="do-metric-card do-metric-card--closed">
              <div className="do-metric-body">
                <p className="do-metric-value">{stats.closedCount}</p>
                <p className="do-metric-label">Closed Cases</p>
                <p className="do-metric-hint">This semester</p>
              </div>
              <div className="do-metric-icon" aria-hidden>
                <CheckCircle2 size={24} strokeWidth={2} />
              </div>
            </div>
          </section>

          <div className="do-home-split">
            <div className="do-panel">
              <div className="do-panel-header">
                <h2 className="do-panel-title">Recent Cases</h2>
                <p className="do-panel-sub">Latest disciplinary cases and their status</p>
              </div>
              <div className="do-panel-body" style={{ padding: "0 22px" }}>
                <div className="cases-table-wrapper" style={{ padding: "0 0 8px" }}>
                  <table className="cases-table">
                    <thead>
                      <tr>
                        <th>Case ID</th>
                        <th>Student Name</th>
                        <th>Case Type</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentCases.map((c) => (
                        <tr key={c.id}>
                          <td className="cell-case-id">{formatCaseId(c.id)}</td>
                          <td>
                            <p className="cell-student-name">{c.student}</p>
                            <p className="cell-student-id">{c.studentId}</p>
                          </td>
                          <td className="cell-text">{c.caseType}</td>
                          <td>
                            <DO_StatusBadge status={c.status} />
                          </td>
                          <td className="cell-date">{c.date}</td>
                          <td>
                            <button
                              className="btn-view"
                              type="button"
                              onClick={() => setSelectedCase(c)}
                            >
                              <Eye size={16} strokeWidth={2} aria-hidden />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                      {recentCases.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            style={{
                              textAlign: "center",
                              color: "#64748b",
                              padding: "28px 8px",
                              fontFamily: "'Inter', sans-serif",
                            }}
                          >
                            No cases yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="do-panel-footer">
                <button
                  type="button"
                  className="do-panel-btn"
                  onClick={() => navigate("/case-management")}
                >
                  View All Cases
                </button>
              </div>
            </div>

            <div className="do-panel">
              <div className="do-panel-header">
                <h2 className="do-panel-title">Upcoming Hearings</h2>
                <p className="do-panel-sub">Scheduled disciplinary hearings</p>
              </div>
              <div className="do-panel-body">
                {upcomingHearings.map((h) => (
                  <div key={h.conferenceId} className="do-hearing-item">
                    <p className="do-hearing-name">
                      {h.studentName}{" "}
                      <span style={{ color: "#64748b", fontWeight: 500 }}>/ {formatCaseId(h.caseId)}</span>
                    </p>
                    <p className="do-hearing-meta">
                      {h.dateLabel}
                      <br />
                      {h.timeLabel} • {h.location}
                    </p>
                  </div>
                ))}
                {upcomingHearings.length === 0 && (
                  <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>No upcoming hearings.</p>
                )}
              </div>
              <div className="do-panel-footer">
                <button
                  type="button"
                  className="do-panel-btn"
                  onClick={() => navigate("/case-conference")}
                >
                  View Full Calendar
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {selectedCase && selectedMeta && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="do-case-details-title"
          onMouseDown={() => setSelectedCase(null)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="do-modal-head">
              <button
                className="do-modal-x"
                type="button"
                aria-label="Close"
                onClick={() => setSelectedCase(null)}
              >
                ×
              </button>
              <div className="do-modal-head-row">
                <div className="do-modal-icon-wrap" aria-hidden>
                  <FileText size={22} strokeWidth={2} />
                </div>
                <div>
                  <h2 id="do-case-details-title" className="do-modal-heading">
                    Case Details
                  </h2>
                  <p className="do-modal-sub">Complete information about the disciplinary case</p>
                </div>
              </div>
            </div>

            <div className="do-modal-body-scroll">
              <div className="do-case-banner">
                <div>
                  <p className="do-case-banner-id">{formatCaseId(selectedCase.id)}</p>
                  <p className="do-case-banner-type">{selectedCase.caseType}</p>
                </div>
                <div className="do-banner-badges">
                  <DO_StatusBadge status={selectedCase.status} />
                </div>
              </div>

              <div className="do-info-grid">
                <div className="do-info-card">
                  <div className="do-info-card-top">
                    <User size={18} strokeWidth={2} aria-hidden />
                    Student Information
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Name</p>
                    <p className="do-info-dd">{selectedCase.student}</p>
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Student ID</p>
                    <p className="do-info-dd">{selectedCase.studentId}</p>
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Program</p>
                    <p className="do-info-dd">{selectedMeta.program}</p>
                  </div>
                </div>
                <div className="do-info-card">
                  <div className="do-info-card-top">
                    <FileText size={18} strokeWidth={2} aria-hidden />
                    Case Information
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Filed Date</p>
                    <p className="do-info-dd">{selectedCase.date}</p>
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Assigned To</p>
                    <p className="do-info-dd">{selectedCase.officer || "—"}</p>
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Next Hearing</p>
                    <p className="do-info-dd">—</p>
                  </div>
                </div>
              </div>

              <div className="do-section-card">
                <h4>Case Description</h4>
                <p>{selectedMeta.body || "No description provided."}</p>
              </div>

              <div className="do-section-card">
                <h4>Evidence Submitted</h4>
                {evidenceToTags(selectedCase.evidence).length > 0 ? (
                  <div className="do-evidence-tags">
                    {evidenceToTags(selectedCase.evidence).map((tag) => (
                      <span key={tag} className="do-evidence-tag">
                        <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "#64748b", fontSize: 14 }}>No evidence listed.</p>
                )}
              </div>

              <div className="do-form-stack" style={{ display: "none" }}>
                <div className="do-form-actions-inline">
                  <label className="do-form-label" htmlFor="dash-status-upd">
                    Status
                  </label>
                  <select
                    id="dash-status-upd"
                    className="cc-input"
                    value={statusUpdate}
                    onChange={(e) => setStatusUpdate(e.target.value)}
                  >
                    <option value="new">new</option>
                    <option value="pending">pending</option>
                    <option value="closed">closed</option>
                  </select>
                </div>
                <div className="do-form-actions-inline" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="dash-status-note">
                    Notes (optional)
                  </label>
                  <textarea
                    id="dash-status-note"
                    className="cc-textarea"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Add an update note…"
                  />
                </div>
              </div>
            </div>

            {caseModalError && (
              <div className="cc-form-error" role="alert" style={{ display: "none", padding: "0 22px 12px" }}>
                {caseModalError}
              </div>
            )}
            <div className="cc-modal-actions">
              <button
                className="cc-btn-secondary"
                type="button"
                onClick={() => setSelectedCase(null)}
              >
                Close
              </button>
              <button
                className="cc-btn-primary"
                type="button"
                style={{ display: "none" }}
                onClick={async () => {
                  setCaseModalError(null);
                  try {
                    await updateCaseStatus(selectedCase.id, statusUpdate, statusNote);
                    setSelectedCase(null);
                  } catch (err) {
                    setCaseModalError(
                      err?.message || "Could not update case. Check Supabase and try again.",
                    );
                  }
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isNewCaseOpen && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="do-new-case-title"
          onMouseDown={() => setIsNewCaseOpen(false)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="do-modal-head">
              <button
                className="do-modal-x"
                type="button"
                aria-label="Close"
                onClick={() => setIsNewCaseOpen(false)}
              >
                ×
              </button>
              <div className="do-modal-head-row">
                <div className="do-modal-icon-wrap do-modal-icon-wrap--accent" aria-hidden>
                  <Plus size={22} strokeWidth={2} />
                </div>
                <div>
                  <h2 id="do-new-case-title" className="do-modal-heading do-modal-heading--blue">
                    File New Disciplinary Case
                  </h2>
                  <p className="do-modal-sub">
                    Enter the details of the disciplinary case to be filed
                  </p>
                </div>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const nextErrors = {};
                const nmErr = validatePersonName(newCaseForm.student, "Student name");
                if (nmErr) nextErrors.student = nmErr;

                const sidErr = validateStrictNumericStudentId(newCaseForm.studentId, "Student ID");
                if (sidErr) nextErrors.studentId = sidErr;
                if (!newCaseForm.caseType) {
                  nextErrors.caseType = "Case type is required.";
                }
                if (!newCaseForm.school) {
                  nextErrors.school = "School is required.";
                }
                if (!newCaseForm.offenseType) {
                  nextErrors.offenseType = "Offense type is required.";
                }
                if (!newCaseForm.description.trim()) {
                  nextErrors.description = "Case description is required.";
                }
                if (!newCaseEvidence) {
                  nextErrors.evidence = "Attach an evidence document (PDF, Word, image, etc.).";
                }
                setNewCaseErrors(nextErrors);
                if (Object.keys(nextErrors).length > 0) return;

                try {
                  const caseDescription = [
                    newCaseForm.school ? `School: ${newCaseForm.school}` : "",
                    newCaseForm.offenseType ? `Offense Type: ${newCaseForm.offenseType}` : "",
                    newCaseForm.description,
                  ]
                    .filter(Boolean)
                    .join("\n\n");

                  await createCase({
                    student: newCaseForm.student,
                    studentId: newCaseForm.studentId,
                    caseType: newCaseForm.caseType,
                    description: caseDescription,
                    program: newCaseForm.program,
                    reportedBy: newCaseForm.reportedBy,
                    evidence: [
                      { name: newCaseEvidence.name, kind: "upload" },
                    ],
                    officer: "Discipline Office",
                  });
                  setIsNewCaseOpen(false);
                  setNewCaseForm({
                    student: "",
                    studentId: "",
                    school: "",
                    program: "",
                    caseType: "",
                    offenseType: "",
                    description: "",
                    reportedBy: "",
                  });
                  setNewCaseEvidence(null);
                  setNewCaseErrors({});
                } catch (err) {
                  setNewCaseErrors({
                    _submit: err?.message || "Could not create case. Check Supabase and try again.",
                  });
                }
              }}
            >
              <div className="do-modal-body-scroll do-form-stack">
                {newCaseErrors._submit && (
                  <div className="cc-form-error" role="alert" style={{ marginBottom: 12 }}>
                    {newCaseErrors._submit}
                  </div>
                )}

                <div className="do-form-grid2">
                  <div className="do-form-cell" style={{ marginBottom: 0 }}>
                    <label className="do-form-label" htmlFor="nf-student">
                      Student Name <span className="req">*</span>
                    </label>
                    <input
                      id="nf-student"
                      className={`cc-input${newCaseErrors.student ? " cc-input-error" : ""}`}
                      placeholder="Enter student name"
                      value={newCaseForm.student}
                      onChange={(e) =>
                        setNewCaseForm((p) => ({ ...p, student: sanitizePersonNameInput(e.target.value) }))
                      }
                      aria-invalid={Boolean(newCaseErrors.student)}
                    />
                    {newCaseErrors.student && (
                      <div className="cc-form-error" role="alert">
                        {newCaseErrors.student}
                      </div>
                    )}
                  </div>
                  <div className="do-form-cell" style={{ marginBottom: 0 }}>
                    <label className="do-form-label" htmlFor="nf-sid">
                      Student ID <span className="req">*</span>
                    </label>
                    <input
                      id="nf-sid"
                      className={`cc-input${newCaseErrors.studentId ? " cc-input-error" : ""}`}
                      placeholder="Numeric ID only (e.g., 202310234)"
                      value={newCaseForm.studentId}
                      onChange={(e) =>
                        setNewCaseForm((p) => ({ ...p, studentId: sanitizeDigitsOnlyInput(e.target.value) }))
                      }
                      aria-invalid={Boolean(newCaseErrors.studentId)}
                    />
                    {newCaseErrors.studentId && (
                      <div className="cc-form-error" role="alert">
                        {newCaseErrors.studentId}
                      </div>
                    )}
                  </div>
                </div>

                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="nf-school">
                    School <span className="req">*</span>
                  </label>
                  <CustomSelect
                    id="nf-school"
                    value={newCaseForm.school}
                    onChange={(v) => {
                      setNewCaseForm((p) => ({ ...p, school: v, program: "" }));
                      setOpenDropdownId(null);
                    }}
                    options={DO_SCHOOL_OPTIONS}
                    placeholder="Select school"
                    error={Boolean(newCaseErrors.school)}
                    isOpen={openDropdownId === "nf-school"}
                    onOpen={() => setOpenDropdownId("nf-school")}
                    onClose={() => setOpenDropdownId(null)}
                  />
                  {newCaseErrors.school && (
                    <div className="cc-form-error" role="alert">
                      {newCaseErrors.school}
                    </div>
                  )}
                </div>

                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="nf-program">
                    Program / Course
                  </label>
                  <CustomSelect
                    id="nf-program"
                    value={newCaseForm.program}
                    onChange={(v) => {
                      setNewCaseForm((p) => ({ ...p, program: v }));
                      setOpenDropdownId(null);
                    }}
                    options={newCaseForm.school ? getProgramsForSchool(newCaseForm.school) : NU_PROGRAM_OPTIONS}
                    placeholder="Select program / course"
                    error={false}
                    isOpen={openDropdownId === "nf-program"}
                    onOpen={() => setOpenDropdownId("nf-program")}
                    onClose={() => setOpenDropdownId(null)}
                  />
                </div>

                <div className="do-form-grid2">
                  <div className="do-form-cell" style={{ marginBottom: 0 }}>
                    <label className="do-form-label" htmlFor="nf-ctype">
                      Case Type <span className="req">*</span>
                    </label>
                    <CustomSelect
                      id="nf-ctype"
                      value={newCaseForm.caseType}
                      onChange={(v) => {
                        setNewCaseForm((p) => ({ ...p, caseType: v }));
                        setOpenDropdownId(null);
                      }}
                      options={newCaseForm.offenseType
                        ? getCaseTypesForOffenseType(newCaseForm.offenseType)
                        : CASE_TYPE_OPTIONS}
                      placeholder="Select case type"
                      error={Boolean(newCaseErrors.caseType)}
                      isOpen={openDropdownId === "nf-ctype"}
                      onOpen={() => setOpenDropdownId("nf-ctype")}
                      onClose={() => setOpenDropdownId(null)}
                    />
                    {newCaseErrors.caseType && (
                      <div className="cc-form-error" role="alert">
                        {newCaseErrors.caseType}
                      </div>
                    )}
                  </div>
                  <div className="do-form-cell" style={{ marginBottom: 0 }}>
                    <label className="do-form-label" htmlFor="nf-offense-type">
                      Offense Type <span className="req">*</span>
                    </label>
                    <CustomSelect
                      id="nf-offense-type"
                      value={newCaseForm.offenseType}
                      onChange={(v) => {
                        setNewCaseForm((p) => ({ ...p, offenseType: v, caseType: "" }));
                        setOpenDropdownId(null);
                      }}
                      options={DO_OFFENSE_TYPE_OPTIONS}
                      placeholder="Select offense type"
                      error={Boolean(newCaseErrors.offenseType)}
                      isOpen={openDropdownId === "nf-offense-type"}
                      onOpen={() => setOpenDropdownId("nf-offense-type")}
                      onClose={() => setOpenDropdownId(null)}
                    />
                    {newCaseErrors.offenseType && (
                      <div className="cc-form-error" role="alert">
                        {newCaseErrors.offenseType}
                      </div>
                    )}
                  </div>
                </div>

                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="nf-desc">
                    Case Description <span className="req">*</span>
                  </label>
                  <textarea
                    id="nf-desc"
                    className={`cc-textarea${newCaseErrors.description ? " cc-input-error" : ""}`}
                    placeholder="Provide detailed description of the incident…"
                    value={newCaseForm.description}
                    onChange={(e) =>
                      setNewCaseForm((p) => ({ ...p, description: e.target.value }))
                    }
                    aria-invalid={Boolean(newCaseErrors.description)}
                  />
                  {newCaseErrors.description && (
                    <div className="cc-form-error" role="alert">
                      {newCaseErrors.description}
                    </div>
                  )}
                </div>

                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="nf-reporter">
                    Reported By
                  </label>
                  <input
                    id="nf-reporter"
                    className="cc-input"
                    placeholder="Name of reporting person/office"
                    value={newCaseForm.reportedBy}
                    onChange={(e) =>
                      setNewCaseForm((p) => ({ ...p, reportedBy: e.target.value }))
                    }
                  />
                </div>

                <div className="do-form-cell do-file-field" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="nf-ev">
                    Evidence / Documents <span className="req">*</span>
                  </label>
                  <input
                    id="nf-ev"
                    className={`cc-input${newCaseErrors.evidence ? " cc-input-error" : ""}`}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,image/*,.eml,application/pdf"
                    onChange={(e) => {
                      setNewCaseEvidence(e.target.files?.[0] || null);
                      setNewCaseErrors((err) => {
                        const next = { ...err };
                        delete next.evidence;
                        return next;
                      });
                    }}
                    aria-invalid={Boolean(newCaseErrors.evidence)}
                  />
                  {newCaseEvidence ? (
                    <p className="do-file-name">Selected: {newCaseEvidence.name}</p>
                  ) : (
                    <p className="do-file-name">Upload supporting documents only.</p>
                  )}
                  {newCaseErrors.evidence && (
                    <div className="cc-form-error" role="alert">
                      {newCaseErrors.evidence}
                    </div>
                  )}
                </div>
              </div>

              <div className="cc-modal-actions">
                <button
                  className="cc-btn-secondary"
                  type="button"
                  onClick={() => setIsNewCaseOpen(false)}
                >
                  Cancel
                </button>
                <button className="cc-btn-primary" type="submit">
                  File Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};



const TABS = [
  { key: "all", label: (cases) => `All Cases (${cases.length})` },
  {
    key: "new",
    label: (cases) =>
      `New / Unreviewed (${cases.filter((c) => c.status === "new").length})`,
  },
  {
    key: "pending",
    label: (cases) =>
      `Pending (${cases.filter((c) => c.status === "pending").length})`,
  },
  {
    key: "closed",
    label: (cases) =>
      `Closed (${cases.filter((c) => c.status === "closed").length})`,
  },
];

const CM_StatusBadge = ({ status }) => (
  <span className={`badge badge-${status}`}>{status}</span>
);

export function CaseManagementPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilterIso, setDateFilterIso] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [searchField, setSearchField] = useState("all");
  const {
    cases,
    loading: casesLoading,
    fetchError: casesError,
    refresh: refreshCases,
    createCase,
    updateCaseStatus,
  } = useCases([]);

  const [newCaseForm, setNewCaseForm] = useState({
    student: "",
    studentId: "",
    program: "",
    caseType: "",
    description: "",
  });
  const [newCaseEvidence, setNewCaseEvidence] = useState(null);
  const [newCaseErrors, setNewCaseErrors] = useState({});
  const [statusUpdate, setStatusUpdate] = useState("pending");
  const [statusNote, setStatusNote] = useState("");
  const [caseModalError, setCaseModalError] = useState(null);

  useEffect(() => {
    setCaseModalError(null);
  }, [selectedCase]);

  const departmentOptions = useMemo(() => {
    const set = new Set();
    for (const c of cases) {
      const p = String(c.program || "").trim();
      if (p) set.add(p);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [cases]);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "new" && c.status === "new") ||
        (activeTab === "pending" && c.status === "pending") ||
        (activeTab === "closed" && c.status === "closed");

      const q = search.toLowerCase();
      const matchesSearch = (() => {
        if (!q) return true;
        if (searchField === "caseId") return c.id.toLowerCase().includes(q);
        if (searchField === "studentName") return c.student.toLowerCase().includes(q);
        if (searchField === "program") return String(c.program || "").toLowerCase().includes(q);
        if (searchField === "caseType") return c.caseType.toLowerCase().includes(q);
        return c.student.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.caseType.toLowerCase().includes(q);
      })();

      const matchesStatus = !statusFilter || String(c.status) === statusFilter;
      const matchesDepartment =
        !departmentFilter || String(c.program || "").trim() === String(departmentFilter).trim();

      const matchesDate = (() => {
        if (!dateFilterIso) return true;
        const d =
          c.reportedAt ? new Date(c.reportedAt) : c.updatedAt ? new Date(c.updatedAt) : new Date(String(c.date || ""));
        if (Number.isNaN(d.getTime())) return false;
        const ck = dateKey(d);
        return ck === dateFilterIso;
      })();

      return matchesTab && matchesSearch && matchesStatus && matchesDepartment && matchesDate;
    });
  }, [cases, activeTab, search, searchField, statusFilter, departmentFilter, dateFilterIso]);

  const stats = useMemo(() => {
    return {
      total: cases.length,
      newCount: cases.filter((c) => c.status === "new").length,
      pending: cases.filter((c) => c.status === "pending").length,
      closed: cases.filter((c) => c.status === "closed").length,
    };
  }, [cases]);


  return (
    <div className="dashboard-layout do-office-layout">
      <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />

      <div className="dashboard-main">
        <DisciplineOfficeTopBar />

        <main className="dashboard-content do-office-shell">
          {(casesError || (casesLoading && cases.length === 0)) && (
            <div
              role="status"
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 10,
                background: casesError ? "#fef2f2" : "#f8fafc",
                border: `1px solid ${casesError ? "#fecaca" : "#e2e8f0"}`,
                color: casesError ? "#991b1b" : "#475569",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span>
                {casesError
                  ? `Could not load cases: ${casesError}`
                  : "Loading cases…"}
              </span>
              {casesError && (
                <button
                  type="button"
                  className="cc-btn-secondary"
                  style={{ height: 32, padding: "0 12px" }}
                  onClick={() => refreshCases()}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          <div className="page-title-row">
            <div>
              <h1>Case Management</h1>
              <p>Manage and track all disciplinary cases</p>
            </div>

            <button
              className="btn-new-case"
              type="button"
              onClick={() => setIsNewCaseOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 3.333v9.334M3.333 8h9.334"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              New Case
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-value total">{stats.total}</p>
              <p className="stat-label">Total Cases</p>
            </div>
            <div className="stat-card">
              <p className="stat-value new">{stats.newCount}</p>
              <p className="stat-label">New / Unreviewed</p>
            </div>
            <div className="stat-card">
              <p className="stat-value pending">{stats.pending}</p>
              <p className="stat-label">Pending</p>
            </div>
            <div className="stat-card">
              <p className="stat-value closed">{stats.closed}</p>
              <p className="stat-label">Closed</p>
            </div>
          </div>

          <div className="cases-panel">
            <div className="cases-panel-header">
              <div className="cases-panel-top">
                <div className="cases-panel-title">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M16.667 2.5H3.333C2.413 2.5 1.667 3.246 1.667 4.167v11.666c0 .92.746 1.667 1.666 1.667h13.334c.92 0 1.666-.746 1.666-1.667V4.167c0-.92-.746-1.667-1.666-1.667z"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M6.667 7.5h6.666M6.667 10.833h4.166"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  All Cases
                </div>
              </div>

              <div className="confidential-notice">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle
                    cx="6"
                    cy="6"
                    r="5"
                    stroke="#f54900"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M6 4v2.5M6 8h.006"
                    stroke="#f54900"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
                Confidential - Handle with discretion
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 0 }}>
                <select
                  className="cc-input"
                  style={{ width: 140, height: 36, flexShrink: 0 }}
                  value={searchField}
                  onChange={(e) => setSearchField(e.target.value)}
                  aria-label="Search by field"
                >
                  <option value="all">All Fields</option>
                  <option value="caseId">Case ID</option>
                  <option value="studentName">Student Name</option>
                  <option value="program">Program</option>
                  <option value="caseType">Case Type</option>
                </select>
                <div className="search-bar-wrapper" style={{ flex: 1, marginBottom: 0 }}>
                <span className="search-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle
                      cx="7.333"
                      cy="7.333"
                      r="4.667"
                      stroke="#64748b"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M14 14l-2.667-2.667"
                      stroke="#64748b"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <input
                  type="text"
                  className="search-input"
                  placeholder={
                    searchField === "caseId" ? "Search by case ID…" :
                    searchField === "studentName" ? "Search by student name…" :
                    searchField === "program" ? "Search by program…" :
                    searchField === "caseType" ? "Search by case type…" :
                    "Search cases…"
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                </div>
              </div>

              <div className="cc-filters-row" aria-label="Case filters">
                <div className="cc-filter">
                  <label htmlFor="cm-filter-status">Status</label>
                  <select
                    id="cm-filter-status"
                    className="cc-input"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="new">New / Unreviewed</option>
                    <option value="pending">Pending</option>
                    <option value="closed">Completed</option>
                  </select>
                </div>
                <div className="cc-filter">
                  <label htmlFor="cm-filter-date">Date</label>
                  <input
                    id="cm-filter-date"
                    type="date"
                    className="cc-input"
                    value={dateFilterIso}
                    onChange={(e) => setDateFilterIso(e.target.value)}
                  />
                </div>
                <div className="cc-filter">
                  <label htmlFor="cm-filter-dept">Department</label>
                  <select
                    id="cm-filter-dept"
                    className="cc-input"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                  >
                    <option value="">All</option>
                    {departmentOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="tab-list">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    className={`tab-btn${activeTab === tab.key ? " tab-active" : ""}`}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label(cases)}
                  </button>
                ))}
              </div>
            </div>

            <div className="cases-table-wrapper">
              <table className="cases-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Student</th>
                    <th>Case Type</th>
                    <th>Status</th>
                    <th>Reported Date</th>
                    <th>Reporting Officer</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td className="cell-case-id">{formatCaseId(c.id)}</td>
                      <td>
                        <p className="cell-student-name">{c.student}</p>
                        <p className="cell-student-id">{c.studentId}</p>
                      </td>
                      <td className="cell-text">{c.caseType}</td>
                      <td>
                        <CM_StatusBadge status={c.status} />
                      </td>
                      <td className="cell-date">{c.date}</td>
                      <td className="cell-text">{c.officer}</td>
                      <td>
                        <button
                          className="btn-view"
                          type="button"
                          onClick={() => {
                            setSelectedCase(c);
                            setStatusUpdate(c.status);
                            setStatusNote("");
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M1.333 8S3.333 3.333 8 3.333 14.667 8 14.667 8 12.667 12.667 8 12.667 1.333 8 1.333 8z"
                              stroke="#374151"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle
                              cx="8"
                              cy="8"
                              r="1.667"
                              stroke="#374151"
                              strokeWidth="1.5"
                            />
                          </svg>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          color: "#64748b",
                          padding: "32px 8px",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        No cases found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {selectedCase && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setSelectedCase(null)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ display: "flex", flexDirection: "column", maxHeight: "min(90vh, 760px)" }}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">Case Details</div>
              <button
                className="cc-modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setSelectedCase(null)}
              >
                ✕
              </button>
            </div>

            <div className="cc-modal-body" style={{ display: "flex", flexDirection: "column", gap: 0, overflowY: "auto", flex: 1, minHeight: 0 }}>
              {/* Case ID + Status row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div className="cc-label">Case ID</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "#0f172a", marginTop: 2 }}>
                    {formatCaseId(selectedCase.id)}
                  </div>
                </div>
                <CM_StatusBadge status={selectedCase.status} />
              </div>

              {/* Divider */}
              <div style={{ borderTop: "1px solid #e2e8f0", marginBottom: 16 }} />

              {/* Student info group */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Student Information
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
                  <div>
                    <div className="cc-label">Name</div>
                    <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 4 }}>{selectedCase.student}</div>
                  </div>
                  <div>
                    <div className="cc-label">Student ID</div>
                    <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 4 }}>{selectedCase.studentId}</div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: "1px solid #f1f5f9", marginBottom: 16 }} />

              {/* Case info group */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Case Information
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginBottom: 12 }}>
                  <div>
                    <div className="cc-label">Case Type</div>
                    <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 4 }}>{selectedCase.caseType}</div>
                  </div>
                  <div>
                    <div className="cc-label">Reporting Officer</div>
                    <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 4 }}>{selectedCase.officer || "—"}</div>
                  </div>
                </div>
                <div>
                  <div className="cc-label">Case Description</div>
                  <div style={{ color: "#334155", fontSize: 14, lineHeight: "20px", marginTop: 6, whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
                    {selectedCase.description || "No description provided."}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: "1px solid #f1f5f9", marginBottom: 16 }} />

              {/* Evidence */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Evidence Submitted
                </div>
                {selectedCase.evidence && selectedCase.evidence.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {selectedCase.evidence.map((ev, idx) => (
                      <div key={`${ev.name}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, fontSize: 13, color: "#166534", fontWeight: 500 }}>
                        <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
                        {ev.name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#94a3b8", fontSize: 14 }}>No evidence submitted.</div>
                )}
              </div>

              {/* Divider */}
              <div style={{ borderTop: "1px solid #e2e8f0", marginBottom: 16 }} />

              {/* Update status */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Update Case
                </div>
                <div className="cc-field" style={{ marginBottom: 12 }}>
                  <div className="cc-label">Status</div>
                  <select
                    className="cc-input"
                    value={statusUpdate}
                    onChange={(e) => setStatusUpdate(e.target.value)}
                  >
                    <option value="new">new</option>
                    <option value="pending">pending</option>
                    <option value="closed">closed</option>
                  </select>
                </div>
                <div className="cc-field">
                  <div className="cc-label">Notes (optional)</div>
                  <textarea
                    className="cc-textarea"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Add an update note for this case..."
                  />
                </div>
              </div>
            </div>

            {caseModalError && (
              <div className="cc-form-error" role="alert" style={{ padding: "0 20px 12px" }}>
                {caseModalError}
              </div>
            )}
            <div className="cc-modal-actions">
              <button
                className="cc-btn-secondary"
                type="button"
                onClick={() => setSelectedCase(null)}
              >
                Close
              </button>
              <button
                className="cc-btn-primary"
                type="button"
                onClick={async () => {
                  setCaseModalError(null);
                  try {
                    await updateCaseStatus(selectedCase.id, statusUpdate, statusNote);
                    setSelectedCase(null);
                  } catch (err) {
                    setCaseModalError(
                      err?.message || "Could not update case. Check Supabase and try again.",
                    );
                  }
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {isNewCaseOpen && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setIsNewCaseOpen(false)}
        >
          <div
            className="cc-modal do-modal do-modal--lg do-modal--new-case"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">New Case</div>
              <button
                className="cc-modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setIsNewCaseOpen(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const nextErrors = {};

                const nmErr = validatePersonName(newCaseForm.student, "Student name");
                if (nmErr) nextErrors.student = nmErr;

                const sidErr = validateStrictNumericStudentId(newCaseForm.studentId, "Student ID");
                if (sidErr) nextErrors.studentId = sidErr;
                if (!newCaseForm.caseType)
                  nextErrors.caseType = "Case Type is required.";
                if (!newCaseForm.description.trim())
                  nextErrors.description = "Description is required.";
                if (!newCaseEvidence)
                  nextErrors.evidence = "Evidence file is required.";

                setNewCaseErrors(nextErrors);
                if (Object.keys(nextErrors).length > 0) return;

                try {
                  await createCase({
                    student: newCaseForm.student,
                    studentId: newCaseForm.studentId,
                    caseType: newCaseForm.caseType,
                    description: newCaseForm.description,
                    program: newCaseForm.program,
                    evidence: [
                      {
                        name: newCaseEvidence.name,
                        kind: "upload",
                      },
                    ],
                    officer: "Discipline Office",
                  });

                  setIsNewCaseOpen(false);
                  setNewCaseForm({
                    student: "",
                    studentId: "",
                    program: "",
                    caseType: "",
                    description: "",
                  });
                  setNewCaseEvidence(null);
                  setNewCaseErrors({});
                } catch (err) {
                  setNewCaseErrors({
                    _submit: err?.message || "Could not create case. Check Supabase and try again.",
                  });
                }
              }}
            >
              <div className="cc-modal-body">
                {newCaseErrors._submit && (
                  <div className="cc-form-error" role="alert" style={{ marginBottom: 12 }}>
                    {newCaseErrors._submit}
                  </div>
                )}
                <div className="cc-modal-row">
                  <div className="cc-field">
                    <div className="cc-label">Student Name</div>
                    <input
                      className={`cc-input${
                        newCaseErrors.student ? " cc-input-error" : ""
                      }`}
                      placeholder="e.g., Michael Tan"
                      value={newCaseForm.student}
                      onChange={(e) =>
                        setNewCaseForm((prev) => ({
                          ...prev,
                          student: sanitizePersonNameInput(e.target.value),
                        }))
                      }
                      aria-invalid={Boolean(newCaseErrors.student)}
                    />
                    {newCaseErrors.student && (
                      <div className="cc-form-error" role="alert">
                        {newCaseErrors.student}
                      </div>
                    )}
                  </div>
                  <div className="cc-field">
                    <div className="cc-label">Student ID</div>
                    <input
                      className={`cc-input${
                        newCaseErrors.studentId ? " cc-input-error" : ""
                      }`}
                      placeholder="2023-12345"
                      value={newCaseForm.studentId}
                      onChange={(e) =>
                        setNewCaseForm((prev) => ({
                          ...prev,
                          studentId: sanitizeDigitsOnlyInput(e.target.value),
                        }))
                      }
                      aria-invalid={Boolean(newCaseErrors.studentId)}
                    />
                    {newCaseErrors.studentId && (
                      <div className="cc-form-error" role="alert">
                        {newCaseErrors.studentId}
                      </div>
                    )}
                  </div>
                </div>

                <div className="cc-modal-row">
                  <div className="cc-field">
                    <div className="cc-label">Program / Course</div>
                    <ProgramSelect
                      value={newCaseForm.program}
                      onChange={(v) =>
                        setNewCaseForm((prev) => ({
                          ...prev,
                          program: v,
                        }))
                      }
                      options={NU_PROGRAM_OPTIONS}
                    />
                  </div>
                </div>

                <div className="cc-modal-row">
                  <div className="cc-field">
                    <div className="cc-label">Case Type</div>
                    <select
                      className={`cc-input${
                        newCaseErrors.caseType ? " cc-input-error" : ""
                      }`}
                      value={newCaseForm.caseType}
                      onChange={(e) =>
                        setNewCaseForm((prev) => ({
                          ...prev,
                          caseType: e.target.value,
                        }))
                      }
                      aria-invalid={Boolean(newCaseErrors.caseType)}
                    >
                      <option value="">Select case type</option>
                      {CASE_TYPE_OPTIONS.map((opt) => (
                        <option value={opt} key={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    {newCaseErrors.caseType && (
                      <div className="cc-form-error" role="alert">
                        {newCaseErrors.caseType}
                      </div>
                    )}
                  </div>
                </div>

                <div className="cc-field">
                  <div className="cc-label">Case Description *</div>
                  <textarea
                    className="cc-textarea"
                    placeholder="Provide a detailed description of the incident…"
                    value={newCaseForm.description}
                    onChange={(e) =>
                      setNewCaseForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    aria-invalid={Boolean(newCaseErrors.description)}
                  />
                  {newCaseErrors.description && (
                    <div className="cc-form-error" role="alert">
                      {newCaseErrors.description}
                    </div>
                  )}
                </div>

                <div className="cc-field" style={{ marginTop: 12 }}>
                  <div className="cc-label">Evidence / Documents *</div>
                  <input
                    className={`cc-input${
                      newCaseErrors.evidence ? " cc-input-error" : ""
                    }`}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.eml,image/*,application/pdf"
                    onChange={(e) => setNewCaseEvidence(e.target.files?.[0] || null)}
                    aria-invalid={Boolean(newCaseErrors.evidence)}
                  />
                  {newCaseEvidence && (
                    <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
                      Selected: <span style={{ color: "#0f172a" }}>{newCaseEvidence.name}</span>
                    </div>
                  )}
                  {newCaseErrors.evidence && (
                    <div className="cc-form-error" role="alert">
                      {newCaseErrors.evidence}
                    </div>
                  )}
                </div>
              </div>

              <div className="cc-modal-actions">
                <button
                  className="cc-btn-secondary"
                  type="button"
                  onClick={() => setIsNewCaseOpen(false)}
                >
                  Cancel
                </button>
                <button className="cc-btn-primary" type="submit">
                  Create Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};



/** Predefined hearing slots only — no free-text times. */
const HEARING_TIME_OPTIONS = [
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
];

const ConferencePill = ({ conference, status: statusProp }) => {
  const status = conference ? effectiveConferenceStatus(conference) : String(statusProp || "scheduled").toLowerCase();
  const cls =
    status === "completed" ? "completed" : status === "cancelled" ? "cancelled" : "scheduled";
  const label =
    status === "completed" && conference && String(conference.status || "").toLowerCase() === "scheduled"
      ? "Completed (past date)"
      : status;
  return <span className={`cc-pill ${cls}`}>{label}</span>;
};

export function CaseConferencePage() {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedConference, setSelectedConference] = useState(null);
  const [scheduleEditId, setScheduleEditId] = useState(null);

  const {
    conferences,
    loading: confLoading,
    fetchError: confFetchError,
    refresh: refreshConferences,
    insertConference,
    updateConference,
  } = useCaseConferences(DO_CONFERENCES_SEED);
  const {
    cases,
    loading: casesLoading,
    fetchError: casesFetchError,
    refresh: refreshCases,
  } = useCases([]);

  const caseOptions = useMemo(() => {
    const map = new Map();
    for (const c of cases) {
      map.set(c.id, {
        caseId: c.id,
        caseTitle: c.caseType,
        studentName: c.student,
        studentId: c.studentId,
      });
    }
    for (const conf of conferences) {
      if (!map.has(conf.caseId)) {
        map.set(conf.caseId, {
          caseId: conf.caseId,
          caseTitle: conf.caseTitle,
          studentName: conf.studentName,
          studentId: conf.studentId,
        });
      }
    }
    return Array.from(map.values());
  }, [cases, conferences]);

  const [scheduleForm, setScheduleForm] = useState({
    caseId: "",
    dateIso: toDateInputValue(new Date()),
    time: "10:00 AM",
    duration: "1 hour",
    location: "",
    attendees: "",
    notes: "",
  });

  const defaultCaseId = caseOptions[0]?.caseId || "";

  useEffect(() => {
    if (!defaultCaseId) return;
    setScheduleForm((prev) => {
      if (prev.caseId && caseOptions.some((x) => x.caseId === prev.caseId)) return prev;
      return { ...prev, caseId: defaultCaseId };
    });
  }, [defaultCaseId, caseOptions]);

  const [scheduleErrors, setScheduleErrors] = useState({});
  const openReschedule = useCallback(
    (conf) => {
      const d = parseConferenceDate(conf) || new Date();
      const attendeeText = Array.isArray(conf?.attendees) ? conf.attendees.join(", ") : "";
      setScheduleEditId(String(conf.conferenceId));
      setScheduleErrors({});
      setScheduleForm({
        caseId: conf.caseId || defaultCaseId,
        dateIso: toDateInputValue(d),
        time: conf.timeLabel || "10:00 AM",
        duration: conf.durationLabel || "1 hour",
        location: conf.location || "",
        attendees: attendeeText,
        notes: conf.notes || "",
      });
      setIsScheduleOpen(true);
    },
    [defaultCaseId],
  );

  const dataFetchError = confFetchError || casesFetchError;
  const dataLoading = confLoading || casesLoading;

  const stats = useMemo(() => {
    const eff = (c) => effectiveConferenceStatus(c);
    const scheduled = conferences.filter((c) => eff(c) === "scheduled").length;
    const completed = conferences.filter((c) => eff(c) === "completed").length;
    const cancelled = conferences.filter((c) => eff(c) === "cancelled").length;
    const today = new Date();
    const w0 = startOfWeekSunday(today);
    const w1 = endOfWeekSunday(today);
    const thisWeek = conferences.filter((c) => {
      if (eff(c) !== "scheduled") return false;
      const d = parseConferenceDate(c);
      return d && d >= w0 && d <= w1;
    }).length;
    return { scheduled, thisWeek, completed, cancelled };
  }, [conferences]);

  const eventsByDateKey = useMemo(() => {
    const map = new Map();
    for (const c of conferences) {
      if (effectiveConferenceStatus(c) !== "scheduled") continue;
      const d = parseConferenceDate(c);
      if (!d) continue;
      const key = dateKey(d);
      map.set(key, [...(map.get(key) || []), c]);
    }
    return map;
  }, [conferences]);

  const upcomingInWindow = useMemo(() => {
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    const t1 = new Date(t0);
    t1.setDate(t1.getDate() + 8);
    return conferences
      .filter((c) => {
        if (effectiveConferenceStatus(c) !== "scheduled") return false;
        const d = parseConferenceDate(c);
        if (!d) return false;
        const day = new Date(d);
        day.setHours(0, 0, 0, 0);
        return day > t0 && day < t1;
      })
      .sort((a, b) => {
        const da = parseConferenceDate(a);
        const db = parseConferenceDate(b);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      });
  }, [conferences]);

  const upcoming = upcomingInWindow[0] || null;

  const conferenceList = useMemo(() => {
    return [...conferences].sort((a, b) => {
      const da = parseConferenceDate(a);
      const db = parseConferenceDate(b);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });
  }, [conferences]);

  const calendarCells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  const activeEvents = useMemo(() => {
    const key = dateKey(selectedDate);
    return eventsByDateKey.get(key) || [];
  }, [eventsByDateKey, selectedDate]);

  const monthTitle = viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayKeyStr = dateKey(new Date());
  /** Scheduled conferences on today's calendar date — right-column "Today" list opens the same details modal as View Details. */
  const todayConferences = useMemo(() => eventsByDateKey.get(todayKeyStr) || [], [eventsByDateKey, todayKeyStr]);
  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  const goMonth = (delta) => {
    setViewMonth((prev) => {
      const n = new Date(prev);
      n.setMonth(n.getMonth() + delta);
      return n;
    });
  };

  return (
    <div className="dashboard-layout do-office-layout">
      <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />

      <div className="dashboard-main">
        <DisciplineOfficeTopBar />

        <main className="dashboard-content do-office-shell">
          {(dataFetchError || dataLoading) && (
            <div
              role="status"
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: dataFetchError ? "#fef2f2" : "#f8fafc",
                border: `1px solid ${dataFetchError ? "#fecaca" : "#e2e8f0"}`,
                color: dataFetchError ? "#991b1b" : "#475569",
                fontSize: 14,
              }}
            >
              {dataFetchError
                ? `Could not load data: ${dataFetchError}`
                : "Loading conferences and cases…"}
              {dataFetchError && (
                <button
                  type="button"
                  className="cc-btn-secondary"
                  style={{ marginLeft: 12, height: 30 }}
                  onClick={() => {
                    refreshConferences();
                    refreshCases();
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          <div className="page-title-row">
            <div>
              <h1>Case Conference Schedule</h1>
              <p>Manage and track disciplinary hearings</p>
            </div>
            <button
              className="cc-schedule-btn"
              type="button"
              onClick={() => setIsScheduleOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 2.667V13.333M2.667 8H13.333"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Schedule Hearing
            </button>
          </div>

          <div className="stats-grid do-cc-stats">
            <div className="stat-card">
              <p className="stat-value total">{stats.scheduled}</p>
              <p className="stat-label">Scheduled Conference</p>
            </div>
            <div className="stat-card">
              <p className="stat-value new">{stats.thisWeek}</p>
              <p className="stat-label">This Week</p>
            </div>
            <div className="stat-card">
              <p className="stat-value ongoing">{stats.completed}</p>
              <p className="stat-label">Completed</p>
            </div>
            <div className="stat-card">
              <p className="stat-value closed">{stats.cancelled}</p>
              <p className="stat-label">Cancelled</p>
            </div>
          </div>

          <div className="cc-two-column">
            <section className="cc-col-main cc-card">
              <div className="cc-card-header">
                <div className="cc-calendar-head">
                  <div className="cc-month-nav">
                    <button className="cc-icon-btn" type="button" aria-label="Previous month" onClick={() => goMonth(-1)}>
                      ‹
                    </button>
                    <div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontWeight: 500,
                          color: "#0f172a",
                          fontSize: 16,
                          lineHeight: "20px",
                        }}
                      >
                        {monthTitle}
                      </div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          color: "#64748b",
                          fontSize: 12,
                        }}
                      >
                        Click on a date to view conference
                      </div>
                    </div>
                    <button className="cc-icon-btn" type="button" aria-label="Next month" onClick={() => goMonth(1)}>
                      ›
                    </button>
                  </div>
                </div>

                <div className="cc-weekdays" aria-hidden="true">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div className="cc-weekday" key={d}>
                      {d}
                    </div>
                  ))}
                </div>
              </div>

              <div className="cc-card-body">
                <div className="cc-calendar-grid">
                  {calendarCells.map((cell, idx) => {
                    if (cell === null) {
                      return <div key={`pad-${idx}`} className="cc-day cc-day--pad" aria-hidden />;
                    }
                    const day = cell.getDate();
                    const key = dateKey(cell);
                    const hasEvent = eventsByDateKey.has(key);
                    const selected = key === dateKey(selectedDate);
                    const isToday = key === todayKeyStr;
                    const cls = [
                      "cc-day",
                      hasEvent ? "has-event" : "",
                      selected ? "selected" : "",
                      isToday && !selected ? "today" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <button
                        key={key}
                        type="button"
                        className={cls}
                        onClick={() => setSelectedDate(new Date(cell))}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div className="cc-calendar-legend">
                  <div className="cc-legend-item">
                    <span className="cc-legend-swatch cc-legend-swatch--today" aria-hidden />
                    Today
                  </div>
                  <div className="cc-legend-item">
                    <span className="cc-legend-swatch cc-legend-swatch--event" aria-hidden />
                    Has Conference
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 500,
                      color: "#0f172a",
                      fontSize: 14,
                    }}
                  >
                    {activeEvents.length > 0 ? "Conferences on selected date" : "No conference"}
                  </div>
                  {activeEvents.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                      {activeEvents.map((c) => (
                        <button
                          key={c.conferenceId}
                          type="button"
                          className="cc-conf-list-row"
                          onClick={() => setSelectedConference(c)}
                        >
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{formatCaseId(c.caseId)}</div>
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                            {c.timeLabel} • {c.location}
                          </div>
                          <div style={{ color: "#155dfc", fontSize: 12, marginTop: 6 }}>Open to update status</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className="cc-col-side">
              <div className="cc-card" style={{ marginBottom: 16 }}>
                <div className="cc-card-header">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 500,
                      color: "#0f172a",
                      fontSize: 16,
                    }}
                  >
                    <CalendarDays size={18} strokeWidth={2} aria-hidden />
                    Today
                  </div>
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: 12, lineHeight: 1.45 }}>
                    <span style={{ color: "#0f172a", fontWeight: 500 }}>{todayFormatted}</span>
                    <span aria-hidden> · </span>
                    Tap a row to mark completed or cancelled
                  </div>
                </div>
                <div className="cc-card-body">
                  {todayConferences.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: 14 }}>No conferences scheduled for today.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {todayConferences.map((c) => (
                        <button
                          key={c.conferenceId}
                          type="button"
                          className="cc-conf-list-row"
                          onClick={() => setSelectedConference(c)}
                        >
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{formatCaseId(c.caseId)}</div>
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                            {c.timeLabel} • {c.location}
                          </div>
                          <div style={{ color: "#155dfc", fontSize: 12, marginTop: 6 }}>View details and status</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="cc-card">
                <div className="cc-card-header">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 500,
                      color: "#0f172a",
                      fontSize: 16,
                    }}
                  >
                    <Clock size={18} strokeWidth={2} aria-hidden />
                    Upcoming Conference
                  </div>
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                    <span style={{ color: "#0f172a", fontWeight: 500 }}>{todayFormatted}</span>
                    <span aria-hidden> · </span>
                    Next 7 days
                  </div>
                </div>
                <div className="cc-card-body">
                  {upcoming ? (
                    <div className="cc-upcoming-item">
                      <ConferencePill conference={upcoming} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          {upcoming.studentName || upcoming.caseTitle}
                        </div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>
                          {formatCaseId(upcoming.caseId)} • {upcoming.dateLabel}
                        </div>
                        <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                          {upcoming.timeLabel} • {upcoming.location}
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <button
                            className="cc-btn-secondary"
                            type="button"
                            onClick={() => setSelectedConference(upcoming)}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "#64748b", fontSize: 14 }}>No upcoming conference</div>
                  )}
                </div>
              </div>
            </aside>
          </div>

          <section className="cc-card" style={{ marginTop: 24 }}>
            <div className="cc-card-header">
              <div
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  color: "#0f172a",
                  fontSize: 16,
                }}
              >
                All Scheduled Case Conference
              </div>
              <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                Complete list of conference
              </div>
            </div>
            <div className="cc-table-wrapper">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Case Type</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {conferenceList.map((c) => (
                    <tr key={c.conferenceId}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {c.studentName || "—"}{" "}
                          <ConferencePill conference={c} />
                        </div>
                        <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                          {c.studentId} • {formatCaseId(c.caseId)}
                        </div>
                      </td>
                      <td>{c.caseTitle}</td>
                      <td>{c.dateLabel}</td>
                      <td>{c.timeLabel}</td>
                      <td>{c.location}</td>
                      <td>
                        <button
                          className="cc-btn-secondary"
                          type="button"
                          onClick={() => setSelectedConference(c)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {isScheduleOpen && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cc-schedule-title"
          onMouseDown={() => setIsScheduleOpen(false)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="do-modal-head">
              <button
                className="do-modal-x"
                type="button"
                aria-label="Close"
                onClick={() => setIsScheduleOpen(false)}
              >
                ×
              </button>
              <div className="do-modal-head-row">
                <div className="do-modal-icon-wrap" aria-hidden>
                  <CalendarDays size={22} strokeWidth={2} />
                </div>
                <div>
                  <h2 id="cc-schedule-title" className="do-modal-heading">
                    {scheduleEditId ? "Reschedule Case Conference" : "Schedule New Case Conference"}
                  </h2>
                  <p className="do-modal-sub">Set up a new disciplinary conference for a case</p>
                </div>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const nextErrors = {};
                const effectiveCaseId = scheduleForm.caseId || defaultCaseId;
                if (!effectiveCaseId) nextErrors.caseId = "Case is required.";
                if (!scheduleForm.dateIso?.trim()) nextErrors.date = "Date is required.";
                if (!HEARING_TIME_OPTIONS.includes(scheduleForm.time)) {
                  nextErrors.time = "Select a hearing time from the list.";
                }
                if (!scheduleForm.duration) nextErrors.duration = "Duration is required.";
                if (!scheduleForm.location.trim()) nextErrors.location = "Location is required.";

                setScheduleErrors(nextErrors);
                if (Object.keys(nextErrors).length > 0) return;

                const confDate = new Date(`${scheduleForm.dateIso}T12:00:00`);
                const day = confDate.getDate();
                const dateLabel = fromDateInputToLabel(scheduleForm.dateIso);

                const refCase =
                  conferences.find((x) => x.caseId === effectiveCaseId) ||
                  caseOptions.find((x) => x.caseId === effectiveCaseId) ||
                  {};

                const attendeeList = scheduleForm.attendees
                  .split(/[\n,]+/)
                  .map((s) => s.trim())
                  .filter(Boolean);

                try {
                  if (scheduleEditId) {
                    await updateConference(scheduleEditId, {
                      caseId: effectiveCaseId,
                      day,
                      dateLabel,
                      timeLabel: scheduleForm.time,
                      durationLabel: scheduleForm.duration,
                      location: scheduleForm.location,
                      attendees:
                        attendeeList.length > 0 ? attendeeList : ["Student", "Discipline Coordinator"],
                      notes: scheduleForm.notes.trim(),
                      presidingOfficer: "Ms. Arny Lynne Saragina",
                      status: "scheduled",
                    });
                    showToast("Conference rescheduled.", { variant: "success" });
                  } else {
                    await insertConference({
                      caseId: effectiveCaseId,
                      studentName: refCase.studentName || "Student",
                      studentId: refCase.studentId || "—",
                      caseTitle: refCase.caseTitle || refCase.caseType || effectiveCaseId,
                      day,
                      dateLabel,
                      timeLabel: scheduleForm.time,
                      durationLabel: scheduleForm.duration,
                      location: scheduleForm.location,
                      status: "scheduled",
                      attendees:
                        attendeeList.length > 0
                          ? attendeeList
                          : ["Student", "Discipline Coordinator"],
                      notes: scheduleForm.notes.trim(),
                      presidingOfficer: "Ms. Arny Lynne Saragina",
                    });
                    showToast("Conference scheduled.", { variant: "success" });
                  }
                  setIsScheduleOpen(false);
                  setScheduleEditId(null);
                  setScheduleErrors({});
                  setScheduleForm((prev) => ({
                    ...prev,
                    dateIso: toDateInputValue(new Date()),
                    notes: "",
                  }));
                } catch (err) {
                  showToast(err?.message || "Could not schedule conference.", { variant: "error" });
                }
              }}
            >
              <div className="do-modal-body-scroll do-form-stack">
                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="sch-case">
                    Case ID
                  </label>
                  <select
                    id="sch-case"
                    className={`cc-input${scheduleErrors.caseId ? " cc-input-error" : ""}`}
                    value={scheduleForm.caseId || defaultCaseId}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({
                        ...prev,
                        caseId: e.target.value,
                      }))
                    }
                    aria-invalid={Boolean(scheduleErrors.caseId)}
                  >
                    <option value="">Select case</option>
                    {caseOptions.map((c) => (
                      <option value={c.caseId} key={c.caseId}>
                        {formatCaseId(c.caseId)} — {c.caseTitle}
                      </option>
                    ))}
                  </select>
                  {scheduleErrors.caseId && (
                    <div className="cc-form-error" role="alert">
                      {scheduleErrors.caseId}
                    </div>
                  )}
                </div>

                <div className="do-form-grid2">
                  <div className="do-form-cell" style={{ marginBottom: 0 }}>
                    <label className="do-form-label" htmlFor="sch-date">
                      Date
                    </label>
                    <input
                      id="sch-date"
                      type="date"
                      className={`cc-input${scheduleErrors.date ? " cc-input-error" : ""}`}
                      value={scheduleForm.dateIso}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, dateIso: e.target.value }))
                      }
                      aria-invalid={Boolean(scheduleErrors.date)}
                    />
                    {scheduleErrors.date && (
                      <div className="cc-form-error" role="alert">
                        {scheduleErrors.date}
                      </div>
                    )}
                  </div>
                  <div className="do-form-cell" style={{ marginBottom: 0 }}>
                    <label className="do-form-label" htmlFor="sch-time">
                      Time
                    </label>
                    <select
                      id="sch-time"
                      className={`cc-input${scheduleErrors.time ? " cc-input-error" : ""}`}
                      value={HEARING_TIME_OPTIONS.includes(scheduleForm.time) ? scheduleForm.time : ""}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, time: e.target.value }))
                      }
                      aria-invalid={Boolean(scheduleErrors.time)}
                    >
                      <option value="">Select time</option>
                      {HEARING_TIME_OPTIONS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                    {scheduleErrors.time && (
                      <div className="cc-form-error" role="alert">
                        {scheduleErrors.time}
                      </div>
                    )}
                  </div>
                </div>

                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="sch-dur">
                    Duration
                  </label>
                  <select
                    id="sch-dur"
                    className={`cc-input${scheduleErrors.duration ? " cc-input-error" : ""}`}
                    value={scheduleForm.duration}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, duration: e.target.value }))
                    }
                  >
                    <option value="">Select duration</option>
                    {CONFERENCE_DURATION_OPTIONS.map((d) => (
                      <option value={d} key={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {scheduleErrors.duration && (
                    <div className="cc-form-error" role="alert">
                      {scheduleErrors.duration}
                    </div>
                  )}
                </div>

                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="sch-loc">
                    Location
                  </label>
                  <input
                    id="sch-loc"
                    className={`cc-input${scheduleErrors.location ? " cc-input-error" : ""}`}
                    placeholder="e.g., Case Room, Discipline Office"
                    value={scheduleForm.location}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, location: e.target.value }))
                    }
                    aria-invalid={Boolean(scheduleErrors.location)}
                  />
                  {scheduleErrors.location && (
                    <div className="cc-form-error" role="alert">
                      {scheduleErrors.location}
                    </div>
                  )}
                </div>

                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="sch-att">
                    Attendees
                  </label>
                  <textarea
                    id="sch-att"
                    className="cc-textarea"
                    placeholder="List all required attendees (student, officers, committee members)"
                    value={scheduleForm.attendees}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, attendees: e.target.value }))
                    }
                  />
                </div>

                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="sch-notes">
                    Notes
                  </label>
                  <textarea
                    id="sch-notes"
                    className="cc-textarea"
                    placeholder="Additional information or special instructions"
                    value={scheduleForm.notes}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="cc-modal-actions">
                <button
                  className="cc-btn-secondary"
                  type="button"
                  onClick={() => setIsScheduleOpen(false)}
                >
                  Cancel
                </button>
                <button className="cc-btn-primary" type="submit">
                  Schedule Hearing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedConference && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cc-conf-details-title"
          onMouseDown={() => setSelectedConference(null)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="do-modal-head">
              <button
                className="do-modal-x"
                type="button"
                aria-label="Close"
                onClick={() => setSelectedConference(null)}
              >
                ×
              </button>
              <div className="do-modal-head-row">
                <div className="do-modal-icon-wrap" aria-hidden>
                  <CalendarDays size={22} strokeWidth={2} />
                </div>
                <div>
                  <h2 id="cc-conf-details-title" className="do-modal-heading">
                    Case Conference Details
                  </h2>
                  <p className="do-modal-sub">Complete information about the scheduled conference</p>
                </div>
              </div>
            </div>

            <div className="do-modal-body-scroll">
              <div className="do-conf-banner">
                <div>
                  <p className="do-case-banner-id">{selectedConference.conferenceId}</p>
                  <p className="do-conf-banner-case">
                    Case: {formatCaseId(selectedConference.caseId)}
                  </p>
                </div>
                <ConferencePill conference={selectedConference} />
              </div>

              <div className="do-info-grid">
                <div className="do-info-card">
                  <div className="do-info-card-top">
                    <User size={18} strokeWidth={2} aria-hidden />
                    Student Information
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Name</p>
                    <p className="do-info-dd">{selectedConference.studentName || "—"}</p>
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Student ID</p>
                    <p className="do-info-dd">{selectedConference.studentId || "—"}</p>
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Case Type</p>
                    <p className="do-info-dd">{selectedConference.caseTitle}</p>
                  </div>
                </div>
                <div className="do-info-card">
                  <div className="do-info-card-top">
                    <CalendarDays size={18} strokeWidth={2} aria-hidden />
                    Conference Information
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Date</p>
                    <p className="do-info-dd">{selectedConference.dateLabel}</p>
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Time</p>
                    <p className="do-info-dd">{selectedConference.timeLabel}</p>
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Room</p>
                    <p className="do-info-dd">{selectedConference.location}</p>
                  </div>
                </div>
              </div>

              <div className="do-presiding">
                <p className="do-info-dt">Presiding Officer</p>
                <p className="do-info-dd">
                  {selectedConference.presidingOfficer || "Ms. Arny Lynne Saragina"}
                </p>
              </div>

              {selectedConference.notes ? (
                <div className="do-notes-callout">
                  <Info size={18} strokeWidth={2} aria-hidden />
                  <div>
                    <strong>Notes</strong>
                    <p>{selectedConference.notes}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="cc-modal-actions" style={{ flexWrap: "wrap", gap: 10 }}>
              <button
                className="cc-btn-secondary"
                type="button"
                onClick={() => setSelectedConference(null)}
              >
                Close
              </button>
              {String(selectedConference.status || "").toLowerCase() === "scheduled" ? (
                <>
                  <button
                    className="cc-btn-secondary"
                    type="button"
                    onClick={() => openReschedule(selectedConference)}
                  >
                    Reschedule
                  </button>
                  <button
                    className="cc-btn-primary"
                    type="button"
                    disabled={conferenceTimeState(selectedConference) !== "past"}
                    onClick={async () => {
                      try {
                        await updateConference(selectedConference.conferenceId, { status: "completed" });
                        setSelectedConference((prev) => (prev ? { ...prev, status: "completed" } : null));
                        await refreshConferences();
                        showToast("Conference marked completed.", { variant: "success" });
                      } catch (err) {
                        showToast(err?.message || "Could not mark conference completed.", { variant: "error" });
                      }
                    }}
                  >
                    Completed
                  </button>
                  <button
                    className="cc-btn-secondary"
                    type="button"
                    onClick={async () => {
                      try {
                        await updateConference(selectedConference.conferenceId, { status: "cancelled" });
                        setSelectedConference((prev) => (prev ? { ...prev, status: "cancelled" } : null));
                        await refreshConferences();
                        showToast("Conference cancelled.", { variant: "success" });
                      } catch (err) {
                        showToast(err?.message || "Could not cancel conference.", { variant: "error" });
                      }
                    }}
                  >
                    Cancelled
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



function categoryToDbFields(category) {
  if (category === "good_standing") return { status: "good", riskLevel: "low" };
  if (category === "high_risk") return { status: "active", riskLevel: "high" };
  return { status: "active", riskLevel: "medium" };
}

const StandingPill = ({ category }) => {
  const cls =
    category === "good_standing"
      ? "standing-good"
      : category === "high_risk"
        ? "standing-high"
        : "standing-probation";
  const label = STANDING_LABELS[category] || category;
  return <span className={`cc-pill ${cls}`}>{label}</span>;
};

export function StudentRecordsPage() {
  const { cases, loading: casesLoading } = useCases([]);
  const { records, loading: recordsLoading, fetchError, refresh, insertStudent, updateStudent } =
    useStudentRecords(DO_STUDENT_RECORDS_SEED);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);

  const [createForm, setCreateForm] = useState({
    studentName: "",
    studentId: "",
    program: "",
    notes: "",
  });
  const [createErrors, setCreateErrors] = useState({});

  const [manageCategory, setManageCategory] = useState("on_probation");
  const [manageNotes, setManageNotes] = useState("");
  const [manageSaving, setManageSaving] = useState(false);

  const mergedRows = useMemo(
    () => mergeStudentRecordsFromCases(cases, records),
    [cases, records],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mergedRows;
    return mergedRows.filter((r) => {
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.studentId.toLowerCase().includes(q) ||
        String(r.program).toLowerCase().includes(q)
      );
    });
  }, [search, mergedRows]);

  const stats = useMemo(() => {
    return {
      total: mergedRows.length,
      good: mergedRows.filter((r) => r.category === "good_standing").length,
      probation: mergedRows.filter((r) => r.category === "on_probation").length,
      high: mergedRows.filter((r) => r.category === "high_risk").length,
    };
  }, [mergedRows]);

  const loading = recordsLoading || casesLoading;

  return (
    <div className="dashboard-layout do-office-layout">
      <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />

      <div className="dashboard-main">
        <DisciplineOfficeTopBar />

        <main className="dashboard-content do-office-shell">
          {(fetchError || loading) && (
            <div
              role="status"
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: fetchError ? "#fef2f2" : "#f8fafc",
                border: `1px solid ${fetchError ? "#fecaca" : "#e2e8f0"}`,
                color: fetchError ? "#991b1b" : "#475569",
                fontSize: 14,
              }}
            >
              {fetchError ? `Could not load records: ${fetchError}` : "Loading student records…"}
              {fetchError && (
                <button
                  type="button"
                  className="cc-btn-secondary"
                  style={{ marginLeft: 12, height: 30 }}
                  onClick={() => refresh()}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          <div className="page-title-row">
            <div>
              <h1>Student Records</h1>
              <p>Manage student disciplinary records and monitoring</p>
            </div>
            <button
              className="cc-btn-primary"
              type="button"
              onClick={() => setIsCreateOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 2.667V13.333M2.667 8H13.333"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              New Record
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-value total">{stats.total}</p>
              <p className="stat-label">Total Students</p>
            </div>
            <div className="stat-card" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
              <p className="stat-value" style={{ color: "#15803d" }}>
                {stats.good}
              </p>
              <p className="stat-label">Good Standing</p>
            </div>
            <div className="stat-card" style={{ background: "#fff7ed", borderColor: "#fed7aa" }}>
              <p className="stat-value" style={{ color: "#c2410c" }}>
                {stats.probation}
              </p>
              <p className="stat-label">On Probation</p>
            </div>
            <div className="stat-card" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
              <p className="stat-value" style={{ color: "#b91c1c" }}>
                {stats.high}
              </p>
              <p className="stat-label">High Risk</p>
            </div>
          </div>

          <section className="cc-card" style={{ marginTop: 24 }}>
            <div className="cc-card-header">
              <div className="cc-search-row">
                <div className="cc-search">
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 500,
                      color: "#0f172a",
                      fontSize: 14,
                      marginBottom: 8,
                    }}
                  >
                    Search
                  </div>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, ID, or program..."
                  />
                </div>

                <div style={{ width: 240, textAlign: "right" }}>
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 500,
                      color: "#0f172a",
                      fontSize: 14,
                    }}
                  >
                    Student Records ({filtered.length})
                  </div>
                </div>
              </div>
            </div>

            <div className="cc-table-wrapper">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Program</th>
                    <th>Cases</th>
                    <th>Last Incident</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.studentId}>
                      <td style={{ fontWeight: 600 }}>{r.studentId}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.studentName}</div>
                      </td>
                      <td>{r.program}</td>
                      <td>{r.casesDisplay}</td>
                      <td>{r.lastIncident}</td>
                      <td>
                        <StandingPill category={r.category} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            className="cc-btn-secondary"
                            type="button"
                            onClick={() => {
                              setSelectedStudent(r);
                              setIsViewOpen(true);
                            }}
                          >
                            View
                          </button>
                          <button
                            className="cc-btn-secondary"
                            type="button"
                            onClick={() => {
                              setSelectedStudent(r);
                              setIsViewOpen(false);
                              setManageCategory(r.category);
                              setManageNotes(r.notes);
                              setIsManageOpen(true);
                            }}
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "24px 8px", color: "#64748b" }}>
                        No student records yet. File cases in Case Management or add a record manually.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {selectedStudent && isViewOpen && !isManageOpen && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setSelectedStudent(null)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">Student Record Details</div>
              <button
                className="cc-modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setSelectedStudent(null)}
              >
                ✕
              </button>
            </div>

            <div className="cc-modal-body">
              <div className="cc-modal-row">
                <div className="cc-field">
                  <div className="cc-label">Student</div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{selectedStudent.studentName}</div>
                </div>
                <div className="cc-field">
                  <div className="cc-label">Student ID</div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{selectedStudent.studentId}</div>
                </div>
              </div>

              <div className="cc-modal-row">
                <div className="cc-field">
                  <div className="cc-label">Program</div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{selectedStudent.program}</div>
                </div>
                <div className="cc-field">
                  <div className="cc-label">Standing</div>
                  <div style={{ marginTop: 6 }}>
                    <StandingPill category={selectedStudent.category} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Case Summary</div>
                <div style={{ color: "#0f172a", fontSize: 14, marginTop: 6 }}>
                  {selectedStudent.casesDisplay}. Last incident on {selectedStudent.lastIncident}.
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Notes</div>
                <div style={{ color: "#0f172a", fontSize: 14 }}>{selectedStudent.notes || "—"}</div>
              </div>
            </div>

            <div className="cc-modal-actions">
              <button
                className="cc-btn-secondary"
                type="button"
                onClick={() => {
                  setIsViewOpen(false);
                  setIsManageOpen(true);
                  setManageCategory(selectedStudent.category);
                  setManageNotes(selectedStudent.notes);
                }}
              >
                Manage Record
              </button>
              <button className="cc-btn-secondary" type="button" onClick={() => {
                setSelectedStudent(null);
                setIsViewOpen(false);
              }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isManageOpen && selectedStudent && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setIsManageOpen(false)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">Manage Student Record</div>
              <button
                className="cc-modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setIsManageOpen(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const { status, riskLevel } = categoryToDbFields(manageCategory);
                try {
                  setManageSaving(true);
                  if (selectedStudent.hasManualRecord && selectedStudent.manualRecordId) {
                    await updateStudent(selectedStudent.manualRecordId, {
                      status,
                      notes: manageNotes,
                      riskLevel,
                      program: selectedStudent.program,
                      openCasesCount: selectedStudent.casesActive,
                    });
                    setSelectedStudent((s) =>
                      s ? { ...s, category: manageCategory, notes: manageNotes } : null,
                    );
                  } else {
                    const saved = await insertStudent({
                      studentName: selectedStudent.studentName,
                      studentId: selectedStudent.studentId,
                      program: selectedStudent.program,
                      notes: manageNotes,
                      cases: selectedStudent.casesActive,
                      status,
                      riskLevel,
                    });
                    setSelectedStudent((s) =>
                      s
                        ? {
                            ...s,
                            category: manageCategory,
                            notes: manageNotes,
                            hasManualRecord: true,
                            manualRecordId: saved.id,
                            id: saved.id,
                          }
                        : null,
                    );
                  }
                  showToast("Student record saved.", { variant: "success" });
                  setIsManageOpen(false);
                } catch (err) {
                  showToast(err?.message || "Could not save record.", { variant: "error" });
                } finally {
                  setManageSaving(false);
                }
              }}
            >
              <div className="cc-modal-body">
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                  When a formal welfare record exists for this student, standing and notes come from Supabase;
                  otherwise standing is derived from cases until you save.
                </p>
                <div className="cc-modal-row">
                  <div className="cc-field">
                    <div className="cc-label">Monitoring standing</div>
                    <select
                      className="cc-input"
                      value={manageCategory}
                      onChange={(e) => setManageCategory(e.target.value)}
                    >
                      <option value="good_standing">Good Standing</option>
                      <option value="on_probation">On Probation</option>
                      <option value="high_risk">High Risk</option>
                    </select>
                  </div>
                </div>

                <div className="cc-field">
                  <div className="cc-label">Monitoring Notes</div>
                  <textarea
                    className="cc-textarea"
                    value={manageNotes}
                    onChange={(e) => setManageNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="cc-modal-actions">
                <button className="cc-btn-secondary" type="button" onClick={() => setIsManageOpen(false)}>
                  Cancel
                </button>
                <button className="cc-btn-primary" type="submit" disabled={manageSaving}>
                  {manageSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setIsCreateOpen(false)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">New Student Record</div>
              <button
                className="cc-modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setIsCreateOpen(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const nextErrors = {};
                if (!createForm.studentName.trim()) nextErrors.studentName = "Student Name is required.";
                if (!createForm.studentId.trim()) nextErrors.studentId = "Student ID is required.";
                if (!createForm.program.trim()) nextErrors.program = "Program is required.";

                setCreateErrors(nextErrors);
                if (Object.keys(nextErrors).length > 0) return;

                try {
                  await insertStudent({
                    studentName: createForm.studentName.trim(),
                    studentId: createForm.studentId.trim(),
                    program: createForm.program.trim(),
                    notes: createForm.notes.trim(),
                    cases: 0,
                    status: "good",
                    riskLevel: "low",
                  });
                  setIsCreateOpen(false);
                  setCreateForm({
                    studentName: "",
                    studentId: "",
                    program: "",
                    notes: "",
                  });
                  setCreateErrors({});
                } catch (err) {
                  setCreateErrors({
                    _submit: err?.message || "Could not create record (duplicate student ID?).",
                  });
                }
              }}
            >
              <div className="cc-modal-body">
                {createErrors._submit && (
                  <div className="cc-form-error" role="alert" style={{ marginBottom: 12 }}>
                    {createErrors._submit}
                  </div>
                )}
                <div className="cc-modal-row">
                  <div className="cc-field">
                    <div className="cc-label">Student Name</div>
                    <input
                      className={`cc-input${createErrors.studentName ? " cc-input-error" : ""}`}
                      placeholder="e.g., Michael Tan"
                      value={createForm.studentName}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          studentName: sanitizePersonNameInput(e.target.value),
                        }))
                      }
                      aria-invalid={Boolean(createErrors.studentName)}
                    />
                    {createErrors.studentName && (
                      <div className="cc-form-error" role="alert">
                        {createErrors.studentName}
                      </div>
                    )}
                  </div>
                  <div className="cc-field">
                    <div className="cc-label">Student ID</div>
                    <input
                      className={`cc-input${createErrors.studentId ? " cc-input-error" : ""}`}
                      placeholder="2023-10234"
                      value={createForm.studentId}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          studentId: sanitizeDigitsOnlyInput(e.target.value),
                        }))
                      }
                      aria-invalid={Boolean(createErrors.studentId)}
                    />
                    {createErrors.studentId && (
                      <div className="cc-form-error" role="alert">
                        {createErrors.studentId}
                      </div>
                    )}
                  </div>
                </div>

                <div className="cc-field">
                  <div className="cc-label">Program</div>
                  <ProgramSelect
                    error={Boolean(createErrors.program)}
                    value={createForm.program}
                    onChange={(v) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        program: v,
                      }))
                    }
                    options={NU_PROGRAM_OPTIONS}
                  />
                  {createErrors.program && (
                    <div className="cc-form-error" role="alert">
                      {createErrors.program}
                    </div>
                  )}
                </div>

                <div className="cc-field" style={{ marginTop: 12 }}>
                  <div className="cc-label">Notes</div>
                  <textarea
                    className="cc-textarea"
                    placeholder="Initial record notes..."
                    value={createForm.notes}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="cc-modal-actions">
                <button className="cc-btn-secondary" type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </button>
                <button className="cc-btn-primary" type="submit">
                  Create Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};



const statusColor = (status) => {
  if (String(status).toLowerCase().includes("approved")) return "completed";
  if (String(status).toLowerCase().includes("pending")) return "scheduled";
  return "scheduled";
};

export function DocumentRequestsPage() {
  const { requests, loading, fetchError, refresh, insertRequest, updateRequest } =
    useDocumentRequests(DO_DOCUMENT_REQUESTS_SEED);
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newDocModalKey, setNewDocModalKey] = useState(0);
  const [docSubmitting, setDocSubmitting] = useState(false);
  const [acceptingUploadBusy, setAcceptingUploadBusy] = useState(false);

  const session = useMemo(() => {
    try {
      return JSON.parse(window.localStorage.getItem("campuscare_session_v1") || "null");
    } catch {
      return null;
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => {
      const prog = (r.program || "").toLowerCase();
      const partner = labelForOfficeKey(r.partnerOffice).toLowerCase();
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.studentId.toLowerCase().includes(q) ||
        prog.includes(q) ||
        partner.includes(q) ||
        (r.partnerOffice || "").toLowerCase().includes(q) ||
        r.documentType.toLowerCase().includes(q) ||
        r.requestId.toLowerCase().includes(q)
      );
    });
  }, [requests, search]);

  const handleAcceptingOfficeAttachment = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedRequest || selectedRequest.direction !== "incoming") return;
    const existing = selectedRequest.evidence || [];
    try {
      setAcceptingUploadBusy(true);
      if (isSupabaseConfigured() && supabase) {
        const { evidence } = await appendEvidenceToInterOfficeRequest(supabase, selectedRequest.requestId, file);
        setSelectedRequest((prev) => (prev ? { ...prev, evidence } : null));
        await refresh();
      } else {
        const newItem = {
          name: file.name,
          source: "target",
          uploadedAt: new Date().toISOString(),
        };
        const nextEvidence = [...existing, newItem];
        await updateRequest(selectedRequest.requestId, {
          evidence: nextEvidence,
          uploaded_at: new Date().toISOString(),
        });
        setSelectedRequest((prev) => (prev ? { ...prev, evidence: nextEvidence } : null));
      }
      showToast("Attachment uploaded.", { variant: "success" });
    } catch (err) {
      showToast(err?.message || "Could not upload attachment.", { variant: "error" });
    } finally {
      setAcceptingUploadBusy(false);
    }
  };

  if (!canCreateDocumentRequest(session?.office)) {
    return (
      <div className="dashboard-layout do-office-layout">
        <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />
        <div className="dashboard-main">
          <DisciplineOfficeTopBar />
          <main className="dashboard-content do-office-shell">
            <div className="cc-card" style={{ marginTop: 24, padding: 24, maxWidth: 560 }}>
              <h1 style={{ fontSize: 18, margin: 0 }}>Document requests</h1>
              <p style={{ color: "#64748b", marginTop: 12, lineHeight: 1.5 }}>
                Inter-office document requests are only available to the Discipline Office, Health Services (HSO), and
                Student Development (SDAO).
              </p>
              <Link to="/dashboard" className="cc-btn-primary" style={{ marginTop: 20, display: "inline-flex" }}>
                Back to dashboard
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!isStaffCampusRole(session?.role)) {
    return (
      <div className="dashboard-layout do-office-layout">
        <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />
        <div className="dashboard-main">
          <DisciplineOfficeTopBar />
          <main className="dashboard-content do-office-shell">
            <div className="cc-card" style={{ marginTop: 24, padding: 24, maxWidth: 560 }}>
              <h1 style={{ fontSize: 18, margin: 0 }}>Document requests</h1>
              <p style={{ color: "#64748b", marginTop: 12, lineHeight: 1.5 }}>
                Inter-office document requests are for authorized campus staff only. Students should use their office
                portal (for example SDAO) to request documents — not this page.
              </p>
              <Link to="/dashboard" className="cc-btn-primary" style={{ marginTop: 20, display: "inline-flex" }}>
                Back to dashboard
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout do-office-layout">
      <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />
      <div className="dashboard-main">
        <DisciplineOfficeTopBar />

        <main className="dashboard-content do-office-shell">
          {(fetchError || loading) && (
            <div
              role="status"
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: fetchError ? "#fef2f2" : "#f8fafc",
                border: `1px solid ${fetchError ? "#fecaca" : "#e2e8f0"}`,
                color: fetchError ? "#991b1b" : "#475569",
                fontSize: 14,
              }}
            >
              {fetchError ? `Could not load requests: ${fetchError}` : "Loading document requests…"}
              {fetchError && (
                <button
                  type="button"
                  className="cc-btn-secondary"
                  style={{ marginLeft: 12, height: 30 }}
                  onClick={() => refresh()}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          <div className="page-title-row">
            <div>
              <h1>Document Requests</h1>
              <p>Inter-office requests between HSO, DO, and SDAO only — same form as partner offices.</p>
            </div>
            <button
              className="cc-btn-primary"
              type="button"
              onClick={() => {
                setNewDocModalKey((k) => k + 1);
                setIsNewOpen(true);
              }}
            >
              New Request
            </button>
          </div>

          <section className="cc-card" style={{ marginTop: 24 }}>
            <div className="cc-card-header">
              <div className="cc-search-row">
                <div className="cc-search">
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 500,
                      color: "#0f172a",
                      fontSize: 14,
                      marginBottom: 8,
                    }}
                  >
                    Search
                  </div>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, ID, program, or document type..."
                  />
                </div>
                <div style={{ width: 240, textAlign: "right" }}>
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 500,
                      color: "#0f172a",
                      fontSize: 14,
                    }}
                  >
                    Requests ({filtered.length})
                  </div>
                </div>
              </div>
            </div>

            <div className="cc-table-wrapper">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Student</th>
                    <th>Program</th>
                    <th>Partner office</th>
                    <th>Document Type</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Requested Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.requestId}>
                      <td style={{ fontWeight: 600 }}>{r.requestId}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.studentName}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{r.studentId}</div>
                      </td>
                      <td style={{ fontSize: 13, color: "#334155", maxWidth: 220 }}>{r.program || "—"}</td>
                      <td style={{ fontSize: 13, color: "#334155", maxWidth: 220 }}>
                        <span
                          style={{
                            display: "inline-block",
                            marginRight: 8,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#64748b",
                            textTransform: "uppercase",
                          }}
                        >
                          {r.direction === "outgoing" ? "To" : "From"}
                        </span>
                        {labelForOfficeKey(r.partnerOffice)}
                      </td>
                      <td>{r.documentType}</td>
                      <td>
                        <span className={`cc-pill ${statusColor(r.status)}`}>{r.status}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${r.priority}`}>{r.priority}</span>
                      </td>
                      <td>{r.requestedDate}</td>
                      <td>
                        <button
                          className="cc-btn-secondary"
                          type="button"
                          onClick={() => setSelectedRequest(r)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "24px 8px", color: "#64748b" }}>
                        No document requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {selectedRequest && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setSelectedRequest(null)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">Request Details</div>
              <button className="cc-modal-close" type="button" aria-label="Close" onClick={() => setSelectedRequest(null)}>
                ✕
              </button>
            </div>

            <div className="cc-modal-body">
              <div className="cc-modal-row">
                <div className="cc-field" style={{ flex: 1 }}>
                  <div className="cc-label">Request ID</div>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selectedRequest.requestId}</div>
                </div>
                <div className="cc-field" style={{ flex: 1 }}>
                  <div className="cc-label">Requested Date</div>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selectedRequest.requestedDate}</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Student Information</div>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selectedRequest.studentName}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{selectedRequest.studentId}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Program</div>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selectedRequest.program || "—"}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">
                  {selectedRequest.direction === "outgoing" ? "Request document from" : "Request from office"}
                </div>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>
                  {labelForOfficeKey(selectedRequest.partnerOffice)}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Document Type</div>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selectedRequest.documentType}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Description</div>
                <div style={{ color: "#0f172a", fontSize: 14, marginTop: 6 }}>{selectedRequest.description}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Attachments</div>
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 10 }}>
                  {(selectedRequest.evidence || []).map((ev, idx) => (
                    <div
                      key={`${ev.name}-${idx}-${ev.url || ""}`}
                      style={{ color: "#0f172a", fontSize: 14 }}
                    >
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>
                        {ev.source === "target"
                          ? "Accepting office"
                          : selectedRequest.direction === "outgoing"
                            ? "Included with request"
                            : "Requesting office"}
                      </div>
                      {ev.url ? (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontWeight: 600, color: "#2563eb" }}
                        >
                          {ev.name}
                        </a>
                      ) : (
                        <span style={{ fontWeight: 600 }}>{ev.name}</span>
                      )}
                    </div>
                  ))}
                  {(selectedRequest.evidence || []).length === 0 && (
                    <div style={{ color: "#64748b", fontSize: 14 }}>No attachments yet.</div>
                  )}
                </div>
              </div>

              {selectedRequest.direction === "incoming" ? (
                <div style={{ marginTop: 16 }}>
                  <div className="cc-label">Add attachment (your office)</div>
                  <p style={{ color: "#64748b", fontSize: 13, margin: "6px 0 8px", lineHeight: 1.45 }}>
                    Upload the prepared document or supporting file for the requesting office.
                  </p>
                  <input
                    className="cc-input"
                    type="file"
                    disabled={acceptingUploadBusy}
                    onChange={handleAcceptingOfficeAttachment}
                  />
                  {acceptingUploadBusy ? (
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>Uploading…</div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="cc-modal-actions">
              <button className="cc-btn-secondary" type="button" onClick={() => setSelectedRequest(null)}>
                Close
              </button>
              {selectedRequest.direction === "incoming" ? (
                <button
                  className="cc-btn-primary"
                  type="button"
                  onClick={async () => {
                    try {
                      await updateRequest(selectedRequest.requestId, { status: "Approved" });
                      setSelectedRequest((prev) =>
                        prev ? { ...prev, status: "Approved" } : prev,
                      );
                      await refresh();
                      showToast("Request approved.", { variant: "success" });
                    } catch (err) {
                      showToast(err?.message || "Could not update request.", { variant: "error" });
                    }
                  }}
                >
                  Approve
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <InterOfficeNewDocumentRequestModal
        key={newDocModalKey}
        open={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        viewerOfficeKey="discipline"
        submitting={docSubmitting}
        onSubmit={async (payload) => {
          const docLabel =
            String(payload.documentType).toLowerCase() === "other" && payload.documentTypeOther?.trim()
              ? `Other: ${payload.documentTypeOther.trim()}`
              : payload.documentType.trim();
          setDocSubmitting(true);
          try {
            const next = await insertRequest({
              studentName: payload.studentName,
              studentId: payload.studentId,
              program: payload.program,
              targetOffice: payload.targetOffice,
              documentType: docLabel,
              priority: payload.priority,
              status: "Pending",
              description: payload.description,
              evidence: [{ name: payload.evidenceFile.name }],
            });
            setSelectedRequest(next);
            setIsNewOpen(false);
          } finally {
            setDocSubmitting(false);
          }
        }}
      />
    </div>
  );
}



const ALLOWED_REFERRAL_TYPES = ["HSO", "SDAO", "DO"];

export function ReferralsPage() {
  const {
    referrals,
    loading,
    fetchError,
    refresh,
    insertReferral,
    updateReferral,
  } = useReferrals(DO_REFERRALS_SEED);
  const { records: disciplineStudentRecords } = useStudentRecords(DO_STUDENT_RECORDS_SEED);
  const referralStudentOptions = useMemo(
    () =>
      disciplineStudentRecords.map((r) => ({
        value: r.studentId,
        label: `${r.studentName} (${r.studentId})`,
      })),
    [disciplineStudentRecords],
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  const [form, setForm] = useState({
    studentId: "",
    referralType: "",
    reason: "",
  });
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [errors, setErrors] = useState({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return referrals;
    return referrals.filter((r) => {
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.studentId.toLowerCase().includes(q) ||
        r.referralId.toLowerCase().includes(q) ||
        r.referralType.toLowerCase().includes(q)
      );
    });
  }, [referrals, search]);

  const statusPill = (status) => {
    const s = String(status).toLowerCase();
    if (s.includes("approved")) return "completed";
    if (s.includes("pending")) return "scheduled";
    return "scheduled";
  };

  return (
    <div className="dashboard-layout do-office-layout">
      <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />
      <div className="dashboard-main">
        <DisciplineOfficeTopBar />

        <main className="dashboard-content do-office-shell">
          {(fetchError || loading) && (
            <div
              role="status"
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: fetchError ? "#fef2f2" : "#f8fafc",
                border: `1px solid ${fetchError ? "#fecaca" : "#e2e8f0"}`,
                color: fetchError ? "#991b1b" : "#475569",
                fontSize: 14,
              }}
            >
              {fetchError ? `Could not load referrals: ${fetchError}` : "Loading referrals…"}
              {fetchError && (
                <button
                  type="button"
                  className="cc-btn-secondary"
                  style={{ marginLeft: 12, height: 30 }}
                  onClick={() => refresh()}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          <div className="page-title-row">
            <div>
              <h1>Referrals</h1>
              <p>Manage referrals to other campus offices</p>
            </div>
            <button
              className="cc-btn-primary"
              type="button"
              onClick={() => {
                setForm({ studentId: "", referralType: "", reason: "" });
                setEvidenceFile(null);
                setErrors({});
                setIsNewOpen(true);
              }}
            >
              New Referral
            </button>
          </div>

          <section className="cc-card" style={{ marginTop: 24 }}>
            <div className="cc-card-header">
              <div className="cc-search-row">
                <div className="cc-search">
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 500,
                      color: "#0f172a",
                      fontSize: 14,
                      marginBottom: 8,
                    }}
                  >
                    Search
                  </div>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, or type..." />
                </div>
                <div style={{ width: 240, textAlign: "right" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, color: "#0f172a", fontSize: 14 }}>
                    Referrals ({filtered.length})
                  </div>
                </div>
              </div>
            </div>

            <div className="cc-table-wrapper">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>Referral ID</th>
                    <th>Student</th>
                    <th>Referral Type</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.referralId}>
                      <td style={{ fontWeight: 600 }}>{r.referralId}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.studentName}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{r.studentId}</div>
                      </td>
                      <td>{r.referralType}</td>
                      <td>
                        <span className={`cc-pill ${statusPill(r.status)}`}>{r.status}</span>
                      </td>
                      <td>{r.date}</td>
                      <td>
                        <button className="cc-btn-secondary" type="button" onClick={() => setSelected(r)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px 8px", color: "#64748b" }}>
                        No referrals found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {selected && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setSelected(null)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">Referral Details</div>
              <button className="cc-modal-close" type="button" aria-label="Close" onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>

            <div className="cc-modal-body">
              <div className="cc-modal-row">
                <div className="cc-field" style={{ flex: 1 }}>
                  <div className="cc-label">Referral ID</div>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selected.referralId}</div>
                </div>
                <div className="cc-field" style={{ flex: 1 }}>
                  <div className="cc-label">Date</div>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selected.date}</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Student</div>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selected.studentName}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{selected.studentId}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Referral Type</div>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selected.referralType}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Reason</div>
                <div style={{ color: "#0f172a", fontSize: 14, marginTop: 6 }}>{selected.reason}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Attachments</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {(selected.evidence || []).map((ev, idx) => (
                    <div key={`${ev.name}-${idx}`} style={{ color: "#0f172a", fontSize: 14 }}>
                      <span style={{ fontWeight: 600 }}>{ev.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="cc-modal-actions">
              <button className="cc-btn-secondary" type="button" onClick={() => setSelected(null)}>
                Close
              </button>
              <button
                className="cc-btn-primary"
                type="button"
                onClick={async () => {
                  try {
                    await updateReferral(selected.referralId, { status: "Approved" });
                    setSelected((prev) => (prev ? { ...prev, status: "Approved" } : prev));
                    showToast("Referral approved.", { variant: "success" });
                  } catch (err) {
                    showToast(err?.message || "Could not update referral.", { variant: "error" });
                  }
                }}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {isNewOpen && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setIsNewOpen(false)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">New Referral</div>
              <button className="cc-modal-close" type="button" aria-label="Close" onClick={() => setIsNewOpen(false)}>
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const nextErrors = {};
                const sid = form.studentId.trim();
                const recordMatch = disciplineStudentRecords.find((r) => r.studentId === sid);
                if (!sid) nextErrors.studentId = "Select a student with a discipline record.";
                else if (!recordMatch) nextErrors.studentId = "Only students with an existing record can be selected.";
                if (!form.referralType || !ALLOWED_REFERRAL_TYPES.includes(form.referralType)) {
                  nextErrors.referralType = "Select HSO, SDAO, or DO.";
                }
                if (!form.reason.trim()) nextErrors.reason = "Reason is required.";
                if (!evidenceFile) nextErrors.evidence = "Attachment is required (mock).";

                setErrors(nextErrors);
                if (Object.keys(nextErrors).length > 0) return;

                try {
                  const created = await insertReferral({
                    studentName: recordMatch.studentName.trim(),
                    studentId: sid,
                    referralType: form.referralType,
                    reason: form.reason.trim(),
                    status: "Pending",
                    evidence: [{ name: evidenceFile.name }],
                  });
                  setSelected(created);
                  setIsNewOpen(false);
                  setErrors({});
                  setEvidenceFile(null);
                  setForm({ studentId: "", referralType: "", reason: "" });
                  showToast("Referral created.", { variant: "success" });
                } catch (err) {
                  showToast(err?.message || "Could not create referral.", { variant: "error" });
                }
              }}
            >
              <div className="cc-modal-body">
                <div className="cc-field">
                  <div className="cc-label">Select Student</div>
                  <select
                    className={`cc-input${errors.studentId ? " cc-input-error" : ""}`}
                    value={form.studentId}
                    onChange={(e) => setForm((p) => ({ ...p, studentId: e.target.value }))}
                    aria-invalid={Boolean(errors.studentId)}
                  >
                    <option value="">Choose a student</option>
                    {referralStudentOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {errors.studentId && <div className="cc-form-error" role="alert">{errors.studentId}</div>}
                </div>

                <div className="cc-field" style={{ marginTop: 12 }}>
                  <div className="cc-label">Referral Type</div>
                  <select
                    className={`cc-input${errors.referralType ? " cc-input-error" : ""}`}
                    value={ALLOWED_REFERRAL_TYPES.includes(form.referralType) ? form.referralType : ""}
                    onChange={(e) => setForm((p) => ({ ...p, referralType: e.target.value }))}
                    aria-invalid={Boolean(errors.referralType)}
                  >
                    <option value="">Select office</option>
                    {ALLOWED_REFERRAL_TYPES.map((t) => (
                      <option value={t} key={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {errors.referralType && <div className="cc-form-error" role="alert">{errors.referralType}</div>}
                </div>

                <div className="cc-field" style={{ marginTop: 12 }}>
                  <div className="cc-label">Reason</div>
                  <textarea
                    className="cc-textarea"
                    value={form.reason}
                    onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="Describe reason for referral..."
                    aria-invalid={Boolean(errors.reason)}
                  />
                  {errors.reason && <div className="cc-form-error" role="alert">{errors.reason}</div>}
                </div>

                <div className="cc-field" style={{ marginTop: 12 }}>
                  <div className="cc-label">Attachment</div>
                  <input
                    className={`cc-input${errors.evidence ? " cc-input-error" : ""}`}
                    type="file"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                    aria-invalid={Boolean(errors.evidence)}
                  />
                  {errors.evidence && <div className="cc-form-error" role="alert">{errors.evidence}</div>}
                </div>
              </div>

              <div className="cc-modal-actions">
                <button className="cc-btn-secondary" type="button" onClick={() => setIsNewOpen(false)}>
                  Cancel
                </button>
                <button className="cc-btn-primary" type="submit">
                  Create Referral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



const SANCTION_TYPES = [
  "Disciplinary Warning",
  "Community Service",
  "Suspension",
  "Probation",
  "Other",
];

const statusClass = (status) => {
  const s = String(status).toLowerCase();
  if (s.includes("approved")) return "completed";
  return "scheduled";
};

export function SanctionsPage() {
  const {
    sanctions: items,
    loading,
    fetchError,
    refresh,
    insertSanction,
    updateSanction,
  } = useSanctions(DO_SANCTIONS_SEED);
  const { records: disciplineStudentRecords } = useStudentRecords(DO_STUDENT_RECORDS_SEED);
  const sanctionStudentOptions = useMemo(
    () =>
      disciplineStudentRecords.map((r) => ({
        value: r.studentId,
        label: `${r.studentName} (${r.studentId})`,
      })),
    [disciplineStudentRecords],
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  const sanctionFiledDateLabel = useMemo(() => {
    if (!isNewOpen) return "";
    return formatCaseDateFromIso(new Date().toISOString());
  }, [isNewOpen]);

  const [form, setForm] = useState({
    studentId: "",
    sanctionType: "",
    notes: "",
  });
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [errors, setErrors] = useState({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      return (
        i.studentName.toLowerCase().includes(q) ||
        i.studentId.toLowerCase().includes(q) ||
        i.sanctionId.toLowerCase().includes(q) ||
        i.sanctionType.toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  return (
    <div className="dashboard-layout do-office-layout">
      <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />
      <div className="dashboard-main">
        <DisciplineOfficeTopBar />

        <main className="dashboard-content do-office-shell">
          {(fetchError || loading) && (
            <div
              role="status"
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: fetchError ? "#fef2f2" : "#f8fafc",
                border: `1px solid ${fetchError ? "#fecaca" : "#e2e8f0"}`,
                color: fetchError ? "#991b1b" : "#475569",
                fontSize: 14,
              }}
            >
              {fetchError ? `Could not load sanctions: ${fetchError}` : "Loading sanctions…"}
              {fetchError && (
                <button
                  type="button"
                  className="cc-btn-secondary"
                  style={{ marginLeft: 12, height: 30 }}
                  onClick={() => refresh()}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          <div className="page-title-row">
            <div>
              <h1>Sanctions & Compliance</h1>
              <p>Track sanctions and compliance actions</p>
            </div>
            <button
              className="cc-btn-primary"
              type="button"
              onClick={() => {
                setForm({ studentId: "", sanctionType: "", notes: "" });
                setEvidenceFile(null);
                setErrors({});
                setIsNewOpen(true);
              }}
            >
              New Sanction
            </button>
          </div>

          <section className="cc-card" style={{ marginTop: 24 }}>
            <div className="cc-card-header">
              <div className="cc-search-row">
                <div className="cc-search">
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, color: "#0f172a", fontSize: 14, marginBottom: 8 }}>
                    Search
                  </div>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, or sanction type..." />
                </div>
                <div style={{ width: 240, textAlign: "right" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, color: "#0f172a", fontSize: 14 }}>
                    Sanctions ({filtered.length})
                  </div>
                </div>
              </div>
            </div>

            <div className="cc-table-wrapper">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>Sanction ID</th>
                    <th>Student</th>
                    <th>Sanction Type</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.sanctionId}>
                      <td style={{ fontWeight: 600 }}>{i.sanctionId}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{i.studentName}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{i.studentId}</div>
                      </td>
                      <td>{i.sanctionType}</td>
                      <td>
                        <span className={`cc-pill ${statusClass(i.status)}`}>{i.status}</span>
                      </td>
                      <td>{i.dueDate}</td>
                      <td>
                        <button className="cc-btn-secondary" type="button" onClick={() => setSelected(i)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px 8px", color: "#64748b" }}>
                        No sanctions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {selected && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setSelected(null)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">Sanction Details</div>
              <button className="cc-modal-close" type="button" aria-label="Close" onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>

            <div className="cc-modal-body">
              <div className="cc-modal-row">
                <div className="cc-field" style={{ flex: 1 }}>
                  <div className="cc-label">Sanction ID</div>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selected.sanctionId}</div>
                </div>
                <div className="cc-field" style={{ flex: 1 }}>
                  <div className="cc-label">Due Date</div>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selected.dueDate}</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Student</div>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selected.studentName}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{selected.studentId}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Sanction Type</div>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selected.sanctionType}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Compliance Notes</div>
                <div style={{ color: "#0f172a", fontSize: 14, marginTop: 6 }}>{selected.notes}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Evidence</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {(selected.evidence || []).map((ev, idx) => (
                    <div key={`${ev.name}-${idx}`} style={{ color: "#0f172a", fontSize: 14 }}>
                      <span style={{ fontWeight: 600 }}>{ev.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="cc-modal-actions">
              <button className="cc-btn-secondary" type="button" onClick={() => setSelected(null)}>
                Close
              </button>
              <button
                className="cc-btn-primary"
                type="button"
                onClick={async () => {
                  try {
                    await updateSanction(selected.sanctionId, { status: "Approved" });
                    setSelected((prev) => (prev ? { ...prev, status: "Approved" } : prev));
                    showToast("Sanction approved.", { variant: "success" });
                  } catch (err) {
                    showToast(err?.message || "Could not update sanction.", { variant: "error" });
                  }
                }}
              >
                Mark Approved
              </button>
            </div>
          </div>
        </div>
      )}

      {isNewOpen && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setIsNewOpen(false)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">New Sanction</div>
              <button className="cc-modal-close" type="button" aria-label="Close" onClick={() => setIsNewOpen(false)}>
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const nextErrors = {};
                const sid = form.studentId.trim();
                const recordMatch = disciplineStudentRecords.find((r) => r.studentId === sid);
                if (!sid) nextErrors.studentId = "Select a student with a discipline record.";
                else if (!recordMatch) nextErrors.studentId = "Only students with an existing record can be selected.";
                if (!form.sanctionType) nextErrors.sanctionType = "Sanction Type is required.";
                if (!sanctionFiledDateLabel) nextErrors.dueDate = "Sanction date could not be set. Close and try again.";
                if (!form.notes.trim()) nextErrors.notes = "Notes are required.";
                if (!evidenceFile) nextErrors.evidence = "Evidence attachment is required (mock).";

                setErrors(nextErrors);
                if (Object.keys(nextErrors).length > 0) return;

                try {
                  const newItem = await insertSanction({
                    studentName: recordMatch.studentName.trim(),
                    studentId: sid,
                    sanctionType: form.sanctionType,
                    status: "In Review",
                    dueDate: sanctionFiledDateLabel,
                    notes: form.notes.trim(),
                    evidence: [{ name: evidenceFile.name }],
                  });
                  setSelected(newItem);
                  setIsNewOpen(false);
                  setErrors({});
                  setEvidenceFile(null);
                  setForm({ studentId: "", sanctionType: "", notes: "" });
                  showToast("Sanction created.", { variant: "success" });
                } catch (err) {
                  showToast(err?.message || "Could not create sanction.", { variant: "error" });
                }
              }}
            >
              <div className="cc-modal-body">
                <div className="cc-field">
                  <div className="cc-label">Select Student</div>
                  <select
                    className={`cc-input${errors.studentId ? " cc-input-error" : ""}`}
                    value={form.studentId}
                    onChange={(e) => setForm((p) => ({ ...p, studentId: e.target.value }))}
                    aria-invalid={Boolean(errors.studentId)}
                  >
                    <option value="">Choose a student</option>
                    {sanctionStudentOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {errors.studentId && <div className="cc-form-error" role="alert">{errors.studentId}</div>}
                </div>

                <div className="cc-modal-row" style={{ marginTop: 12 }}>
                  <div className="cc-field">
                    <div className="cc-label">Sanction Type</div>
                    <select
                      className={`cc-input${errors.sanctionType ? " cc-input-error" : ""}`}
                      value={form.sanctionType}
                      onChange={(e) => setForm((p) => ({ ...p, sanctionType: e.target.value }))}
                      aria-invalid={Boolean(errors.sanctionType)}
                    >
                      <option value="">Select type</option>
                      {SANCTION_TYPES.map((t) => (
                        <option value={t} key={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {errors.sanctionType && <div className="cc-form-error" role="alert">{errors.sanctionType}</div>}
                  </div>
                  <div className="cc-field">
                    <div className="cc-label">Sanction date</div>
                    <input
                      className="cc-input"
                      readOnly
                      value={sanctionFiledDateLabel || "—"}
                      aria-readonly="true"
                    />
                    <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 0" }}>
                      Set automatically to today&apos;s date when the sanction is filed.
                    </p>
                    {errors.dueDate && <div className="cc-form-error" role="alert">{errors.dueDate}</div>}
                  </div>
                </div>

                <div className="cc-field" style={{ marginTop: 12 }}>
                  <div className="cc-label">Notes</div>
                  <textarea
                    className="cc-textarea"
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    aria-invalid={Boolean(errors.notes)}
                  />
                  {errors.notes && <div className="cc-form-error" role="alert">{errors.notes}</div>}
                </div>

                <div className="cc-field" style={{ marginTop: 12 }}>
                  <div className="cc-label">Evidence Attachment</div>
                  <input
                    className={`cc-input${errors.evidence ? " cc-input-error" : ""}`}
                    type="file"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                    aria-invalid={Boolean(errors.evidence)}
                  />
                  {errors.evidence && <div className="cc-form-error" role="alert">{errors.evidence}</div>}
                </div>
              </div>

              <div className="cc-modal-actions">
                <button className="cc-btn-secondary" type="button" onClick={() => setIsNewOpen(false)}>
                  Cancel
                </button>
                <button className="cc-btn-primary" type="submit">
                  Create Sanction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



/** Slower, ease-out motion when data / period changes — Recharts defaults feel rushed. */
const CHART_ANIMATION_DURATION = 1100;
const CHART_ANIMATION_EASING = "ease-out";

/** Recharts places overlapping labels when multiple slices are 0% — hide those labels. */
function PieSliceLabel({ name, value }) {
  if (value == null || Number(value) <= 0) return null;
  return `${name} ${value}%`;
}

/**
 * @param {{ standalone?: boolean }} props
 * When true, renders reports main content only (no DO sidebar / top bar) for Super Admin embed.
 */
export function ReportsPage({ standalone = false } = {}) {
  const [period, setPeriod] = useState("semester");
  const [showGraphs, setShowGraphs] = useState(false);

  const { cases, loading, fetchError } = useCases([]);

  const analytics = useMemo(() => buildReportsAnalytics(cases, period), [cases, period]);

  useEffect(() => {
    if (loading) return undefined;
    setShowGraphs(false);
    const t = setTimeout(() => setShowGraphs(true), 320);
    return () => clearTimeout(t);
  }, [period, loading]);

  const periodLabel = useMemo(() => {
    const opt = PERIOD_OPTIONS.find((p) => p.id === period);
    return opt?.label ?? "This Semester";
  }, [period]);

  const handleExportExcel = () => {
    const csv = exportAnalyticsCsv(analytics, periodLabel);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campuscare_reports_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    window.print();
  };

  /** Omit 0% slices so the donut has no degenerate arcs and labels cannot collide. */
  const statusPieData = useMemo(
    () => analytics.statusSlices.filter((s) => Number(s.value) > 0),
    [analytics.statusSlices],
  );

  const reportsMain = (
        <main className={`dashboard-content do-office-shell${standalone ? " do-reports-standalone" : ""}`}>
          <div className="reports-page-title-row">
            <div>
              <h1>
                Reports & Analytics
                {analytics.isDemo && (
                  <span className="reports-demo-pill" title="Shown when no cases match the selected period">
                    Sample data
                  </span>
                )}
              </h1>
              <p>Comprehensive discipline office statistics and insights.</p>
            </div>
            <div className="reports-toolbar">
              <div className="reports-period-field">
                <label htmlFor="reports-period">Period</label>
                <select
                  id="reports-period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  disabled={loading}
                >
                  {PERIOD_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cc-page-actions">
                <button className="cc-btn-primary" type="button" onClick={handleExportPdf}>
                  Export PDF
                </button>
                <button className="cc-btn-secondary" type="button" onClick={handleExportExcel}>
                  Export Excel
                </button>
              </div>
            </div>
          </div>

          {fetchError && (
            <div className="reports-error-banner" role="alert">
              Could not load cases from Supabase: {fetchError}. Charts may show sample data or local cases only.
            </div>
          )}

          {loading && (
            <p style={{ color: "#64748b", fontSize: 14, marginTop: 8 }}>Loading case data…</p>
          )}

          <section className="reports-kpi-grid" aria-label="Key metrics">
            <div className="reports-kpi-card">
              <p className="reports-kpi-value">{analytics.totalCases.toLocaleString()}</p>
              <p className="reports-kpi-label">Total cases</p>
            </div>
            <div className="reports-kpi-card">
              <p className="reports-kpi-value">{Number(analytics.minorOffenses || 0).toLocaleString()}</p>
              <p className="reports-kpi-label">Minor offenses</p>
            </div>
            <div className="reports-kpi-card">
              <p className="reports-kpi-value">{Number(analytics.majorOffenses || 0).toLocaleString()}</p>
              <p className="reports-kpi-label">Major offenses</p>
            </div>
            <div className="reports-kpi-card">
              <p className="reports-kpi-value">
                {analytics.resolutionRatePct}%
                <span className="reports-kpi-trend" title="Resolution rate">
                  <TrendingUp size={20} strokeWidth={2.5} aria-hidden />
                </span>
              </p>
              <p className="reports-kpi-label">Resolution rate</p>
            </div>
            <div className="reports-kpi-card">
              <p className="reports-kpi-value">
                {analytics.avgResolutionDays}
                <span style={{ fontSize: 16, fontWeight: 600, color: "#64748b" }}> days</span>
              </p>
              <p className="reports-kpi-label">Avg. resolution time</p>
            </div>
            <div className="reports-kpi-card">
              <p className="reports-kpi-value">{analytics.studentsMonitored.toLocaleString()}</p>
              <p className="reports-kpi-label">Students monitored</p>
            </div>
            <div className="reports-kpi-card">
              <p className="reports-kpi-value" style={{ fontSize: 18, lineHeight: "24px" }}>
                {analytics.topDepartment?.department || "—"}
              </p>
              <p className="reports-kpi-label">
                Top department ({Number(analytics.topDepartment?.count || 0).toLocaleString()})
              </p>
            </div>
            <div className="reports-kpi-card">
              <p className="reports-kpi-value" style={{ fontSize: 18, lineHeight: "24px" }}>
                {analytics.peakPeriod?.label || "—"}
              </p>
              <p className="reports-kpi-label">
                Peak period ({Number(analytics.peakPeriod?.count || 0).toLocaleString()})
              </p>
            </div>
          </section>

          <div
            className={`reports-charts-grid${showGraphs ? " reports-charts-grid--visible" : " reports-charts-grid--defer"}`}
            aria-busy={!showGraphs}
          >
            {showGraphs ? (
              <>
            <div className="reports-chart-card">
              <h2 className="reports-chart-title">Cases per month</h2>
              <p className="reports-chart-hint">Cases filed vs. cases resolved ({periodLabel})</p>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={analytics.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Legend />
                    <Bar
                      dataKey="filed"
                      name="Cases filed"
                      fill="#155dfc"
                      radius={[4, 4, 0, 0]}
                      animationDuration={CHART_ANIMATION_DURATION}
                      animationEasing={CHART_ANIMATION_EASING}
                    />
                    <Bar
                      dataKey="resolved"
                      name="Cases resolved"
                      fill="#16a34a"
                      radius={[4, 4, 0, 0]}
                      animationDuration={CHART_ANIMATION_DURATION}
                      animationEasing={CHART_ANIMATION_EASING}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="reports-chart-card">
              <h2 className="reports-chart-title">Case status distribution</h2>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={2}
                      label={PieSliceLabel}
                      animationDuration={CHART_ANIMATION_DURATION}
                      animationEasing={CHART_ANIMATION_EASING}
                    >
                      {statusPieData.map((s) => (
                        <Cell key={s.key} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="reports-chart-card reports-chart-card--tall">
              <h2 className="reports-chart-title">Common violations</h2>
              <p className="reports-chart-hint">By case type in this period</p>
              <div style={{ width: "100%", height: 280 }} className="reports-hbar">
                <ResponsiveContainer>
                  <BarChart
                    layout="vertical"
                    data={analytics.violations}
                    margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={148}
                      tick={{ fontSize: 11 }}
                      stroke="#64748b"
                    />
                    <Tooltip
                      formatter={(c, _n, p) => [`${c} cases (${p.payload.pct}%)`, "Count"]}
                      contentStyle={{ borderRadius: 8 }}
                    />
                    <Bar
                      dataKey="count"
                      name="Cases"
                      fill="#155dfc"
                      radius={[0, 6, 6, 0]}
                      barSize={18}
                      animationDuration={CHART_ANIMATION_DURATION}
                      animationEasing={CHART_ANIMATION_EASING}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="reports-chart-card reports-chart-card--tall">
              <h2 className="reports-chart-title">Offenses by department</h2>
              <p className="reports-chart-hint">Top departments (based on program/course on case records)</p>
              <div style={{ width: "100%", height: 280 }} className="reports-hbar">
                <ResponsiveContainer>
                  <BarChart
                    layout="vertical"
                    data={(analytics.departmentCounts || []).slice(0, 10)}
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="department"
                      width={148}
                      tick={{ fontSize: 11 }}
                      stroke="#64748b"
                    />
                    <Tooltip contentStyle={{ borderRadius: 8 }} />
                    <Bar
                      dataKey="count"
                      name="Cases"
                      fill="#7c3aed"
                      radius={[0, 6, 6, 0]}
                      barSize={18}
                      animationDuration={CHART_ANIMATION_DURATION}
                      animationEasing={CHART_ANIMATION_EASING}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="reports-chart-card reports-chart-card--tall">
              <h2 className="reports-chart-title">Resolution time</h2>
              <p className="reports-chart-hint">Closed cases by time to resolve</p>
              <div style={{ width: "100%", height: 280 }} className="reports-hbar">
                <ResponsiveContainer>
                  <BarChart
                    layout="vertical"
                    data={analytics.resolutionBuckets}
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="label" width={88} tick={{ fontSize: 12 }} stroke="#64748b" />
                    <Tooltip contentStyle={{ borderRadius: 8 }} />
                    <Bar
                      dataKey="count"
                      name="Cases"
                      fill="#16a34a"
                      radius={[0, 6, 6, 0]}
                      barSize={20}
                      animationDuration={CHART_ANIMATION_DURATION}
                      animationEasing={CHART_ANIMATION_EASING}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
              </>
            ) : null}
          </div>

          <section className="cc-card" style={{ marginBottom: 20 }}>
            <div className="cc-card-header" style={{ paddingBottom: 8 }}>
              <h2 className="reports-chart-title" style={{ margin: 0 }}>
                Repeat offenders
              </h2>
              <p className="reports-chart-hint" style={{ margin: "4px 0 0 0" }}>
                Students with more than one case in this period
              </p>
            </div>
            <div className="cc-table-wrapper reports-repeat-table-wrap">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>Student name</th>
                    <th>Student ID</th>
                    <th>Violations</th>
                    <th>Last violation</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.repeatOffenders.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "20px 8px", color: "#64748b" }}>
                        No repeat offenders in this period.
                      </td>
                    </tr>
                  ) : (
                    analytics.repeatOffenders.map((r) => (
                      <tr key={r.studentId}>
                        <td style={{ fontWeight: 600 }}>{r.student}</td>
                        <td>{r.studentId}</td>
                        <td>
                          <span className="reports-badge-violations">{r.violations}</span>
                        </td>
                        <td>{r.lastDate}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="reports-insights-grid" aria-label="Key insights">
            {analytics.insights.map((ins) => (
              <div
                key={ins.title}
                className={`reports-insight reports-insight--${ins.tone === "warning" ? "warning" : ins.tone === "positive" ? "positive" : "info"}`}
              >
                <h3 className="reports-insight-title">{ins.title}</h3>
                <p>{ins.text}</p>
              </div>
            ))}
          </section>

          <p
            style={{
              fontSize: 12,
              color: "#94a3b8",
              marginTop: 16,
              lineHeight: 1.5,
            }}
          >
            Data source:{" "}
            <strong>Supabase PostgREST</strong> via{" "}
            <code style={{ fontSize: 11 }}>@supabase/supabase-js</code> — table{" "}
            <code style={{ fontSize: 11 }}>public.discipline_cases</code> (same data as Case Management).
            Sample metrics appear when no cases fall in the selected period.
          </p>
        </main>
  );

  if (standalone) {
    return <div className="sa-embed-do do-office-layout">{reportsMain}</div>;
  }

  return (
    <div className="dashboard-layout do-office-layout">
      <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />
      <div className="dashboard-main">
        <DisciplineOfficeTopBar />
        {reportsMain}
      </div>
    </div>
  );
}