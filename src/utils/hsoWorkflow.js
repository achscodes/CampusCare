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

/** Next sequential check-in code for local/mock inserts (DB uses default on real inserts). */
export function formatCheckinCodeFromNumber(n) {
  const num = Math.max(1, Math.floor(Number(n) || 1));
  return `CH-${String(num).padStart(4, "0")}`;
}

/**
 * Normalize for comparison: legacy 6-digit numeric codes, or CH- / CH0001 → CH-0001.
 * Also maps plain digits (e.g. "1" / "0001" from mobile or DB) to CH-####.
 * @param {string} value
 */
export function normalizeCheckinCode(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const u = raw.toUpperCase().replace(/\s+/g, "");
  const ch = u.match(/^CH-?(\d+)$/);
  if (ch) return `CH-${ch[1].padStart(4, "0")}`;
  if (/^\d{6}$/.test(u)) return u;
  if (/^\d{1,8}$/.test(u)) return `CH-${u.padStart(4, "0")}`;
  return u;
}

/** Values to try in DB lookup (CH-0001 vs 0001 vs 1). */
export function checkinLookupVariants(normalizedCode) {
  const code = String(normalizedCode || "").trim();
  if (!code) return [];
  const out = new Set([code]);
  const ch = code.match(/^CH-(\d+)$/);
  if (ch) {
    const n = ch[1];
    out.add(n);
    const stripped = n.replace(/^0+/, "") || "0";
    out.add(stripped);
  }
  return [...out];
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
