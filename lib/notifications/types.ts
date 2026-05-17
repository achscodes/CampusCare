export type WelfareNotificationCategory =
  | 'health'
  | 'discipline'
  | 'scholarships'
  | 'referrals'
  | 'campus';

export type NotificationSection = 'today' | 'yesterday' | 'last7' | 'last30';

export type NotificationStatusType = 'success' | 'info' | 'error';

export type NotificationItem = {
  id: string;
  category: WelfareNotificationCategory;
  title: string;
  body: string;
  /** Short relative label for scan (e.g. "2h ago"). */
  timeLabel: string;
  read: boolean;
  /** Expo Router path for deep-linking when tapped. */
  href: string;
  section?: NotificationSection;
  /** Display source label shown next to timestamp (e.g. "Discipline Office"). */
  source?: string;
  /** Drives the StatusIcon variant on the card. Defaults to 'info'. */
  notificationType?: NotificationStatusType;
};

export const NOTIFICATION_CATEGORY_LABEL: Record<WelfareNotificationCategory, string> = {
  health: 'Health',
  discipline: 'Discipline',
  scholarships: 'Scholarships',
  referrals: 'Referrals',
  campus: 'Campus',
};

export const DEFAULT_SOURCE_BY_CATEGORY: Record<WelfareNotificationCategory, string> = {
  health: 'Health Service',
  discipline: 'Discipline Office',
  scholarships: 'SDA Office',
  referrals: 'Referrals',
  campus: 'Campus',
};

/** Raw row shape returned by Supabase. */
export type NotificationRow = {
  id: string;
  user_id: string;
  category: WelfareNotificationCategory;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
  /** Populated by notifySelf — e.g. 'Discipline Office' */
  source?: string | null;
  /** Populated by notifySelf — 'success' | 'info' | 'error' */
  notification_type?: string | null;
};

const DAY_MS = 86_400_000;

export function isWithinDays(createdAt: string, days: number): boolean {
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff < days * DAY_MS;
}

export function toSection(createdAt: string): NotificationSection {
  const diff = Date.now() - new Date(createdAt).getTime();
  if (diff < DAY_MS) return 'today';
  if (diff < 2 * DAY_MS) return 'yesterday';
  if (diff < 7 * DAY_MS) return 'last7';
  return 'last30';
}

/** Lightweight relative time label — no external deps. */
export function toTimeLabel(createdAt: string): string {
  const date = new Date(createdAt);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Convert a raw Supabase row into the UI-shaped item used by the screen. */
export function toNotificationItem(row: NotificationRow): NotificationItem {
  const rawType = (row.notification_type ?? '').toLowerCase();
  const notificationType: NotificationStatusType | undefined =
    rawType === 'success' || rawType === 'error' || rawType === 'info'
      ? (rawType as NotificationStatusType)
      : undefined;
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.read_at !== null,
    section: toSection(row.created_at),
    timeLabel: toTimeLabel(row.created_at),
    source: row.source ?? DEFAULT_SOURCE_BY_CATEGORY[row.category],
    notificationType,
  };
}
