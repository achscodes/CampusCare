/**
 * CampusCare Discipline — mobile ↔ web alignment contract (live Supabase).
 * Source of truth for staff web (`CampusCare-main`). Share with mobile team.
 *
 * @see DISCIPLINE_OFFICE_WEB_ADMIN_PLAN.md (product vision; several statuses differ)
 */

/** What the student mobile app writes today (confirmed with product owner). */
export const MOBILE_STUDENT_WRITES = {
  incidentReport: true,
  proofOfSanctionCompliance: true,
  nteResponse: true,
  /** Staff-created on web; not a primary mobile insert path. */
  disciplineCaseDirect: false,
};

export const DISCIPLINE_STORAGE_BUCKETS = {
  incidentAttachments: "discipline-incident-attachments",
  sanctionProofs: "discipline-proofs",
};

/** Incident attachment JSON item (column `attachments` on `discipline_incident_reports`). */
export const INCIDENT_ATTACHMENT_JSON_SHAPE = {
  file_name: "string",
  mime_type: "string",
  size_bytes: "number",
  storage_path: "string — object path inside bucket, not URL",
};

/**
 * Upload path pattern (student auth uid = first folder segment):
 * `{auth.uid}/incident/{report_id}/{timestamp}_{safe_filename}`
 */
export const INCIDENT_ATTACHMENT_PATH_PATTERN =
  "{student_auth_uid}/incident/{report_id}/{timestamp}_{filename}";

// ——— Incident reports (live DB + web) ———

export const INCIDENT_REPORT_TABLE = "discipline_incident_reports";

/** DB check: `discipline_incident_reports_status_check` — use these only (not plan resolved/closed). */
export const INCIDENT_REPORT_STATUSES = [
  "submitted",
  "under_review",
  "converted_to_case",
  "rejected",
];

/** DB check: `discipline_incident_reports_incident_type_check` */
export const INCIDENT_REPORT_INCIDENT_TYPES = [
  "Academic dishonesty",
  "Harassment or discrimination",
  "Safety concern",
  "Property damage or theft",
  "Disruptive conduct",
  "Other",
];

export const INCIDENT_REPORT_COLUMNS = [
  "id",
  "incident_at",
  "location",
  "involved_parties",
  "attachments",
  "status",
  "converted_case_id",
  "reviewed_by",
  "reviewed_at",
  "created_at",
  "updated_at",
  "incident_type",
  "narrative",
  "impact",
  "rejection_message",
  "reporter_student_id",
];

/** List/detail fetch includes rejection_message; staff table UI must not render it. */
export const INCIDENT_REPORT_TABLE_HIDDEN_COLUMNS = ["rejection_message"];

/** Suggested student-app labels when reading `status` (DB values stay as left). */
export const INCIDENT_REPORT_STUDENT_STATUS_LABELS = {
  submitted: "Submitted — waiting for review",
  under_review: "Under review",
  converted_to_case: "Accepted — referred to discipline case",
  rejected: "Not accepted",
};

/** Staff web route + actions */
export const INCIDENT_REPORT_WEB = {
  path: "/incident-report",
  staffActions: ["mark_under_review", "reject", "convert_to_case"],
  /** Student/filer text for DO review — never overwritten on reject. */
  studentImpactColumn: "impact",
  /** Saved on reject; for student email/mobile — not shown on staff table. */
  rejectionMessageColumn: "rejection_message",
};

// ——— Proof of sanction compliance ———

export const PROOF_SUBMISSION_TABLE = "discipline_proof_submissions";
export const PROOF_FILE_TABLE = "discipline_proof_files";

/** DB check: `discipline_proof_submissions_status_check` */
export const PROOF_SUBMISSION_STATUSES = ["pending_review", "approved", "rejected"];

export const PROOF_SUBMISSION_COLUMNS = [
  "id",
  "sanction_id",
  "submitted_by",
  "time_in",
  "time_out",
  "computed_hours",
  "notes",
  "status",
  "reviewed_by",
  "reviewed_at",
  "rejection_reason",
  "submitted_at",
];

export const PROOF_FILE_COLUMNS = [
  "id",
  "submission_id",
  "storage_bucket",
  "storage_path",
  "file_name",
  "mime_type",
  "size_bytes",
  "created_at",
];

export const PROOF_WEB = {
  path: "/proof-submissions",
  plannedPath: "/proof-submissions",
  staffActions: ["approve", "reject", "partial_approve"],
  webUiBuilt: true,
};

// ——— NTE (Notice to Explain) ———

export const NTE_TABLE = "discipline_nte";

/** DB check: `discipline_nte_status_check` */
export const NTE_STATUSES = ["pending_response", "responded", "waived", "escalated"];

export const NTE_COLUMNS = [
  "id",
  "student_id",
  "case_type",
  "description",
  "issued_at",
  "deadline_at",
  "status",
  "response_text",
  "responded_at",
  "case_id",
  "created_at",
  "updated_at",
  "response_attachments",
  "escalated_at",
  "escalation_reason",
];

/** Mobile writes response via UPDATE (not insert): */
export const NTE_MOBILE_RESPONSE_FIELDS = [
  "response_text",
  "response_attachments",
  "responded_at",
  "status",
];

export const NTE_WEB = {
  issuePath: "case-management (NTE modal + edge function send-discipline-nte-notice)",
  reviewPath: "/nte-responses",
  plannedInboxPath: "/nte-responses",
  webInboxBuilt: true,
};

// ——— Sanctions (staff assigns; mobile consumes + submits proof) ———

export const SANCTION_TABLE = "discipline_sanctions";

export const SANCTION_COLUMNS = [
  "id",
  "student_id",
  "sanction_type",
  "status",
  "due_date",
  "notes",
  "evidence",
  "created_at",
  "updated_at",
  "description",
  "case_id",
  "progress",
  "review_days_min",
  "review_days_max",
  "review_status_label",
  "hours",
  "corresponding_office",
  "corresponding_office_other",
  "community_service_detail",
  "completion_date",
  "program",
  "school",
  "offenses_summary",
  "completed_hours",
];

// ——— Plan doc vs live system (for mobile team) ———

export const PLAN_DOC_MISMATCHES = [
  {
    topic: "Incident status values",
    plan: "submitted → under_review → resolved → closed",
    live: INCIDENT_REPORT_STATUSES.join(" → "),
  },
  {
    topic: "Mobile direct case filing",
    plan: "Implied in case module",
    live: "Not a confirmed mobile write; cases created on web or via convert from incident",
  },
  {
    topic: "Staff notes on incidents",
    plan: "Separate internal notes table",
    live: "`impact` = student text; `rejection_message` on reject (email/mobile; hidden on staff table)",
  },
  {
    topic: "Web tech stack",
    plan: "Next.js 14 + Shadcn",
    live: "React 19 + Vite + Bootstrap in CampusCare-main",
  },
  {
    topic: "Proof review UI",
    plan: "Module 5.3 queue",
    live: "Staff queue built at `/proof-submissions`; approves/rejects mobile submissions",
  },
  {
    topic: "NTE inbox",
    plan: "Dedicated NTE list/review",
    live: "Issue via case + edge function; response inbox built at `/nte-responses`",
  },
];

// ——— Mobile case progress stepper (`discipline_cases.case_steps`, `progress_percent`) ———

/** Default step order: NTE Issued → Awaiting Student Response → Decision → Case Conference → Sanction Issued */
export const CASE_PROGRESS_DEFAULT_LABELS = [
  "NTE Issued",
  "Awaiting Student Response",
  "Decision: Accepted / Declined",
  "Case Conference",
  "Sanction Issued",
];

/** DB: `case_steps` jsonb array; mobile stepper reads these labels and statuses. */
export const CASE_PROGRESS_STEP_SHAPE = {
  label: "string — default labels in CASE_PROGRESS_DEFAULT_LABELS; staff may customize titles on web",
  status: "pending | in_progress | completed",
  date: "optional short label e.g. Nov 12",
  note: "optional student-safe note",
};

/** `progress_percent` is computed on web from step statuses (do not set manually on mobile). */
export const CASE_PROGRESS_AUTO_PERCENT = true;

/** Ordered web build phases (product owner: A then incident report). */
export const WEB_BUILD_PHASES = [
  { id: "A", name: "Contract alignment", status: "done" },
  { id: "B", name: "Incident report hardening", status: "done" },
  { id: "C", name: "Proof submission review queue", status: "current" },
  { id: "D", name: "NTE response review inbox", status: "current" },
];
