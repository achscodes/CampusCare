import type { Appointment } from './types';

/** Stable ticket-style label, e.g. `Patient #1` (not a real name). */
export function getPatientTicketLabel(appointmentId: string): string {
  const m = /^ap-(\d+)$/.exec(appointmentId);
  if (m) {
    const raw = Number(m[1]);
    if (Number.isFinite(raw)) {
      const n = ((raw - 1) % 99) + 1;
      return `Patient #${n}`;
    }
  }
  let h = 0;
  for (let i = 0; i < appointmentId.length; i++) h = (h * 31 + appointmentId.charCodeAt(i)) | 0;
  return `Patient #${(Math.abs(h) % 99) + 1}`;
}

export function parseAppointmentDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map((n) => Number(n));
  return new Date(y, m - 1, d);
}

/** e.g. "Wed, Apr 16 · 10:40 AM" */
export function formatAppointmentWhen(a: Appointment): string {
  const day = parseAppointmentDateKey(a.dateKey);
  const datePart = day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${datePart} · ${a.startLabel}`;
}

/** Long date for ticket-style layouts, e.g. "Wednesday, April 16, 2026" */
export function formatAppointmentDateLong(a: Appointment): string {
  const day = parseAppointmentDateKey(a.dateKey);
  return day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
