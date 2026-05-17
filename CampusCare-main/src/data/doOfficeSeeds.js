/** Local + offline-first seeds — empty by default; data comes from Supabase or user entry. */

export const DO_STUDENT_RECORDS_SEED = [];

export const DO_DOCUMENT_REQUESTS_SEED = [
  {
    requestId: "DR-2026-001",
    requestingOffice: "health",
    targetOffice: "discipline",
    studentName: "Chad Kurt Loza",
    studentId: "2024-20311",
    program: "BS Information Technology",
    documentType: "Behavior Incident Summary",
    priority: "high",
    status: "pending_partner",
    description: "Linked to Health referral HRF-2026-001 for coordinated case handling.",
    evidence: [],
    requestedAtIso: new Date().toISOString(),
  },
  {
    requestId: "DR-2026-002",
    requestingOffice: "discipline",
    targetOffice: "health",
    studentName: "Arielle Trisha Gula",
    studentId: "2022-10341",
    program: "BS Psychology",
    documentType: "Medical Clearance Copy",
    priority: "medium",
    status: "approved_partner",
    description: "For DO conference packet and cross-office support planning.",
    evidence: [],
    requestedAtIso: new Date().toISOString(),
  },
];

export const DO_REFERRALS_SEED = [];

export const DO_SANCTIONS_SEED = [];

export const DO_CONFERENCES_SEED = [];
