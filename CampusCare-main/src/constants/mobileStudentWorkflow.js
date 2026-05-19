/**
 * Maps student-mobile Supabase writes to CampusCare staff web routes.
 * @see disciplineMobileWebContract.js for columns, statuses, and plan mismatches.
 */

import {
  INCIDENT_REPORT_TABLE,
  INCIDENT_REPORT_WEB,
  NTE_TABLE,
  NTE_WEB,
  PROOF_SUBMISSION_TABLE,
  PROOF_WEB,
  MOBILE_STUDENT_WRITES,
} from "./disciplineMobileWebContract";

/** @typedef {{ table: string, webPath: string | null, label: string, office: string, mobileWrites: boolean, realtimeOnWeb: boolean, webUiBuilt: boolean, notes?: string }} MobileWorkflowEntry */

/** @type {MobileWorkflowEntry[]} */
export const MOBILE_STUDENT_WORKFLOW = [
  {
    table: INCIDENT_REPORT_TABLE,
    webPath: INCIDENT_REPORT_WEB.path,
    label: "Incident Report",
    office: "discipline",
    mobileWrites: MOBILE_STUDENT_WRITES.incidentReport,
    realtimeOnWeb: true,
    webUiBuilt: true,
    notes:
      "Statuses: submitted, under_review, converted_to_case, rejected. On reject, read rejection_message (not impact) for student email/app.",
  },
  {
    table: PROOF_SUBMISSION_TABLE,
    webPath: PROOF_WEB.plannedPath,
    label: "Proof of sanction compliance",
    office: "discipline",
    mobileWrites: MOBILE_STUDENT_WRITES.proofOfSanctionCompliance,
    realtimeOnWeb: true,
    webUiBuilt: true,
    notes: "Rows in discipline_proof_submissions + files in discipline_proof_files / discipline-proofs bucket; web reviews at /proof-submissions.",
  },
  {
    table: NTE_TABLE,
    webPath: NTE_WEB.plannedInboxPath,
    label: "NTE response",
    office: "discipline",
    mobileWrites: MOBILE_STUDENT_WRITES.nteResponse,
    realtimeOnWeb: true,
    webUiBuilt: true,
    notes: "Staff issues NTE from web; mobile updates response_text / response_attachments / status=responded; web reviews at /nte-responses.",
  },
];

/**
 * @param {string} table
 * @returns {MobileWorkflowEntry | undefined}
 */
export function mobileWorkflowForTable(table) {
  return MOBILE_STUDENT_WORKFLOW.find((e) => e.table === table);
}
