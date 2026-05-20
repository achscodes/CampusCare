const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatCaseDateFromIso(isoOrDate) {
  const dt = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(dt.getTime())) return "";
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

export function formatCaseId(caseId) {
  const raw = String(caseId ?? "").trim();
  const match = raw.match(/^DC-(\d{4})-(\d+)$/i);
  if (!match) return raw;
  const seq = Number.parseInt(match[2], 10);
  if (Number.isNaN(seq)) return raw;
  return `DC-${match[1]}-${String(seq).padStart(2, "0")}`;
}

export function normalizeCaseStatus(status) {
  const value = String(status ?? "new").trim().toLowerCase();
  if (
    value === "new" ||
    value === "pending" ||
    value === "ongoing" ||
    value === "escalated" ||
    value === "closed"
  ) {
    return value;
  }
  return "new";
}

export function isPendingCaseStudentId(studentId) {
  return /^PENDING-IR-/i.test(String(studentId || "").trim());
}

export function isResolvedCaseStudentId(studentId) {
  const raw = String(studentId || "").trim();
  return raw.length > 0 && !isPendingCaseStudentId(raw);
}

/** Mobile case-progress stepper labels (student app reads `discipline_cases.case_steps`). */
export const MOBILE_CASE_PROGRESS_LABELS = {
  nteIssued: "NTE Issued",
  awaitingResponse: "Awaiting Student Response",
  decision: "Decision: Accepted / Declined",
  caseConference: "Case Conference",
  sanctionIssued: "Sanction Issued",
};

/** @deprecated Use `sanctionIssued` — kept for legacy rows in DB. */
export const MOBILE_CASE_PROGRESS_LABELS_LEGACY = {
  caseClosed: "Case Closed",
};

export const CASE_STEP_STATUSES = ["pending", "in_progress", "completed"];

export const MOBILE_CASE_PROGRESS_TEMPLATE = [
  MOBILE_CASE_PROGRESS_LABELS.nteIssued,
  MOBILE_CASE_PROGRESS_LABELS.awaitingResponse,
  MOBILE_CASE_PROGRESS_LABELS.decision,
  MOBILE_CASE_PROGRESS_LABELS.caseConference,
  MOBILE_CASE_PROGRESS_LABELS.sanctionIssued,
];

/** Maps old saved step titles to the current canonical slot. */
const LEGACY_CASE_STEP_LABEL_ALIASES = {
  "Case Closed": MOBILE_CASE_PROGRESS_LABELS.sanctionIssued,
  "Case conference scheduled": MOBILE_CASE_PROGRESS_LABELS.caseConference,
  "Case conference completed": MOBILE_CASE_PROGRESS_LABELS.caseConference,
  "Sanction assigned": MOBILE_CASE_PROGRESS_LABELS.sanctionIssued,
  "Sanction completed": MOBILE_CASE_PROGRESS_LABELS.sanctionIssued,
  "Sanction updated": MOBILE_CASE_PROGRESS_LABELS.sanctionIssued,
};

function formatCaseStepDate(raw = new Date()) {
  return formatCaseDateFromIso(raw) || formatCaseDateFromIso(new Date());
}

/** Short date for mobile stepper (e.g. "Nov 12"). */
export function formatCaseStepDateShort(raw = new Date()) {
  const dt = typeof raw === "string" ? new Date(raw) : raw;
  if (Number.isNaN(dt.getTime())) return "";
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}

function normalizeStepStatus(status) {
  const s = String(status || "pending").toLowerCase();
  if (s === "completed" || s === "in_progress" || s === "pending") return s;
  if (s === "complete" || s === "done") return "completed";
  if (s === "active" || s === "current") return "in_progress";
  return "pending";
}

export function normalizeCaseSteps(steps) {
  return Array.isArray(steps)
    ? steps
        .map((step) => ({
          label: String(step?.label || "").trim(),
          status: normalizeStepStatus(step?.status),
          ...(step?.date ? { date: String(step.date) } : {}),
          ...(step?.note ? { note: String(step.note) } : {}),
        }))
        .filter((step) => step.label)
    : [];
}

function statusPrecedence(status) {
  if (status === "completed") return 2;
  if (status === "in_progress") return 1;
  return 0;
}

function mergeStepSources(sources) {
  let mergedStatus = "pending";
  let mergedDate;
  let mergedNote;
  for (const src of sources) {
    if (!src) continue;
    const s = normalizeStepStatus(src.status);
    if (statusPrecedence(s) > statusPrecedence(mergedStatus)) mergedStatus = s;
    const d = src.date ? String(src.date).trim() : "";
    if (d) mergedDate = d;
    const n = src.note ? String(src.note).trim() : "";
    if (n) mergedNote = n;
  }
  return { status: mergedStatus, date: mergedDate, note: mergedNote };
}

/**
 * Ensures the canonical five mobile stepper slots. Folds legacy aliases (e.g.
 * "Case conference scheduled" / "Case conference completed" → "Case Conference")
 * and de-duplicates rows that converge on the same canonical label, merging
 * their status (completed > in_progress > pending) and latest date/note.
 */
export function ensureCanonicalCaseSteps(steps) {
  const incoming = normalizeCaseSteps(steps);
  // Each canonical slot collects every incoming row that resolves to it.
  /** @type {Array<typeof incoming[number]>[]} */
  const bucketsBySlot = MOBILE_CASE_PROGRESS_TEMPLATE.map(() => []);
  const claimedRows = new Set();

  // Pass 1 — positional match: row at index `i` claims slot `i` unless its label
  // resolves elsewhere (e.g. its label is another slot's canonical).
  incoming.forEach((row, index) => {
    if (index >= MOBILE_CASE_PROGRESS_TEMPLATE.length) return;
    const aliasCanonical = LEGACY_CASE_STEP_LABEL_ALIASES[row.label];
    const aliasIdx = aliasCanonical ? MOBILE_CASE_PROGRESS_TEMPLATE.indexOf(aliasCanonical) : -1;
    if (aliasIdx >= 0 && aliasIdx !== index) return; // resolve via alias in pass 2
    const directIdx = MOBILE_CASE_PROGRESS_TEMPLATE.indexOf(row.label);
    if (directIdx >= 0 && directIdx !== index) return; // belongs to a different canonical slot
    bucketsBySlot[index].push(row);
    claimedRows.add(row);
  });

  // Pass 2 — alias / direct-canonical match for any rows not yet claimed.
  incoming.forEach((row) => {
    if (claimedRows.has(row)) return;
    const aliasCanonical = LEGACY_CASE_STEP_LABEL_ALIASES[row.label];
    if (aliasCanonical) {
      const idx = MOBILE_CASE_PROGRESS_TEMPLATE.indexOf(aliasCanonical);
      if (idx >= 0) {
        bucketsBySlot[idx].push(row);
        claimedRows.add(row);
        return;
      }
    }
    const directIdx = MOBILE_CASE_PROGRESS_TEMPLATE.indexOf(row.label);
    if (directIdx >= 0) {
      bucketsBySlot[directIdx].push(row);
      claimedRows.add(row);
    }
  });

  return MOBILE_CASE_PROGRESS_TEMPLATE.map((templateLabel, index) => {
    const sources = bucketsBySlot[index];
    const merged = mergeStepSources(sources);

    // Preserve a staff-edited title only when it doesn't collide with another
    // canonical label and isn't a legacy alias key.
    let label = templateLabel;
    for (const src of sources) {
      const raw = String(src?.label || "").trim();
      if (!raw) continue;
      if (raw === templateLabel) continue;
      if (LEGACY_CASE_STEP_LABEL_ALIASES[raw]) continue;
      const collidesWithAnotherTemplate =
        MOBILE_CASE_PROGRESS_TEMPLATE.indexOf(raw) >= 0 &&
        MOBILE_CASE_PROGRESS_TEMPLATE.indexOf(raw) !== index;
      if (collidesWithAnotherTemplate) continue;
      label = raw;
      break;
    }

    return {
      label,
      status: merged.status,
      ...(merged.date ? { date: merged.date } : {}),
      ...(merged.note ? { note: merged.note } : {}),
    };
  });
}

/** Initial stepper after convert/create — all pending until DO advances (NTE sent, etc.). */
export function createInitialCaseProgressSteps() {
  return MOBILE_CASE_PROGRESS_TEMPLATE.map((label) => ({ label, status: "pending" }));
}

export function computeCaseProgressMetrics(steps) {
  const list = ensureCanonicalCaseSteps(steps);
  const total = list.length || 1;
  let completed = 0;
  let inProgress = 0;
  let currentIndex = 0;

  list.forEach((step, index) => {
    if (step.status === "completed") completed += 1;
    else if (step.status === "in_progress") {
      inProgress += 1;
      currentIndex = index;
    }
  });

  if (inProgress === 0) {
    const firstPending = list.findIndex((step) => step.status === "pending");
    currentIndex = firstPending >= 0 ? firstPending : Math.max(0, list.length - 1);
  }

  const reached = completed + inProgress;
  const progress_percent = Math.min(100, Math.round((reached / total) * 100));

  return { progress_percent, current_step_index: currentIndex };
}

export function setCaseStep(steps, label, patch = {}) {
  const canonical = LEGACY_CASE_STEP_LABEL_ALIASES[label] || label;
  const index = MOBILE_CASE_PROGRESS_TEMPLATE.indexOf(canonical);
  if (index < 0) return ensureCanonicalCaseSteps(steps);
  return patchCaseProgressStep(steps, index, {
    ...patch,
    ...(patch.label === undefined ? { label: canonical } : {}),
  });
}

/** Web saves managed steps; `progress_percent` is derived automatically for mobile. */
export function buildCaseProgressStepsPatch(caseRow, steps) {
  const normalized = ensureCanonicalCaseSteps(steps);
  const metrics = computeCaseProgressMetrics(normalized);
  const isClosed = String(caseRow?.status || "").toLowerCase() === "closed";
  return {
    case_steps: normalized,
    progress_percent: isClosed ? 100 : metrics.progress_percent,
    current_step_index: metrics.current_step_index,
  };
}

/**
 * Advance the mobile stepper from workflow events (NTE sent, student responded, case closed).
 * @param {object} caseRow
 * @param {"case_created"|"nte_sent"|"nte_responded"|"decision_made"|"conference_scheduled"|"conference_completed"|"sanction_issued"|"sanction_assigned"|"case_closed"|"nte_waived"} event
 * @param {{ date?: string, note?: string, at?: string|Date }} [options]
 */
const MONTH_NAME_TO_INDEX = Object.fromEntries(MONTHS.map((name, index) => [name.toLowerCase(), index]));

/** Parse mobile short date ("Nov 12") to `YYYY-MM-DD` for date inputs; empty if unknown. */
export function caseStepShortLabelToIsoDate(label, year = new Date().getFullYear()) {
  const raw = String(label || "").trim();
  const match = raw.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
  if (!match) return "";
  const monKey = match[1].slice(0, 3).toLowerCase();
  const monthIndex = MONTH_NAME_TO_INDEX[monKey] ?? MONTH_NAME_TO_INDEX[match[1].toLowerCase()];
  if (monthIndex === undefined) return "";
  const day = Number(match[2]);
  const y = match[3] ? Number(match[3]) : year;
  if (!day || day < 1 || day > 31) return "";
  return `${y}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Format `YYYY-MM-DD` from a date input as the mobile step label (e.g. "Nov 12"). */
export function isoDateToCaseStepShortLabel(isoDate) {
  if (!isoDate) return "";
  const parts = String(isoDate).split("-").map(Number);
  if (parts.length < 3) return "";
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return "";
  return formatCaseStepDateShort(dt);
}

/** Update one step; fills today's mobile date when marking active or done. */
export function patchCaseProgressStep(steps, stepIndex, patch) {
  return ensureCanonicalCaseSteps(steps).map((step, index) => {
    if (index !== stepIndex) return step;
    const next = {
      ...step,
      ...(patch.label !== undefined ? { label: String(patch.label).trim() || step.label } : {}),
      ...(patch.status !== undefined ? { status: normalizeStepStatus(patch.status) } : {}),
      ...(patch.date !== undefined ? { date: patch.date } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
    };
    if (patch.status === "completed" || patch.status === "in_progress") {
      if (!String(next.date || "").trim()) {
        next.date = formatCaseStepDateShort();
      }
    }
    return next;
  });
}

export const CASE_PROGRESS_QUICK_ACTIONS = [
  { id: "nte_sent", label: "NTE sent", hint: "Notice emailed; awaiting student reply." },
  { id: "nte_responded", label: "Student responded", hint: "Student submitted NTE explanation." },
  { id: "decision_made", label: "Decision recorded", hint: "Moves to case conference." },
  { id: "conference_scheduled", label: "Conference scheduled", hint: "Hearing date set for student." },
  { id: "conference_completed", label: "Conference completed", hint: "Hearing finished; sanction next." },
  { id: "sanction_issued", label: "Sanction issued", hint: "Sanction assigned or completed." },
];

export function applyCaseProgressQuickAction(caseRow, steps, actionId) {
  const event = String(actionId || "");
  if (!CASE_PROGRESS_QUICK_ACTIONS.some((a) => a.id === event)) {
    return ensureCanonicalCaseSteps(steps);
  }
  const patch = buildCaseProgressFromEvent(
    { ...(caseRow || {}), caseSteps: steps, case_steps: steps },
    event,
    { date: formatCaseStepDateShort() },
  );
  return patch.case_steps;
}

export function buildCaseProgressFromEvent(caseRow, event, options = {}) {
  const date =
    options.date ||
    formatCaseStepDateShort(options.at || new Date());
  let steps = ensureCanonicalCaseSteps(caseRow?.caseSteps ?? caseRow?.case_steps);

  switch (event) {
    case "case_created":
      steps = createInitialCaseProgressSteps();
      break;
    case "nte_sent":
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.nteIssued, {
        status: "completed",
        date,
        note: options.note,
      });
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.awaitingResponse, {
        status: "in_progress",
      });
      break;
    case "nte_responded":
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.nteIssued, {
        status: "completed",
      });
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.awaitingResponse, {
        status: "completed",
        date,
        note: options.note,
      });
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.decision, {
        status: "in_progress",
      });
      break;
    case "decision_made":
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.decision, {
        status: "completed",
        date,
        note: options.note,
      });
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.caseConference, {
        status: "in_progress",
      });
      break;
    case "conference_scheduled":
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.decision, {
        status: "completed",
      });
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.caseConference, {
        status: "in_progress",
        date,
        note: options.note,
      });
      break;
    case "conference_completed":
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.caseConference, {
        status: "completed",
        date,
        note: options.note,
      });
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.sanctionIssued, {
        status: "in_progress",
      });
      break;
    case "sanction_assigned":
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.caseConference, {
        status: "completed",
      });
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.sanctionIssued, {
        status: "in_progress",
        date,
        note: options.note,
      });
      break;
    case "sanction_issued":
    case "case_closed":
      steps = steps.map((step) =>
        step.status === "pending" || step.status === "in_progress"
          ? { ...step, status: "completed" }
          : step,
      );
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.sanctionIssued, {
        status: "completed",
        date,
        note: options.note,
      });
      break;
    case "nte_waived":
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.decision, {
        status: "completed",
        date,
        note: options.note || "NTE waived — no further action.",
      });
      steps = setCaseStep(steps, MOBILE_CASE_PROGRESS_LABELS.sanctionIssued, {
        status: "completed",
        date,
      });
      break;
    default:
      break;
  }

  return buildCaseProgressStepsPatch(caseRow, steps);
}

function mapLegacyStepLabelToEvent(label) {
  const l = String(label || "").toLowerCase();
  if (l.includes("nte sent") || l.includes("nte issued")) return "nte_sent";
  if (l.includes("response submitted") || l.includes("nte response")) return "nte_responded";
  if (l.includes("escalat") && l.includes("nte")) return "nte_responded";
  if (l.includes("waived")) return "nte_waived";
  if (l.includes("conference") && l.includes("complet")) return "conference_completed";
  if (l.includes("conference") && (l.includes("sched") || l.includes("set"))) return "conference_scheduled";
  if (l.includes("sanction")) return "sanction_issued";
  if (l.includes("case closed") || l.includes("closed")) return "sanction_issued";
  if (l.includes("decision") || l.includes("accepted") || l.includes("declined")) return "decision_made";
  return null;
}

/** @deprecated Prefer `buildCaseProgressFromEvent` / `buildCaseProgressStepsPatch`. Maps legacy labels to events. */
export function buildCaseProgressPatch(caseRow, step) {
  if (!step?.label) {
    return buildCaseProgressStepsPatch(caseRow, caseRow?.caseSteps ?? caseRow?.case_steps);
  }
  const event = mapLegacyStepLabelToEvent(step.label);
  if (event) {
    return buildCaseProgressFromEvent(caseRow, event, {
      date: step.date || formatCaseStepDateShort(),
      note: step.note,
    });
  }
  let steps = ensureCanonicalCaseSteps(caseRow?.caseSteps ?? caseRow?.case_steps);
  const active = steps.find((s) => s.status === "in_progress");
  const target = active || steps.find((s) => s.status === "pending") || steps[steps.length - 1];
  if (target) {
    steps = setCaseStep(steps, target.label, {
      note: [target.note, step.note].filter(Boolean).join(" · ") || step.note,
    });
  }
  return buildCaseProgressStepsPatch(caseRow, steps);
}

function parseProgramFromDescription(description) {
  const raw = String(description || "");
  if (!raw.trim()) return "";
  const parts = raw.split(/\n\s*\n/g).map((s) => s.trim());
  for (const part of parts) {
    if (part.startsWith("Program: ")) return part.slice(9).trim();
  }
  return "";
}

function parseSchoolFromDescription(description) {
  const raw = String(description || "");
  for (const part of raw.split(/\n\s*\n/g).map((s) => s.trim())) {
    if (part.startsWith("School: ")) return part.slice(8).trim();
  }
  return "";
}

function parseOffenseTypeFromDescription(description) {
  const raw = String(description || "");
  for (const part of raw.split(/\n\s*\n/g).map((s) => s.trim())) {
    if (part.startsWith("Offense Type: ")) return part.slice(14).trim();
  }
  return "";
}

export function parseCaseDescriptionSchool(description) {
  return parseSchoolFromDescription(description);
}

/** @param {Record<string, unknown>} row */
export function rowToCase(row) {
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  const reportedAt = row.reported_at ? new Date(String(row.reported_at)).toISOString() : null;
  const updatedAt = row.updated_at ? new Date(String(row.updated_at)).toISOString() : null;
  const description = String(row.description ?? "");
  const program = String(row.program ?? "") || parseProgramFromDescription(description);
  const school = String(row.school ?? "") || parseSchoolFromDescription(description);
  const offenseType = String(row.offense_type ?? "") || parseOffenseTypeFromDescription(description);
  return {
    id: String(row.id ?? ""),
    student: String(row.student_name ?? ""),
    studentId: String(row.student_id ?? ""),
    caseType: String(row.case_type ?? ""),
    status: normalizeCaseStatus(row.status),
    priority:
      row.priority != null && String(row.priority).trim() !== ""
        ? String(row.priority).trim()
        : "medium",
    date: formatCaseDateFromIso(row.reported_at),
    officer: String(row.reporting_officer ?? ""),
    program: program || "",
    school: school || "",
    offenseType: offenseType || "",
    description,
    evidence,
    severity: String(row.severity ?? "minor"),
    progressPercent: Number(row.progress_percent ?? 0),
    currentStepIndex: Number(row.current_step_index ?? 0),
    caseSteps: normalizeCaseSteps(row.case_steps),
    reportedAt: reportedAt || undefined,
    updatedAt: updatedAt || undefined,
    respondentUserId: row.respondent_user_id ? String(row.respondent_user_id) : null,
    respondentEmail: String(row.respondent_email ?? ""),
    nteSentAt: row.nte_sent_at ? new Date(String(row.nte_sent_at)).toISOString() : null,
    closureSummary: String(row.closure_summary ?? ""),
    closedAt: row.closed_at ? new Date(String(row.closed_at)).toISOString() : null,
    closedByUserId: row.closed_by_user_id ? String(row.closed_by_user_id) : null,
    escalatedAt: row.escalated_at ? new Date(String(row.escalated_at)).toISOString() : null,
    sourceIncidentReportId: String(row.source_incident_report_id ?? ""),
  };
}

/**
 * @param {object} payload
 * @param {string} payload.student
 * @param {string} payload.studentId
 * @param {string} payload.caseType
 * @param {string} payload.description
 * @param {object[]} [payload.evidence]
 * @param {string} [payload.officer]
 */
export function buildCaseInsertRow(id, payload) {
  const now = new Date();
  return {
    id,
    student_name: payload.student.trim(),
    student_id: payload.studentId.trim(),
    case_type: payload.caseType,
    status: payload.status ? normalizeCaseStatus(payload.status) : "new",
    reporting_officer: payload.officer || "Discipline Office",
    description: payload.description.trim(),
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    reported_at: now.toISOString(),
    progress_percent: 0,
    current_step_index: 0,
    case_steps: createInitialCaseProgressSteps(),
    program: String(payload.program || "").trim(),
    school: String(payload.school || "").trim(),
    offense_type: String(payload.offenseType || "").trim(),
    ...(payload.respondentEmail != null && String(payload.respondentEmail).trim() !== ""
      ? { respondent_email: String(payload.respondentEmail).trim() }
      : {}),
    ...(payload.sourceIncidentReportId != null && String(payload.sourceIncidentReportId).trim() !== ""
      ? { source_incident_report_id: String(payload.sourceIncidentReportId).trim() }
      : {}),
  };
}

/**
 * Next `DC-YYYY-NN` id from existing `discipline_cases` rows (same rules as DO case creation).
 * @param {{ id: string }[]} rows
 */
export function makeNextDisciplineCaseId(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const year = String(new Date().getFullYear());
  const prefix = `DC-${year}-`;
  const parseCaseIndex = (caseId) => {
    const parts = String(caseId).split("-");
    const last = parts[parts.length - 1];
    const n = Number(last);
    return Number.isFinite(n) ? n : 0;
  };
  const maxIdx = list.reduce((acc, row) => Math.max(acc, parseCaseIndex(row.id)), 0);
  return `${prefix}${String(maxIdx + 1).padStart(2, "0")}`;
}

/**
 * Insert row for a case created from an incident report (includes workflow link columns when present in DB).
 * @param {string} id
 * @param {{
 *   studentName: string,
 *   studentId: string,
 *   caseType: string,
 *   description: string,
 *   evidence?: object[],
 *   officer?: string,
 *   program?: string,
 *   school?: string,
 *   offenseType?: string,
 *   sourceIncidentReportId?: string | null,
 *   respondentEmail?: string | null,
 * }} payload
 */
export function buildCaseInsertRowFromIncident(id, payload) {
  return buildCaseInsertRow(id, {
    student: payload.studentName,
    studentId: payload.studentId,
    caseType: payload.caseType,
    description: payload.description,
    evidence: payload.evidence,
    officer: payload.officer,
    program: payload.program,
    school: payload.school,
    offenseType: payload.offenseType,
    status: "new",
    respondentEmail: payload.respondentEmail,
    sourceIncidentReportId: payload.sourceIncidentReportId,
  });
}
