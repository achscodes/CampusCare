import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Lock, RotateCcw, Save, Smartphone, Zap } from "lucide-react";
import {
  CASE_PROGRESS_QUICK_ACTIONS,
  CASE_STEP_STATUSES,
  applyCaseProgressQuickAction,
  buildCaseProgressFromEvent,
  buildCaseProgressStepsPatch,
  caseStepShortLabelToIsoDate,
  computeCaseProgressMetrics,
  ensureCanonicalCaseSteps,
  formatCaseStepDateShort,
  isoDateToCaseStepShortLabel,
  MOBILE_CASE_PROGRESS_LABELS,
  MOBILE_CASE_PROGRESS_TEMPLATE,
  patchCaseProgressStep,
} from "../../utils/disciplineCaseMapper";

const QUICK_ACTION_PREREQ_INDEX = {
  nte_sent: -1,
  nte_responded: 0,
  decision_made: 1,
  conference_scheduled: 2,
  conference_completed: 2,
  sanction_issued: 3,
};

function caseStepsEqual(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    const x = left[i] || {};
    const y = right[i] || {};
    if (
      String(x.label || "") !== String(y.label || "") ||
      String(x.status || "pending") !== String(y.status || "pending") ||
      String(x.date || "") !== String(y.date || "") ||
      String(x.note || "") !== String(y.note || "")
    ) {
      return false;
    }
  }
  return true;
}

const STATUS_UI = {
  pending: { label: "Pending", dot: "#cbd5e1", text: "#64748b", bg: "#fff" },
  in_progress: { label: "In progress", dot: "#2563eb", text: "#1d4ed8", bg: "#eff6ff" },
  completed: { label: "Completed", dot: "#16a34a", text: "#15803d", bg: "#f0fdf4" },
};

function stepStatusLabel(status) {
  return STATUS_UI[status]?.label || "Pending";
}

/**
 * Staff-facing mobile case progress editor (student app reads saved `case_steps`).
 */
export function CaseProgressStepperPanel({
  caseRow,
  linkedNteRows = [],
  saving = false,
  onSave,
  onSyncFromNte,
}) {
  const [draft, setDraft] = useState(() => ensureCanonicalCaseSteps(caseRow?.caseSteps));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(ensureCanonicalCaseSteps(caseRow?.caseSteps));
    setDirty(false);
  }, [caseRow?.id, caseRow?.caseSteps]);

  // Self-heal once per case: if the stored shape doesn't match the canonical
  // (e.g. legacy DBs with both "Case conference scheduled" + "Case conference
  // completed"), persist the cleaned shape so all clients converge.
  const healedCaseIdRef = useRef(null);
  useEffect(() => {
    const caseId = caseRow?.id;
    if (!caseId || !onSave) return;
    if (healedCaseIdRef.current === caseId) return;
    const canonical = ensureCanonicalCaseSteps(caseRow?.caseSteps);
    if (caseStepsEqual(canonical, caseRow?.caseSteps)) {
      healedCaseIdRef.current = caseId;
      return;
    }
    healedCaseIdRef.current = caseId;
    const patch = buildCaseProgressStepsPatch(caseRow, canonical);
    Promise.resolve(onSave(patch)).catch(() => {
      // Best-effort self-heal — don't block the user if persistence fails.
    });
  }, [caseRow, onSave]);

  const savedMetrics = useMemo(
    () => computeCaseProgressMetrics(caseRow?.caseSteps),
    [caseRow?.caseSteps],
  );
  const draftMetrics = useMemo(() => computeCaseProgressMetrics(draft), [draft]);

  const firstIncompleteIndex = useMemo(() => {
    const idx = draft.findIndex((s) => s.status !== "completed");
    return idx === -1 ? draft.length : idx;
  }, [draft]);

  const isStepUnlocked = useCallback(
    (stepIndex) => stepIndex <= firstIncompleteIndex,
    [firstIncompleteIndex],
  );

  const isQuickActionUnlocked = useCallback(
    (actionId) => {
      const required = QUICK_ACTION_PREREQ_INDEX[actionId];
      if (required == null || required < 0) return true;
      const prereq = draft[required];
      return Boolean(prereq && prereq.status === "completed");
    },
    [draft],
  );

  const pendingNte = linkedNteRows.find((n) => String(n.status) === "pending_response");
  const respondedNte = linkedNteRows.find((n) => String(n.status) === "responded");

  const updateStep = useCallback((stepIndex, patch) => {
    setDraft((prev) => patchCaseProgressStep(prev, stepIndex, patch));
    setDirty(true);
  }, []);

  const applyQuickAction = useCallback(
    (actionId) => {
      setDraft(applyCaseProgressQuickAction(caseRow, draft, actionId));
      setDirty(true);
    },
    [caseRow, draft],
  );

  const resetDraft = useCallback(() => {
    setDraft(ensureCanonicalCaseSteps(caseRow?.caseSteps));
    setDirty(false);
  }, [caseRow?.caseSteps]);

  const handleSave = useCallback(async () => {
    if (!caseRow || !onSave) return;
    const patch = buildCaseProgressStepsPatch(caseRow, draft);
    await onSave(patch);
    setDirty(false);
  }, [caseRow, draft, onSave]);

  const handleSyncNte = useCallback(() => {
    if (!caseRow) return;
    let event = null;
    let at = null;
    if (respondedNte) {
      event = "nte_responded";
      at = respondedNte.responded_at;
    } else if (pendingNte) {
      event = "nte_sent";
      at = pendingNte.issued_at;
    }
    if (!event) return;
    const patch = buildCaseProgressFromEvent(caseRow, event, {
      date: formatCaseStepDateShort(at || new Date()),
    });
    setDraft(patch.case_steps);
    setDirty(true);
    onSyncFromNte?.(event);
  }, [caseRow, pendingNte, respondedNte, onSyncFromNte]);

  return (
    <div className="do-case-stepper">
      <div className="do-case-stepper-head">
        <div className="do-case-stepper-head-text">
          <div className="do-case-stepper-title-row">
            <Clock size={18} strokeWidth={2.5} aria-hidden />
            <h4 className="do-case-stepper-title">Mobile Case Progress</h4>
          </div>
          <p className="do-case-stepper-sub">
            <Smartphone size={14} aria-hidden />
            Students see this timeline in the app. Progress % is calculated automatically when you save.
          </p>
        </div>
        <div className="do-case-stepper-head-actions">
          <button
            type="button"
            className="cc-btn-secondary do-case-stepper-btn"
            disabled={saving || !dirty}
            onClick={resetDraft}
            title="Discard unsaved edits"
          >
            <RotateCcw size={16} aria-hidden />
            Reset
          </button>
          <button
            type="button"
            className="cc-btn-primary do-case-stepper-btn"
            disabled={saving || !dirty}
            onClick={handleSave}
          >
            <Save size={16} aria-hidden />
            {saving ? "Saving…" : "Save progress"}
          </button>
        </div>
      </div>

      <div className="do-case-stepper-progress">
        <div className="do-case-stepper-progress-labels">
          <span>Overall progress {dirty ? "(preview)" : ""}</span>
          <strong>{dirty ? draftMetrics.progress_percent : savedMetrics.progress_percent}%</strong>
        </div>
        <div className="do-case-stepper-progress-track">
          <div
            className="do-case-stepper-progress-fill"
            style={{
              width: `${dirty ? draftMetrics.progress_percent : savedMetrics.progress_percent}%`,
            }}
          />
        </div>
      </div>

      <div className="do-case-stepper-quick">
        <div className="do-case-stepper-quick-label">
          <Zap size={14} aria-hidden />
          Quick update
        </div>
        <div className="do-case-stepper-quick-btns">
          {CASE_PROGRESS_QUICK_ACTIONS.map((action) => {
            const unlocked = isQuickActionUnlocked(action.id);
            const lockedTitle = "Complete the previous step before using this action.";
            return (
              <button
                key={action.id}
                type="button"
                className={`cc-btn-secondary do-case-stepper-quick-btn${unlocked ? "" : " is-locked"}`}
                disabled={saving || !unlocked}
                aria-disabled={!unlocked || undefined}
                title={unlocked ? action.hint : lockedTitle}
                onClick={() => applyQuickAction(action.id)}
              >
                {!unlocked ? <Lock size={12} aria-hidden /> : null}
                {action.label}
              </button>
            );
          })}
          {(pendingNte || respondedNte) && (
            <button
              type="button"
              className="cc-btn-secondary do-case-stepper-quick-btn"
              disabled={saving}
              onClick={handleSyncNte}
              title="Apply step statuses from linked NTE record"
            >
              Sync from NTE
            </button>
          )}
        </div>
      </div>

      <ol className="do-case-stepper-timeline" aria-label="Case progress steps">
        {draft.map((step, stepIndex) => {
          const ui = STATUS_UI[step.status] || STATUS_UI.pending;
          const isLast = stepIndex === draft.length - 1;
          const isoDate = caseStepShortLabelToIsoDate(step.date);
          const unlocked = isStepUnlocked(stepIndex);
          const lockTitle = "Complete the previous step before changing this one.";
          return (
            <li
              key={step.label}
              className={`do-case-stepper-item${step.status === "in_progress" ? " is-active" : ""}${
                unlocked ? "" : " is-locked"
              }`}
            >
              <div className="do-case-stepper-rail" aria-hidden>
                <span className="do-case-stepper-dot" style={{ background: ui.dot }}>
                  {step.status === "completed" ? "✓" : stepIndex + 1}
                </span>
                {!isLast ? (
                  <span
                    className="do-case-stepper-line"
                    style={{
                      background:
                        step.status === "completed" ? "#16a34a" : "#e2e8f0",
                    }}
                  />
                ) : null}
              </div>

              <div className="do-case-stepper-card" style={{ background: ui.bg }}>
                <div className="do-case-stepper-card-head">
                  <strong>
                    {!unlocked ? (
                      <Lock
                        size={14}
                        aria-hidden
                        style={{ verticalAlign: "-2px", marginRight: 6, color: "#94a3b8" }}
                      />
                    ) : null}
                    {step.label}
                  </strong>
                  <span className="do-case-stepper-status-pill" style={{ color: ui.text }}>
                    {stepStatusLabel(step.status)}
                  </span>
                </div>

                <div className="cc-field do-case-stepper-field do-case-stepper-field--wide">
                  <div className="cc-label-row">
                    <span className="cc-label">Step title (mobile)</span>
                    {step.label !== MOBILE_CASE_PROGRESS_TEMPLATE[stepIndex] ? (
                      <button
                        type="button"
                        className="do-case-stepper-today-link"
                        disabled={saving}
                        onClick={() =>
                          updateStep(stepIndex, { label: MOBILE_CASE_PROGRESS_TEMPLATE[stepIndex] })
                        }
                      >
                        Reset title
                      </button>
                    ) : null}
                  </div>
                  <input
                    className="cc-input"
                    value={step.label}
                    disabled={saving}
                    placeholder={MOBILE_CASE_PROGRESS_TEMPLATE[stepIndex]}
                    onChange={(e) => updateStep(stepIndex, { label: e.target.value })}
                  />
                </div>

                <div className="do-case-stepper-status-btns" role="group" aria-label={`Status for ${step.label}`}>
                  {CASE_STEP_STATUSES.map((statusOption) => (
                    <button
                      key={statusOption}
                      type="button"
                      className={`do-case-stepper-status-btn${step.status === statusOption ? " is-selected" : ""}${
                        unlocked ? "" : " is-locked"
                      }`}
                      disabled={saving || !unlocked}
                      aria-disabled={!unlocked || undefined}
                      title={unlocked ? undefined : lockTitle}
                      onClick={() => updateStep(stepIndex, { status: statusOption })}
                    >
                      {stepStatusLabel(statusOption)}
                    </button>
                  ))}
                </div>

                <div className="do-case-stepper-fields">
                  <div className="cc-field do-case-stepper-field">
                    <div className="cc-label-row">
                      <span className="cc-label">Date on mobile</span>
                      <button
                        type="button"
                        className="do-case-stepper-today-link"
                        disabled={saving}
                        onClick={() =>
                          updateStep(stepIndex, { date: formatCaseStepDateShort() })
                        }
                      >
                        Use today
                      </button>
                    </div>
                    <input
                      className="cc-input"
                      type="date"
                      value={isoDate}
                      disabled={saving}
                      onChange={(e) =>
                        updateStep(stepIndex, {
                          date: isoDateToCaseStepShortLabel(e.target.value),
                        })
                      }
                    />
                    {step.date ? (
                      <span className="do-case-stepper-date-preview">Shows as: {step.date}</span>
                    ) : null}
                  </div>
                  <div className="cc-field do-case-stepper-field do-case-stepper-field--wide">
                    <div className="cc-label">Note for student (optional)</div>
                    <textarea
                      className="cc-textarea"
                      rows={2}
                      disabled={saving}
                      value={step.note || ""}
                      placeholder={
                        stepIndex === 2
                          ? "e.g., Accepted with community service"
                          : stepIndex === 3
                            ? "e.g., Conference on May 20, Room 201"
                            : stepIndex === 4
                              ? "e.g., Community service — 20 hours"
                              : "Short message visible on mobile"
                      }
                      onChange={(e) => updateStep(stepIndex, { note: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
