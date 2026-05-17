import { Pressable, Text, View } from 'react-native';

import { SCHEDULE_PARTNER } from '@/lib/ui/theme';
import { IconsaxLocationIcon } from '@/components/icons/IconsaxLocationIcon';
import { IconsaxFlagIcon } from '@/components/icons/IconsaxFlagIcon';
import { IconsaxClipboardTextIcon } from '@/components/icons/IconsaxClipboardTextIcon';
import { IconsaxEditIcon } from '@/components/icons/IconsaxEditIcon';
import { IconsaxProfile2UserIcon } from '@/components/icons/IconsaxProfile2UserIcon';
import { IconsaxEyeIcon } from '@/components/icons/IconsaxEyeIcon';
import { IconsaxClockIcon } from '@/components/icons/IconsaxClockIcon';
import { IconsaxCalendarIcon } from '@/components/icons/IconsaxCalendarIcon';
import { IconsaxTickCircleIcon } from '@/components/icons/IconsaxTickCircleIcon';
import type { StudentReferral, ReferralStatus, WelfareOffice, CATEGORY_LABELS } from '@/lib/referrals/types';

const T = SCHEDULE_PARTNER;

const STATUS_CONFIG: Record<ReferralStatus, {
  label: string;
  bg: string;
  text: string;
  icon: React.FC<{ size?: number; color?: string }>;
}> = {
  pending:   { label: 'Pending',    bg: 'rgba(234,179,8,0.12)',  text: '#92400E', icon: IconsaxClockIcon             },
  in_review: { label: 'In Review',  bg: 'rgba(41,112,255,0.10)', text: '#1D4ED8', icon: IconsaxEyeIcon              },
  scheduled: { label: 'Scheduled',  bg: 'rgba(16,185,129,0.12)', text: '#065F46', icon: IconsaxCalendarIcon         },
  completed: { label: 'Completed',  bg: 'rgba(16,185,129,0.12)', text: '#065F46', icon: IconsaxTickCircleIcon        },
  cancelled: { label: 'Cancelled',  bg: T.segmentTrackBg,        text: T.textDisabled, icon: IconsaxEyeIcon             },
};

function timeAgo(date: Date): string {
  const diffMs   = Date.now() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHrs  = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSecs < 60)  return 'Just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  if (diffHrs  < 24)  return `${diffHrs}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)   return `${diffDays} days ago`;
  if (diffDays < 30)  return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

type Props = { referral: StudentReferral; onPress?: () => void };

// Helper to get office display name
function getOfficeLabel(office: WelfareOffice): string {
  const labels: Record<WelfareOffice, string> = {
    HSO: 'Health Service Office',
    SDAO: 'Student Development and Activities Office',
    DO: 'Discipline Office',
  };
  return labels[office] ?? office;
}

// Helper to get category display name
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    mental_health: 'Mental Health',
    physical_health: 'Physical Health',
    behavioral: 'Behavioral',
    academic: 'Academic Concern',
    family_issue: 'Family Issue',
    bullying: 'Bullying',
    disciplinary: 'Disciplinary',
    financial: 'Financial',
    other: 'Other',
  };
  return labels[category] ?? category.replace('_', ' ');
}

export function ReferralCard({ referral, onPress }: Props) {
  const status = STATUS_CONFIG[referral.status];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        borderRadius: T.radius,
        borderWidth: 1,
        borderColor: T.cardBorder,
        backgroundColor: T.surface,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 20,
        gap: 12,
      }}
      className="active:opacity-92">

      {/* ── Title row ────────────────────────────── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: T.textPrimary, letterSpacing: -0.3 }}>
            {getCategoryLabel(referral.category)}
          </Text>
          <Text style={{ fontSize: 12, color: T.textDisabled, marginTop: 2 }}>
            {referral.referenceId} • {timeAgo(new Date(referral.createdAt))}
          </Text>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 5,
          borderRadius: 999, backgroundColor: status.bg,
          paddingHorizontal: 10, paddingVertical: 5,
        }}>
          <status.icon size={13} color={status.text} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: status.text }}>{status.label}</Text>
        </View>
      </View>

      {/* Separator */}
      <View style={{ height: 1, backgroundColor: T.divider }} />

      {/* ── From / To ────────────────────────────── */}
      <View style={{ gap: 12, marginHorizontal: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <IconsaxLocationIcon size={20} color={T.textDisabled} />
          <View>
            <Text style={{ fontSize: 12, color: T.textDisabled }}>From</Text>
            <Text style={{ fontSize: 14, color: T.textPrimary, marginTop: 1 }}>{getOfficeLabel(referral.fromService)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <IconsaxFlagIcon size={20} color={T.textDisabled} />
          <View>
            <Text style={{ fontSize: 12, color: T.textDisabled }}>To</Text>
            <Text style={{ fontSize: 14, color: T.textPrimary, marginTop: 1 }}>{getOfficeLabel(referral.toService)}</Text>
          </View>
        </View>
      </View>

      {/* Separator */}
      <View style={{ height: 1, backgroundColor: T.divider }} />

      {/* ── Referral details ─────────────────────── */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: T.textPrimary }}>Referral details</Text>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: T.segmentTrackBg,
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <IconsaxClipboardTextIcon size={18} color={T.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: T.textPrimary, marginBottom: 6 }}>Reason</Text>
          <Text style={{ fontSize: 14, color: T.textMuted, lineHeight: 20 }}>
            {referral.reason}
          </Text>
        </View>
      </View>

      {/* ── Appointment ────────────────────────────────── */}
      {referral.appointmentDate ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 }}>
          <View style={{ width: 36 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: T.textPrimary, marginBottom: 6 }}>Appointment</Text>
            <Text style={{ fontSize: 14, color: T.textMuted, lineHeight: 20 }}>
              {new Date(referral.appointmentDate).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Notes ────────────────────────────────── */}
      {referral.studentNotes ? (
        <>
          {/* Separator */}
          <View style={{ height: 1, backgroundColor: T.divider, marginTop: 4 }} />

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: T.segmentTrackBg,
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <IconsaxEditIcon size={18} color={T.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: T.textPrimary, marginBottom: 6 }}>Note</Text>
            <Text style={{ fontSize: 14, color: T.textMuted, lineHeight: 20 }}>{referral.studentNotes}</Text>
          </View>
        </View>
        </>
      ) : null}
    </Pressable>
  );
}
