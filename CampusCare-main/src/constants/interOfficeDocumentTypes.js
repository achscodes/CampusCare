/**
 * Document types for each office when it is the *target* of an inter-office request.
 * Shared by DO, HSO, and SDAO — keys match `target_office` (discipline | health | development).
 */
export const INTER_OFFICE_DOCUMENT_TYPES_BY_TARGET = {
  health: [
    "Medical Certificate",
    "Immunization Record",
    "Fit to Study / Medical Clearance",
    "Medical Abstract",
    "Other",
  ],
  discipline: [
    "Good Moral Certificate",
    "Transcript of Records",
    "Certificate of Enrollment",
    "Discipline / Case-related Document",
    "Other",
  ],
  development: [
    "Scholarship / Beneficiary Letter",
    "Certificate of Enrollment",
    "Transcript of Records",
    "Clearance-related Document",
    "Other",
  ],
};

export const INTER_OFFICE_DOC_REQ_PRIORITY_OPTIONS = ["low", "medium", "high"];
