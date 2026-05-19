import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, RotateCcw, Save, Smartphone, Zap } from "lucide-react";
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

  const savedMetrics = useMemo(
    () => computeCaseProgressMetrics(caseRow?.caseSteps),
    [caseRow?.caseSteps],
  );
  const draftMetrics = useMemo(() => computeCaseProgressMetrics(draft), [draft]);

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
          {CASE_PROGRESS_QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              className="cc-btn-secondary do-case-stepper-quick-btn"
              disabled={saving}
              title={action.hint}
              onClick={() => applyQuickAction(action.id)}
            >
              {action.label}
            </button>
          ))}
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
          return (
            <li
              key={step.label}
              className={`do-case-stepper-item${step.status === "in_progress" ? " is-active" : ""}`}
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
                  <strong>{step.label}</strong>
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
                      className={`do-case-stepper-status-btn${step.status === statusOption ? " is-selected" : ""}`}
                      disabled={saving}
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
