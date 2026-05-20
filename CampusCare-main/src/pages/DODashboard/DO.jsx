import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
  Ban,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  Info,
  Plus,
  Scale,
  TrendingUp,
  User,
} from "lucide-react";
import { showToast } from "../../utils/toast";
import Sidebar from "../../components/Sidebar/Sidebar";
import { CASE_TYPE_OPTIONS, PRIORITY_OPTIONS, CASE_STATUS_LABELS } from "../../data/mockCases";
import { NU_PROGRAM_OPTIONS } from "../../data/nuPrograms";
import { canCreateDocumentRequest, labelForOfficeKey } from "../../constants/documentRequestAccess";
import { CONFERENCE_DURATION_OPTIONS } from "../../data/mockConferences";
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
import { useRealtimeIncidentReports } from "../../hooks/useRealtimeIncidentReports";
import {
  buildMonthGrid,
  conferenceCompletionBlockedReason,
  dateKey,
  effectiveConferenceStatus,
  endOfWeekSunday,
  fromDateInputToLabel,
  parseConferenceDate,
  parseConferenceStartDateTime,
  startOfWeekSunday,
  toDateInputValue,
} from "../../utils/conferenceCalendar";
import { isStaffCampusRole } from "../../utils/officeSession";
import { PROFILE_SETTINGS_PATH_DISCIPLINE } from "../../utils/profileSettingsRoutes";
import { readCampusCareSession } from "../../utils/campusCareSession";
import { getSupabaseAuthUserId } from "../../utils/campusCareAuth";
import {
  INTER_OFFICE_DOC_STATUS,
  canReceivingOfficeUploadDoc,
  isDocRequestDeclined,
  isDocRequestPendingApproval,
  isDocRequestApprovedForFulfillment,
  normalizeInterOfficeDocStatus,
  DISCIPLINE_REFERRAL_STATUS,
  isReferralPendingPartnerReview,
  isReferralPendingReferringReview,
  canReceivingOfficeReviewReferral,
} from "../../utils/interOfficeWorkflow";
import {
  formatCaseDateFromIso,
  formatCaseId,
  isPendingCaseStudentId,
  makeNextDisciplineCaseId,
  buildCaseInsertRowFromIncident,
} from "../../utils/disciplineCaseMapper";
import { CaseProgressStepperPanel } from "./CaseProgressStepperPanel";
import {
  INCIDENT_REPORT_TABLE,
  INCIDENT_REPORT_SELECT,
  IR_FILTER_TABS,
  IR_STATUS_MODAL_LABEL,
  buildIncidentReportConvertUpdate,
  buildIncidentReportRejectUpdate,
  buildIncidentReportUnderReviewUpdate,
  irCollectEmbeddedRosterHints,
  irAttachmentsForCaseEvidence,
  irAttachmentsList,
  irComplainantDisplay,
  irComplaineeDisplay,
  irDisplayReportId,
  irFormatDateTime,
  irFormatFiledOn,
  irFormatId,
  irImpact,
  irRejectionMessage,
  irIncidentType,
  irNarrative,
  irResolveComplaineeEmail,
  irRowSearchBlob,
  irStatusLabel,
  irStatusPillClass,
  irStaffCanRejectOrConvert,
  irStudentRosterMapAddRow,
  irTryExtractStudentId,
} from "../../utils/disciplineIncidentReportMapper";
import { generateNuStudentEmail } from "../../utils/nuStudentEmail";
import { buildDefaultNteEmailContent } from "../../services/disciplineNteNotice";
import {
  CaseManagementCaseActions,
  CaseManagementNteModal,
  CaseManagementCloseCaseModal,
} from "./CaseManagementCaseModals";
import {
  sanitizeDoStudentIdInput,
  sanitizePersonNameInput,
  studentIdDigitsOnly,
  validateDoStudentId,
  validatePersonName,
} from "../../utils/signupFieldValidation";
import {
  STANDING_LABELS,
  mergeStudentRecordsFromCases,
} from "../../utils/studentRecordsFromCases";
import {
  PERIOD_OPTIONS,
  buildReportsAnalytics,
  exportAnalyticsCsv,
  resolveReportsPeriodRange,
} from "../../utils/reportsAnalytics";
import { downloadDisciplineReportsPdf } from "../../reports/pdf/downloadDisciplineReportsPdf";
import { fileToEvidenceItem } from "../../utils/disciplineEvidence";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { appendEvidenceToInterOfficeRequest } from "../../services/interOfficeDocumentEvidence";
import {
  formatAttachmentSize,
  isImageMime,
  isPdfMime,
  checkIncidentAttachmentAccess,
  resolveIncidentAttachmentsForView,
  revokeIncidentAttachmentBlobUrls,
} from "../../services/incidentReportAttachments";
import { sendConferenceDiscussionSummaryToStudents } from "../../services/conferenceStudentNotifications";
import InterOfficeNewDocumentRequestModal from "../../components/interOffice/InterOfficeNewDocumentRequestModal";
import { DisciplineOfficeTopBar } from "./DisciplineOfficeTopBar";
import "../../components/common/ProgramSelect.css";
import "./DO.css";

export { DisciplineOfficeTopBar };

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
    "BS Computer Science",
    "BS Information Technology",
  ],
  "SBMA": [
    "BS Accountancy",
    "BS Management Accounting",
    "BS Business Administration major in Financial Management",
    "BSBA major in Marketing Management",
    "BSBA major in Human Resource Management",
    "BS Hospitality Management",
    "BS Tourism Management",
  ],
  "SASE": [
    "AB Communication",
    "BS Psychology",
    "Bachelor of Physical Education",
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
  let school = caseRow?.school || "";
  let offenseType = caseRow?.offenseType || "";
  let reportedBy = "";
  const chunks = [];
  for (const part of desc.split("\n\n")) {
    if (part.startsWith("Program: ")) {
      program = program || part.slice(9).trim();
    } else if (part.startsWith("School: ")) {
      school = school || part.slice(8).trim();
    } else if (part.startsWith("Offense Type: ")) {
      offenseType = offenseType || part.slice(14).trim();
    } else if (part.startsWith("Reported by: ")) {
      reportedBy = part.slice(13).trim();
    } else {
      chunks.push(part);
    }
  }
  return {
    program: program || "—",
    school: school || "—",
    offenseType: offenseType || "—",
    reportedBy: reportedBy || caseRow?.officer || "—",
    body: chunks.join("\n\n").trim() || desc,
  };
}

function evidenceToTags(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) return [];
  return evidence.map((e) => (typeof e === "string" ? e : e?.name)).filter(Boolean);
}

function DOEvidenceViewer({ evidence }) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return <p style={{ color: "#64748b", fontSize: 14 }}>No evidence submitted.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {evidence.map((ev, idx) => {
        const item = typeof ev === "string" ? { name: ev } : ev || {};
        const name = item.name || "Attachment";
        const dataUrl = item.dataUrl || "";
        const mime = String(item.mime || "").toLowerCase();
        const isImage = mime.startsWith("image/") && dataUrl;
        const isPdf =
          dataUrl &&
          (mime === "application/pdf" ||
            /\.pdf$/i.test(String(name || "")));

        const previewBox = {
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: 12,
          background: "#f8fafc",
        };
        const headerRow = {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        };
        const actionsRow = {
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 8,
          flexWrap: "wrap",
        };
        const viewLinkStyle = {
          fontSize: 13,
          fontWeight: 600,
          color: "#2563eb",
          textDecoration: "none",
        };
        const downloadLinkStyle = {
          fontSize: 13,
          fontWeight: 500,
          color: "#475569",
          textDecoration: "none",
        };

        return (
          <div key={`${name}-${idx}`} style={previewBox}>
            <div style={headerRow}>
              <div style={{ fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis" }} title={name}>
                {name}
              </div>
              {mime ? (
                <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>{mime}</span>
              ) : null}
            </div>

            {isImage ? (
              <a
                href={dataUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block" }}
              >
                <img
                  src={dataUrl}
                  alt={name}
                  style={{
                    maxWidth: "100%",
                    maxHeight: 320,
                    borderRadius: 8,
                    display: "block",
                    margin: "0 auto",
                    background: "#fff",
                  }}
                />
              </a>
            ) : null}

            {isPdf ? (
              <iframe
                src={dataUrl}
                title={name}
                style={{
                  width: "100%",
                  height: 360,
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  background: "#fff",
                }}
              />
            ) : null}

            {!isImage && !isPdf && dataUrl ? (
              <div style={{ fontSize: 13, color: "#475569" }}>
                Preview not available for this file type. Use View or Download below.
              </div>
            ) : null}

            {dataUrl ? (
              <div style={actionsRow}>
                <a href={dataUrl} target="_blank" rel="noopener noreferrer" style={viewLinkStyle}>
                  View
                </a>
                <a
                  href={dataUrl}
                  download={name}
                  rel="noopener noreferrer"
                  style={downloadLinkStyle}
                >
                  Download
                </a>
              </div>
            ) : (
              <span style={{ fontSize: 13, color: "#64748b" }}>
                Filename only (upload a new case to store a viewable copy).
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedCase, setSelectedCase] = useState(null);
  const {
    cases,
    loading: casesLoading,
    fetchError: casesError,
    refresh: refreshCases,
    updateCaseStatus,
  } = useCases([]);

  const [statusUpdate, setStatusUpdate] = useState("pending");
  const [statusNote, setStatusNote] = useState("");
  const [caseModalError, setCaseModalError] = useState(null);

  useEffect(() => {
    setCaseModalError(null);
  }, [selectedCase]);

  // New-case creation is owned by Case Management. If the dashboard receives
  // a legacy ?newCase=1 query param, hand control over to /case-management.
  useEffect(() => {
    if (searchParams.get("newCase") !== "1") return;
    navigate("/case-management?newCase=1", { replace: true });
  }, [searchParams, navigate]);

  const stats = useMemo(() => {
    const newCount = cases.filter((c) => c.status === "new").length;
    const pendingCount = cases.filter((c) => c.status === "pending").length;
    const closedCount = cases.filter((c) => c.status === "closed").length;
    return { newCount, pendingCount, closedCount };
  }, [cases]);

  const recentCases = useMemo(() => cases.slice(0, 5), [cases]);

  const upcomingHearings = useMemo(() => [], []);

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
            className="cc-modal do-modal do-modal--lg do-modal--case-detail"
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
                  <div className="do-info-row">
                    <p className="do-info-dt">School</p>
                    <p className="do-info-dd">{selectedMeta.school}</p>
                  </div>
                </div>
                <div className="do-info-card">
                  <div className="do-info-card-top">
                    <FileText size={18} strokeWidth={2} aria-hidden />
                    Case Information
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Offense type</p>
                    <p className="do-info-dd">{selectedMeta.offenseType}</p>
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
                <DOEvidenceViewer evidence={selectedCase.evidence} />
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

    </div>
  );
};



const TABS = [
  { key: "all", label: (cases) => `All Cases (${cases.length})` },
  {
    key: "new",
    label: (cases) =>
      `New (${cases.filter((c) => c.status === "new").length})`,
  },
  {
    key: "pending",
    label: (cases) =>
      `Pending (${cases.filter((c) => c.status === "pending").length})`,
  },
  {
    key: "ongoing",
    label: (cases) =>
      `Ongoing (${cases.filter((c) => c.status === "ongoing").length})`,
  },
  {
    key: "escalated",
    label: (cases) =>
      `Escalated (${cases.filter((c) => c.status === "escalated").length})`,
  },
  {
    key: "closed",
    label: (cases) =>
      `Closed (${cases.filter((c) => c.status === "closed").length})`,
  },
];

const CM_StatusBadge = ({ status }) => {
  const key = String(status || "new").toLowerCase();
  const label = CASE_STATUS_LABELS[key] || key;
  return <span className={`badge badge-${key}`}>{label}</span>;
};

export function CaseManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedCaseWorkflow, setSelectedCaseWorkflow] = useState({
    loading: false,
    nteRows: [],
    sanctions: [],
    proofs: [],
    proofFiles: [],
  });
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [openDropdownIdCm, setOpenDropdownIdCm] = useState(null);
  const [searchField, setSearchField] = useState("all");
  const {
    cases,
    loading: casesLoading,
    fetchError: casesError,
    refresh: refreshCases,
    createCase,
    updateCaseStatus,
    updateCaseFields,
    escalateCase,
    closeCase,
    syncOngoingStatus,
  } = useCases([]);

  const { conferences } = useCaseConferences(DO_CONFERENCES_SEED);

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
  const [newCaseStudentSearch, setNewCaseStudentSearch] = useState("");
  const [newCaseStudentMatches, setNewCaseStudentMatches] = useState([]);
  const [newCaseStudentLoading, setNewCaseStudentLoading] = useState(false);
  const [showStudentSearchDropdown, setShowStudentSearchDropdown] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [caseModalError, setCaseModalError] = useState(null);
  const [nteModalOpen, setNteModalOpen] = useState(false);
  const [nteToEmail, setNteToEmail] = useState("");
  const [nteSubject, setNteSubject] = useState("");
  const [nteBody, setNteBody] = useState("");
  const [nteSending, setNteSending] = useState(false);
  const [closeCaseOpen, setCloseCaseOpen] = useState(false);
  const [closeCaseStep, setCloseCaseStep] = useState(1);
  const [closureSummary, setClosureSummary] = useState("");
  const [closeConfirmChecked, setCloseConfirmChecked] = useState(false);
  const [closePassword, setClosePassword] = useState("");
  const [closeCaseSubmitting, setCloseCaseSubmitting] = useState(false);
  const [resolveStudentOpen, setResolveStudentOpen] = useState(false);
  const [resolveStudentSearch, setResolveStudentSearch] = useState("");
  const [resolveStudentMatches, setResolveStudentMatches] = useState([]);
  const [resolveStudentLoading, setResolveStudentLoading] = useState(false);
  const [caseProgressSaving, setCaseProgressSaving] = useState(false);
  const selectedMetaCm = selectedCase ? parseCaseMeta(selectedCase) : null;
  const selectedCaseNeedsIdentity = selectedCase ? isPendingCaseStudentId(selectedCase.studentId) : false;

  const caseConferencesForSelected = useMemo(() => {
    if (!selectedCase) return [];
    return conferences.filter((c) => String(c.caseId) === String(selectedCase.id));
  }, [conferences, selectedCase]);

  const hasActiveScheduledConference = useMemo(() => {
    return caseConferencesForSelected.some((c) => effectiveConferenceStatus(c) === "scheduled");
  }, [caseConferencesForSelected]);

  useEffect(() => {
    setCaseModalError(null);
  }, [selectedCase]);

  const loadSelectedCaseWorkflow = useCallback(
    async (caseId, { silent = false } = {}) => {
      if (!caseId || !isSupabaseConfigured() || !supabase) return;
      if (!silent) {
        setSelectedCaseWorkflow((prev) => ({ ...prev, loading: true }));
      }
      try {
        const [nteRes, sanctionRes] = await Promise.all([
          supabase.from("discipline_nte").select("*").eq("case_id", caseId),
          supabase.from("discipline_sanctions").select("*").eq("case_id", caseId),
        ]);
        const sanctions = sanctionRes.data || [];
        const sanctionIds = sanctions.map((s) => s.id).filter(Boolean);
        const proofRes = sanctionIds.length
          ? await supabase.from("discipline_proof_submissions").select("*").in("sanction_id", sanctionIds)
          : { data: [] };
        const proofIds = (proofRes.data || []).map((p) => p.id).filter(Boolean);
        const proofFileRes = proofIds.length
          ? await supabase.from("discipline_proof_files").select("*").in("submission_id", proofIds)
          : { data: [] };
        const nteRows = nteRes.data || [];
        setSelectedCaseWorkflow({
          loading: false,
          nteRows,
          sanctions,
          proofs: proofRes.data || [],
          proofFiles: proofFileRes.data || [],
        });
      } catch {
        setSelectedCaseWorkflow({ loading: false, nteRows: [], sanctions: [], proofs: [], proofFiles: [] });
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedCase || !isSupabaseConfigured() || !supabase) {
      setSelectedCaseWorkflow({ loading: false, nteRows: [], sanctions: [], proofs: [], proofFiles: [] });
      return undefined;
    }
    let cancelled = false;
    void loadSelectedCaseWorkflow(selectedCase.id).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCase, loadSelectedCaseWorkflow]);

  useEffect(() => {
    if (!selectedCase || !isSupabaseConfigured() || !supabase) return undefined;
    const caseId = selectedCase.id;
    let timerId = null;
    const schedule = () => {
      if (timerId != null) return;
      timerId = window.setTimeout(() => {
        timerId = null;
        void loadSelectedCaseWorkflow(caseId, { silent: true });
      }, 300);
    };

    const channel = supabase
      .channel(`case-workflow-realtime-${caseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discipline_nte", filter: `case_id=eq.${caseId}` },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discipline_sanctions", filter: `case_id=eq.${caseId}` },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discipline_proof_submissions" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discipline_proof_files" },
        schedule,
      )
      .subscribe();

    return () => {
      if (timerId != null) window.clearTimeout(timerId);
      supabase.removeChannel(channel);
    };
  }, [selectedCase, loadSelectedCaseWorkflow]);

  const studentSearchDebounceRef = useRef(null);
  const studentSearchSeqRef = useRef(0);
  const STUDENT_SEARCH_LIMIT = 15;
  const STUDENT_SEARCH_DEBOUNCE_MS = 250;

  const runStudentSearch = useCallback(async (rawQuery) => {
    const q = rawQuery.trim();
    if (!q || q.length < 2) {
      setNewCaseStudentMatches([]);
      setNewCaseStudentLoading(false);
      return;
    }
    if (!isSupabaseConfigured() || !supabase) return;
    const requestId = ++studentSearchSeqRef.current;
    setNewCaseStudentLoading(true);
    try {
      const safe = q.replace(/[%(),]/g, " ").trim();
      const { data, error } = await supabase
        .from("students")
        .select("id, email, first_name, last_name, full_name, program, student_id")
        .or(
          [
            `student_id.ilike.%${safe}%`,
            `email.ilike.%${safe}%`,
            `first_name.ilike.%${safe}%`,
            `last_name.ilike.%${safe}%`,
            `full_name.ilike.%${safe}%`,
          ].join(","),
        )
        .limit(STUDENT_SEARCH_LIMIT);
      if (requestId !== studentSearchSeqRef.current) return;
      if (error) throw error;
      setNewCaseStudentMatches(data || []);
      setShowStudentSearchDropdown(true);
    } catch (err) {
      if (requestId !== studentSearchSeqRef.current) return;
      console.error("Student search error:", err);
      setNewCaseStudentMatches([]);
    } finally {
      if (requestId === studentSearchSeqRef.current) {
        setNewCaseStudentLoading(false);
      }
    }
  }, []);

  const searchStudentsForNewCase = useCallback(
    (searchQuery) => {
      if (studentSearchDebounceRef.current) {
        window.clearTimeout(studentSearchDebounceRef.current);
        studentSearchDebounceRef.current = null;
      }
      const q = String(searchQuery || "").trim();
      if (!q || q.length < 2) {
        studentSearchSeqRef.current += 1;
        setNewCaseStudentMatches([]);
        setNewCaseStudentLoading(false);
        return;
      }
      setNewCaseStudentLoading(true);
      studentSearchDebounceRef.current = window.setTimeout(() => {
        studentSearchDebounceRef.current = null;
        void runStudentSearch(q);
      }, STUDENT_SEARCH_DEBOUNCE_MS);
    },
    [runStudentSearch],
  );

  useEffect(() => {
    return () => {
      if (studentSearchDebounceRef.current) {
        window.clearTimeout(studentSearchDebounceRef.current);
        studentSearchDebounceRef.current = null;
      }
    };
  }, []);

  const selectStudentForNewCase = useCallback((student) => {
    const fullName =
      String(student.full_name || "").trim() ||
      [student.first_name, student.last_name].filter(Boolean).join(" ").trim();
    setNewCaseForm((prev) => ({
      ...prev,
      student: fullName || student.email,
      studentId: student.student_id,
      program: student.program || prev.program,
    }));
    setNewCaseStudentSearch(fullName || student.email);
    setShowStudentSearchDropdown(false);
    setNewCaseStudentMatches([]);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      setShowStudentSearchDropdown(false);
    };
    if (showStudentSearchDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showStudentSearchDropdown]);

  const searchRespondentStudents = useCallback(async () => {
    const q = resolveStudentSearch.trim();
    if (!q || q.length < 2) {
      setResolveStudentMatches([]);
      return;
    }
    if (!isSupabaseConfigured() || !supabase) {
      setCaseModalError("Supabase is not configured.");
      return;
    }
    setResolveStudentLoading(true);
    setCaseModalError(null);
    try {
      const safe = q.replace(/[%(),]/g, " ").trim();
      const { data, error } = await supabase
        .from("students")
        .select("id, email, first_name, last_name, program, student_id")
        .or(
          `student_id.ilike.%${safe}%,email.ilike.%${safe}%,first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`,
        )
        .limit(12);
      if (error) throw error;
      setResolveStudentMatches(data || []);
    } catch (err) {
      setCaseModalError(err?.message || "Could not search students.");
    } finally {
      setResolveStudentLoading(false);
    }
  }, [resolveStudentSearch]);

  const resolveCaseRespondent = useCallback(
    async (student) => {
      if (!selectedCase || !student) return;
      const fullName = [student.first_name, student.last_name].filter(Boolean).join(" ").trim();
      const patch = {
        student_name: fullName || selectedCase.student,
        student_id: student.student_id,
        program: student.program || selectedCase.program || "",
        respondent_email: student.email || selectedCase.respondentEmail || "",
        respondent_user_id: student.id,
      };
      try {
        await updateCaseFields(selectedCase.id, patch, "[Identity] Respondent linked to student record.");
        await refreshCases();
        setSelectedCase((prev) =>
          prev
            ? {
                ...prev,
                student: patch.student_name,
                studentId: patch.student_id,
                program: patch.program,
                respondentEmail: patch.respondent_email,
                respondentUserId: patch.respondent_user_id,
              }
            : prev,
        );
        setResolveStudentOpen(false);
        setResolveStudentSearch("");
        setResolveStudentMatches([]);
        showToast("Respondent identity resolved.", { variant: "success" });
      } catch (err) {
        setCaseModalError(err?.message || "Could not resolve respondent identity.");
      }
    },
    [selectedCase, updateCaseFields, refreshCases],
  );

  const saveCaseProgressPatch = useCallback(
    async (patch) => {
      if (!selectedCase) return;
      setCaseProgressSaving(true);
      setCaseModalError(null);
      try {
        await updateCaseFields(selectedCase.id, patch, "[Progress] Student-facing case progress updated.");
        await refreshCases();
        setSelectedCase((prev) =>
          prev
            ? {
                ...prev,
                caseSteps: patch.case_steps,
                progressPercent: patch.progress_percent,
                currentStepIndex: patch.current_step_index,
              }
            : prev,
        );
        showToast("Mobile case progress saved.", { variant: "success" });
      } catch (err) {
        setCaseModalError(err?.message || "Could not update case progress.");
        throw err;
      } finally {
        setCaseProgressSaving(false);
      }
    },
    [selectedCase, updateCaseFields, refreshCases],
  );

  useEffect(() => {
    if (!selectedCase || !syncOngoingStatus) return;
    const s = String(selectedCase.status || "").toLowerCase();
    if (s === "closed" || s === "escalated") return;
    void syncOngoingStatus(selectedCase.id, hasActiveScheduledConference);
  }, [selectedCase?.id, hasActiveScheduledConference, syncOngoingStatus, selectedCase?.status]);

  const openNteModal = useCallback(async (caseRow) => {
    if (isPendingCaseStudentId(caseRow.studentId)) {
      setCaseModalError(
        "Resolve the respondent identity before sending a mobile-linked NTE. If only email is known, use email-only outside the mobile workflow.",
      );
      setResolveStudentOpen(true);
      setResolveStudentSearch(caseRow.student || "");
      return;
    }
    const email =
      String(caseRow.respondentEmail || "").trim() ||
      generateNuStudentEmail(caseRow.student) ||
      "";

    let factualAntecedence;
    const irId = String(caseRow.sourceIncidentReportId || "").trim();
    if (irId && isSupabaseConfigured() && supabase) {
      try {
        const { data: irRow } = await supabase
          .from(INCIDENT_REPORT_TABLE)
          .select("narrative, statement_of_incident, description")
          .eq("id", irId)
          .maybeSingle();
        if (irRow) {
          const narrative = irNarrative(irRow);
          if (narrative && narrative !== "—") {
            factualAntecedence = narrative;
          } else {
            const stmt = String(irRow.statement_of_incident ?? "").trim();
            const desc = String(irRow.description ?? "").trim();
            if (stmt) factualAntecedence = stmt;
            else if (desc) factualAntecedence = desc;
          }
        }
      } catch {
        // Best-effort prefill; ignore fetch errors and keep placeholder.
      }
    }

    const content = buildDefaultNteEmailContent(caseRow.student, caseRow.id, {
      caseType: caseRow.caseType,
      offenseType: caseRow.offenseType,
      factualAntecedence,
    });
    setNteToEmail(email);
    setNteSubject(content.subject);
    setNteBody(content.textBody);
    setNteModalOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get("newCase") !== "1") return;
    setIsNewCaseOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("newCase");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const caseKey = String(searchParams.get("case") || "").trim();
    if (!caseKey || cases.length === 0) return;
    const found = cases.find((c) => String(c.id || "").toLowerCase() === caseKey.toLowerCase());
    if (found) setSelectedCase(found);
  }, [searchParams, cases]);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "new" && c.status === "new") ||
        (activeTab === "pending" && c.status === "pending") ||
        (activeTab === "ongoing" && c.status === "ongoing") ||
        (activeTab === "escalated" && c.status === "escalated") ||
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

      return matchesTab && matchesSearch;
    });
  }, [cases, activeTab, search, searchField]);

  const stats = useMemo(() => {
    return {
      total: cases.length,
      newCount: cases.filter((c) => c.status === "new").length,
      pending: cases.filter((c) => c.status === "pending").length,
      ongoing: cases.filter((c) => c.status === "ongoing").length,
      escalated: cases.filter((c) => c.status === "escalated").length,
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
              <Plus size={16} strokeWidth={2} aria-hidden />
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
                    <th className="cases-table-col-action">Action</th>
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
                      <td className="cases-table-col-action">
                        <button
                          className="btn-view btn-view--fixed"
                          type="button"
                          onClick={() => {
                            setSelectedCase(c);
                            setStatusNote("");
                            setCloseCaseOpen(false);
                            setNteModalOpen(false);
                          }}
                        >
                          <Eye size={16} strokeWidth={2} aria-hidden />
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

      {selectedCase && !nteModalOpen && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setSelectedCase(null)}
        >
          <div
            className="cc-modal do-modal do-modal--lg do-modal--case-detail"
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
                  <h2 className="do-modal-heading">Case Details</h2>
                  <p className="do-modal-sub">Complete information about the disciplinary case</p>
                </div>
              </div>
            </div>

            <div className="do-modal-body-scroll">
              {selectedMetaCm && (
                <>
                  <div className="do-case-banner" style={{
                    background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                    padding: "20px 24px",
                    borderRadius: 12,
                    marginBottom: 24,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 28, fontWeight: 700, color: "#fff", margin: 0, marginBottom: 4 }}>
                          {formatCaseId(selectedCase.id)}
                        </p>
                        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.9)", margin: 0, marginBottom: 12 }}>
                          {selectedCase.caseType}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <div style={{
                            background: "rgba(255,255,255,0.2)",
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 13,
                            color: "#fff",
                          }}>
                            <User size={14} style={{ display: "inline-block", marginRight: 6 }} />
                            {selectedCase.student}
                          </div>
                          <div style={{
                            background: "rgba(255,255,255,0.2)",
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 13,
                            color: "#fff",
                          }}>
                            {selectedCase.studentId}
                          </div>
                        </div>
                      </div>
                      <CM_StatusBadge status={selectedCase.status} />
                    </div>
                    {selectedCaseNeedsIdentity && (
                      <div style={{
                        marginTop: 16,
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: "rgba(253, 224, 71, 0.95)",
                        color: "#854d0e",
                        fontSize: 13,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}>
                        <span>⚠️ Respondent identity not verified. Resolve before enabling mobile workflows.</span>
                        <button
                          type="button"
                          className="cc-btn-secondary"
                          style={{ height: 32, fontSize: 13 }}
                          onClick={() => {
                            setResolveStudentOpen(true);
                            setResolveStudentSearch(selectedCase.student || "");
                          }}
                        >
                          Resolve Student
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
                    <div className="do-info-card" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "#1e40af", fontWeight: 600 }}>
                        <User size={18} strokeWidth={2.5} />
                        <span>Student Details</span>
                      </div>
                      <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
                        <div>
                          <div style={{ color: "#64748b", fontSize: 12, marginBottom: 2 }}>Program</div>
                          <div style={{ fontWeight: 500 }}>{selectedMetaCm.program}</div>
                        </div>
                        <div>
                          <div style={{ color: "#64748b", fontSize: 12, marginBottom: 2 }}>School</div>
                          <div style={{ fontWeight: 500 }}>{selectedMetaCm.school}</div>
                        </div>
                        {selectedCase.respondentEmail && (
                          <div>
                            <div style={{ color: "#64748b", fontSize: 12, marginBottom: 2 }}>Email</div>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{selectedCase.respondentEmail}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="do-info-card" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "#1e40af", fontWeight: 600 }}>
                        <FileText size={18} strokeWidth={2.5} />
                        <span>Case Details</span>
                      </div>
                      <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
                        <div>
                          <div style={{ color: "#64748b", fontSize: 12, marginBottom: 2 }}>Offense Type</div>
                          <div style={{ fontWeight: 500 }}>{selectedMetaCm.offenseType}</div>
                        </div>
                        <div>
                          <div style={{ color: "#64748b", fontSize: 12, marginBottom: 2 }}>Filed Date</div>
                          <div style={{ fontWeight: 500 }}>{selectedCase.date}</div>
                        </div>
                        <div>
                          <div style={{ color: "#64748b", fontSize: 12, marginBottom: 2 }}>Assigned Officer</div>
                          <div style={{ fontWeight: 500 }}>{selectedCase.officer || "—"}</div>
                        </div>
                        {selectedCase.nteSentAt && (
                          <div>
                            <div style={{ color: "#64748b", fontSize: 12, marginBottom: 2 }}>NTE Sent</div>
                            <div style={{ fontWeight: 500 }}>{formatCaseDateFromIso(selectedCase.nteSentAt)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="do-section-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "#1e40af" }}>
                      <FileText size={18} strokeWidth={2.5} />
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Case Description</h4>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#334155" }}>
                      {selectedMetaCm.body || "No description provided."}
                    </p>
                  </div>

                  <div
                    className="do-section-card do-section-card--stepper"
                    style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 20 }}
                  >
                    <CaseProgressStepperPanel
                      caseRow={selectedCase}
                      linkedNteRows={selectedCaseWorkflow.nteRows}
                      saving={caseProgressSaving}
                      onSave={saveCaseProgressPatch}
                    />
                  </div>

                  <div className="do-section-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "#1e40af" }}>
                      <ClipboardList size={18} strokeWidth={2.5} />
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Evidence Submitted</h4>
                    </div>
                    <DOEvidenceViewer evidence={selectedCase.evidence} />
                  </div>

                  <div className="do-section-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "#1e40af" }}>
                      <Scale size={18} strokeWidth={2.5} />
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Mobile-Linked Workflow</h4>
                    </div>
                    {selectedCaseWorkflow.loading ? (
                      <p style={{ color: "#64748b", margin: 0 }}>Loading linked mobile workflow…</p>
                    ) : (
                      <div style={{ display: "grid", gap: 20 }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
                            <strong style={{ fontSize: 14, color: "#334155" }}>📋 NTE Notices</strong>
                            <Link 
                              to="/nte-responses" 
                              onClick={() => setSelectedCase(null)}
                              style={{ fontSize: 13, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
                            >
                              View All →
                            </Link>
                          </div>
                          {selectedCaseWorkflow.nteRows.length > 0 ? (
                            <div className="cc-table-wrapper">
                              <table className="cc-table">
                                <thead>
                                  <tr>
                                    <th>NTE</th>
                                    <th>Status</th>
                                    <th>Issued</th>
                                    <th>Responded</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedCaseWorkflow.nteRows.map((n) => (
                                    <tr key={n.id}>
                                      <td style={{ fontWeight: 600 }}>{n.id}</td>
                                      <td><span className={`cc-pill ${statusClass(n.status)}`}>{n.status}</span></td>
                                      <td>{formatCaseDateFromIso(n.issued_at)}</td>
                                      <td>{n.responded_at ? formatCaseDateFromIso(n.responded_at) : "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p style={{ color: "#64748b", margin: 0 }}>
                              {selectedCaseNeedsIdentity ? "Resolve respondent before mobile NTE." : "No mobile NTE row yet."}
                            </p>
                          )}
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
                            <strong style={{ fontSize: 14, color: "#334155" }}>⚖️ Sanctions</strong>
                            <Link 
                              to="/sanctions" 
                              onClick={() => setSelectedCase(null)}
                              style={{ fontSize: 13, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
                            >
                              View All →
                            </Link>
                          </div>
                          {selectedCaseWorkflow.sanctions.length > 0 ? (
                            <div className="cc-table-wrapper">
                              <table className="cc-table">
                                <thead>
                                  <tr>
                                    <th>Sanction</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Hours</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedCaseWorkflow.sanctions.map((s) => (
                                    <tr key={s.id}>
                                      <td style={{ fontWeight: 600 }}>{s.id}</td>
                                      <td>{s.sanction_type || "—"}</td>
                                      <td><span className={`cc-pill ${statusClass(s.status)}`}>{s.status}</span></td>
                                      <td>{s.hours ? `${s.completed_hours || 0} / ${s.hours}` : "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p style={{ color: "#64748b", margin: 0 }}>
                              {selectedCaseNeedsIdentity ? "Resolve respondent before mobile-visible sanctions." : "No sanctions linked."}
                            </p>
                          )}
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
                            <strong style={{ fontSize: 14, color: "#334155" }}>📎 Proof Submissions</strong>
                            <Link 
                              to="/proof-submissions" 
                              onClick={() => setSelectedCase(null)}
                              style={{ fontSize: 13, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
                            >
                              View All →
                            </Link>
                          </div>
                          {selectedCaseWorkflow.proofs.length > 0 ? (
                            <div className="cc-table-wrapper">
                              <table className="cc-table">
                                <thead>
                                  <tr>
                                    <th>Submission</th>
                                    <th>Sanction</th>
                                    <th>Status</th>
                                    <th>Files</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedCaseWorkflow.proofs.map((p) => {
                                    const fileCount = selectedCaseWorkflow.proofFiles.filter((f) => String(f.submission_id) === String(p.id)).length;
                                    return (
                                      <tr key={p.id}>
                                        <td style={{ fontWeight: 600 }}>{String(p.id).slice(0, 8)}</td>
                                        <td>{p.sanction_id}</td>
                                        <td><span className={`cc-pill ${statusClass(p.status)}`}>{p.status}</span></td>
                                        <td>{fileCount}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p style={{ color: "#64748b", margin: 0 }}>No proof submissions yet.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {resolveStudentOpen ? (
                    <div className="do-section-card">
                      <h4>Resolve Respondent Identity</h4>
                      <p style={{ marginTop: 0, color: "#64748b", fontSize: 14 }}>
                        Search the student registry and link this case before enabling mobile NTE,
                        sanctions, or proof workflows.
                      </p>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          className="cc-input"
                          value={resolveStudentSearch}
                          onChange={(e) => setResolveStudentSearch(e.target.value)}
                          placeholder="Search by name, email, or student ID"
                        />
                        <button
                          className="cc-btn-secondary"
                          type="button"
                          disabled={resolveStudentLoading}
                          onClick={searchRespondentStudents}
                        >
                          Search
                        </button>
                      </div>
                      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                        {resolveStudentMatches.map((student) => {
                          const fullName = [student.first_name, student.last_name].filter(Boolean).join(" ").trim();
                          return (
                            <button
                              key={student.id}
                              type="button"
                              className="cc-btn-secondary"
                              style={{
                                height: "auto",
                                justifyContent: "flex-start",
                                padding: "10px 12px",
                                textAlign: "left",
                              }}
                              onClick={() => resolveCaseRespondent(student)}
                            >
                              <span>
                                <strong>{fullName || student.email}</strong>
                                <br />
                                <span style={{ color: "#64748b", fontSize: 12 }}>
                                  {student.student_id} · {student.email} · {student.program || "No program"}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                        {!resolveStudentLoading &&
                          resolveStudentSearch.trim().length >= 2 &&
                          resolveStudentMatches.length === 0 ? (
                            <div style={{ color: "#64748b", fontSize: 13 }}>No matches yet. Try another name or ID.</div>
                          ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              <CaseManagementCaseActions
                selectedCase={selectedCase}
                statusNote={statusNote}
                setStatusNote={setStatusNote}
                caseModalError={caseModalError}
                setCaseModalError={setCaseModalError}
                openNteModal={openNteModal}
                escalateCase={escalateCase}
                refreshCases={refreshCases}
                setSelectedCase={setSelectedCase}
                setCloseCaseStep={setCloseCaseStep}
                setClosureSummary={setClosureSummary}
                setCloseConfirmChecked={setCloseConfirmChecked}
                setClosePassword={setClosePassword}
                setCloseCaseOpen={setCloseCaseOpen}
              />
            </div>
          </div>
        </div>
      )}

      <CaseManagementNteModal
        selectedCase={selectedCase}
        nteModalOpen={nteModalOpen}
        setNteModalOpen={setNteModalOpen}
        nteToEmail={nteToEmail}
        setNteToEmail={setNteToEmail}
        nteSubject={nteSubject}
        setNteSubject={setNteSubject}
        nteBody={nteBody}
        setNteBody={setNteBody}
        nteSending={nteSending}
        setNteSending={setNteSending}
        caseModalError={caseModalError}
        setCaseModalError={setCaseModalError}
        refreshCases={refreshCases}
        setSelectedCase={setSelectedCase}
      />

      <CaseManagementCloseCaseModal
        selectedCase={selectedCase}
        closeCaseOpen={closeCaseOpen}
        setCloseCaseOpen={setCloseCaseOpen}
        closeCaseStep={closeCaseStep}
        setCloseCaseStep={setCloseCaseStep}
        closureSummary={closureSummary}
        setClosureSummary={setClosureSummary}
        closeConfirmChecked={closeConfirmChecked}
        setCloseConfirmChecked={setCloseConfirmChecked}
        closePassword={closePassword}
        setClosePassword={setClosePassword}
        closeCaseSubmitting={closeCaseSubmitting}
        setCloseCaseSubmitting={setCloseCaseSubmitting}
        caseModalError={caseModalError}
        setCaseModalError={setCaseModalError}
        caseConferencesForSelected={caseConferencesForSelected}
        closeCase={closeCase}
        refreshCases={refreshCases}
        setSelectedCase={setSelectedCase}
      />

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
                  <h2 className="do-modal-heading do-modal-heading--blue">File New Disciplinary Case</h2>
                  <p className="do-modal-sub">Enter the details of the disciplinary case to be filed</p>
                </div>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const nextErrors = {};
                const nmErr = validatePersonName(newCaseForm.student, "Student name");
                if (nmErr) nextErrors.student = nmErr;
                const sidErr = validateDoStudentId(newCaseForm.studentId, "Student ID");
                if (sidErr) nextErrors.studentId = sidErr;
                if (!newCaseForm.caseType) nextErrors.caseType = "Case type is required.";
                if (!newCaseForm.school) nextErrors.school = "School is required.";
                if (!newCaseForm.offenseType) nextErrors.offenseType = "Offense type is required.";
                if (!newCaseForm.description.trim()) nextErrors.description = "Case description is required.";
                if (!newCaseEvidence) nextErrors.evidence = "Attach an evidence document (PDF, Word, image, etc.).";
                setNewCaseErrors(nextErrors);
                if (Object.keys(nextErrors).length > 0) return;

                let evidenceItems = [];
                try {
                  evidenceItems = [await fileToEvidenceItem(newCaseEvidence)];
                } catch (err) {
                  setNewCaseErrors({ evidence: err?.message || "Could not read evidence file." });
                  return;
                }

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
                    studentId: sanitizeDoStudentIdInput(newCaseForm.studentId.trim()),
                    caseType: newCaseForm.caseType,
                    description: caseDescription,
                    program: newCaseForm.program,
                    school: newCaseForm.school,
                    offenseType: newCaseForm.offenseType,
                    reportedBy: newCaseForm.reportedBy,
                    evidence: evidenceItems,
                    officer: "Discipline Office",
                  });
                  setIsNewCaseOpen(false);
                  setOpenDropdownIdCm(null);
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
                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="cm-nf-student-search">
                    Search Student <span className="req">*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="cm-nf-student-search"
                      className={`cc-input${newCaseErrors.student ? " cc-input-error" : ""}`}
                      placeholder="Type student name or ID to search..."
                      value={newCaseStudentSearch}
                      onChange={(e) => {
                        setNewCaseStudentSearch(e.target.value);
                        searchStudentsForNewCase(e.target.value);
                      }}
                      onFocus={() => {
                        if (newCaseStudentMatches.length > 0) {
                          setShowStudentSearchDropdown(true);
                        }
                      }}
                      autoComplete="off"
                      aria-invalid={Boolean(newCaseErrors.student)}
                    />
                    {newCaseStudentLoading && (
                      <div style={{ 
                        position: "absolute", 
                        right: 12, 
                        top: "50%", 
                        transform: "translateY(-50%)",
                        color: "#64748b",
                        fontSize: 13
                      }}>
                        Searching...
                      </div>
                    )}
                    {showStudentSearchDropdown && newCaseStudentMatches.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: 4,
                          background: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: 10,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          maxHeight: 240,
                          overflowY: "auto",
                          zIndex: 1000,
                        }}
                      >
                        {newCaseStudentMatches.map((student) => {
                          const fullName =
                            String(student.full_name || "").trim() ||
                            [student.first_name, student.last_name].filter(Boolean).join(" ").trim();
                          return (
                            <button
                              key={student.id}
                              type="button"
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                border: "none",
                                background: "transparent",
                                textAlign: "left",
                                cursor: "pointer",
                                borderBottom: "1px solid #f1f5f9",
                                transition: "background 0.15s",
                              }}
                              onMouseEnter={(e) => (e.target.style.background = "#f8fafc")}
                              onMouseLeave={(e) => (e.target.style.background = "transparent")}
                              onClick={() => selectStudentForNewCase(student)}
                            >
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                {fullName || student.email}
                              </div>
                              <div style={{ fontSize: 12, color: "#64748b" }}>
                                {student.student_id} · {student.program || "No program"}
                              </div>
                            </button>
                          );
                        })}
                        {newCaseStudentMatches.length >= STUDENT_SEARCH_LIMIT ? (
                          <div
                            style={{
                              padding: "8px 12px",
                              fontSize: 12,
                              color: "#64748b",
                              borderTop: "1px solid #f1f5f9",
                              background: "#f8fafc",
                            }}
                          >
                            Showing first {STUDENT_SEARCH_LIMIT}. Type more to narrow the results.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {newCaseErrors.student && (
                    <div className="cc-form-error" role="alert">
                      {newCaseErrors.student}
                    </div>
                  )}
                </div>

                <div className="do-form-grid2">
                  <div className="do-form-cell" style={{ marginBottom: 0 }}>
                    <label className="do-form-label" htmlFor="cm-nf-student">
                      Student Name <span className="req">*</span>
                    </label>
                    <input
                      id="cm-nf-student"
                      className="cc-input"
                      value={newCaseForm.student}
                      readOnly
                      style={{ background: "#f8fafc", cursor: "not-allowed" }}
                      placeholder="Auto-filled from search"
                    />
                  </div>
                  <div className="do-form-cell" style={{ marginBottom: 0 }}>
                    <label className="do-form-label" htmlFor="cm-nf-sid">
                      Student ID <span className="req">*</span>
                    </label>
                    <input
                      id="cm-nf-sid"
                      className="cc-input"
                      value={newCaseForm.studentId}
                      readOnly
                      style={{ background: "#f8fafc", cursor: "not-allowed" }}
                      placeholder="Auto-filled from search"
                    />
                  </div>
                </div>

                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="cm-nf-school">
                    School <span className="req">*</span>
                  </label>
                  <CustomSelect
                    id="cm-nf-school"
                    value={newCaseForm.school}
                    onChange={(v) => {
                      setNewCaseForm((p) => ({ ...p, school: v, program: "" }));
                      setOpenDropdownIdCm(null);
                    }}
                    options={DO_SCHOOL_OPTIONS}
                    placeholder="Select school"
                    error={Boolean(newCaseErrors.school)}
                    isOpen={openDropdownIdCm === "cm-nf-school"}
                    onOpen={() => setOpenDropdownIdCm("cm-nf-school")}
                    onClose={() => setOpenDropdownIdCm(null)}
                  />
                  {newCaseErrors.school && (
                    <div className="cc-form-error" role="alert">
                      {newCaseErrors.school}
                    </div>
                  )}
                </div>

                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="cm-nf-program">
                    Program / Course
                  </label>
                  <CustomSelect
                    id="cm-nf-program"
                    value={newCaseForm.program}
                    onChange={(v) => {
                      setNewCaseForm((p) => ({ ...p, program: v }));
                      setOpenDropdownIdCm(null);
                    }}
                    options={newCaseForm.school ? getProgramsForSchool(newCaseForm.school) : NU_PROGRAM_OPTIONS}
                    placeholder="Select program / course"
                    error={false}
                    isOpen={openDropdownIdCm === "cm-nf-program"}
                    onOpen={() => setOpenDropdownIdCm("cm-nf-program")}
                    onClose={() => setOpenDropdownIdCm(null)}
                  />
                </div>

                <div className="do-form-grid2 do-form-grid2--tight">
                  <div className="do-form-cell" style={{ marginBottom: 0 }}>
                    <label className="do-form-label" htmlFor="cm-nf-offense-type">
                      Offense Type <span className="req">*</span>
                    </label>
                    <CustomSelect
                      id="cm-nf-offense-type"
                      value={newCaseForm.offenseType}
                      onChange={(v) => {
                        setNewCaseForm((p) => ({ ...p, offenseType: v, caseType: "" }));
                        setOpenDropdownIdCm(null);
                      }}
                      options={DO_OFFENSE_TYPE_OPTIONS}
                      placeholder="Select offense type"
                      error={Boolean(newCaseErrors.offenseType)}
                      isOpen={openDropdownIdCm === "cm-nf-offense-type"}
                      onOpen={() => setOpenDropdownIdCm("cm-nf-offense-type")}
                      onClose={() => setOpenDropdownIdCm(null)}
                    />
                    {newCaseErrors.offenseType && (
                      <div className="cc-form-error" role="alert">
                        {newCaseErrors.offenseType}
                      </div>
                    )}
                  </div>
                  <div className="do-form-cell" style={{ marginBottom: 0 }}>
                    <label className="do-form-label" htmlFor="cm-nf-ctype">
                      Case Type <span className="req">*</span>
                    </label>
                    <CustomSelect
                      id="cm-nf-ctype"
                      value={newCaseForm.caseType}
                      onChange={(v) => {
                        setNewCaseForm((p) => ({ ...p, caseType: v }));
                        setOpenDropdownIdCm(null);
                      }}
                      options={
                        newCaseForm.offenseType
                          ? getCaseTypesForOffenseType(newCaseForm.offenseType)
                          : CASE_TYPE_OPTIONS
                      }
                      placeholder="Select case type"
                      error={Boolean(newCaseErrors.caseType)}
                      isOpen={openDropdownIdCm === "cm-nf-ctype"}
                      onOpen={() => setOpenDropdownIdCm("cm-nf-ctype")}
                      onClose={() => setOpenDropdownIdCm(null)}
                    />
                    {newCaseErrors.caseType && (
                      <div className="cc-form-error" role="alert">
                        {newCaseErrors.caseType}
                      </div>
                    )}
                  </div>
                </div>

                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="cm-nf-desc">
                    Case Description <span className="req">*</span>
                  </label>
                  <textarea
                    id="cm-nf-desc"
                    className={`cc-textarea${newCaseErrors.description ? " cc-input-error" : ""}`}
                    placeholder="Provide detailed description of the incident…"
                    value={newCaseForm.description}
                    onChange={(e) => setNewCaseForm((p) => ({ ...p, description: e.target.value }))}
                    aria-invalid={Boolean(newCaseErrors.description)}
                  />
                  {newCaseErrors.description && (
                    <div className="cc-form-error" role="alert">
                      {newCaseErrors.description}
                    </div>
                  )}
                </div>

                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="cm-nf-reporter">
                    Reported By
                  </label>
                  <input
                    id="cm-nf-reporter"
                    className="cc-input"
                    placeholder="Name of reporting person/office"
                    value={newCaseForm.reportedBy}
                    onChange={(e) => setNewCaseForm((p) => ({ ...p, reportedBy: e.target.value }))}
                  />
                </div>

                <div className="do-form-cell do-file-field" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="cm-nf-ev">
                    Evidence / Documents <span className="req">*</span>
                  </label>
                  <input
                    id="cm-nf-ev"
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
                  onClick={() => {
                    setIsNewCaseOpen(false);
                    setOpenDropdownIdCm(null);
                  }}
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

// ─────────────────────────────────────────────────────────────────────────────
// INCIDENT REPORT PAGE — paste above ConferencePill
// ─────────────────────────────────────────────────────────────────────────────

const IR_TABS = IR_FILTER_TABS.map((tab) => ({
  ...tab,
  count:
    tab.key === "all"
      ? (rows) => rows.length
      : (rows) => rows.filter((r) => r.status === tab.key).length,
}));

function IrIncidentStatusPill({ status }) {
  return (
    <span className={`cc-pill ${irStatusPillClass(status)}`}>{irStatusLabel(status)}</span>
  );
}

function IrIncidentAttachmentsViewer({ report }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const itemsRef = useRef([]);

  const attachmentMeta = useMemo(() => irAttachmentsList(report), [report]);

  const loadUrls = useCallback(async () => {
    revokeIncidentAttachmentBlobUrls(itemsRef.current);
    itemsRef.current = [];

    if (attachmentMeta.length === 0) {
      setItems([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setItems([]);
      setLoadError("Supabase is not configured; cannot load attachments.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const { items: resolved, sessionError } = await resolveIncidentAttachmentsForView(
        supabase,
        irAttachmentsList(report),
      );
      if (sessionError) {
        setItems([]);
        setLoadError(sessionError);
        return;
      }
      itemsRef.current = resolved;
      setItems(resolved);
    } catch (err) {
      setItems([]);
      setLoadError(err?.message || "Could not load attachments.");
    } finally {
      setLoading(false);
    }
  }, [attachmentMeta, report?.id]);

  useEffect(() => {
    loadUrls();
    return () => revokeIncidentAttachmentBlobUrls(itemsRef.current);
  }, [loadUrls]);

  if (attachmentMeta.length === 0) {
    return <p style={{ margin: 0, color: "#64748b" }}>No attachments submitted.</p>;
  }

  if (loading) {
    return <p style={{ margin: 0, color: "#64748b" }}>Loading attachments…</p>;
  }

  if (loadError && items.length === 0) {
    return (
      <div>
        <p className="cc-form-error" role="alert" style={{ marginBottom: 8 }}>
          {loadError}
        </p>
        <button type="button" className="cc-btn-secondary" style={{ height: 32 }} onClick={loadUrls}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="ir-attachment-viewer">
      {items.map((item) => {
        const sizeLabel = formatAttachmentSize(item.sizeBytes);
        const showImage = Boolean(item.viewUrl) && isImageMime(item.mimeType, item.fileName);
        const isPdf = isPdfMime(item.mimeType, item.fileName);

        return (
          <article key={item.key} className="ir-attachment-card">
            <div className="ir-attachment-card__head">
              <FileText size={18} strokeWidth={2} aria-hidden className="ir-attachment-card__icon" />
              <div className="ir-attachment-card__meta">
                <div className="ir-attachment-card__name">{item.fileName}</div>
                {(item.mimeType || sizeLabel) && (
                  <div className="ir-attachment-card__sub">
                    {[item.mimeType, sizeLabel].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </div>

            {item.urlError && (
              <p className="ir-attachment-card__error" role="alert">
                {item.urlError}
              </p>
            )}

            {showImage ? (
              <a
                href={item.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ir-attachment-card__preview-link"
              >
                <img
                  src={item.viewUrl}
                  alt={item.fileName}
                  className="ir-attachment-card__image"
                />
              </a>
            ) : null}

            {isPdf && item.viewUrl ? (
              <iframe
                title={item.fileName}
                src={item.viewUrl}
                className="ir-attachment-card__pdf"
              />
            ) : null}

            {item.viewUrl ? (
              <a
                href={item.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ir-attachment-card__open"
              >
                {showImage ? "Open full size" : isPdf ? "Open PDF in new tab" : "Open or download file"}
              </a>
            ) : !item.urlError ? (
              <span className="ir-attachment-card__muted">Preview unavailable.</span>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export function IncidentReportPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [irReports, setIrReports]           = useState([]);
  const [irLoading, setIrLoading]           = useState(true);
  const [irError, setIrError]               = useState(null);
  const [irActiveTab, setIrActiveTab]       = useState("all");
  const [irSearch, setIrSearch]             = useState("");
  const [irSearchField, setIrSearchField]   = useState("all");
  const [irSelected, setIrSelected]         = useState(null);
  const [irDetailActionError, setIrDetailActionError] = useState(null);

  const [irRejectTarget, setIrRejectTarget] = useState(null);
  const [irRejectCommon, setIrRejectCommon] = useState({
    duplicate: false,
    insufficient_evidence: false,
    lack_of_detail: false,
    wrong_jurisdiction: false,
    informally_resolved: false,
    others: false,
  });
  const [irRejectOtherSpec, setIrRejectOtherSpec] = useState("");
  const [irRejectExplanation, setIrRejectExplanation] = useState("");
  const [irRejectSaving, setIrRejectSaving] = useState(false);
  const [irRejectError, setIrRejectError] = useState(null);
  /** Lookup keys: `uuid:<students.id>`, `sid:<students.student_id>` → display name. */
  const [irStudentNames, setIrStudentNames] = useState({});
  const [irStaffAccess, setIrStaffAccess] = useState({ checked: false, ok: true, message: null });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIrStaffAccess({ checked: true, ok: false, message: "Supabase is not configured." });
      return;
    }
    let cancelled = false;
    (async () => {
      const access = await checkIncidentAttachmentAccess(supabase);
      if (!cancelled) {
        setIrStaffAccess({
          checked: true,
          ok: access.ok,
          message: access.ok ? null : access.message,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchIrReports = useCallback(async () => {
    setIrLoading(true);
    setIrError(null);
    try {
      const { data, error } = await supabase
        .from(INCIDENT_REPORT_TABLE)
        .select(INCIDENT_REPORT_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const reports = data || [];
      const hints = irCollectEmbeddedRosterHints(reports);
      const uuidList = hints.uuids;
      const sidList = hints.sids;
      const emailList = hints.emails;
      const nameMap = {};
      /** `*` keeps email (if present on `public.students`) for party JSON lookups without hard-failing on older schemas. */
      const rosterSelect = "*";
      if (uuidList.length > 0) {
        const { data: studsByUuid, error: errUuid } = await supabase
          .from("students")
          .select(rosterSelect)
          .in("id", uuidList);
        if (!errUuid && Array.isArray(studsByUuid)) {
          for (const s of studsByUuid) irStudentRosterMapAddRow(nameMap, s);
        }
      }
      if (sidList.length > 0) {
        const { data: studsBySid, error: errSid } = await supabase
          .from("students")
          .select(rosterSelect)
          .in("student_id", sidList);
        if (!errSid && Array.isArray(studsBySid)) {
          for (const s of studsBySid) irStudentRosterMapAddRow(nameMap, s);
        }
      }
      if (emailList.length > 0) {
        const { data: studsByEmail, error: errEmail } = await supabase
          .from("students")
          .select(rosterSelect)
          .in("email", emailList);
        if (!errEmail && Array.isArray(studsByEmail)) {
          for (const s of studsByEmail) irStudentRosterMapAddRow(nameMap, s);
        }
      }
      setIrStudentNames(nameMap);
      setIrReports(reports);
    } catch (err) {
      setIrError(err?.message || "Failed to load incident reports.");
    } finally {
      setIrLoading(false);
    }
  }, []);

  useEffect(() => { fetchIrReports(); }, [fetchIrReports]);

  const handleIncidentReportsRealtime = useCallback(
    (payload) => {
      if (payload.eventType === "INSERT") {
        const row = payload.new || {};
        const idLabel =
          row.id != null ? irDisplayReportId(String(row.id)) : "New report";
        showToast(`New incident report from student app: ${idLabel}`, {
          variant: "info",
          duration: 10000,
        });
        if (String(row.status || "").toLowerCase() === "submitted") {
          setIrActiveTab("submitted");
        }
      }
      fetchIrReports();
    },
    [fetchIrReports],
  );

  useRealtimeIncidentReports(handleIncidentReportsRealtime);

  useEffect(() => {
    const reportKey = String(searchParams.get("report") || "").trim();
    if (!reportKey || irReports.length === 0) return;
    const found = irReports.find((r) => {
      const id = String(r.id || "");
      return id === reportKey || irFormatId(r.id).toLowerCase() === reportKey.toLowerCase();
    });
    if (found) setIrSelected(found);
  }, [searchParams, irReports]);

  useEffect(() => {
    setIrDetailActionError(null);
  }, [irSelected]);

  const irStats = useMemo(() => ({
    total: irReports.length,
    submitted: irReports.filter((r) => r.status === "submitted").length,
    under_review: irReports.filter((r) => r.status === "under_review").length,
    rejected: irReports.filter((r) => r.status === "rejected").length,
    converted_to_case: irReports.filter((r) => r.status === "converted_to_case").length,
  }), [irReports]);

  const irFiltered = useMemo(() => {
    return irReports.filter((r) => {
      const matchesTab = irActiveTab === "all" || r.status === irActiveTab;

      const q = irSearch.toLowerCase();
      const complainantDisp = irComplainantDisplay(r, irStudentNames);
      const complaineeDisp = irComplaineeDisplay(r, irStudentNames);
      const matchesSearch = (() => {
        if (!q) return true;
        const id = String(r.id || "").toLowerCase();
        const narrative = String(r.narrative || "").toLowerCase();
        const incidentType = String(irIncidentType(r) || "").toLowerCase();
        const location = String(r.location || "").toLowerCase();
        const blob = irRowSearchBlob(r, irStudentNames);
        const statusLabel = irStatusLabel(r.status).toLowerCase();
        const reporterSid = String(r.reporter_student_id || "").toLowerCase();
        if (irSearchField === "reportId") return id.includes(q) || irFormatId(r.id).toLowerCase().includes(q);
        if (irSearchField === "status") return statusLabel.includes(q) || String(r.status || "").toLowerCase().includes(q);
        if (irSearchField === "incidentType") return narrative.includes(q) || incidentType.includes(q);
        if (irSearchField === "location") return location.includes(q);
        if (irSearchField === "reporter") {
          return complainantDisp.toLowerCase().includes(q) || reporterSid.includes(q);
        }
        if (irSearchField === "involved") return complaineeDisp.toLowerCase().includes(q);
        return blob.includes(q);
      })();

      return matchesTab && matchesSearch;
    });
  }, [irReports, irActiveTab, irSearch, irSearchField, irStudentNames]);

  const handleIrDetailConvert = useCallback(async () => {
    if (!irSelected || !irStaffCanRejectOrConvert(irSelected.status)) return;
    setIrDetailActionError(null);
    try {
      const reviewedBy = await getSupabaseAuthUserId();
      if (!reviewedBy) {
        setIrDetailActionError(
          "Your sign-in session is missing. Sign out and sign in again (password + email code) before converting.",
        );
        return;
      }
      const { data: existingCases, error: fetchErr } = await supabase
        .from("discipline_cases")
        .select("id");
      if (fetchErr) throw fetchErr;

      const caseId = makeNextDisciplineCaseId(existingCases || []);
      const complaineeDisp = irComplaineeDisplay(irSelected, irStudentNames);
      const stmt = irNarrative(irSelected);
      const evidence = irAttachmentsForCaseEvidence(irSelected);

      const studentName =
        complaineeDisp && complaineeDisp !== "—"
          ? complaineeDisp.trim()
          : "Unknown respondent";
      const sidRaw = irTryExtractStudentId(irSelected);
      const studentId =
        sidRaw ||
        `PENDING-IR-${String(irSelected.id).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || "UNKNOWN"}`;

      const itype = irIncidentType(irSelected);
      const caseType =
        itype !== "—" && CASE_TYPE_OPTIONS.includes(itype)
          ? itype
          : itype !== "—"
            ? itype
            : "Code of Conduct Violation";

      const workflowNote =
        "Created from an incident report; continue classification and investigation in case management as needed.";

      const description = [
        `Source incident report: ${irDisplayReportId(irSelected.id)}`,
        `Complainant: ${irComplainantDisplay(irSelected, irStudentNames)}`,
        `Respondent (complainee): ${complaineeDisp}`,
        irSelected.location ? `Location: ${irSelected.location}` : "",
        `Incident date/time: ${irFormatDateTime(irSelected.incident_at)}`,
        irImpact(irSelected) !== "—" ? `Impact: ${irImpact(irSelected)}` : "",
        "",
        "Narrative:",
        stmt,
        "",
        workflowNote,
      ]
        .filter(Boolean)
        .join("\n");

      const emailFromParties = await irResolveComplaineeEmail(
        irSelected,
        irStudentNames,
        studentName,
        supabase,
      );
      const respondentEmail =
        emailFromParties ||
        (studentName && studentName !== "—" ? generateNuStudentEmail(studentName) : "") ||
        "";

      const row = buildCaseInsertRowFromIncident(caseId, {
        studentName,
        studentId,
        caseType,
        description,
        evidence,
        program: "",
        school: "",
        offenseType: "",
        sourceIncidentReportId: String(irSelected.id),
        respondentEmail: respondentEmail || null,
      });

      const { error: insErr } = await supabase.from("discipline_cases").insert(row);
      if (insErr) throw insErr;

      const convertPatch = buildIncidentReportConvertUpdate(caseId, reviewedBy);
      const { error: updErr } = await supabase
        .from(INCIDENT_REPORT_TABLE)
        .update(convertPatch)
        .eq("id", irSelected.id);

      if (updErr) {
        await supabase.from("discipline_cases").delete().eq("id", caseId);
        throw updErr;
      }

      await fetchIrReports();
      showToast(`Case ${caseId} created and linked to this report.`, { variant: "success" });
      setIrSelected(null);
      navigate(`/case-management?case=${encodeURIComponent(caseId)}`);
    } catch (err) {
      setIrDetailActionError(err?.message || "Could not convert this report.");
    }
  }, [irSelected, fetchIrReports, irStudentNames, navigate]);

  const handleIrMarkUnderReview = useCallback(async () => {
    if (!irSelected || irSelected.status !== "submitted") return;
    setIrDetailActionError(null);
    try {
      const reviewedBy = await getSupabaseAuthUserId();
      if (!reviewedBy) {
        setIrDetailActionError(
          "Your sign-in session is missing. Sign out and sign in again (password + email code).",
        );
        return;
      }
      const underReviewPatch = buildIncidentReportUnderReviewUpdate(reviewedBy);
      const { error } = await supabase
        .from(INCIDENT_REPORT_TABLE)
        .update(underReviewPatch)
        .eq("id", irSelected.id);
      if (error) throw error;
      await fetchIrReports();
      setIrSelected((prev) =>
        prev && String(prev.id) === String(irSelected.id) ? { ...prev, ...underReviewPatch } : prev,
      );
      showToast("Report marked as under review.", { variant: "success" });
    } catch (err) {
      setIrDetailActionError(err?.message || "Could not update this report.");
    }
  }, [irSelected, fetchIrReports]);

  const openIrRejectModal = useCallback((row) => {
    setIrRejectError(null);
    setIrRejectCommon({
      duplicate: false,
      insufficient_evidence: false,
      lack_of_detail: false,
      wrong_jurisdiction: false,
      informally_resolved: false,
      others: false,
    });
    setIrRejectOtherSpec("");
    setIrRejectExplanation("");
    setIrRejectTarget(row);
  }, []);

  return (
    <div className="dashboard-layout do-office-layout">
      <Sidebar profileSettingsPath={PROFILE_SETTINGS_PATH_DISCIPLINE} />
      <div className="dashboard-main">
        <DisciplineOfficeTopBar />
        <main className="dashboard-content do-office-shell">

          {/* ── Error / loading banner ── */}
          {irStaffAccess.checked && !irStaffAccess.ok && (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
                fontSize: 14,
              }}
            >
              {irStaffAccess.message ||
                "Sign in with an approved Discipline Office account to review reports and open attachments."}
            </div>
          )}

          {(irError || (irLoading && irReports.length === 0)) && (
            <div
              role="status"
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 10,
                background: irError ? "#fef2f2" : "#f8fafc",
                border: `1px solid ${irError ? "#fecaca" : "#e2e8f0"}`,
                color: irError ? "#991b1b" : "#475569",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span>{irError ? `Could not load reports: ${irError}` : "Loading incident reports…"}</span>
              {irError && (
                <button type="button" className="cc-btn-secondary" style={{ height: 32, padding: "0 12px" }} onClick={fetchIrReports}>
                  Retry
                </button>
              )}
            </div>
          )}

          {/* ── Page title row ── */}
          <div className="page-title-row">
            <div>
              <h1>Incident Report</h1>
              <p>Manage and track all disciplinary incident reports</p>
            </div>
          </div>

          {/* ── Summary stat cards ── */}
          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-value total">{irStats.total}</p>
              <p className="stat-label">Total Reports</p>
            </div>
            <div className="stat-card">
              <p className="stat-value new">{irStats.submitted}</p>
              <p className="stat-label">Submitted</p>
            </div>
            <div className="stat-card">
              <p className="stat-value pending">{irStats.under_review}</p>
              <p className="stat-label">Under Review</p>
            </div>
            <div className="stat-card">
              <p className="stat-value ongoing">{irStats.converted_to_case}</p>
              <p className="stat-label">Converted</p>
            </div>
            <div className="stat-card">
              <p className="stat-value high">{irStats.rejected}</p>
              <p className="stat-label">Rejected</p>
            </div>
          </div>

          {/* ── Table panel ── */}
          <div className="cases-panel">
            <div className="cases-panel-header">

              <div className="cases-panel-top">
                <div className="cases-panel-title">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M16.667 2.5H3.333C2.413 2.5 1.667 3.246 1.667 4.167v11.666c0 .92.746 1.667 1.666 1.667h13.334c.92 0 1.666-.746 1.666-1.667V4.167c0-.92-.746-1.667-1.666-1.667z" stroke="#0f172a" strokeWidth="1.5" />
                    <path d="M6.667 7.5h6.666M6.667 10.833h4.166" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  All Incident Reports
                </div>
              </div>

              <div className="confidential-notice">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="#f54900" strokeWidth="1.2" />
                  <path d="M6 4v2.5M6 8h.006" stroke="#f54900" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Confidential - Handle with discretion
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 0 }}>
                <select
                  className="cc-input"
                  style={{ width: 160, height: 36, flexShrink: 0 }}
                  value={irSearchField}
                  onChange={(e) => setIrSearchField(e.target.value)}
                  aria-label="Search by field"
                >
                  <option value="all">All Fields</option>
                  <option value="reportId">Report ID</option>
                  <option value="status">Status</option>
                  <option value="reporter">Reporter</option>
                  <option value="involved">Involved party</option>
                  <option value="incidentType">Incident type</option>
                  <option value="location">Location</option>
                </select>
                <div className="search-bar-wrapper" style={{ flex: 1, marginBottom: 0 }}>
                  <span className="search-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="7.333" cy="7.333" r="4.667" stroke="#64748b" strokeWidth="1.5" />
                      <path d="M14 14l-2.667-2.667" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder={
                      irSearchField === "reportId" ? "Search by report ID…" :
                      irSearchField === "status" ? "Search by status…" :
                      irSearchField === "reporter" ? "Search by reporter…" :
                      irSearchField === "involved" ? "Search by involved party…" :
                      irSearchField === "incidentType" ? "Search by incident type…" :
                      irSearchField === "location" ? "Search by location…" :
                      "Search reports…"
                    }
                    value={irSearch}
                    onChange={(e) => setIrSearch(e.target.value)}
                  />
                </div>
              </div>

              <div
                className="ir-filter-tabs"
                role="tablist"
                aria-label="Filter incident reports by status"
              >
                {IR_TABS.map((tab) => {
                  const n = tab.count(irReports);
                  const active = irActiveTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      id={`ir-filter-tab-${tab.key}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`ir-filter-tab${active ? " ir-filter-tab--active" : ""}`}
                      onClick={() => setIrActiveTab(tab.key)}
                    >
                      <span className="ir-filter-tab__label">{tab.label}</span>
                      <span className="ir-filter-tab__badge" aria-label={`${n} reports`}>
                        {n}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Table ── */}
            <div className="cases-table-wrapper ir-incident-table-wrap">
              <table className="cases-table ir-incident-table">
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Status</th>
                    <th>Reporter</th>
                    <th>Involved</th>
                    <th>Incident type</th>
                    <th>Incident date</th>
                    <th>Location</th>
                    <th className="cases-table-col-action ir-incident-table-actions-head">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {irFiltered.map((r) => {
                    const reporterDisp = irComplainantDisplay(r, irStudentNames);
                    const involvedDisp = irComplaineeDisplay(r, irStudentNames);
                    return (
                      <tr key={r.id}>
                        <td className="cell-case-id">{irDisplayReportId(r.id)}</td>
                        <td>
                          <IrIncidentStatusPill status={r.status} />
                        </td>
                        <td className="cell-text ir-cell-ellipsis" title={reporterDisp}>
                          {reporterDisp}
                        </td>
                        <td className="cell-text ir-cell-ellipsis" title={involvedDisp}>
                          {involvedDisp}
                        </td>
                        <td className="cell-text ir-cell-ellipsis" title={irIncidentType(r)}>
                          {irIncidentType(r)}
                        </td>
                        <td className="cell-date ir-cell-datetime" title={irFormatDateTime(r.incident_at)}>
                          {irFormatDateTime(r.incident_at)}
                        </td>
                        <td className="cell-text ir-cell-ellipsis" title={r.location || ""}>
                          {r.location || "—"}
                        </td>
                        <td className="cases-table-col-action">
                          <div className="ir-incident-table-actions">
                            <button
                              className="ir-do-icon-btn"
                              type="button"
                              title="View Details"
                              aria-label="View Details"
                              onClick={() => setIrSelected(r)}
                            >
                              <Eye size={18} strokeWidth={2} aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {irFiltered.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", color: "#64748b", padding: "32px 8px", fontFamily: "'Inter', sans-serif" }}>
                        {irLoading ? "Loading…" : "No incident reports found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* ── Incident report detail modal ── */}
      {irSelected && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ir-detail-modal-title"
          onMouseDown={() => setIrSelected(null)}
        >
          <div
            className="cc-modal do-modal do-modal--lg ir-incident-detail-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="do-modal-head">
              <button
                className="do-modal-x"
                type="button"
                aria-label="Close"
                onClick={() => setIrSelected(null)}
              >
                ×
              </button>
              <div className="do-modal-head-row">
                <div className="do-modal-icon-wrap" aria-hidden><FileText size={22} strokeWidth={2} /></div>
                <div>
                  <h2 id="ir-detail-modal-title" className="do-modal-heading">
                    Incident Report Details:{" "}
                    <span className="ir-detail-title-id">{irDisplayReportId(irSelected.id)}</span>
                  </h2>
                  <p className="do-modal-sub ir-detail-meta">
                    <span>
                      Status:{" "}
                      <strong>
                        {IR_STATUS_MODAL_LABEL[irSelected.status] || irSelected.status || "—"}
                      </strong>
                    </span>
                    <span className="ir-detail-meta-sep" aria-hidden>
                      {" "}
                      |{" "}
                    </span>
                    <span>
                      Filed On:{" "}
                      <strong>{irFormatFiledOn(irSelected.created_at)}</strong>
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="do-modal-body-scroll ir-detail-body">
              <section className="ir-detail-section" aria-labelledby="ir-detail-general">
                <h3 id="ir-detail-general" className="ir-detail-section-title">
                  General Information
                </h3>
                <dl className="ir-detail-dl">
                  <div>
                    <dt>Incident Type</dt>
                    <dd>{irIncidentType(irSelected)}</dd>
                  </div>
                  <div>
                    <dt>Date &amp; Time</dt>
                    <dd>{irFormatDateTime(irSelected.incident_at)}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{irSelected.location || "—"}</dd>
                  </div>
                  {irSelected.reviewed_at && (
                    <div>
                      <dt>Reviewed at</dt>
                      <dd>{irFormatDateTime(irSelected.reviewed_at)}</dd>
                    </div>
                  )}
                  {irSelected.reporter_student_id && String(irSelected.reporter_student_id).trim() && (
                    <div>
                      <dt>Reporter student ID</dt>
                      <dd>{irSelected.reporter_student_id}</dd>
                    </div>
                  )}
                  {irSelected.converted_case_id && (
                    <div>
                      <dt>Linked discipline case</dt>
                      <dd>
                        <Link
                          to={`/case-management?case=${encodeURIComponent(irSelected.converted_case_id)}`}
                          onClick={() => setIrSelected(null)}
                        >
                          {formatCaseId(irSelected.converted_case_id)}
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              <section className="ir-detail-section" aria-labelledby="ir-detail-parties">
                <h3 id="ir-detail-parties" className="ir-detail-section-title">
                  Parties Involved
                </h3>
                <dl className="ir-detail-dl ir-detail-dl--stacked">
                  <div>
                    <dt>Involved party</dt>
                    <dd>{irComplaineeDisplay(irSelected, irStudentNames)}</dd>
                  </div>
                  <div>
                    <dt>Reporter</dt>
                    <dd>{irComplainantDisplay(irSelected, irStudentNames)}</dd>
                  </div>
                </dl>
              </section>

              <section className="ir-detail-section" aria-labelledby="ir-detail-narrative">
                <h3 id="ir-detail-narrative" className="ir-detail-section-title">
                  Narrative
                </h3>
                <div className="ir-detail-prose">
                  {irNarrative(irSelected) !== "—" ? (
                    <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{irNarrative(irSelected)}</p>
                  ) : (
                    <p style={{ margin: 0, color: "#64748b" }}>—</p>
                  )}
                </div>
              </section>
              {irImpact(irSelected) !== "—" && (
                <section className="ir-detail-section" aria-labelledby="ir-detail-impact">
                  <h3 id="ir-detail-impact" className="ir-detail-section-title">
                    Impact (from student)
                  </h3>
                  <div className="ir-detail-prose">
                    <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{irImpact(irSelected)}</p>
                  </div>
                </section>
              )}
              {irSelected?.status === "rejected" && irRejectionMessage(irSelected) !== "—" && (
                <section className="ir-detail-section" aria-labelledby="ir-detail-rejection">
                  <h3 id="ir-detail-rejection" className="ir-detail-section-title">
                    Rejection message (for student email)
                  </h3>
                  <p className="ir-detail-hint" style={{ margin: "0 0 8px", color: "#64748b", fontSize: 13 }}>
                    Not shown in the incident table. Use for email to the student when that is enabled.
                  </p>
                  <div className="ir-detail-prose">
                    <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{irRejectionMessage(irSelected)}</p>
                  </div>
                </section>
              )}
              <section className="ir-detail-section" aria-labelledby="ir-detail-attachments">
                <h3 id="ir-detail-attachments" className="ir-detail-section-title">
                  Attachments
                </h3>
                <div className="ir-detail-prose">
                  <IrIncidentAttachmentsViewer report={irSelected} />
                </div>
              </section>

              {irDetailActionError && (
                <div className="cc-form-error" role="alert">
                  {irDetailActionError}
                </div>
              )}

              <div className="ir-detail-primary-actions">
                <button
                  className="cc-btn-secondary ir-detail-btn-with-icon"
                  type="button"
                  disabled={irSelected.status !== "submitted"}
                  title={irSelected.status !== "submitted" ? "Only submitted reports can be marked under review." : undefined}
                  onClick={handleIrMarkUnderReview}
                >
                  Mark Under Review
                </button>
                <button
                  className="cc-btn-primary ir-detail-btn-with-icon"
                  type="button"
                  disabled={!irStaffCanRejectOrConvert(irSelected.status)}
                  title={
                    !irStaffCanRejectOrConvert(irSelected.status)
                      ? irSelected.status === "converted_to_case"
                        ? "This report is already converted to a case."
                        : irSelected.status === "rejected"
                          ? "This report has been rejected."
                          : "This report cannot be converted."
                      : undefined
                  }
                  onClick={handleIrDetailConvert}
                >
                  <Scale size={18} strokeWidth={2} aria-hidden />
                  Convert to Case
                </button>
                <button
                  className="cc-btn-secondary ir-detail-btn-with-icon ir-detail-btn-reject"
                  type="button"
                  disabled={!irStaffCanRejectOrConvert(irSelected.status)}
                  title={
                    !irStaffCanRejectOrConvert(irSelected.status)
                      ? irSelected.status === "rejected"
                        ? "This report has already been rejected."
                        : irSelected.status === "converted_to_case"
                          ? "Converted reports cannot be rejected from here."
                          : "This report cannot be rejected."
                      : undefined
                  }
                  onClick={() => {
                    const row = irSelected;
                    setIrSelected(null);
                    openIrRejectModal(row);
                  }}
                >
                  <Ban size={18} strokeWidth={2} aria-hidden />
                  Reject
                </button>
              </div>
            </div>

            <div className="cc-modal-actions">
              <button className="cc-btn-secondary" type="button" onClick={() => setIrSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {irRejectTarget && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ir-reject-modal-title"
          onMouseDown={() => {
            if (irRejectSaving) return;
            setIrRejectTarget(null);
          }}
        >
          <div
            className="cc-modal do-modal do-modal--lg ir-reject-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="do-modal-head">
              <button
                className="do-modal-x"
                type="button"
                aria-label="Close"
                disabled={irRejectSaving}
                onClick={() => setIrRejectTarget(null)}
              >
                ×
              </button>
              <div className="do-modal-head-row">
                <div className="do-modal-icon-wrap" aria-hidden><Ban size={22} strokeWidth={2} /></div>
                <div>
                  <h2 id="ir-reject-modal-title" className="do-modal-heading">
                    Reason for Rejection Modal
                  </h2>
                  <p className="do-modal-sub">
                    Please provide a clear justification. This message is saved for the student (email when enabled) and
                    is not shown in the incident report table.
                  </p>
                </div>
              </div>
            </div>

            <div className="do-modal-body-scroll">
              <div className="ir-reject-modal-summary">
                <p>
                  <span className="ir-reject-k">Report ID:</span>{" "}
                  <strong>{irDisplayReportId(irRejectTarget.id)}</strong>
                </p>
                <p>
                  <span className="ir-reject-k">Complainant:</span>{" "}
                  <strong>{irComplainantDisplay(irRejectTarget, irStudentNames)}</strong>
                </p>
              </div>

              <div className="cc-field" style={{ marginBottom: 14 }}>
                <div className="cc-label" style={{ marginBottom: 8 }}>
                  Select a Common Reason
                </div>
                <p className="ir-reject-hint">Quick-select options to save time for the DO staff</p>
                <ul className="ir-reject-reason-list">
                  <li>
                    <label className="ir-reject-check">
                      <input
                        type="checkbox"
                        checked={irRejectCommon.duplicate}
                        onChange={(e) => setIrRejectCommon((c) => ({ ...c, duplicate: e.target.checked }))}
                        disabled={irRejectSaving}
                      />
                      <span>Duplicate: This incident has already been reported.</span>
                    </label>
                  </li>
                  <li>
                    <label className="ir-reject-check">
                      <input
                        type="checkbox"
                        checked={irRejectCommon.insufficient_evidence}
                        onChange={(e) =>
                          setIrRejectCommon((c) => ({ ...c, insufficient_evidence: e.target.checked }))
                        }
                        disabled={irRejectSaving}
                      />
                      <span>Insufficient Evidence: The provided evidence does not support the claim.</span>
                    </label>
                  </li>
                  <li>
                    <label className="ir-reject-check">
                      <input
                        type="checkbox"
                        checked={irRejectCommon.lack_of_detail}
                        onChange={(e) => setIrRejectCommon((c) => ({ ...c, lack_of_detail: e.target.checked }))}
                        disabled={irRejectSaving}
                      />
                      <span>Lack of Detail: The statement is too vague to initiate an investigation.</span>
                    </label>
                  </li>
                  <li>
                    <label className="ir-reject-check">
                      <input
                        type="checkbox"
                        checked={irRejectCommon.wrong_jurisdiction}
                        onChange={(e) =>
                          setIrRejectCommon((c) => ({ ...c, wrong_jurisdiction: e.target.checked }))
                        }
                        disabled={irRejectSaving}
                      />
                      <span>
                        Wrong Jurisdiction: This matter should be handled by a different office (e.g., Guidance,
                        Academics).
                      </span>
                    </label>
                  </li>
                  <li>
                    <label className="ir-reject-check">
                      <input
                        type="checkbox"
                        checked={irRejectCommon.informally_resolved}
                        onChange={(e) =>
                          setIrRejectCommon((c) => ({ ...c, informally_resolved: e.target.checked }))
                        }
                        disabled={irRejectSaving}
                      />
                      <span>Informally Resolved: The parties involved have already settled the matter.</span>
                    </label>
                  </li>
                  <li>
                    <label className="ir-reject-check ir-reject-check--others">
                      <input
                        type="checkbox"
                        checked={irRejectCommon.others}
                        onChange={(e) => setIrRejectCommon((c) => ({ ...c, others: e.target.checked }))}
                        disabled={irRejectSaving}
                      />
                      <span>Others;</span>
                      <input
                        type="text"
                        className="cc-input ir-reject-other-input"
                        placeholder="please specify"
                        value={irRejectOtherSpec}
                        onChange={(e) => setIrRejectOtherSpec(e.target.value)}
                        disabled={irRejectSaving || !irRejectCommon.others}
                        aria-label="Other reason (please specify)"
                      />
                    </label>
                  </li>
                </ul>
              </div>

              <div className="cc-field">
                <div className="cc-label">Detailed Explanation (Mandatory)</div>
                <p className="ir-reject-hint">
                  Saved as the student rejection message (for email when enabled). Not shown in the incident report table.
                </p>
                <textarea
                  className="cc-textarea"
                  rows={5}
                  value={irRejectExplanation}
                  onChange={(e) => setIrRejectExplanation(e.target.value)}
                  disabled={irRejectSaving}
                  placeholder='e.g., The video evidence provided is blurry and does not clearly show the face of the complainee. Please re-submit with clearer documentation if available.'
                />
              </div>

              {irRejectError && (
                <div className="cc-form-error" role="alert" style={{ marginTop: 12 }}>
                  {irRejectError}
                </div>
              )}
            </div>

            <div className="cc-modal-actions">
              <button
                className="cc-btn-secondary"
                type="button"
                disabled={irRejectSaving}
                onClick={() => setIrRejectTarget(null)}
              >
                Cancel
              </button>
              <button
                className="cc-btn-primary"
                type="button"
                disabled={!irRejectExplanation.trim() || irRejectSaving}
                onClick={async () => {
                  const detail = irRejectExplanation.trim();
                  if (!detail) return;
                  setIrRejectError(null);
                  setIrRejectSaving(true);
                  try {
                    const reviewedBy = await getSupabaseAuthUserId();
                    if (!reviewedBy) {
                      setIrRejectError(
                        "Your sign-in session is missing. Sign out and sign in again (password + email code).",
                      );
                      return;
                    }
                    const quickLines = [];
                    if (irRejectCommon.duplicate) {
                      quickLines.push("Duplicate: This incident has already been reported.");
                    }
                    if (irRejectCommon.insufficient_evidence) {
                      quickLines.push("Insufficient Evidence: The provided evidence does not support the claim.");
                    }
                    if (irRejectCommon.lack_of_detail) {
                      quickLines.push("Lack of Detail: The statement is too vague to initiate an investigation.");
                    }
                    if (irRejectCommon.wrong_jurisdiction) {
                      quickLines.push(
                        "Wrong Jurisdiction: This matter should be handled by a different office (e.g., Guidance, Academics).",
                      );
                    }
                    if (irRejectCommon.informally_resolved) {
                      quickLines.push("Informally Resolved: The parties involved have already settled the matter.");
                    }
                    if (irRejectCommon.others && irRejectOtherSpec.trim()) {
                      quickLines.push(`Others: ${irRejectOtherSpec.trim()}`);
                    }
                    const rejectPatch = buildIncidentReportRejectUpdate({ quickLines, detail }, reviewedBy);
                    const rejectId = irRejectTarget.id;

                    const { error } = await supabase
                      .from(INCIDENT_REPORT_TABLE)
                      .update(rejectPatch)
                      .eq("id", rejectId);
                    if (error) throw error;
                    await fetchIrReports();
                    showToast("Report rejected and archived.", { variant: "success" });
                    setIrRejectTarget(null);
                    setIrActiveTab("rejected");
                  } catch (err) {
                    setIrRejectError(err?.message || "Could not reject this report. Try again.");
                  } finally {
                    setIrRejectSaving(false);
                  }
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [conferenceCompletionDraft, setConferenceCompletionDraft] = useState(null);
  const [completionSummaryDraft, setCompletionSummaryDraft] = useState("");
  const [completionSaving, setCompletionSaving] = useState(false);
  const [completionFormError, setCompletionFormError] = useState("");
  const [conferenceSearch, setConferenceSearch] = useState("");
  const [conferenceStatusFilter, setConferenceStatusFilter] = useState("all");

  const {
    conferences,
    loading: confLoading,
    fetchError: confFetchError,
    refresh: refreshConferences,
    insertConference,
    updateConference,
    useRemote: conferencesUseRemote,
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

  const defaultCaseId = caseOptions[0]?.caseId || "";

  // ── Schedule modal: Case ID search state ──────────────────────────────────
  const [caseIdInput, setCaseIdInput] = useState("");
  const [caseIdError, setCaseIdError] = useState("");
  const caseIdPrefix = useMemo(() => {
    const raw = String(defaultCaseId || "").trim().toUpperCase();
    const m = raw.match(/^(DC-\d{4}-)\d+$/);
    if (m) return m[1];
    return `DC-${new Date().getFullYear()}-`;
  }, [defaultCaseId]);

  function composeCaseIdFromSuffixInput(val) {
    const digits = String(val || "").replace(/\D+/g, "");
    if (!digits) return "";
    return `${caseIdPrefix}${String(Number.parseInt(digits, 10)).padStart(2, "0")}`;
  }

  const [scheduleForm, setScheduleForm] = useState({
    caseId: "",
    dateIso: toDateInputValue(new Date()),
    startTime: "",
    endTime: "",
    location: "",
    attendees: "",
    notes: "",
  });

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
      const suffixMatch = String(conf.caseId || defaultCaseId || "")
        .toUpperCase()
        .match(/^DC-\d{4}-(\d+)$/);
      setCaseIdInput(suffixMatch ? suffixMatch[1] : "");
      setCaseIdError("");
      // Convert stored timeLabel (e.g. "10:00 AM" or "7:00 PM - 8:00 PM") back to HH:MM for inputs
      const storedTime = conf.timeLabel || "";
      const segments = storedTime.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean);
      const toTimeInput = (segment) => {
        if (!segment) return "";
        const m = segment.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!m) return "";
        let h = parseInt(m[1], 10);
        const min = m[2];
        const ampm = m[3].toUpperCase();
        if (ampm === "PM" && h !== 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        return `${String(h).padStart(2, "0")}:${min}`;
      };
      const startVal = toTimeInput(segments[0] || storedTime);
      const endVal = segments.length >= 2 ? toTimeInput(segments[1]) : "";
      setScheduleForm({
        caseId: conf.caseId || defaultCaseId,
        dateIso: toDateInputValue(d),
        startTime: startVal,
        endTime: endVal,
        location: conf.location || "",
        attendees: attendeeText,
        notes: conf.notes || "",
      });
      setIsScheduleOpen(true);
    },
    [defaultCaseId],
  );

  /** Convert HH:MM → "h:MM AM/PM" label for storage */
  function timeInputToLabel(val) {
    if (!val) return "";
    const [hStr, mStr] = val.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  /** Validate Case ID input suffix: must map to a known full case ID */
  function validateCaseIdInput(val) {
    const normalized = composeCaseIdFromSuffixInput(val);
    if (!normalized) return "Case ID number is required.";
    const match = caseOptions.find(
      (x) =>
        String(x.caseId).toUpperCase() === normalized ||
        formatCaseId(x.caseId).toUpperCase() === normalized,
    );
    if (!match) return `Case ID not found`;
    return "";
  }

  const scheduleCasePreview = useMemo(() => {
    const up = composeCaseIdFromSuffixInput(caseIdInput);
    if (!up) return null;
    const c = cases.find(
      (x) => String(x.id).toUpperCase() === up || formatCaseId(x.id).toUpperCase() === up,
    );
    if (!c) return null;
    const meta = parseCaseMeta(c);
    return {
      student: c.student,
      studentId: c.studentId,
      program: meta.program,
      school: meta.school,
      caseType: c.caseType,
    };
  }, [caseIdInput, caseIdPrefix, cases]);

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
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const windowEndExclusive = new Date(todayStart);
    windowEndExclusive.setDate(windowEndExclusive.getDate() + 8);
    return conferences
      .filter((c) => {
        if (effectiveConferenceStatus(c) !== "scheduled") return false;
        const d = parseConferenceDate(c);
        if (!d) return false;
        const day = new Date(d);
        day.setHours(0, 0, 0, 0);
        return day.getTime() > todayStart.getTime() && day.getTime() < windowEndExclusive.getTime();
      })
      .sort((a, b) => {
        const sa = parseConferenceStartDateTime(a)?.getTime() ?? parseConferenceDate(a)?.getTime() ?? 0;
        const sb = parseConferenceStartDateTime(b)?.getTime() ?? parseConferenceDate(b)?.getTime() ?? 0;
        return sa - sb;
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

  const filteredConferenceList = useMemo(() => {
    const q = conferenceSearch.trim().toLowerCase();
    return conferenceList.filter((c) => {
      const status = effectiveConferenceStatus(c);
      const matchesStatus = conferenceStatusFilter === "all" || status === conferenceStatusFilter;
      const haystack = [
        c.conferenceId,
        c.caseId,
        c.studentName,
        c.studentId,
        c.caseTitle,
        c.location,
        c.presidingOfficer,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [conferenceList, conferenceSearch, conferenceStatusFilter]);

  const calendarCells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  const activeEvents = useMemo(() => {
    const key = dateKey(selectedDate);
    return eventsByDateKey.get(key) || [];
  }, [eventsByDateKey, selectedDate]);

  const monthTitle = viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayKeyStr = dateKey(new Date());
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

  const conferenceCompleteBlockedReason = useMemo(() => {
    if (!selectedConference) return "";
    if (String(selectedConference.status || "").toLowerCase() !== "scheduled") return "";
    return conferenceCompletionBlockedReason(selectedConference);
  }, [selectedConference]);

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
              onClick={() => {
                setScheduleEditId(null);
                setScheduleErrors({});
                setCaseIdInput("");
                setCaseIdError("");
                setScheduleForm({
                  caseId: "",
                  dateIso: toDateInputValue(new Date()),
                  startTime: "",
                  endTime: "",
                  location: "",
                  attendees: "",
                  notes: "",
                });
                setIsScheduleOpen(true);
              }}
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

          <section className="cc-card" style={{ marginTop: 24, marginBottom: 24 }}>
            <div className="cc-card-header">
              <div className="cc-search-row">
                <div className="cc-search">
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, color: "#0f172a", fontSize: 14, marginBottom: 8 }}>
                    Search hearings
                  </div>
                  <input
                    value={conferenceSearch}
                    onChange={(e) => setConferenceSearch(e.target.value)}
                    placeholder="Search by case, student, title, officer, or room..."
                  />
                </div>
                <div style={{ width: 220 }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, color: "#0f172a", fontSize: 14, marginBottom: 8 }}>
                    Status
                  </div>
                  <select
                    className="cc-input"
                    value={conferenceStatusFilter}
                    onChange={(e) => setConferenceStatusFilter(e.target.value)}
                  >
                    <option value="all">All conferences</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="cc-table-wrapper">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Student</th>
                    <th>Schedule</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th className="cases-table-col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConferenceList.map((c) => (
                    <tr key={c.conferenceId}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{formatCaseId(c.caseId)}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{c.caseTitle}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.studentName || "—"}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{c.studentId || "—"}</div>
                      </td>
                      <td>
                        <div>{c.dateLabel}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{c.timeLabel}</div>
                      </td>
                      <td>{c.location || "—"}</td>
                      <td><ConferencePill conference={c} /></td>
                      <td className="cases-table-col-action">
                        <button className="cc-btn-secondary btn-view--fixed" type="button" onClick={() => setSelectedConference(c)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredConferenceList.length === 0 && !dataLoading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px 8px", color: "#64748b" }}>
                        No conferences found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

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

      {/* ── Schedule / Reschedule modal ───────────────────────────────────── */}
      {isScheduleOpen && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cc-schedule-title"
          onMouseDown={() => setIsScheduleOpen(false)}
        >
          <div
            className="cc-modal do-modal do-modal--lg do-modal--schedule"
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

                // Validate Case ID search input
                const caseIdErr = validateCaseIdInput(caseIdInput);
                if (caseIdErr) {
                  setCaseIdError(caseIdErr);
                  nextErrors.caseId = caseIdErr;
                } else {
                  setCaseIdError("");
                  setSelectedConference(null);
                }

                // Resolve matched case
                const trimmedInput = composeCaseIdFromSuffixInput(caseIdInput);
                const matchedCase = caseOptions.find(
                  (x) =>
                    String(x.caseId).toUpperCase() === trimmedInput ||
                    formatCaseId(x.caseId).toUpperCase() === trimmedInput,
                );
                const effectiveCaseId = matchedCase?.caseId || "";

                if (!scheduleForm.dateIso?.trim()) nextErrors.date = "Date is required.";
                if (!scheduleForm.startTime) nextErrors.startTime = "Start time is required.";
                if (!scheduleForm.endTime) nextErrors.endTime = "End time is required.";
                if (!scheduleForm.location.trim()) nextErrors.location = "Location is required.";

                setScheduleErrors(nextErrors);
                if (Object.keys(nextErrors).length > 0) return;

                const confDate = new Date(`${scheduleForm.dateIso}T12:00:00`);
                const day = confDate.getDate();
                const dateLabel = fromDateInputToLabel(scheduleForm.dateIso);
                const startTimeLabel = timeInputToLabel(scheduleForm.startTime);
                const endTimeLabel = timeInputToLabel(scheduleForm.endTime);
                const timeLabel = `${startTimeLabel} - ${endTimeLabel}`;

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
                      timeLabel,
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
                      timeLabel,
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
                  setCaseIdInput("");
                  setCaseIdError("");
                  setScheduleForm((prev) => ({
                    ...prev,
                    caseId: "",
                    startTime: "",
                    endTime: "",
                    dateIso: toDateInputValue(new Date()),
                    notes: "",
                  }));
                } catch (err) {
                  showToast(err?.message || "Could not schedule conference.", { variant: "error" });
                }
              }}
            >
              <div className="do-modal-body-scroll do-form-stack" style={{ maxHeight: "calc(90vh - 200px)", overflowY: "auto" }}>
                {/* ── Case ID search input (replaces dropdown) ── */}
                <div className="do-form-cell" style={{ marginBottom: 0 }}>
                  <label className="do-form-label" htmlFor="sch-case">
                    Case ID
                  </label>
                  <div style={{ position: "relative" }}>
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#334155",
                        fontFamily: "monospace",
                        fontSize: 13,
                        pointerEvents: "none",
                      }}
                    >
                      {caseIdPrefix}
                    </span>
                    <input
                      id="sch-case"
                      className={`cc-input${caseIdError || scheduleErrors.caseId ? " cc-input-error" : ""}`}
                      placeholder="Case ID Number"
                      autoComplete="off"
                      inputMode="numeric"
                      value={caseIdInput}
                      style={{ paddingLeft: `${Math.max(96, caseIdPrefix.length * 8 + 18)}px` }}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D+/g, "");
                        setCaseIdInput(val);
                        if (val.trim()) {
                          const err = validateCaseIdInput(val);
                          setCaseIdError(err);
                        } else {
                          setCaseIdError("");
                        }
                      }}
                      aria-invalid={Boolean(caseIdError || scheduleErrors.caseId)}
                    />
                  </div>
                  {(caseIdError || scheduleErrors.caseId) && (
                    <div className="cc-form-error" role="alert">
                      {caseIdError || scheduleErrors.caseId}
                    </div>
                  )}
                </div>

                {scheduleCasePreview ? (
                  <div
                    className="do-section-card"
                    style={{ marginBottom: 0, padding: "12px 14px", background: "#eff6ff", borderColor: "#bfdbfe" }}
                  >
                    <h4 style={{ margin: "0 0 8px", fontSize: 13 }}>Student matched to this case</h4>
                    <p style={{ margin: 0, fontSize: 14, color: "#0f172a" }}>
                      <strong>{scheduleCasePreview.student}</strong>
                      <span style={{ color: "#64748b" }}> · ID {scheduleCasePreview.studentId}</span>
                    </p>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "#475569" }}>
                      Program: {scheduleCasePreview.program} · School: {scheduleCasePreview.school}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475569" }}>
                      Case type: {scheduleCasePreview.caseType}
                    </p>
                  </div>
                ) : null}

                <div className="do-form-grid2 do-form-grid2--tight">
                  <div className="do-form-cell" style={{ marginBottom: 0 }}>
                    <label className="do-form-label" htmlFor="sch-start-time">
                      Start Time
                    </label>
                    <input
                      id="sch-start-time"
                      type="time"
                      className={`cc-input${scheduleErrors.startTime ? " cc-input-error" : ""}`}
                      value={scheduleForm.startTime}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, startTime: e.target.value }))
                      }
                      aria-invalid={Boolean(scheduleErrors.startTime)}
                    />
                    {scheduleErrors.startTime && (
                      <div className="cc-form-error" role="alert">
                        {scheduleErrors.startTime}
                      </div>
                    )}
                  </div>

                  <div className="do-form-cell" style={{ marginBottom: 0 }}>
                    <label className="do-form-label" htmlFor="sch-end-time">
                      End Time
                    </label>
                    <input
                      id="sch-end-time"
                      type="time"
                      className={`cc-input${scheduleErrors.endTime ? " cc-input-error" : ""}`}
                      value={scheduleForm.endTime}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, endTime: e.target.value }))
                      }
                      aria-invalid={Boolean(scheduleErrors.endTime)}
                    />
                    {scheduleErrors.endTime && (
                      <div className="cc-form-error" role="alert">
                        {scheduleErrors.endTime}
                      </div>
                    )}
                  </div>
                </div>

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

              {String(selectedConference.status || "").toLowerCase() === "completed" &&
              String(selectedConference.discussionSummary || "").trim() ? (
                <div className="do-notes-callout" style={{ borderColor: "#bfdbfe", background: "#eff6ff" }}>
                  <FileText size={18} strokeWidth={2} aria-hidden />
                  <div>
                    <strong>Discussion summary (on file)</strong>
                    <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{selectedConference.discussionSummary}</p>
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
                    onClick={() => {
                      const conf = selectedConference;
                      setSelectedConference(null);
                      if (conf) {
                        window.setTimeout(() => openReschedule(conf), 0);
                      }
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    className="cc-btn-primary"
                    type="button"
                    disabled={!!conferenceCompleteBlockedReason}
                    title={
                      conferenceCompleteBlockedReason ||
                      "Enter the discussion summary and mark this hearing completed."
                    }
                    onClick={() => {
                      setConferenceCompletionDraft(selectedConference);
                      setCompletionSummaryDraft("");
                      setCompletionFormError("");
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
              {conferenceCompleteBlockedReason ? (
                <p
                  style={{
                    flexBasis: "100%",
                    fontSize: 12,
                    color: "#64748b",
                    margin: "4px 0 0",
                    lineHeight: 1.45,
                  }}
                >
                  {conferenceCompleteBlockedReason}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {conferenceCompletionDraft && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cc-conf-complete-title"
          style={{ zIndex: 11000 }}
          onMouseDown={() => {
            if (!completionSaving) setConferenceCompletionDraft(null);
          }}
        >
          <div className="cc-modal do-modal do-modal--lg" onMouseDown={(e) => e.stopPropagation()}>
            <div className="do-modal-head">
              <button
                className="do-modal-x"
                type="button"
                aria-label="Close"
                disabled={completionSaving}
                onClick={() => setConferenceCompletionDraft(null)}
              >
                ×
              </button>
              <div className="do-modal-head-row">
                <div className="do-modal-icon-wrap" aria-hidden>
                  <FileText size={22} strokeWidth={2} />
                </div>
                <div>
                  <h2 id="cc-conf-complete-title" className="do-modal-heading">
                    Complete case conference
                  </h2>
                  <p className="do-modal-sub">
                    Record the official discussion summary. The same text is sent as an in-app notification to the
                    student when their roster record has a linked CampusCare account ({conferenceCompletionDraft.studentId || "student ID"}).
                  </p>
                </div>
              </div>
            </div>

            <div className="do-modal-body-scroll">
              <div className="do-info-grid" style={{ marginBottom: 16 }}>
                <div className="do-info-card">
                  <div className="do-info-card-top">
                    <User size={18} strokeWidth={2} aria-hidden />
                    Case & student
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Case</p>
                    <p className="do-info-dd">{formatCaseId(conferenceCompletionDraft.caseId)}</p>
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Student</p>
                    <p className="do-info-dd">
                      {conferenceCompletionDraft.studentName || "—"} ({conferenceCompletionDraft.studentId || "—"})
                    </p>
                  </div>
                </div>
                <div className="do-info-card">
                  <div className="do-info-card-top">
                    <CalendarDays size={18} strokeWidth={2} aria-hidden />
                    Schedule
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">When</p>
                    <p className="do-info-dd">
                      {conferenceCompletionDraft.dateLabel} · {conferenceCompletionDraft.timeLabel}
                    </p>
                  </div>
                  <div className="do-info-row">
                    <p className="do-info-dt">Where</p>
                    <p className="do-info-dd">{conferenceCompletionDraft.location || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="cc-field">
                <label className="cc-label" htmlFor="cc-completion-summary">
                  Discussion summary <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px" }}>
                  Summarize decisions, expectations, and follow-ups from the hearing. This is required to finalize
                  completion.
                </p>
                <textarea
                  id="cc-completion-summary"
                  className="cc-textarea"
                  rows={8}
                  value={completionSummaryDraft}
                  disabled={completionSaving}
                  onChange={(e) => {
                    setCompletionSummaryDraft(e.target.value);
                    if (completionFormError) setCompletionFormError("");
                  }}
                  placeholder="e.g., Outcomes discussed, sanctions or behavioral agreements, deadlines for compliance…"
                />
                {completionFormError ? (
                  <div className="cc-form-error" role="alert" style={{ marginTop: 8 }}>
                    {completionFormError}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="cc-modal-actions">
              <button
                className="cc-btn-secondary"
                type="button"
                disabled={completionSaving}
                onClick={() => setConferenceCompletionDraft(null)}
              >
                Cancel
              </button>
              <button
                className="cc-btn-primary"
                type="button"
                disabled={completionSaving}
                onClick={async () => {
                  const text = completionSummaryDraft.trim();
                  if (!text) {
                    setCompletionFormError("Discussion summary is required.");
                    return;
                  }
                  setCompletionFormError("");
                  setCompletionSaving(true);
                  try {
                    await updateConference(conferenceCompletionDraft.conferenceId, {
                      status: "completed",
                      discussionSummary: text,
                    });
                    if (conferencesUseRemote && isSupabaseConfigured() && supabase) {
                      try {
                        const { sent, attempted } = await sendConferenceDiscussionSummaryToStudents(
                          supabase,
                          { ...conferenceCompletionDraft, discussionSummary: text },
                          text,
                        );
                        if (attempted === 0) {
                          showToast(
                            "Conference completed. Summary saved. No linked student account was found for in-app delivery.",
                            { variant: "success" },
                          );
                        } else if (sent === attempted) {
                          showToast(
                            `Conference completed. Discussion summary delivered to ${sent} linked student account(s).`,
                            { variant: "success" },
                          );
                        } else {
                          showToast(
                            `Conference completed. Delivered to ${sent} of ${attempted} linked account(s); some deliveries failed (check notification policies).`,
                            { variant: "warning" },
                          );
                        }
                      } catch (notifyErr) {
                        showToast(
                          notifyErr?.message ||
                            "Summary saved, but sending student notifications failed. Check roster links and policies.",
                          { variant: "warning" },
                        );
                      }
                    } else {
                      showToast("Conference completed and summary saved.", { variant: "success" });
                    }
                    setConferenceCompletionDraft(null);
                    setSelectedConference(null);
                    await refreshConferences();
                  } catch (err) {
                    showToast(err?.message || "Could not complete conference.", { variant: "error" });
                  } finally {
                    setCompletionSaving(false);
                  }
                }}
              >
                {completionSaving ? "Saving…" : "Submit & mark completed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



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

const RecordProgressPill = ({ status }) => {
  const s = String(status || "").toLowerCase();
  if (!s) return null;
  if (s === "done") return <span className="cc-pill sr-progress-done">Done</span>;
  return <span className="cc-pill sr-progress-pending">Pending</span>;
};

function StudentRecordCaseDetailCard({ c }) {
  const isMajor = c.offenseCategory === "major";
  return (
    <div className="do-student-record-case-detail">
      <div
        className="do-student-record-case-detail-title"
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 10px" }}
      >
        <span>
          {formatCaseId(c.id)} — {c.caseType}
        </span>
        <span
          className={`do-student-record-severity-pill${isMajor ? " do-student-record-severity-pill--major" : " do-student-record-severity-pill--minor"}`}
        >
          {isMajor ? "Major offense" : "Minor offense"}
        </span>
      </div>
      <p className="do-student-record-case-detail-meta">
        Filed {c.dateLabel} · Status: {c.status}
        {c.priority && c.priority !== "—" ? ` · Priority: ${c.priority}` : ""}
      </p>
      <div className="do-student-record-case-detail-label">Offense type (major / minor classification)</div>
      <p className="do-student-record-case-detail-body" style={{ margin: 0 }}>
        {c.offenseType || "—"}
      </p>
      <div className="do-student-record-case-detail-label">Assigned to</div>
      <p className="do-student-record-case-detail-body" style={{ margin: 0 }}>
        {c.officer || "—"}
      </p>
      <div className="do-student-record-case-detail-label">Description</div>
      <p className="do-student-record-case-detail-body">{c.body || "—"}</p>
      {c.evidenceNames && c.evidenceNames.length > 0 ? (
        <>
          <div className="do-student-record-case-detail-label">Evidence submitted</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#334155" }}>
            {c.evidenceNames.map((name, idx) => (
              <li key={`${c.id}-ev-${idx}-${name}`}>{name}</li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="do-student-record-case-detail-label">Evidence submitted</div>
          <p className="do-student-record-case-detail-body" style={{ margin: 0, color: "#94a3b8" }}>
            None listed
          </p>
        </>
      )}
    </div>
  );
}

/** Minor (amber) and major (red) capsule trackers; 3 minor cases roll into 1 major fill. */
function StudentCasesCapsules({ minorFilled, majorFilled, slots = 3 }) {
  const mf = Math.max(0, Math.min(slots, Number(minorFilled) || 0));
  const Mf = Math.max(0, Math.min(slots, Number(majorFilled) || 0));
  return (
    <div
      className="do-cases-capsules"
      role="img"
      aria-label={`Minor progress ${mf} of ${slots} toward the next major offense; major level ${Mf} of ${slots}. Three minors count as one major.`}
    >
      <div className="do-cases-capsules-title">Cases</div>
      <div className="do-cases-capsules-grid">
        <div className="do-cases-capsules-col">
          <span className="do-cases-capsules-label">Minor</span>
          <div className="do-cases-capsules-pills">
            {Array.from({ length: slots }, (_, i) => (
              <span
                key={`sr-min-${i}`}
                className={`do-cases-pill do-cases-pill--minor${i < mf ? " do-cases-pill--filled" : ""}`}
              />
            ))}
          </div>
        </div>
        <div className="do-cases-capsules-col">
          <span className="do-cases-capsules-label">Major</span>
          <div className="do-cases-capsules-pills">
            {Array.from({ length: slots }, (_, i) => (
              <span
                key={`sr-maj-${i}`}
                className={`do-cases-pill do-cases-pill--major${i < Mf ? " do-cases-pill--filled" : ""}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StudentRecordsPage() {
  const { cases, loading: casesLoading } = useCases([]);
  const { records, loading: recordsLoading, fetchError, refresh } = useStudentRecords(DO_STUDENT_RECORDS_SEED);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

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
        String(r.program).toLowerCase().includes(q) ||
        String(r.school || "").toLowerCase().includes(q)
      );
    });
  }, [search, mergedRows]);

  const stats = useMemo(() => {
    return {
      total: mergedRows.length,
      done: mergedRows.filter((r) => r.recordProgressStatus === "done").length,
      pending: mergedRows.filter((r) => r.recordProgressStatus === "pending").length,
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
              <p>
                One row per student with cases from the dashboard and case management. Cases show minor progress
                (amber) and major level (red); every three minor offenses fill one major slot.
              </p>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-value total">{stats.total}</p>
              <p className="stat-label">Total Students</p>
            </div>
            <div className="stat-card" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
              <p className="stat-value" style={{ color: "#15803d" }}>
                {stats.done}
              </p>
              <p className="stat-label">Done</p>
            </div>
            <div className="stat-card" style={{ background: "#fff7ed", borderColor: "#fed7aa" }}>
              <p className="stat-value" style={{ color: "#c2410c" }}>
                {stats.pending}
              </p>
              <p className="stat-label">Pending</p>
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
                    <th>School</th>
                    <th>Program</th>
                    <th style={{ minWidth: 200 }}>Cases</th>
                    <th>Last incident</th>
                    <th>Status</th>
                    <th className="cases-table-col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.studentId}>
                      <td style={{ fontWeight: 600 }}>{r.studentId}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.studentName}</div>
                      </td>
                      <td>{r.school || "—"}</td>
                      <td style={{ maxWidth: 200, fontSize: 13 }}>{r.program}</td>
                      <td>
                        <StudentCasesCapsules
                          minorFilled={r.capsuleMinorFilled ?? 0}
                          majorFilled={r.capsuleMajorFilled ?? 0}
                          slots={r.capsuleSlots ?? 3}
                        />
                      </td>
                      <td>{r.lastIncident}</td>
                      <td>{r.recordProgressStatus ? <RecordProgressPill status={r.recordProgressStatus} /> : null}</td>
                      <td className="cases-table-col-action">
                        <button
                          className="cc-btn-secondary btn-view--fixed"
                          type="button"
                          onClick={() => {
                            setSelectedStudent(r);
                            setIsViewOpen(true);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "24px 8px", color: "#64748b" }}>
                        No student records yet. File a disciplinary case on the dashboard or in Case Management.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {selectedStudent && isViewOpen && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => {
            setSelectedStudent(null);
            setIsViewOpen(false);
          }}
        >
          <div
            className="cc-modal do-modal do-modal--lg do-modal--case-detail"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">Student record</div>
              <button
                className="cc-modal-close"
                type="button"
                aria-label="Close"
                onClick={() => {
                  setSelectedStudent(null);
                  setIsViewOpen(false);
                }}
              >
                ✕
              </button>
            </div>

            <div className="cc-modal-body do-student-record-modal-body">
              <div className="do-student-record-modal-identity">
                <div className="do-student-record-modal-title-wrap">
                  <p className="do-student-record-modal-name">{selectedStudent.studentName}</p>
                  <p className="do-student-record-modal-sub">
                    {selectedStudent.studentId} · {selectedStudent.school || "—"}
                  </p>
                </div>
                <div className="do-student-record-modal-status-wrap">
                  {selectedStudent.recordProgressStatus ? (
                    <RecordProgressPill status={selectedStudent.recordProgressStatus} />
                  ) : (
                    <span className="do-student-record-no-major-status">No major offense status</span>
                  )}
                </div>
              </div>

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
                  <div className="cc-label">School</div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{selectedStudent.school || "—"}</div>
                </div>
                <div className="cc-field">
                  <div className="cc-label">Program</div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{selectedStudent.program}</div>
                </div>
              </div>

              <div className="cc-modal-row">
                <div className="cc-field" style={{ flex: 1, minWidth: 0 }}>
                  <div className="cc-label">Standing</div>
                  <div style={{ marginTop: 6 }}>
                    <StandingPill category={selectedStudent.category} />
                  </div>
                </div>
              </div>

              <div className="do-student-record-summary-card">
                <div className="cc-label">Summary</div>
                <div className="do-student-record-summary-copy">
                  {selectedStudent.casesDisplay}. Last incident on {selectedStudent.lastIncident}.
                </div>
                <p className="do-student-record-counts-line">
                  {selectedStudent.majorCases ?? 0} major case{selectedStudent.majorCases !== 1 ? "s" : ""},{" "}
                  {selectedStudent.minorCases ?? 0} minor — {selectedStudent.equivalentMajorTotal ?? 0} total major
                  equivalent{selectedStudent.equivalentMajorTotal !== 1 ? "s" : ""} (3 minor = 1 major).
                </p>
              </div>

              {(() => {
                const all = selectedStudent.caseSummaries || [];
                const majorList = all.filter((c) => c.offenseCategory === "major");
                const minorList = all.filter((c) => c.offenseCategory === "minor");
                return (
                  <>
                    <div className="do-student-record-offense-block">
                      <h4 className="do-student-record-offense-heading do-student-record-offense-heading--major">
                        Major offenses ({majorList.length}) — newest first
                      </h4>
                      {majorList.length === 0 ? (
                        <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>No major offense cases recorded.</p>
                      ) : (
                        majorList.map((c) => <StudentRecordCaseDetailCard key={c.id} c={c} />)
                      )}
                    </div>
                    <div className="do-student-record-offense-block">
                      <h4 className="do-student-record-offense-heading do-student-record-offense-heading--minor">
                        Minor offenses ({minorList.length}) — newest first
                      </h4>
                      {minorList.length === 0 ? (
                        <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>No minor offense cases recorded.</p>
                      ) : (
                        minorList.map((c) => <StudentRecordCaseDetailCard key={c.id} c={c} />)
                      )}
                    </div>
                  </>
                );
              })()}

              {selectedStudent.notes ? (
                <div style={{ marginTop: 12 }}>
                  <div className="cc-label">Welfare notes (legacy record)</div>
                  <div style={{ color: "#0f172a", fontSize: 14 }}>{selectedStudent.notes}</div>
                </div>
              ) : null}
            </div>

            <div className="cc-modal-actions">
              <button
                className="cc-btn-secondary"
                type="button"
                onClick={() => {
                  setSelectedStudent(null);
                  setIsViewOpen(false);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



const statusColor = (status) => {
  const s = String(status).toLowerCase();
  if (s.includes("declined") || s.includes("rejected")) return "closed";
  if (s.includes("approved")) return "completed";
  if (s.includes("pending")) return "scheduled";
  return "scheduled";
};

export function DocumentRequestsPage() {
  const [docSearchParams] = useSearchParams();
  const { requests, loading, fetchError, refresh, insertRequest, updateRequest } =
    useDocumentRequests(DO_DOCUMENT_REQUESTS_SEED);
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newDocModalKey, setNewDocModalKey] = useState(0);
  const [docSubmitting, setDocSubmitting] = useState(false);
  const [acceptingUploadBusy, setAcceptingUploadBusy] = useState(false);

  const session = useMemo(() => {
    return readCampusCareSession();
  }, []);

  useEffect(() => {
    const key = String(docSearchParams.get("request") || "").trim();
    if (!key || requests.length === 0) return;
    const found = requests.find((r) => {
      const id = String(r.requestId || r.id || "");
      return id === key || id.toLowerCase() === key.toLowerCase();
    });
    if (found) setSelectedRequest(found);
  }, [docSearchParams, requests]);

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

  const outgoingDoc = useMemo(() => filtered.filter((r) => r.direction === "outgoing"), [filtered]);
  const incomingDoc = useMemo(() => filtered.filter((r) => r.direction === "incoming"), [filtered]);

  const renderDocTable = (rows) => (
    <div className="cc-table-wrapper">
      <table className="cc-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Partner office</th>
            <th>Document Type</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Requested Date</th>
            <th className="cases-table-col-action">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.requestId}>
              <td style={{ fontWeight: 600 }}>{r.requestId}</td>
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
              <td className="cases-table-col-action">
                <button className="cc-btn-secondary btn-view--fixed" type="button" onClick={() => setSelectedRequest(r)}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const handleAcceptingOfficeAttachment = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedRequest || selectedRequest.direction !== "incoming") return;
    if (!canReceivingOfficeUploadDoc(selectedRequest.status)) {
      showToast("Approve this request before uploading a file.", { variant: "warning" });
      return;
    }
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
              <p>
                Inter-office requests between the student welfare offices.
              </p>
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
                    placeholder="Search by request ID, partner office, or document type..."
                  />
                </div>
                <div style={{ width: 280, textAlign: "right" }}>
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 500,
                      color: "#0f172a",
                      fontSize: 14,
                    }}
                  >
                    Outgoing {outgoingDoc.length} · Incoming {incomingDoc.length}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: "0 20px 20px" }}>
              <h3 style={{ fontSize: 15, margin: "16px 0 8px", color: "#0f172a" }}>
                Requests from Discipline Office to HSO / SDAO
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>
                You only file these requests here. The partner office (HSO or SDAO) approves or declines; if they approve,
                they attach the document. Discipline Office does not approve its own outgoing requests.
              </p>
              {outgoingDoc.length === 0 ? (
                <p style={{ color: "#64748b", padding: "12px 0" }}>No outgoing document requests.</p>
              ) : (
                renderDocTable(outgoingDoc)
              )}

              <h3 style={{ fontSize: 15, margin: "28px 0 8px", color: "#0f172a" }}>
                Requests from partner offices to Discipline Office
              </h3>
              {incomingDoc.length === 0 ? (
                <p style={{ color: "#64748b", padding: "12px 0" }}>No incoming document requests.</p>
              ) : (
                renderDocTable(incomingDoc)
              )}
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

              {selectedRequest.direction === "outgoing" && isDocRequestPendingApproval(selectedRequest.status) ? (
                <p
                  style={{
                    color: "#1e40af",
                    fontSize: 13,
                    marginTop: 12,
                    lineHeight: 1.45,
                    background: "#eff6ff",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #bfdbfe",
                  }}
                >
                  <strong>No approval step on your side.</strong>{" "}
                  {labelForOfficeKey(selectedRequest.partnerOffice)} will approve or decline this request. After they
                  approve, they will attach the document here for Discipline Office.
                </p>
              ) : null}
              {selectedRequest.direction === "outgoing" && isDocRequestApprovedForFulfillment(selectedRequest.status) ? (
                <p
                  style={{
                    color: "#14532d",
                    fontSize: 13,
                    marginTop: 12,
                    lineHeight: 1.45,
                    background: "#f0fdf4",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #bbf7d0",
                  }}
                >
                  This request was approved by {labelForOfficeKey(selectedRequest.partnerOffice)}. They can attach the
                  file; you will see it under Attachments when it is uploaded.
                </p>
              ) : null}
              {selectedRequest.direction === "outgoing" && isDocRequestDeclined(selectedRequest.status) ? (
                <p style={{ color: "#991b1b", fontSize: 13, marginTop: 12 }}>
                  {labelForOfficeKey(selectedRequest.partnerOffice)} declined this request.
                </p>
              ) : null}
              {selectedRequest.direction === "outgoing" &&
              normalizeInterOfficeDocStatus(selectedRequest.status) === "fulfilled" ? (
                <p style={{ color: "#14532d", fontSize: 13, marginTop: 12 }}>
                  This request was fulfilled — the document should appear in Attachments below.
                </p>
              ) : null}

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

              {selectedRequest.direction === "incoming" && isDocRequestPendingApproval(selectedRequest.status) ? (
                <p style={{ color: "#92400e", fontSize: 13, marginTop: 12, lineHeight: 1.45, background: "#fffbeb", padding: 10, borderRadius: 8, border: "1px solid #fde68a" }}>
                  Approve this request first. After approval, you can attach the file for the requesting office.
                </p>
              ) : null}
              {selectedRequest.direction === "incoming" && isDocRequestDeclined(selectedRequest.status) ? (
                <p style={{ color: "#991b1b", fontSize: 13, marginTop: 12 }}>This request was declined. No file upload is required.</p>
              ) : null}
              {selectedRequest.direction === "incoming" && canReceivingOfficeUploadDoc(selectedRequest.status) ? (
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
              {selectedRequest.direction === "incoming" && isDocRequestPendingApproval(selectedRequest.status) ? (
                <>
                  <button
                    className="cc-btn-secondary"
                    type="button"
                    onClick={async () => {
                      try {
                        await updateRequest(selectedRequest.requestId, { status: INTER_OFFICE_DOC_STATUS.DECLINED });
                        setSelectedRequest((prev) =>
                          prev ? { ...prev, status: INTER_OFFICE_DOC_STATUS.DECLINED } : prev,
                        );
                        await refresh();
                        showToast("Request declined.", { variant: "success" });
                      } catch (err) {
                        showToast(err?.message || "Could not update request.", { variant: "error" });
                      }
                    }}
                  >
                    Decline
                  </button>
                  <button
                    className="cc-btn-primary"
                    type="button"
                    onClick={async () => {
                      try {
                        await updateRequest(selectedRequest.requestId, { status: INTER_OFFICE_DOC_STATUS.APPROVED });
                        setSelectedRequest((prev) =>
                          prev ? { ...prev, status: INTER_OFFICE_DOC_STATUS.APPROVED } : prev,
                        );
                        await refresh();
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
              status: INTER_OFFICE_DOC_STATUS.PENDING_APPROVAL,
              description: payload.description,
              evidence: payload.evidenceFile ? [{ name: payload.evidenceFile.name }] : [],
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



const DO_REFERRAL_TARGETS = [
  { value: "HSO", targetOffice: "health", label: "Health Services (HSO)" },
  { value: "SDAO", targetOffice: "development", label: "SDAO — Student Development" },
];

function referralPartnerLabel(targetOfficeKey) {
  const m = DO_REFERRAL_TARGETS.find((t) => t.targetOffice === targetOfficeKey);
  return m?.label || targetOfficeKey || "—";
}

/** Incoming-to-DO source office → abbreviated unit + formal department name */
function referralDepartmentMetaForIncoming(referringOfficeKey) {
  const k = String(referringOfficeKey || "").toLowerCase();
  if (k === "health") return { code: "HSO", fullName: "Health Services Office" };
  if (k === "development") return { code: "SDAO", fullName: "Student Development and Activities Office" };
  if (k === "discipline") return { code: "SDO", fullName: "Student Discipline Office" };
  const m = DO_REFERRAL_TARGETS.find((t) => t.targetOffice === referringOfficeKey);
  if (m?.value === "HSO") return { code: "HSO", fullName: "Health Services Office" };
  if (m?.value === "SDAO") return { code: "SDAO", fullName: "Student Development and Activities Office" };
  return { code: "—", fullName: referralPartnerLabel(referringOfficeKey) };
}

export function ReferralsPage() {
  const [refSearchParams] = useSearchParams();
  const {
    referrals,
    loading,
    fetchError,
    refresh,
    insertReferral,
    updateReferral,
  } = useReferrals(DO_REFERRALS_SEED);
  const { cases } = useCases([]);
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
  const [partnerHealthReferrals, setPartnerHealthReferrals] = useState([]);
  const [partnerSdaoReferrals, setPartnerSdaoReferrals] = useState([]);
  const [selectedPartnerReferral, setSelectedPartnerReferral] = useState(null);

  useEffect(() => {
    const key = String(refSearchParams.get("referral") || "").trim();
    if (!key || referrals.length === 0) return;
    const found = referrals.find((r) => {
      const id = String(r.id || r.referralId || "");
      return id === key || id.toLowerCase() === key.toLowerCase();
    });
    if (found) setSelected(found);
  }, [refSearchParams, referrals]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return undefined;
    let cancelled = false;
    (async () => {
      const [hRes, sRes] = await Promise.all([
        supabase
          .from("health_referrals")
          .select("*")
          .or("receiving_office.ilike.%Discipline%,receiving_office.ilike.%DO%")
          .order("referral_date", { ascending: false }),
        supabase
          .from("sdao_referrals")
          .select("*")
          .or("receiving_office.ilike.%Discipline%,receiving_office.ilike.%DO%")
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setPartnerHealthReferrals(hRes.data || []);
      setPartnerSdaoReferrals(sRes.data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const referralStudentPreview = useMemo(() => {
    const sidDigits = studentIdDigitsOnly(form.studentId);
    if (sidDigits.length < 10) return null;
    const matches = cases.filter((c) => studentIdDigitsOnly(c.studentId) === sidDigits);
    if (!matches.length) return null;
    const last = matches.sort((a, b) => {
      const ta = a.reportedAt ? new Date(a.reportedAt).getTime() : 0;
      const tb = b.reportedAt ? new Date(b.reportedAt).getTime() : 0;
      return tb - ta;
    })[0];
    const meta = parseCaseMeta(last);
    return {
      studentName: last.student,
      studentId: last.studentId,
      program: meta.program,
      school: meta.school,
    };
  }, [form.studentId, cases]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = !q
      ? referrals
      : referrals.filter((r) => {
          return (
            r.studentName.toLowerCase().includes(q) ||
            r.studentId.toLowerCase().includes(q) ||
            r.referralId.toLowerCase().includes(q) ||
            r.referralType.toLowerCase().includes(q)
          );
        });
    return base;
  }, [referrals, search]);

  const outgoingReferrals = useMemo(
    () => filtered.filter((r) => r.referringOffice === "discipline"),
    [filtered],
  );
  const incomingReferrals = useMemo(
    () => filtered.filter((r) => r.targetOffice === "discipline"),
    [filtered],
  );

  const unifiedIncomingReferrals = useMemo(() => {
    const q = search.trim().toLowerCase();
    const partnerMatches = (row, idStr) =>
      !q ||
      String(row.student_name || "")
        .toLowerCase()
        .includes(q) ||
      String(row.student_id || "")
        .toLowerCase()
        .includes(q) ||
      String(idStr || "")
        .toLowerCase()
        .includes(q);

    const rows = [];

    for (const r of incomingReferrals) {
      const dept = referralDepartmentMetaForIncoming(r.referringOffice);
      rows.push({
        key: `dr-${r.referralId}`,
        variant: "discipline_referrals",
        referralRecord: r,
        idDisplay: r.referralId,
        departmentCode: dept.code,
        departmentFullName: dept.fullName,
        studentName: r.studentName,
        studentId: r.studentId,
        status: r.status,
        dateDisplay: r.date,
        sortTs: (() => {
          const t = Date.parse(String(r.date));
          return Number.isFinite(t) ? t : 0;
        })(),
      });
    }

    for (const row of partnerHealthReferrals) {
      const idDisp = String(row.reference_id || row.id).slice(0, 24);
      if (!partnerMatches(row, idDisp)) continue;
      const dRaw = row.referral_date;
      rows.push({
        key: `hr-${row.id}`,
        variant: "health_partner",
        partnerRow: row,
        idDisplay: idDisp,
        departmentCode: "HSO",
        departmentFullName: "Health Services Office",
        studentName: row.student_name,
        studentId: row.student_id,
        status: row.status,
        dateDisplay: dRaw || "—",
        sortTs: (() => {
          if (!dRaw) return 0;
          const t = Date.parse(`${String(dRaw).slice(0, 10)}T12:00:00`);
          return Number.isFinite(t) ? t : 0;
        })(),
      });
    }

    for (const row of partnerSdaoReferrals) {
      const idDisp = String(row.reference_id || row.id).slice(0, 24);
      if (!partnerMatches(row, idDisp)) continue;
      const dRaw = row.created_at ? String(row.created_at).slice(0, 10) : "";
      rows.push({
        key: `sr-${row.id}`,
        variant: "sdao_partner",
        partnerRow: row,
        idDisplay: idDisp,
        departmentCode: "SDAO",
        departmentFullName: "Student Development and Activities Office",
        studentName: row.student_name,
        studentId: row.student_id,
        status: row.status,
        dateDisplay: dRaw || "—",
        sortTs: (() => {
          if (!dRaw) return 0;
          const t = Date.parse(`${dRaw}T12:00:00`);
          return Number.isFinite(t) ? t : 0;
        })(),
      });
    }

    rows.sort((a, b) => b.sortTs - a.sortTs);
    return rows;
  }, [incomingReferrals, partnerHealthReferrals, partnerSdaoReferrals, search]);

  const statusPill = (status) => {
    const s = String(status).toLowerCase();
    if (s.includes("approved")) return "completed";
    if (s.includes("pending")) return "scheduled";
    return "scheduled";
  };

  const renderReferralTable = (rows, emptyMsg) => (
    <div className="cc-table-wrapper">
      <table className="cc-table">
        <thead>
          <tr>
            <th>Referral ID</th>
            <th>Student</th>
            <th>To / From</th>
            <th>Status</th>
            <th>Date</th>
            <th className="cases-table-col-action">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.referralId}>
              <td style={{ fontWeight: 600 }}>{r.referralId}</td>
              <td>
                <div style={{ fontWeight: 600 }}>{r.studentName}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{r.studentId}</div>
              </td>
              <td>
                {r.referringOffice === "discipline" ? (
                  <span>
                    To <strong>{referralPartnerLabel(r.targetOffice)}</strong>
                  </span>
                ) : (
                  <span>
                    From <strong>{referralPartnerLabel(r.referringOffice)}</strong>
                  </span>
                )}
              </td>
              <td>
                <span className={`cc-pill ${statusPill(r.status)}`}>{r.status}</span>
              </td>
              <td>{r.date}</td>
              <td className="cases-table-col-action">
                <button className="cc-btn-secondary btn-view--fixed" type="button" onClick={() => setSelected(r)}>
                  View
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: "24px 8px", color: "#64748b" }}>
                {emptyMsg}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

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
                <div style={{ width: 280, textAlign: "right" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, color: "#0f172a", fontSize: 14 }}>
                    Outgoing {outgoingReferrals.length} · Incoming {unifiedIncomingReferrals.length}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: "0 20px 20px" }}>
              <h3 style={{ fontSize: 15, margin: "16px 0 8px", color: "#0f172a" }}>
                Referrals from Discipline Office
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
                Referrals are sent directly to Health Services or SDAO for review and approval.
              </p>
              {renderReferralTable(
                outgoingReferrals,
                "No outgoing referrals. Partner approvals happen in HSO/SDAO portals.",
              )}

              <h3 style={{ fontSize: 15, margin: "28px 0 8px", color: "#0f172a" }}>
                Referrals from other Department
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
                Discipline referrals, Health Services referrals, and SDAO referrals routed to Discipline Office—approve
                or decline in one place.{" "}
                <strong>SDAO</strong> = Student Development and Activities Office, <strong>HSO</strong> = Health
                Services Office, <strong>SDO</strong> = Student Discipline Office.
              </p>
              <div className="cc-table-wrapper">
                <table className="cc-table">
                  <thead>
                    <tr>
                      <th>Referral ID</th>
                      <th>Department</th>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th className="cases-table-col-action">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedIncomingReferrals.map((row) => (
                      <tr key={row.key}>
                        <td style={{ fontWeight: 600 }}>{row.idDisplay}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{row.departmentCode}</div>
                          <div style={{ color: "#64748b", fontSize: 12, maxWidth: 220 }}>{row.departmentFullName}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{row.studentName}</div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>{row.studentId}</div>
                        </td>
                        <td>
                          <span className={`cc-pill ${statusPill(row.status)}`}>{row.status}</span>
                        </td>
                        <td>{row.dateDisplay}</td>
                        <td className="cases-table-col-action">
                          <button
                            type="button"
                            className="cc-btn-secondary btn-view--fixed"
                            onClick={() => {
                              if (row.variant === "discipline_referrals") {
                                setSelected(row.referralRecord);
                              } else if (row.variant === "health_partner") {
                                setSelectedPartnerReferral({ kind: "health", row: row.partnerRow });
                              } else {
                                setSelectedPartnerReferral({ kind: "sdao", row: row.partnerRow });
                              }
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {unifiedIncomingReferrals.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "24px 8px", color: "#64748b" }}>
                          No referrals from other departments to Discipline Office.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>

      {selectedPartnerReferral && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setSelectedPartnerReferral(null)}
        >
          <div
            className="cc-modal do-modal do-modal--lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">
                {selectedPartnerReferral.kind === "health" ? "HSO referral to DO" : "SDAO referral to DO"}
              </div>
              <button
                className="cc-modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setSelectedPartnerReferral(null)}
              >
                ✕
              </button>
            </div>
            <div className="cc-modal-body">
              <div className="cc-modal-row">
                <div className="cc-field" style={{ flex: 1 }}>
                  <div className="cc-label">Student</div>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>
                    {selectedPartnerReferral.row.student_name}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{selectedPartnerReferral.row.student_id}</div>
                </div>
                <div className="cc-field" style={{ flex: 1 }}>
                  <div className="cc-label">Status</div>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>{selectedPartnerReferral.row.status}</div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Reason</div>
                <div style={{ color: "#0f172a", fontSize: 14, marginTop: 6 }}>{selectedPartnerReferral.row.reason}</div>
              </div>
              {canReceivingOfficeReviewReferral(selectedPartnerReferral.row.status) ? (
                <p style={{ fontSize: 13, color: "#64748b", marginTop: 12, lineHeight: 1.5 }}>
                  You may approve or decline this referral for Discipline Office.
                </p>
              ) : null}
            </div>
            <div className="cc-modal-actions">
              <button className="cc-btn-secondary" type="button" onClick={() => setSelectedPartnerReferral(null)}>
                Close
              </button>
              {canReceivingOfficeReviewReferral(selectedPartnerReferral.row.status) ? (
                <>
                  <button
                    className="cc-btn-secondary"
                    type="button"
                    onClick={async () => {
                      try {
                        if (!isSupabaseConfigured() || !supabase) return;
                        const table =
                          selectedPartnerReferral.kind === "health" ? "health_referrals" : "sdao_referrals";
                        const { error } = await supabase
                          .from(table)
                          .update({
                            status: DISCIPLINE_REFERRAL_STATUS.DECLINED,
                            updated_at: new Date().toISOString(),
                          })
                          .eq("id", selectedPartnerReferral.row.id);
                        if (error) throw error;
                        if (selectedPartnerReferral.kind === "health") {
                          setPartnerHealthReferrals((prev) =>
                            prev.map((r) =>
                              r.id === selectedPartnerReferral.row.id
                                ? { ...r, status: DISCIPLINE_REFERRAL_STATUS.DECLINED }
                                : r,
                            ),
                          );
                        } else {
                          setPartnerSdaoReferrals((prev) =>
                            prev.map((r) =>
                              r.id === selectedPartnerReferral.row.id
                                ? { ...r, status: DISCIPLINE_REFERRAL_STATUS.DECLINED }
                                : r,
                            ),
                          );
                        }
                        setSelectedPartnerReferral((prev) =>
                          prev
                            ? {
                                ...prev,
                                row: { ...prev.row, status: DISCIPLINE_REFERRAL_STATUS.DECLINED },
                              }
                            : null,
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
                    className="cc-btn-primary"
                    type="button"
                    onClick={async () => {
                      try {
                        if (!isSupabaseConfigured() || !supabase) return;
                        const table =
                          selectedPartnerReferral.kind === "health" ? "health_referrals" : "sdao_referrals";
                        const { error } = await supabase
                          .from(table)
                          .update({
                            status: DISCIPLINE_REFERRAL_STATUS.APPROVED,
                            updated_at: new Date().toISOString(),
                          })
                          .eq("id", selectedPartnerReferral.row.id);
                        if (error) throw error;
                        if (selectedPartnerReferral.kind === "health") {
                          setPartnerHealthReferrals((prev) =>
                            prev.map((r) =>
                              r.id === selectedPartnerReferral.row.id
                                ? { ...r, status: DISCIPLINE_REFERRAL_STATUS.APPROVED }
                                : r,
                            ),
                          );
                        } else {
                          setPartnerSdaoReferrals((prev) =>
                            prev.map((r) =>
                              r.id === selectedPartnerReferral.row.id
                                ? { ...r, status: DISCIPLINE_REFERRAL_STATUS.APPROVED }
                                : r,
                            ),
                          );
                        }
                        setSelectedPartnerReferral((prev) =>
                          prev
                            ? {
                                ...prev,
                                row: { ...prev.row, status: DISCIPLINE_REFERRAL_STATUS.APPROVED },
                              }
                            : null,
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
        </div>
      )}

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
                <div className="cc-label">Referral destination</div>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>
                  {selected.referringOffice === "discipline"
                    ? referralPartnerLabel(selected.targetOffice)
                    : `Discipline Office (from ${referralPartnerLabel(selected.referringOffice)})`}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Reason</div>
                <div style={{ color: "#0f172a", fontSize: 14, marginTop: 6 }}>{selected.reason}</div>
              </div>

              {selected.referringOffice === "discipline" &&
              (isReferralPendingPartnerReview(selected.status) ||
                isReferralPendingReferringReview(selected.status)) ? (
                <p style={{ fontSize: 13, color: "#64748b", marginTop: 12, lineHeight: 1.5 }}>
                  Waiting for {referralPartnerLabel(selected.targetOffice)} to approve or decline.
                </p>
              ) : null}

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Attachments</div>
                <DOEvidenceViewer evidence={selected.evidence} />
              </div>
            </div>

            <div className="cc-modal-actions">
              <button className="cc-btn-secondary" type="button" onClick={() => setSelected(null)}>
                Close
              </button>
              {selected.targetOffice === "discipline" &&
              selected.referringOffice !== "discipline" &&
              canReceivingOfficeReviewReferral(selected.status) ? (
                <>
                  <button
                    className="cc-btn-primary"
                    type="button"
                    onClick={async () => {
                      try {
                        await updateReferral(selected.referralId, { status: DISCIPLINE_REFERRAL_STATUS.APPROVED });
                        setSelected((prev) => (prev ? { ...prev, status: DISCIPLINE_REFERRAL_STATUS.APPROVED } : prev));
                        showToast("Referral approved.", { variant: "success" });
                        await refresh();
                      } catch (err) {
                        showToast(err?.message || "Could not update referral.", { variant: "error" });
                      }
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="cc-btn-secondary"
                    type="button"
                    onClick={async () => {
                      try {
                        await updateReferral(selected.referralId, { status: DISCIPLINE_REFERRAL_STATUS.DECLINED });
                        setSelected((prev) => (prev ? { ...prev, status: DISCIPLINE_REFERRAL_STATUS.DECLINED } : prev));
                        showToast("Referral declined.", { variant: "success" });
                        await refresh();
                      } catch (err) {
                        showToast(err?.message || "Could not update referral.", { variant: "error" });
                      }
                    }}
                  >
                    Decline
                  </button>
                </>
              ) : null}
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
            className="cc-modal do-modal do-modal--lg do-modal--new-case"
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
                const sidErr = validateDoStudentId(form.studentId, "Student ID");
                if (sidErr) nextErrors.studentId = sidErr;
                else if (!referralStudentPreview) {
                  nextErrors.studentId = "No student found with this ID in case records.";
                }
                const target = DO_REFERRAL_TARGETS.find((t) => t.value === form.referralType);
                if (!target) nextErrors.referralType = "Select Health Services or SDAO.";
                if (!form.reason.trim()) nextErrors.reason = "Reason is required.";
                if (!evidenceFile) nextErrors.evidence = "Attachment is required.";

                setErrors(nextErrors);
                if (Object.keys(nextErrors).length > 0) return;

                const sid = sanitizeDoStudentIdInput(form.studentId.trim());

                let evItems = [];
                try {
                  evItems = [await fileToEvidenceItem(evidenceFile)];
                } catch (err) {
                  setErrors({ evidence: err?.message || "Could not read file." });
                  return;
                }

                try {
                  const created = await insertReferral({
                    studentName: referralStudentPreview.studentName.trim(),
                    studentId: sid,
                    referralType: target.label,
                    targetOffice: target.targetOffice,
                    referringOffice: "discipline",
                    reason: form.reason.trim(),
                    status: DISCIPLINE_REFERRAL_STATUS.PENDING_PARTNER,
                    evidence: evItems,
                  });
                  setSelected(created);
                  setIsNewOpen(false);
                  setErrors({});
                  setEvidenceFile(null);
                  setForm({ studentId: "", referralType: "", reason: "" });
                  showToast("Referral created.", { variant: "success" });
                  await refresh();
                } catch (err) {
                  showToast(err?.message || "Could not create referral.", { variant: "error" });
                }
              }}
            >
              <div className="cc-modal-body">
                <div className="cc-field">
                  <div className="cc-label">Student ID</div>
                  <input
                    className={`cc-input${errors.studentId ? " cc-input-error" : ""}`}
                    placeholder="e.g. "
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.studentId}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, studentId: sanitizeDoStudentIdInput(e.target.value) }))
                    }
                    aria-invalid={Boolean(errors.studentId)}
                  />
                  {errors.studentId && <div className="cc-form-error" role="alert">{errors.studentId}</div>}
                </div>

                {referralStudentPreview ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    <div className="cc-label" style={{ marginBottom: 6 }}>
                      Student information
                    </div>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{referralStudentPreview.studentName}</div>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                      Program: {referralStudentPreview.program}
                    </div>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
                      School: {referralStudentPreview.school}
                    </div>
                  </div>
                ) : null}

                <div className="cc-field">
                  <div className="cc-label">Refer to office</div>
                  <select
                    className={`cc-input${errors.referralType ? " cc-input-error" : ""}`}
                    value={DO_REFERRAL_TARGETS.some((t) => t.value === form.referralType) ? form.referralType : ""}
                    onChange={(e) => setForm((p) => ({ ...p, referralType: e.target.value }))}
                    aria-invalid={Boolean(errors.referralType)}
                  >
                    <option value="">Select office (DO is not listed)</option>
                    {DO_REFERRAL_TARGETS.map((t) => (
                      <option value={t.value} key={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {errors.referralType && <div className="cc-form-error" role="alert">{errors.referralType}</div>}
                </div>

                <div className="cc-field">
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

                <div className="cc-field">
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

const SANCTION_CORRESPONDING_OFFICES = [
  { value: "", label: "Select office" },
  { value: "Treasury", label: "Treasury" },
  { value: "Registrar", label: "Registrar" },
  { value: "Community Extension", label: "Community Extension" },
  { value: "Others", label: "Others" },
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
  const { cases } = useCases([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  const sanctionFiledDateLabel = useMemo(() => {
    if (!isNewOpen) return "";
    return formatCaseDateFromIso(new Date().toISOString());
  }, [isNewOpen]);

  const [form, setForm] = useState({
    caseId: "",
    studentId: "",
    sanctionType: "",
    notes: "",
    hours: "",
    correspondingOffice: "",
    correspondingOfficeOther: "",
    completionDate: "",
    communityServiceDetail: "",
  });
  const [errors, setErrors] = useState({});

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState(1);
  const [pendingSanctionPayload, setPendingSanctionPayload] = useState(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const linkedCaseEvidence = useMemo(() => {
    const linkedCase = cases.find((c) => String(c.id) === String(form.caseId));
    return Array.isArray(linkedCase?.evidence) ? linkedCase.evidence : [];
  }, [form.caseId, cases]);

  const resetSanctionForm = () => {
    setForm({
      caseId: "",
      studentId: "",
      sanctionType: "",
      notes: "",
      hours: "",
      correspondingOffice: "",
      correspondingOfficeOther: "",
      completionDate: "",
      communityServiceDetail: "",
    });
    setErrors({});
  };

  const closeConfirmFlow = () => {
    setConfirmOpen(false);
    setConfirmStep(1);
    setPendingSanctionPayload(null);
    setConfirmPassword("");
    setConfirmError("");
    setConfirmSubmitting(false);
  };

  const sanctionStudentPreview = useMemo(() => {
    const selectedCase = cases.find((c) => String(c.id) === String(form.caseId));
    if (selectedCase) {
      const meta = parseCaseMeta(selectedCase);
      return {
        caseId: selectedCase.id,
        studentName: selectedCase.student,
        studentId: selectedCase.studentId,
        program: meta.program,
        school: meta.school,
        offensesSummary: `${selectedCase.caseType} (${selectedCase.status})`,
      };
    }
    const sidDigits = studentIdDigitsOnly(form.studentId);
    if (sidDigits.length < 10) return null;
    const matches = cases.filter((c) => studentIdDigitsOnly(c.studentId) === sidDigits);
    if (!matches.length) return null;
    const last = matches.sort((a, b) => {
      const ta = a.reportedAt ? new Date(a.reportedAt).getTime() : 0;
      const tb = b.reportedAt ? new Date(b.reportedAt).getTime() : 0;
      return tb - ta;
    })[0];
    const meta = parseCaseMeta(last);
    const offensesSummary = matches
      .map((c) => `${c.caseType} (${c.status})`)
      .slice(0, 8)
      .join("; ");
    return {
      studentName: last.student,
      caseId: last.id,
      studentId: last.studentId,
      program: meta.program,
      school: meta.school,
      offensesSummary,
    };
  }, [form.caseId, form.studentId, cases]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      return (
        i.studentName.toLowerCase().includes(q) ||
        i.studentId.toLowerCase().includes(q) ||
        String(i.caseId || "").toLowerCase().includes(q) ||
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
                resetSanctionForm();
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
                    <th>Case</th>
                    <th>Hours</th>
                    <th>Due Date</th>
                    <th className="cases-table-col-action">Action</th>
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
                        {i.caseId ? (
                          <Link to={`/case-management?case=${encodeURIComponent(i.caseId)}`}>{i.caseId}</Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{i.hours != null && i.hours !== "" ? i.hours : "—"}</td>
                      <td>{i.dueDate}</td>
                      <td className="cases-table-col-action">
                        <button className="cc-btn-secondary btn-view--fixed" type="button" onClick={() => setSelected(i)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "24px 8px", color: "#64748b" }}>
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
                <div className="cc-label">Linked case</div>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>
                  {selected.caseId ? (
                    <Link to={`/case-management?case=${encodeURIComponent(selected.caseId)}`}>{selected.caseId}</Link>
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              {selected.sanctionType === "Community Service" ? (
                <>
                  <div className="cc-modal-row" style={{ marginTop: 12 }}>
                    <div className="cc-field">
                      <div className="cc-label">Hours</div>
                      <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>
                        {selected.hours != null && selected.hours !== ""
                          ? `${selected.completedHours || 0} / ${selected.hours}`
                          : "—"}
                      </div>
                    </div>
                    <div className="cc-field">
                      <div className="cc-label">Completion / end date</div>
                      <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>
                        {selected.completionDate || "—"}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div className="cc-label">Corresponding office</div>
                    <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 6 }}>
                      {selected.correspondingOffice === "Others"
                        ? selected.correspondingOfficeOther || "Others"
                        : selected.correspondingOffice || "—"}
                    </div>
                  </div>

                  {selected.communityServiceDetail ? (
                    <div style={{ marginTop: 12 }}>
                      <div className="cc-label">Community service detail</div>
                      <div style={{ color: "#0f172a", fontSize: 14, marginTop: 6 }}>
                        {selected.communityServiceDetail}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {selected.offensesSummary ? (
                <div style={{ marginTop: 12 }}>
                  <div className="cc-label">Related offenses (from cases)</div>
                  <div style={{ color: "#0f172a", fontSize: 14, marginTop: 6 }}>{selected.offensesSummary}</div>
                </div>
              ) : null}

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Compliance Notes</div>
                <div style={{ color: "#0f172a", fontSize: 14, marginTop: 6 }}>{selected.notes}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="cc-label">Evidence</div>
                <DOEvidenceViewer evidence={selected.evidence} />
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
            className="cc-modal do-modal do-modal--lg do-modal--new-case"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">New Sanction</div>
              <button className="cc-modal-close" type="button" aria-label="Close" onClick={() => setIsNewOpen(false)}>
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const nextErrors = {};
                const sidErr = validateDoStudentId(form.studentId, "Student ID");
                if (sidErr) nextErrors.studentId = sidErr;
                else if (!sanctionStudentPreview) {
                  nextErrors.studentId = "No student found with this ID in case records.";
                }
                if (!sanctionStudentPreview?.caseId) nextErrors.caseId = "Link this sanction to a discipline case.";
                if (!form.sanctionType) nextErrors.sanctionType = "Sanction Type is required.";
                if (!sanctionFiledDateLabel) nextErrors.dueDate = "Sanction date could not be set. Close and try again.";
                if (form.sanctionType === "Community Service") {
                  if (!form.hours.trim()) nextErrors.hours = "How many hours is required.";
                  if (!form.correspondingOffice) nextErrors.correspondingOffice = "Select the corresponding office.";
                  if (form.correspondingOffice === "Others" && !form.correspondingOfficeOther.trim()) {
                    nextErrors.correspondingOfficeOther = "Specify the office.";
                  }
                  if (!form.completionDate.trim()) {
                    nextErrors.completionDate = "Completion or sanction end date is required.";
                  }
                  if (!form.communityServiceDetail.trim()) {
                    nextErrors.communityServiceDetail = "Describe the community service.";
                  }
                }
                if (!form.notes.trim()) nextErrors.notes = "Notes are required.";

                setErrors(nextErrors);
                if (Object.keys(nextErrors).length > 0) return;

                const sid = sanitizeDoStudentIdInput(form.studentId.trim());
                const isCs = form.sanctionType === "Community Service";

                const payload = {
                  caseId: sanctionStudentPreview.caseId,
                  studentName: sanctionStudentPreview.studentName.trim(),
                  studentId: sid,
                  sanctionType: form.sanctionType,
                  status: "In Review",
                  dueDate: sanctionFiledDateLabel,
                  description: form.notes.trim(),
                  notes: form.notes.trim(),
                  hours: isCs ? form.hours.trim() : "",
                  correspondingOffice: isCs ? form.correspondingOffice : "",
                  correspondingOfficeOther:
                    isCs && form.correspondingOffice === "Others" ? form.correspondingOfficeOther.trim() : "",
                  completionDate: isCs ? form.completionDate.trim() : "",
                  communityServiceDetail: isCs ? form.communityServiceDetail.trim() : "",
                  program: sanctionStudentPreview.program,
                  school: sanctionStudentPreview.school,
                  offensesSummary: sanctionStudentPreview.offensesSummary,
                  evidence: linkedCaseEvidence,
                };

                setPendingSanctionPayload(payload);
                setConfirmStep(1);
                setConfirmPassword("");
                setConfirmError("");
                setConfirmSubmitting(false);
                setConfirmOpen(true);
              }}
            >
              <div className="cc-modal-body">
                <div className="cc-field">
                  <div className="cc-label">Linked Case</div>
                  <select
                    className={`cc-input${errors.caseId ? " cc-input-error" : ""}`}
                    value={form.caseId}
                    onChange={(e) => {
                      const caseId = e.target.value;
                      const selectedCase = cases.find((c) => String(c.id) === String(caseId));
                      setForm((p) => ({
                        ...p,
                        caseId,
                        studentId: selectedCase ? sanitizeDoStudentIdInput(selectedCase.studentId) : p.studentId,
                      }));
                    }}
                    aria-invalid={Boolean(errors.caseId)}
                  >
                    <option value="">Select a case for mobile proof tracking</option>
                    {cases.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.id} - {c.student} ({c.caseType})
                      </option>
                    ))}
                  </select>
                  {errors.caseId && <div className="cc-form-error" role="alert">{errors.caseId}</div>}
                </div>

                <div className="cc-field">
                  <div className="cc-label">Student ID</div>
                  <input
                    className={`cc-input${errors.studentId ? " cc-input-error" : ""}`}
                    placeholder="Enter Student ID"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.studentId}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, caseId: "", studentId: sanitizeDoStudentIdInput(e.target.value) }))
                    }
                    aria-invalid={Boolean(errors.studentId)}
                  />
                  {errors.studentId && <div className="cc-form-error" role="alert">{errors.studentId}</div>}
                </div>

                {sanctionStudentPreview ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                    }}
                  >
                    <div className="cc-label" style={{ marginBottom: 6 }}>
                      Student
                    </div>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{sanctionStudentPreview.studentName}</div>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                      Program: {sanctionStudentPreview.program} · School: {sanctionStudentPreview.school}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
                      Linked case: {sanctionStudentPreview.caseId}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                      Offenses: {sanctionStudentPreview.offensesSummary}
                    </div>
                  </div>
                ) : null}

                <div className="cc-modal-row">
                  <div className="cc-field">
                    <div className="cc-label">Sanction Type</div>
                    <select
                      className={`cc-input${errors.sanctionType ? " cc-input-error" : ""}`}
                      value={form.sanctionType}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((p) => ({
                          ...p,
                          sanctionType: v,
                          ...(v !== "Community Service"
                            ? {
                                hours: "",
                                correspondingOffice: "",
                                correspondingOfficeOther: "",
                                completionDate: "",
                                communityServiceDetail: "",
                              }
                            : {}),
                        }));
                      }}
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
                    <div className="cc-label">Filed date</div>
                    <input
                      className="cc-input"
                      readOnly
                      value={sanctionFiledDateLabel || "—"}
                      aria-readonly="true"
                    />
                    {errors.dueDate && <div className="cc-form-error" role="alert">{errors.dueDate}</div>}
                  </div>
                </div>

                {form.sanctionType === "Community Service" ? (
                  <>
                    <div className="cc-modal-row">
                      <div className="cc-field">
                        <div className="cc-label">How many hours</div>
                        <input
                          className={`cc-input${errors.hours ? " cc-input-error" : ""}`}
                          inputMode="decimal"
                          placeholder="Enter Hours of Service"
                          value={form.hours}
                          onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))}
                        />
                        {errors.hours && <div className="cc-form-error" role="alert">{errors.hours}</div>}
                      </div>
                      <div className="cc-field">
                        <div className="cc-label">Completion / sanction end date</div>
                        <input
                          type="date"
                          className={`cc-input${errors.completionDate ? " cc-input-error" : ""}`}
                          value={form.completionDate}
                          onChange={(e) => setForm((p) => ({ ...p, completionDate: e.target.value }))}
                        />
                        {errors.completionDate && (
                          <div className="cc-form-error" role="alert">
                            {errors.completionDate}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="cc-field">
                      <div className="cc-label">Corresponding office</div>
                      <select
                        className={`cc-input${errors.correspondingOffice ? " cc-input-error" : ""}`}
                        value={form.correspondingOffice}
                        onChange={(e) => setForm((p) => ({ ...p, correspondingOffice: e.target.value }))}
                      >
                        {SANCTION_CORRESPONDING_OFFICES.map((o) => (
                          <option value={o.value} key={o.value || "empty"}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {errors.correspondingOffice && (
                        <div className="cc-form-error" role="alert">
                          {errors.correspondingOffice}
                        </div>
                      )}
                    </div>

                    {form.correspondingOffice === "Others" ? (
                      <div className="cc-field">
                        <div className="cc-label">Specify office</div>
                        <input
                          className={`cc-input${errors.correspondingOfficeOther ? " cc-input-error" : ""}`}
                          value={form.correspondingOfficeOther}
                          onChange={(e) => setForm((p) => ({ ...p, correspondingOfficeOther: e.target.value }))}
                        />
                        {errors.correspondingOfficeOther && (
                          <div className="cc-form-error" role="alert">
                            {errors.correspondingOfficeOther}
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="cc-field">
                      <div className="cc-label">Community service details</div>
                      <textarea
                        className={`cc-textarea${errors.communityServiceDetail ? " cc-input-error" : ""}`}
                        value={form.communityServiceDetail}
                        onChange={(e) => setForm((p) => ({ ...p, communityServiceDetail: e.target.value }))}
                      />
                      {errors.communityServiceDetail && (
                        <div className="cc-form-error" role="alert">
                          {errors.communityServiceDetail}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}

                <div className="cc-field">
                  <div className="cc-label">Notes</div>
                  <textarea
                    className="cc-textarea"
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    aria-invalid={Boolean(errors.notes)}
                  />
                  {errors.notes && <div className="cc-form-error" role="alert">{errors.notes}</div>}
                </div>

                <div className="cc-field">
                  <div className="cc-label">Evidence (from incident report)</div>
                  {form.caseId ? (
                    linkedCaseEvidence.length > 0 ? (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>
                          Evidence submitted with the linked case will be attached to this sanction automatically.
                        </div>
                        <DOEvidenceViewer evidence={linkedCaseEvidence} />
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "#64748b" }}>
                        No evidence was submitted by the reporter for the linked case. The sanction can still be issued.
                      </div>
                    )
                  ) : (
                    <div style={{ fontSize: 13, color: "#64748b" }}>
                      Select a linked case above to see the reporter&apos;s submitted evidence.
                    </div>
                  )}
                </div>
              </div>

              <div className="cc-modal-actions">
                <button className="cc-btn-secondary" type="button" onClick={() => setIsNewOpen(false)}>
                  Cancel
                </button>
                <button className="cc-btn-primary" type="submit">
                  Review & Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmOpen && pendingSanctionPayload && (
        <div
          className="cc-modal-overlay do-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => {
            if (!confirmSubmitting) closeConfirmFlow();
          }}
        >
          <div
            className="cc-modal do-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 520 }}
          >
            <div className="cc-modal-header">
              <div className="cc-modal-title">
                {confirmStep === 1 ? "Confirm Sanction" : "Verify Your Password"}
              </div>
              <button
                className="cc-modal-close"
                type="button"
                aria-label="Close"
                disabled={confirmSubmitting}
                onClick={() => closeConfirmFlow()}
              >
                ✕
              </button>
            </div>

            <div className="cc-modal-body">
              {confirmStep === 1 ? (
                <>
                  <p style={{ fontSize: 14, color: "#334155", marginBottom: 12 }}>
                    Please review the details below. Once issued, this sanction will be recorded
                    against the student and linked to their discipline case.
                  </p>
                  <dl className="ir-detail-dl">
                    <div>
                      <dt>Student</dt>
                      <dd>
                        {pendingSanctionPayload.studentName}
                        <div style={{ color: "#64748b", fontSize: 12 }}>
                          {pendingSanctionPayload.studentId}
                        </div>
                      </dd>
                    </div>
                    <div>
                      <dt>Linked case</dt>
                      <dd>{pendingSanctionPayload.caseId}</dd>
                    </div>
                    <div>
                      <dt>Sanction type</dt>
                      <dd>{pendingSanctionPayload.sanctionType}</dd>
                    </div>
                    {pendingSanctionPayload.sanctionType === "Community Service" ? (
                      <>
                        <div>
                          <dt>Hours</dt>
                          <dd>{pendingSanctionPayload.hours || "—"}</dd>
                        </div>
                        <div>
                          <dt>Corresponding office</dt>
                          <dd>
                            {pendingSanctionPayload.correspondingOffice === "Others"
                              ? pendingSanctionPayload.correspondingOfficeOther || "Others"
                              : pendingSanctionPayload.correspondingOffice || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>Completion / end date</dt>
                          <dd>{pendingSanctionPayload.completionDate || "—"}</dd>
                        </div>
                      </>
                    ) : null}
                    <div>
                      <dt>Evidence</dt>
                      <dd>
                        {pendingSanctionPayload.evidence.length > 0
                          ? `${pendingSanctionPayload.evidence.length} item(s) auto-attached from incident report`
                          : "No evidence on file"}
                      </dd>
                    </div>
                  </dl>
                  {confirmError ? (
                    <div className="cc-form-error" role="alert" style={{ marginTop: 12 }}>
                      {confirmError}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <p style={{ fontSize: 14, color: "#334155", marginBottom: 12 }}>
                    For security, enter your account password to confirm issuing this sanction.
                  </p>
                  <div className="cc-field">
                    <div className="cc-label">Password</div>
                    {/* Honeypot inputs trick aggressive password managers (Chrome/Edge/1Password/LastPass)
                        into binding to these hidden fields instead of the real one. */}
                    <input
                      type="text"
                      name="username"
                      autoComplete="username"
                      tabIndex={-1}
                      aria-hidden="true"
                      style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                      onChange={() => {}}
                    />
                    <input
                      type="password"
                      name="cc-sanction-honeypot-password"
                      autoComplete="current-password"
                      tabIndex={-1}
                      aria-hidden="true"
                      style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                      onChange={() => {}}
                    />
                    <input
                      id="cc-sanction-confirm-password"
                      name="cc-sanction-confirm-password"
                      type="password"
                      className="cc-input"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (confirmError) setConfirmError("");
                      }}
                      autoComplete="new-password"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-form-type="other"
                      disabled={confirmSubmitting}
                      autoFocus
                    />
                  </div>
                  {confirmError ? (
                    <div className="cc-form-error" role="alert" style={{ marginTop: 12 }}>
                      {confirmError}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="cc-modal-actions">
              {confirmStep === 1 ? (
                <>
                  <button
                    type="button"
                    className="cc-btn-secondary"
                    onClick={() => closeConfirmFlow()}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="cc-btn-primary"
                    onClick={() => {
                      setConfirmError("");
                      setConfirmStep(2);
                    }}
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="cc-btn-secondary"
                    disabled={confirmSubmitting}
                    onClick={() => {
                      setConfirmError("");
                      setConfirmStep(1);
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="cc-btn-primary"
                    disabled={confirmSubmitting || !confirmPassword}
                    onClick={async () => {
                      setConfirmSubmitting(true);
                      setConfirmError("");
                      try {
                        const session = readCampusCareSession();
                        const email = session?.email;
                        if (!email || !supabase) {
                          throw new Error("Could not verify your session.");
                        }
                        const { error: pwErr } = await supabase.auth.signInWithPassword({
                          email,
                          password: confirmPassword,
                        });
                        if (pwErr) {
                          throw new Error("Incorrect password.");
                        }
                        const newItem = await insertSanction(pendingSanctionPayload);
                        setSelected(newItem);
                        closeConfirmFlow();
                        setIsNewOpen(false);
                        resetSanctionForm();
                        showToast("Sanction issued.", { variant: "success" });
                        await refresh();
                      } catch (err) {
                        setConfirmError(err?.message || "Could not issue sanction.");
                      } finally {
                        setConfirmSubmitting(false);
                      }
                    }}
                  >
                    {confirmSubmitting ? "Issuing…" : "Issue sanction"}
                  </button>
                </>
              )}
            </div>
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
 * When true, renders reports main content only (no DO sidebar / top bar) for welfare AdminPage embed.
 */
export function ReportsPage({ standalone = false } = {}) {
  const [periodPreset, setPeriodPreset] = useState("month");
  const [customRange, setCustomRange] = useState(() => {
    const r = resolveReportsPeriodRange("month", new Date());
    return {
      start: toDateInputValue(r.start),
      end: toDateInputValue(r.end),
    };
  });
  const [showGraphs, setShowGraphs] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);

  const { cases, loading, fetchError } = useCases([]);

  const analytics = useMemo(() => buildReportsAnalytics(cases, customRange), [cases, customRange]);

  useEffect(() => {
    if (loading) return undefined;
    setShowGraphs(false);
    const t = setTimeout(() => setShowGraphs(true), 320);
    return () => clearTimeout(t);
  }, [periodPreset, loading, customRange.start, customRange.end]);

  const presetLabel = useMemo(() => {
    const opt = PERIOD_OPTIONS.find((p) => p.id === periodPreset);
    return opt?.label ?? "This Month";
  }, [periodPreset]);

  const handleExportExcel = () => {
    const csv = exportAnalyticsCsv(analytics, presetLabel, new Date());
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campuscare_reports_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    try {
      setPdfExporting(true);
      await downloadDisciplineReportsPdf(analytics, presetLabel, periodPreset);
      showToast("PDF downloaded.", { variant: "success" });
    } catch (err) {
      showToast(err?.message || "Could not generate PDF.", { variant: "error" });
    } finally {
      setPdfExporting(false);
    }
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
              <p>
                {standalone
                  ? "Discipline Office reports and analytics from case data."
                  : "Comprehensive discipline office statistics and insights."}
              </p>
            </div>
            <div className="reports-toolbar">
              <div className="reports-period-fields">
                <div className="reports-period-field reports-period-field--date">
                  <label htmlFor="reports-from">From</label>
                  <input
                    id="reports-from"
                    type="date"
                    value={customRange.start}
                    max={customRange.end}
                    onChange={(e) =>
                      setCustomRange((prev) => ({ ...prev, start: e.target.value }))
                    }
                    disabled={loading}
                  />
                </div>
                <div className="reports-period-field reports-period-field--date">
                  <label htmlFor="reports-to">To</label>
                  <input
                    id="reports-to"
                    type="date"
                    value={customRange.end}
                    min={customRange.start}
                    onChange={(e) =>
                      setCustomRange((prev) => ({ ...prev, end: e.target.value }))
                    }
                    disabled={loading}
                  />
                </div>
                <div className="reports-period-field">
                  <label htmlFor="reports-period">Period</label>
                  <select
                    id="reports-period"
                    value={periodPreset}
                    onChange={(e) => {
                      const id = e.target.value;
                      setPeriodPreset(id);
                      const r = resolveReportsPeriodRange(id, new Date());
                      setCustomRange({
                        start: toDateInputValue(r.start),
                        end: toDateInputValue(r.end),
                      });
                    }}
                    disabled={loading}
                  >
                    {PERIOD_OPTIONS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="cc-page-actions">
                <button
                  className="cc-btn-primary"
                  type="button"
                  onClick={handleExportPdf}
                  disabled={loading || pdfExporting || analytics.periodInvalid}
                >
                  {pdfExporting ? "Generating PDF…" : "Export PDF"}
                </button>
                <button
                  className="cc-btn-secondary"
                  type="button"
                  onClick={handleExportExcel}
                  disabled={analytics.periodInvalid}
                >
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

          {analytics.periodInvalid && (
            <div className="reports-error-banner" role="alert">
              Pick a valid start and end date (end on or after start).
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
              <p className="reports-kpi-value">{analytics.studentsMonitored.toLocaleString()}</p>
              <p className="reports-kpi-label">Students monitored</p>
            </div>
            <div className="reports-kpi-card">
              <p className="reports-kpi-value">{Number(analytics.pendingMajorCases ?? 0).toLocaleString()}</p>
              <p className="reports-kpi-label">Pending (major cases)</p>
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
              <p className="reports-chart-hint">
                Cases filed vs. cases resolved · {analytics.periodLabel}
              </p>
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
                    data={(analytics.departmentStats || []).slice(0, 10)}
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
              <h2 className="reports-chart-title">Cases by school</h2>
              <p className="reports-chart-hint">SECA, SASE, and SBMA (from School on case records)</p>
              <div style={{ width: "100%", height: 280 }} className="reports-hbar">
                <ResponsiveContainer>
                  <BarChart
                    layout="vertical"
                    data={analytics.schoolStats || []}
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="school" width={56} tick={{ fontSize: 12 }} stroke="#64748b" />
                    <Tooltip contentStyle={{ borderRadius: 8 }} />
                    <Bar
                      dataKey="count"
                      name="Cases"
                      fill="#0d9488"
                      radius={[0, 6, 6, 0]}
                      barSize={22}
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