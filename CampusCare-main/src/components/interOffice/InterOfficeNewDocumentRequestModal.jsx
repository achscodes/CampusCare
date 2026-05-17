import { useMemo, useState } from "react";
import { getDocumentRequestTargetOptionsForOffice, normalizeOfficeKey } from "../../constants/documentRequestAccess";
import { INTER_OFFICE_DOCUMENT_TYPES_BY_TARGET } from "../../constants/interOfficeDocumentTypes";
import "../../pages/DODashboard/DO.css";
import "./InterOfficeNewDocumentRequestModal.css";

const INITIAL = {
  targetOffice: "",
  documentType: "",
  documentTypeOther: "",
  description: "",
};

/**
 * @typedef {object} InterOfficeNewDocumentRequestPayload
 * @property {string} targetOffice
 * @property {string} documentType
 * @property {string} documentTypeOther
 * @property {string} description
 * @property {File | null} evidenceFile
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
    if (!form.targetOffice.trim()) next.targetOffice = "Select which office should fulfill this request.";
    if (!form.documentType) next.documentType = "Document Type is required.";
    if (String(form.documentType).toLowerCase() === "other" && !form.documentTypeOther?.trim()) {
      next.documentTypeOther = "Please specify the document type.";
    }
    if (!form.description.trim()) next.description = "Description is required.";

    setErrors(next);
    setSubmitError(null);
    if (Object.keys(next).length > 0) return;

    try {
      await onSubmit({
        studentName: "N/A",
        studentId: "N/A",
        program: "",
        targetOffice: form.targetOffice.trim(),
        documentType: form.documentType,
        documentTypeOther: form.documentTypeOther?.trim() || "",
        priority: "medium",
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
            <div className="cc-field">
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
              <div className="cc-label">Attachment (optional)</div>
              <input
                className="cc-input"
                type="file"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
              />
              {evidenceFile ? (
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
                  Selected: <span style={{ color: "#0f172a" }}>{evidenceFile.name}</span>
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
