import type { SlotPeriod, TimeSlot } from './types';

const PERIOD_WINDOWS: Record<SlotPeriod, { start: string; end: string }> = {
  morning: { start: '8:00 AM', end: '11:30 AM' },
  afternoon: { start: '12:00 PM', end: '4:00 PM' },
  evening: { start: '4:30 PM', end: '7:00 PM' },
  night: { start: '7:30 PM', end: '9:00 PM' },
};

/** Deterministic “working today” from staff id + calendar day. */
export function isStaffWorkingOnDate(staffId: string, day: Date): boolean {
  const seed = staffId.charCodeAt(staffId.length - 1) + day.getFullYear() * 373 + day.getMonth() * 31 + day.getDate();
  return seed % 4 !== 0;
}

function hashSlotBooked(staffId: string, dateKey: string, label: string): boolean {
  let h = 0;
  const s = `${staffId}|${dateKey}|${label}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 5 === 0;
}

/** Mock slot rows for a day (used for hub “availability” summary). */
export function buildDaySlots(staffId: string, dateKey: string, day: Date): TimeSlot[] {
  const working = isStaffWorkingOnDate(staffId, day);
  if (!working) return [];

  const periods: SlotPeriod[] = ['morning', 'afternoon', 'evening', 'night'];
  const out: TimeSlot[] = [];

  for (const period of periods) {
    const { start, end } = PERIOD_WINDOWS[period];
    const booked = hashSlotBooked(staffId, dateKey, period) ? 1 : 0;
    out.push({ period, start, end, capacity: 6, booked });
  }
  return out;
}

/** Single-line typical clinic window for mock UI (all periods combined). */
export function getClinicPublicHoursSummary(): string {
  const first = PERIOD_WINDOWS.morning.start;
  const last = PERIOD_WINDOWS.night.end;
  return `${first} – ${last}`;
}

export function getSlotLabelsForPeriod(
  staffId: string,
  dateKey: string,
  period: SlotPeriod,
): string[] {
  const templates: Record<SlotPeriod, string[]> = {
    morning: ['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM'],
    afternoon: ['12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM'],
    evening: ['4:30 PM', '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM'],
    night: ['7:30 PM', '8:00 PM', '8:30 PM'],
  };
  const labels = templates[period];
  return labels.filter((_, i) => !hashSlotBooked(staffId, dateKey, `${period}-${i}`));
}
