import { useState, useEffect, useMemo, useRef } from "react";
import { Minus, X, Send, Eye, Paperclip } from "lucide-react";
import {
  buildCaseProgressFromEvent,
  formatCaseId,
  formatCaseStepDateShort,
  rowToCase,
} from "../../utils/disciplineCaseMapper";
import { readCampusCareSession } from "../../utils/campusCareSession";
import { supabase } from "../../lib/supabaseClient";
import {
  sendDisciplineNteNotice,
  buildDefaultNteEmailContent,
  buildFormalNteHtml,
  stripNteMemoHeader,
  nteComposeHighlightHtml,
} from "../../services/disciplineNteNotice";

const NTE_MAX_ATTACHMENTS = 5;
const NTE_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

async function readFileAsBase64(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
import { showToast } from "../../utils/toast";

export function CM_StatusBadge({ status }) {
  const key = String(status || "new").toLowerCase();
  const labels = {
    new: "New",
    pending: "Pending",
    ongoing: "Ongoing",
    escalated: "Escalated",
    closed: "Closed",
  };
  const label = labels[key] || key;
  return <span className={`badge badge-${key}`}>{label}</span>;
}

export function CaseManagementCaseActions({
  selectedCase,
  statusNote,
  setStatusNote,
  caseModalError,
  setCaseModalError,
  openNteModal,
  escalateCase,
  refreshCases,
  setSelectedCase,
  setCloseCaseStep,
  setClosureSummary,
  setCloseConfirmChecked,
  setClosePassword,
  setCloseCaseOpen,
}) {
  return (
    <>
      <div style={{ borderTop: "1px solid #e2e8f0", marginBottom: 16, marginTop: 8 }} />
      <div className="do-case-actions">
        <div
          style={{
            fontWeight: 600,
            fontSize: 11,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 10,
          }}
        >
          Case actions
        </div>
        <div className="do-case-actions-row">
          <button
            type="button"
            className="cc-btn-primary"
            disabled={selectedCase.status === "closed"}
            onClick={() => openNteModal(selectedCase)}
          >
            Send NTE notice
          </button>
          <button
            type="button"
            className="cc-btn-secondary"
            disabled={selectedCase.status === "closed" || selectedCase.status === "escalated"}
            onClick={async () => {
              setCaseModalError(null);
              try {
                await escalateCase(selectedCase.id, statusNote);
                await refreshCases();
                setSelectedCase(null);
                showToast("Case escalated.", { variant: "success" });
              } catch (err) {
                setCaseModalError(err?.message || "Could not escalate case.");
              }
            }}
          >
            Escalate case
          </button>
          <button
            type="button"
            className="cc-btn-secondary do-btn-danger-outline"
            disabled={selectedCase.status === "closed"}
            onClick={() => {
              setCloseCaseStep(1);
              setClosureSummary("");
              setCloseConfirmChecked(false);
              setClosePassword("");
              setCloseCaseOpen(true);
            }}
          >
            Close case
          </button>
        </div>
        <div className="cc-field" style={{ marginTop: 12 }}>
          <div className="cc-label">Internal note (optional)</div>
          <textarea
            className="cc-textarea"
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            placeholder="Add an internal note for this case..."
          />
        </div>
      </div>
      {caseModalError && (
        <div className="cc-form-error" role="alert" style={{ padding: "0 20px 12px" }}>
          {caseModalError}
        </div>
      )}
      <div className="cc-modal-actions">
        <button className="cc-btn-secondary" type="button" onClick={() => setSelectedCase(null)}>
          Dismiss
        </button>
      </div>
    </>
  );
}

export function CaseManagementNteModal({
  selectedCase,
  nteModalOpen,
  setNteModalOpen,
  nteToEmail,
  setNteToEmail,
  nteSubject,
  setNteSubject,
  nteBody,
  setNteBody,
  nteSending,
  setNteSending,
  caseModalError,
  setCaseModalError,
  refreshCases,
  setSelectedCase,
}) {
  const [showCc, setShowCc] = useState(false);
  const [nteCc1, setNteCc1] = useState("");
  const [nteCc2, setNteCc2] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [composeTab, setComposeTab] = useState("edit");
  const [nteAttachments, setNteAttachments] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (nteModalOpen) {
      setMinimized(false);
      setComposeTab("edit");
    } else {
      setNteAttachments([]);
      setNteCc1("");
      setNteCc2("");
      setShowCc(false);
    }
  }, [nteModalOpen]);

  const previewHtml = useMemo(() => {
    if (!selectedCase) return "";
    const content = buildDefaultNteEmailContent(selectedCase.student, selectedCase.id, {
      caseType: selectedCase.caseType,
      offenseType: selectedCase.offenseType,
    });
    const bodyText = stripNteMemoHeader(nteBody.trim() || content.textBody);
    return buildFormalNteHtml(bodyText);
  }, [selectedCase, nteBody]);

  const composeHighlightHtml = useMemo(
    () => nteComposeHighlightHtml(nteBody),
    [nteBody],
  );

  if (!nteModalOpen || !selectedCase) return null;

  const handleAttachFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const remaining = NTE_MAX_ATTACHMENTS - nteAttachments.length;
    if (remaining <= 0) {
      showToast(`You can attach up to ${NTE_MAX_ATTACHMENTS} files.`, { variant: "warning" });
      return;
    }

    const toAdd = files.slice(0, remaining);
    const next = [...nteAttachments];

    for (const file of toAdd) {
      if (file.size > NTE_MAX_ATTACHMENT_BYTES) {
        showToast(`"${file.name}" exceeds 10 MB.`, { variant: "warning" });
        continue;
      }
      try {
        const content = await readFileAsBase64(file);
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          filename: file.name,
          content,
          size: file.size,
        });
      } catch {
        showToast(`Could not read "${file.name}".`, { variant: "error" });
      }
    }

    setNteAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    setNteSending(true);
    setCaseModalError(null);
    try {
      const content = buildDefaultNteEmailContent(selectedCase.student, selectedCase.id, {
        caseType: selectedCase.caseType,
        offenseType: selectedCase.offenseType,
      });
      const bodyText = stripNteMemoHeader(nteBody.trim() || content.textBody).trim();
      const htmlBody = buildFormalNteHtml(bodyText);
      const attachments = nteAttachments.map(({ filename, content }) => ({
        filename,
        content,
      }));

      const ccCandidates = [nteCc1, nteCc2]
        .map((v) => String(v || "").trim().toLowerCase())
        .filter(Boolean);
      const invalidCc = ccCandidates.find((v) => !v.includes("@"));
      if (invalidCc) {
        throw new Error(`Cc email looks invalid: ${invalidCc}`);
      }
      const ccEmails = Array.from(new Set(ccCandidates)).slice(0, 2);

      const result = await sendDisciplineNteNotice({
        caseId: selectedCase.id,
        toEmail: nteToEmail.trim(),
        subject: nteSubject.trim() || content.subject,
        htmlBody,
        textBody: bodyText,
        attachments: attachments.length ? attachments : undefined,
        ccEmails: ccEmails.length ? ccEmails : undefined,
      });
      if (supabase) {
        const { data: caseRow } = await supabase
          .from("discipline_cases")
          .select("*")
          .eq("id", selectedCase.id)
          .maybeSingle();
        if (caseRow) {
          const progressPatch = buildCaseProgressFromEvent(rowToCase(caseRow), "nte_sent", {
            date: formatCaseStepDateShort(),
          });
          await supabase
            .from("discipline_cases")
            .update({ ...progressPatch, updated_at: new Date().toISOString() })
            .eq("id", selectedCase.id);
        }
      }
      await refreshCases();
      setNteModalOpen(false);
      setSelectedCase(null);
      showToast(
        result?.mobileLinked
          ? "NTE notice sent and linked to the student mobile app."
          : "NTE notice sent by email only.",
        { variant: "success" },
      );
    } catch (err) {
      setCaseModalError(err?.message || "Could not send NTE notice.");
    } finally {
      setNteSending(false);
    }
  };

  return (
  <>
    <div
      className="do-gmail-compose-backdrop"
      aria-hidden
      onMouseDown={() => setNteModalOpen(false)}
    />
    <div
      className={`do-gmail-compose-wrap${minimized ? " do-gmail-compose-wrap--min" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Compose NTE email"
    >
      <div className="do-gmail-compose">
        <header className="do-gmail-compose-head">
          <span className="do-gmail-compose-head-title">
            New Message · {formatCaseId(selectedCase.id)}
          </span>
          <div className="do-gmail-compose-head-actions">
            <button
              type="button"
              className="do-gmail-compose-icon-btn"
              aria-label={minimized ? "Restore" : "Minimize"}
              onClick={() => setMinimized((m) => !m)}
            >
              <Minus size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="do-gmail-compose-icon-btn"
              aria-label="Close"
              onClick={() => setNteModalOpen(false)}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </header>

        {!minimized && (
          <>
            <div className="do-gmail-compose-fields">
              <div className="do-gmail-compose-row">
                <label className="do-gmail-compose-label" htmlFor="nte-to">
                  To
                </label>
                <input
                  id="nte-to"
                  className="do-gmail-compose-input"
                  type="email"
                  value={nteToEmail}
                  onChange={(e) => setNteToEmail(e.target.value)}
                  placeholder="Recipients"
                />
                {!showCc && (
                  <button
                    type="button"
                    className="do-gmail-compose-cc-toggle"
                    onClick={() => setShowCc(true)}
                  >
                    Cc
                  </button>
                )}
              </div>
              {showCc && (
                <>
                  <div className="do-gmail-compose-row">
                    <label className="do-gmail-compose-label" htmlFor="nte-cc-1">
                      Cc 1
                    </label>
                    <input
                      id="nte-cc-1"
                      className="do-gmail-compose-input"
                      type="email"
                      value={nteCc1}
                      onChange={(e) => setNteCc1(e.target.value)}
                      placeholder="program.chair@example.edu"
                      autoComplete="off"
                    />
                  </div>
                  <div className="do-gmail-compose-row">
                    <label className="do-gmail-compose-label" htmlFor="nte-cc-2">
                      Cc 2
                    </label>
                    <input
                      id="nte-cc-2"
                      className="do-gmail-compose-input"
                      type="email"
                      value={nteCc2}
                      onChange={(e) => setNteCc2(e.target.value)}
                      placeholder="oic.dean@example.edu"
                      autoComplete="off"
                    />
                  </div>
                </>
              )}
              <div className="do-gmail-compose-row">
                <label className="do-gmail-compose-label" htmlFor="nte-subject">
                  Subject
                </label>
                <input
                  id="nte-subject"
                  className="do-gmail-compose-input do-gmail-compose-input--subject"
                  type="text"
                  value={nteSubject}
                  onChange={(e) => setNteSubject(e.target.value)}
                  placeholder="Subject"
                  title={nteSubject}
                />
              </div>
            </div>

            <div className="do-gmail-compose-tabs">
              <button
                type="button"
                className={`do-gmail-compose-tab${composeTab === "edit" ? " is-active" : ""}`}
                onClick={() => setComposeTab("edit")}
              >
                Compose
              </button>
              <button
                type="button"
                className={`do-gmail-compose-tab${composeTab === "preview" ? " is-active" : ""}`}
                onClick={() => setComposeTab("preview")}
              >
                <Eye size={14} strokeWidth={2} aria-hidden />
                Preview
              </button>
            </div>
            <p className="do-gmail-compose-placeholder-hint">
              Replace the <strong style={{ color: "#b91c1c" }}>[red bracketed]</strong> fields for alleged offense,
              factual antecedence, and handbook citation before sending.
            </p>

            {composeTab === "edit" ? (
              <div className="do-gmail-compose-body-wrap">
                <div
                  className="do-gmail-compose-body-backdrop"
                  aria-hidden
                  dangerouslySetInnerHTML={{ __html: composeHighlightHtml }}
                />
                <textarea
                  className="do-gmail-compose-body do-gmail-compose-body--highlight"
                  value={nteBody}
                  onChange={(e) => setNteBody(e.target.value)}
                  onScroll={(e) => {
                    const backdrop = e.currentTarget.previousElementSibling;
                    if (backdrop) {
                      backdrop.scrollTop = e.currentTarget.scrollTop;
                      backdrop.scrollLeft = e.currentTarget.scrollLeft;
                    }
                  }}
                  placeholder="Compose your message…"
                  spellCheck
                />
              </div>
            ) : (
              <div className="do-gmail-compose-preview-wrap">
                <iframe
                  className="do-gmail-compose-preview"
                  title="Email preview"
                  srcDoc={previewHtml}
                  sandbox=""
                />
              </div>
            )}

            {nteAttachments.length > 0 && (
              <ul className="do-gmail-compose-attachments" aria-label="Attached files">
                {nteAttachments.map((att) => (
                  <li key={att.id} className="do-gmail-compose-attachment-item">
                    <Paperclip size={14} strokeWidth={2} aria-hidden />
                    <span className="do-gmail-compose-attachment-name" title={att.filename}>
                      {att.filename}
                    </span>
                    <button
                      type="button"
                      className="do-gmail-compose-attachment-remove"
                      aria-label={`Remove ${att.filename}`}
                      onClick={() =>
                        setNteAttachments((prev) => prev.filter((a) => a.id !== att.id))
                      }
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {caseModalError && (
              <div className="do-gmail-compose-error" role="alert">
                {caseModalError}
              </div>
            )}

            <footer className="do-gmail-compose-foot">
              <input
                ref={fileInputRef}
                type="file"
                className="do-gmail-compose-file-input"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => handleAttachFiles(e.target.files)}
              />
              <button
                type="button"
                className="do-gmail-compose-attach-btn"
                aria-label="Attach file"
                title="Attach file (PDF, Word, images — max 10 MB each)"
                disabled={nteSending || nteAttachments.length >= NTE_MAX_ATTACHMENTS}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={18} strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                className="do-gmail-send-btn"
                disabled={nteSending || !nteToEmail.trim()}
                onClick={handleSend}
              >
                <Send size={16} strokeWidth={2.5} aria-hidden />
                {nteSending ? "Sending…" : "Send"}
              </button>
              <span className="do-gmail-compose-foot-hint">
                Formal Notice to Explain (plain email)
              </span>
            </footer>
          </>
        )}
      </div>
    </div>
  </>
  );
}

export function CaseManagementCloseCaseModal({
  selectedCase,
  closeCaseOpen,
  setCloseCaseOpen,
  closeCaseStep,
  setCloseCaseStep,
  closureSummary,
  setClosureSummary,
  closeConfirmChecked,
  setCloseConfirmChecked,
  closePassword,
  setClosePassword,
  closeCaseSubmitting,
  setCloseCaseSubmitting,
  caseModalError,
  setCaseModalError,
  caseConferencesForSelected,
  closeCase,
  refreshCases,
  setSelectedCase,
}) {
  if (!closeCaseOpen || !selectedCase) return null;
  return (
    <div
      className="cc-modal-overlay do-modal-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={() => setCloseCaseOpen(false)}
    >
      <div className="cc-modal do-modal do-modal--lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cc-modal-header">
          <div className="cc-modal-title">Close case — {formatCaseId(selectedCase.id)}</div>
          <button type="button" className="cc-modal-close" aria-label="Close" onClick={() => setCloseCaseOpen(false)}>
            ✕
          </button>
        </div>
        <div className="cc-modal-body">
          {closeCaseStep === 1 && (
            <>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 12 }}>
                Review case details before closing. A closure summary is required.
              </p>
              <dl className="ir-detail-dl">
                <div>
                  <dt>Student</dt>
                  <dd>{selectedCase.student}</dd>
                </div>
                <div>
                  <dt>Case type</dt>
                  <dd>{selectedCase.caseType}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <CM_StatusBadge status={selectedCase.status} />
                  </dd>
                </div>
                <div>
                  <dt>Conferences</dt>
                  <dd>{caseConferencesForSelected.length}</dd>
                </div>
              </dl>
              <div className="cc-field">
                <div className="cc-label">Closure summary (required)</div>
                <textarea
                  className="cc-textarea"
                  rows={5}
                  value={closureSummary}
                  onChange={(e) => setClosureSummary(e.target.value)}
                  placeholder="Summarize findings, actions taken, and outcome..."
                />
              </div>
            </>
          )}
          {closeCaseStep === 2 && (
            <div>
              <p style={{ fontSize: 15, color: "#0f172a", marginBottom: 12 }}>
                Are you sure you want to close this case? This action is recorded.
              </p>
              <label className="do-close-confirm-label">
                <input
                  type="checkbox"
                  checked={closeConfirmChecked}
                  onChange={(e) => setCloseConfirmChecked(e.target.checked)}
                />
                I confirm that this case should be closed.
              </label>
            </div>
          )}
          {closeCaseStep === 3 && (
            <div>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 12 }}>
                Enter your account password to confirm closing this case.
              </p>
              <div className="cc-field">
                <div className="cc-label">Password</div>
                <input
                  type="password"
                  className="cc-input"
                  value={closePassword}
                  onChange={(e) => setClosePassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>
          )}
        </div>
        {caseModalError && (
          <div className="cc-form-error" role="alert" style={{ padding: "0 20px" }}>
            {caseModalError}
          </div>
        )}
        <div className="cc-modal-actions">
          <button type="button" className="cc-btn-secondary" onClick={() => setCloseCaseOpen(false)}>
            Cancel
          </button>
          {closeCaseStep > 1 && (
            <button
              type="button"
              className="cc-btn-secondary"
              onClick={() => setCloseCaseStep((s) => Math.max(1, s - 1))}
            >
              Back
            </button>
          )}
          {closeCaseStep < 3 ? (
            <button
              type="button"
              className="cc-btn-primary"
              disabled={closeCaseStep === 1 && !closureSummary.trim()}
              onClick={() => setCloseCaseStep((s) => s + 1)}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="cc-btn-primary"
              disabled={closeCaseSubmitting || !closeConfirmChecked || !closePassword}
              onClick={async () => {
                setCloseCaseSubmitting(true);
                setCaseModalError(null);
                try {
                  const session = readCampusCareSession();
                  const email = session?.email;
                  if (!email || !supabase) throw new Error("Could not verify your session.");
                  const { error: pwErr } = await supabase.auth.signInWithPassword({
                    email,
                    password: closePassword,
                  });
                  if (pwErr) throw new Error("Incorrect password.");
                  const uid = (await supabase.auth.getUser()).data.user?.id;
                  await closeCase(selectedCase.id, closureSummary, uid);
                  await refreshCases();
                  setCloseCaseOpen(false);
                  setSelectedCase(null);
                  showToast("Case closed.", { variant: "success" });
                } catch (err) {
                  setCaseModalError(err?.message || "Could not close case.");
                } finally {
                  setCloseCaseSubmitting(false);
                }
              }}
            >
              {closeCaseSubmitting ? "Closing…" : "Close case"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
