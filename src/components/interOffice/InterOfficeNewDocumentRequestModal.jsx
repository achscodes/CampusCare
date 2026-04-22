import { useMemo, useState } from "react";
import ProgramSelect from "../common/ProgramSelect";
import { NU_PROGRAM_OPTIONS } from "../../data/nuPrograms";
import { getDocumentRequestTargetOptionsForOffice, normalizeOfficeKey } from "../../constants/documentRequestAccess";
import {
  INTER_OFFICE_DOCUMENT_TYPES_BY_TARGET,
  INTER_OFFICE_DOC_REQ_PRIORITY_OPTIONS,
} from "../../constants/interOfficeDocumentTypes";
import { sanitizeDigitsOnlyInput, sanitizePersonNameInput } from "../../utils/signupFieldValidation";
import "../../pages/DODashboard/DO.css";
import "./InterOfficeNewDocumentRequestModal.css";

const INITIAL = {
  studentName: "",
  studentId: "",
  program: "",
  targetOffice: "",
  documentType: "",
  documentTypeOther: "",
  priority: "medium",
  description: "",
};

/**
 * @typedef {object} InterOfficeNewDocumentRequestPayload
 * @property {string} studentName
 * @property {string} studentId
 * @property {string} program
 * @property {string} targetOffice
 * @property {string} documentType
 * @property {string} documentTypeOther
 * @property {string} priority
 * @property {string} description
 * @property {File} evidenceFile
 */

export default function InterOfficeNewDocumentRequestModal({
  open,
  onClose,
  /** @type {"discipline"|"health"|"development"} */
  viewerOfficeKey,
  /** @param {InterOfficeNewDocumentRequestPayload} payload */
  onSubmit,
  submitting = false,
}) {
  const [form, setForm] = useState(() => ({ ...INITIAL }));
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);

  const targetOptions = useMemo(() => getDocumentRequestTargetOptionsForOffice(viewerOfficeKey), [viewerOfficeKey]);

  const docTypeOptions = useMemo(() => {
    const key = normalizeOfficeKey(form.targetOffice);
    return INTER_OFFICE_DOCUMENT_TYPES_BY_TARGET[key] || [];
  }, [form.targetOffice]);

  const runSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    const sname = form.studentName.trim();
    const sid = form.studentId.trim();
    if (!sname) next.studentName = "Student name is required.";
    if (!sid) next.studentId = "Student ID is required.";
    if (!form.program.trim()) next.program = "Program is required.";
    if (!form.targetOffice.trim()) next.targetOffice = "Select which office should fulfill this request.";
    if (!form.documentType) next.documentType = "Document Type is required.";
    if (String(form.documentType).toLowerCase() === "other" && !form.documentTypeOther?.trim()) {
      next.documentTypeOther = "Please specify the document type.";
    }
    if (!form.description.trim()) next.description = "Description is required.";
    if (!evidenceFile) next.evidence = "Attachment is required.";

    setErrors(next);
    setSubmitError(null);
    if (Object.keys(next).length > 0) return;

    try {
      await onSubmit({
        studentName: sname,
        studentId: sid,
        program: form.program.trim(),
        targetOffice: form.targetOffice.trim(),
        documentType: form.documentType,
        documentTypeOther: form.documentTypeOther?.trim() || "",
        priority: form.priority,
        description: form.description.trim(),
        evidenceFile,
      });
    } catch (err) {
      setSubmitError(err?.message || "Could not submit request.");
    }
  };

  if (!open) return null;

  return (
    <div
      className="cc-modal-overlay do-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inter-office-doc-req-title"
      onMouseDown={onClose}
    >
      <div
        className="cc-modal do-modal inter-office-doc-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="cc-modal-header">
          <div id="inter-office-doc-req-title" className="cc-modal-title">
            New Document Request
          </div>
          <button className="cc-modal-close" type="button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="inter-office-doc-modal__form" onSubmit={runSubmit} noValidate>
          <div className="inter-office-doc-modal__body cc-modal-body">
            <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.45, margin: "0 0 12px" }}>
              Admin-to-admin only (HSO, DO, and SDAO): enter the student or case this request supports. Attachments are
              required before submitting.
            </p>
            <div className="cc-modal-row">
              <div className="cc-field">
                <div className="cc-label">Student name</div>
                <input
                  className={`cc-input${errors.studentName ? " cc-input-error" : ""}`}
                  value={form.studentName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, studentName: sanitizePersonNameInput(e.target.value) }))
                  }
                  placeholder="As it should appear on the document"
                  aria-invalid={Boolean(errors.studentName)}
                />
                {errors.studentName ? (
                  <div className="cc-form-error" role="alert">
                    {errors.studentName}
                  </div>
                ) : null}
              </div>
              <div className="cc-field">
                <div className="cc-label">Student ID</div>
                <input
                  className={`cc-input${errors.studentId ? " cc-input-error" : ""}`}
                  value={form.studentId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, studentId: sanitizeDigitsOnlyInput(e.target.value) }))
                  }
                  placeholder="e.g., 2023-10234"
                  aria-invalid={Boolean(errors.studentId)}
                />
                {errors.studentId ? (
                  <div className="cc-form-error" role="alert">
                    {errors.studentId}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="cc-field" style={{ marginTop: 12 }}>
              <div className="cc-label">Program</div>
              <ProgramSelect
                error={Boolean(errors.program)}
                value={form.program}
                onChange={(v) => setForm((p) => ({ ...p, program: v }))}
                options={NU_PROGRAM_OPTIONS}
                placeholder="Select program / course"
              />
              {errors.program ? (
                <div className="cc-form-error" role="alert">
                  {errors.program}
                </div>
              ) : null}
            </div>

            <div className="cc-field" style={{ marginTop: 12 }}>
              <div className="cc-label">Request document from</div>
              <select
                className={`cc-input${errors.targetOffice ? " cc-input-error" : ""}`}
                value={form.targetOffice}
                onChange={(e) => {
                  const targetOffice = e.target.value;
                  setForm((p) => {
                    const types = INTER_OFFICE_DOCUMENT_TYPES_BY_TARGET[normalizeOfficeKey(targetOffice)] || [];
                    const nextDoc = types.includes(p.documentType) ? p.documentType : "";
                    return { ...p, targetOffice, documentType: nextDoc, documentTypeOther: "" };
                  });
                }}
                aria-invalid={Boolean(errors.targetOffice)}
              >
                <option value="">Select office</option>
                {targetOptions.map((o) => (
                  <option value={o.value} key={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {errors.targetOffice ? (
                <div className="cc-form-error" role="alert">
                  {errors.targetOffice}
                </div>
              ) : null}
            </div>

            <div className="cc-modal-row">
              <div className="cc-field">
                <div className="cc-label">Document Type</div>
                <select
                  className={`cc-input${errors.documentType ? " cc-input-error" : ""}`}
                  value={form.documentType}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      documentType: e.target.value,
                      documentTypeOther: e.target.value.toLowerCase() === "other" ? p.documentTypeOther : "",
                    }))
                  }
                  aria-invalid={Boolean(errors.documentType)}
                  disabled={!form.targetOffice}
                >
                  <option value="">{form.targetOffice ? "Select document type" : "Select an office first"}</option>
                  {docTypeOptions.map((opt) => (
                    <option value={opt} key={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {errors.documentType ? (
                  <div className="cc-form-error" role="alert">
                    {errors.documentType}
                  </div>
                ) : null}
              </div>

              <div className="cc-field">
                <div className="cc-label">Priority</div>
                <select
                  className="cc-input"
                  value={form.priority}
                  onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                >
                  {INTER_OFFICE_DOC_REQ_PRIORITY_OPTIONS.map((p) => (
                    <option value={p} key={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {String(form.documentType).toLowerCase() === "other" ? (
              <div className="cc-field" style={{ marginTop: 12 }}>
                <div className="cc-label">Specify document type</div>
                <input
                  className={`cc-input${errors.documentTypeOther ? " cc-input-error" : ""}`}
                  value={form.documentTypeOther}
                  onChange={(e) => setForm((p) => ({ ...p, documentTypeOther: e.target.value }))}
                  placeholder="Describe the document you need"
                />
                {errors.documentTypeOther ? (
                  <div className="cc-form-error" role="alert">
                    {errors.documentTypeOther}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="cc-field" style={{ marginTop: 12 }}>
              <div className="cc-label">Description</div>
              <textarea
                className={`cc-textarea${errors.description ? " cc-input-error" : ""}`}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Describe the request..."
                aria-invalid={Boolean(errors.description)}
              />
              {errors.description ? (
                <div className="cc-form-error" role="alert">
                  {errors.description}
                </div>
              ) : null}
            </div>

            <div className="cc-field" style={{ marginTop: 12 }}>
              <div className="cc-label">Attachment</div>
              <input
                className={`cc-input${errors.evidence ? " cc-input-error" : ""}`}
                type="file"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                aria-invalid={Boolean(errors.evidence)}
              />
              {evidenceFile ? (
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
                  Selected: <span style={{ color: "#0f172a" }}>{evidenceFile.name}</span>
                </div>
              ) : null}
              {errors.evidence ? (
                <div className="cc-form-error" role="alert">
                  {errors.evidence}
                </div>
              ) : null}
            </div>
          </div>

          {submitError ? (
            <div className="inter-office-doc-modal__submit-err" role="alert">
              {submitError}
            </div>
          ) : null}

          <div className="inter-office-doc-modal__actions cc-modal-actions">
            <button className="cc-btn-secondary" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button className="cc-btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
