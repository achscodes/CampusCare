import { HSO_WORKFLOW_STATUS, normalizeWorkflowStatus } from "./hsoWorkflow";

/** @param {number | null | undefined} n */
export function formatQueueTicket(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return String(Number(n)).padStart(4, "0");
}

/** @param {{ consultationType?: string; service?: string; purpose?: string }} row */
export function appointmentServiceLabel(row) {
  const s = String(row?.consultationType || row?.service || row?.purpose || "").trim();
  return s || "Visit";
}

/** @param {object[]} rows */
export function nurseStationSnapshot(rows) {
  const mapped = rows.map((r) => ({
    ...r,
    workflowStatus: normalizeWorkflowStatus(r.workflowStatus || r.status),
  }));
  const pool = mapped.filter((r) =>
    [HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE, HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS].includes(r.workflowStatus),
  );
  const sorted = [...pool].sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0));
  const now = sorted.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS) || null;
  const waiting = sorted.filter((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE);
  const upcoming = waiting.slice(0, 4);
  const waitingCount = waiting.length;
  const estWaitMins = Math.min(45, 8 + waitingCount * 5);
  return { now, upcoming, waitingCount, estWaitMins };
}

/**
 * @param {'physician'|'dentist'} providerKey
 */
export function providerStationSnapshot(rows, providerKey) {
  const pk = String(providerKey || "").toLowerCase();
  const mapped = rows.map((r) => ({
    ...r,
    workflowStatus: normalizeWorkflowStatus(r.workflowStatus || r.status),
  }));
  const pool = mapped.filter(
    (r) =>
      [HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER, HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS].includes(r.workflowStatus) &&
      String(r.providerQueue || r.designation || "").toLowerCase() === pk,
  );
  const sorted = [...pool].sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0));
  const now = sorted.find((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS) || null;
  const waiting = sorted.filter((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER);
  const upcoming = waiting.slice(0, 4);
  const waitingCount = waiting.length;
  const estWaitMins = Math.min(60, 10 + waitingCount * 8);
  return { now, upcoming, waitingCount, estWaitMins };
}

/** Patients still in the building queue (before completion). @param {object[]} rows */
export function totalWaitingCount(rows) {
  const active = new Set([
    HSO_WORKFLOW_STATUS.CHECKED_IN,
    HSO_WORKFLOW_STATUS.QUEUED_FOR_NURSE,
    HSO_WORKFLOW_STATUS.NURSE_IN_PROGRESS,
    HSO_WORKFLOW_STATUS.QUEUED_FOR_PROVIDER,
    HSO_WORKFLOW_STATUS.PROVIDER_IN_PROGRESS,
  ]);
  return rows.filter((r) => active.has(normalizeWorkflowStatus(r.workflowStatus || r.status))).length;
}

/** @param {object[]} rows */
export function recentlyCompletedAppointments(rows, limit = 9) {
  const done = rows
    .map((r) => ({
      ...r,
      workflowStatus: normalizeWorkflowStatus(r.workflowStatus || r.status),
    }))
    .filter((r) => r.workflowStatus === HSO_WORKFLOW_STATUS.COMPLETED);
  done.sort((a, b) => {
    const ta = new Date(a.consultationCompletedAt || 0).getTime();
    const tb = new Date(b.consultationCompletedAt || 0).getTime();
    return tb - ta;
  });
  return done.slice(0, limit);
}

/** @param {string | null | undefined} iso */
export function relativeCompletedLabel(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr ago`;
}
