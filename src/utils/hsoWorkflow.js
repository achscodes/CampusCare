export const HSO_WORKFLOW_STATUS = {
  BOOKED: "booked",
  CHECKIN_WINDOW_OPEN: "checkin_window_open",
  CHECKED_IN: "checked_in",
  QUEUED_FOR_NURSE: "queued_for_nurse",
  NURSE_IN_PROGRESS: "nurse_in_progress",
  QUEUED_FOR_PROVIDER: "queued_for_provider",
  PROVIDER_IN_PROGRESS: "provider_in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
  EXPIRED_CODE: "expired_code",
};

export function normalizeWorkflowStatus(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return HSO_WORKFLOW_STATUS.BOOKED;
  const all = Object.values(HSO_WORKFLOW_STATUS);
  return all.includes(v) ? v : HSO_WORKFLOW_STATUS.BOOKED;
}

export function statusLabel(status) {
  const s = normalizeWorkflowStatus(status);
  if (s === HSO_WORKFLOW_STATUS.CHECKIN_WINDOW_OPEN) return "Check-in Open";
  return s.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function consultationTypeOptions() {
  return [
    "General Check-up",
    "Fever/Flu Symptoms",
    "Pain or Injury",
    "Stress/Mental Health",
    "Digestive Issues",
    "Something Else",
  ];
}

export function designationToService(designation) {
  const d = String(designation || "").toLowerCase();
  if (d === "dentist") return "Dental Consultation";
  return "Physician Consultation";
}

export function generateCheckinCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function computeCheckinWindow(dateIso, time) {
  if (!dateIso || !time) return { validFrom: null, validUntil: null };
  const start = new Date(`${dateIso}T${time}:00`);
  if (Number.isNaN(start.getTime())) return { validFrom: null, validUntil: null };
  const validFrom = new Date(start.getTime() - 60 * 60 * 1000);
  const validUntil = start;
  return { validFrom, validUntil };
}

export function nowInWindow(validFromIso, validUntilIso) {
  const n = Date.now();
  const from = validFromIso ? new Date(validFromIso).getTime() : Number.NEGATIVE_INFINITY;
  const until = validUntilIso ? new Date(validUntilIso).getTime() : Number.POSITIVE_INFINITY;
  return n >= from && n <= until;
}
