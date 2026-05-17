import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconsaxHeartIcon } from '../icons/IconsaxHeartIcon';
import { SCHEDULE_PARTNER } from '../../lib/health-service/bookingScheduleTheme';
import type { Staff } from '../../lib/health-service/types';

const AVATAR_SIZE = 72;

function roleKindLabel(role: Staff['role']): string {
  if (role === 'doctor') return 'Doctor';
  if (role === 'dentist') return 'Dentist';
  return 'Nurse';
}

function initials(name: string): string {
  const parts = name.replace(/^Dr\.\s+/i, '').split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '?';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

export type ProviderCardProps = {
  staff: Staff;
  /** When true, show as available on today's schedule (shown as “available now” in the UI). */
  availableToday: boolean;
  saved?: boolean;
  onToggleSave?: () => void;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ProviderCard({ staff, availableToday, saved = false, onToggleSave, onPress, style }: ProviderCardProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(staff.photoUrl) && !photoFailed;

  useEffect(() => {
    setPhotoFailed(false);
  }, [staff.id, staff.photoUrl]);

  const statusLabel = availableToday ? 'Available now' : 'Unavailable';
  const statusColor = availableToday ? '#15803D' : SCHEDULE_PARTNER.textMuted;
  const dotColor = availableToday ? '#22C55E' : SCHEDULE_PARTNER.textDisabled;
  const rating = staff.rating ?? 4.8;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${staff.name}, ${roleKindLabel(staff.role)}, ${rating} stars, ${statusLabel}. Tap to view profile and book.`}
      onPress={onPress}
      style={[{ width: '100%', aspectRatio: 1, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: '#F8FAFC' }, style]}
      className="active:opacity-92">
      <View
        style={{
          flex: 2,
          backgroundColor: '#F8FAFC',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 14,
          paddingRight: 8,
          paddingTop: 12,
          gap: 12,
        }}>
        <View
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: SCHEDULE_PARTNER.segmentTrackBg,
            borderWidth: 1,
            borderColor: SCHEDULE_PARTNER.segmentTrackBorder,
          }}>
          {showPhoto ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: staff.photoUrl! }}
              onError={() => setPhotoFailed(true)}
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '600', color: SCHEDULE_PARTNER.textMuted }}>{initials(staff.name)}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1, alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 2 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? `Remove ${staff.name} from saved` : `Save ${staff.name}`}
            accessibilityState={{ selected: saved }}
            hitSlop={10}
            onPress={() => onToggleSave?.()}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="active:opacity-85">
            <IconsaxHeartIcon size={20} filled={saved} color={saved ? '#EF4444' : SCHEDULE_PARTNER.textMuted} />
          </Pressable>
        </View>
      </View>

      <View
        style={{
          flex: 2,
          paddingHorizontal: 10,
          paddingTop: 4,
          paddingBottom: 10,
          justifyContent: 'space-between',
        }}>
        <View style={{ gap: 2, marginHorizontal: 4}}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: SCHEDULE_PARTNER.textPrimary, letterSpacing: -0.2 }} numberOfLines={2}>
            {staff.name}
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '500', color: SCHEDULE_PARTNER.textMuted, letterSpacing: 0.15 }}>
            {roleKindLabel(staff.role)}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 4,
            paddingHorizontal: 4,
            gap: 8,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, paddingRight: 8 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: dotColor,
              }}
            />
            <Text style={{ fontSize: 11, fontWeight: '600', color: statusColor }} numberOfLines={1}>
              {statusLabel}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
              paddingLeft: 8,
              paddingRight: 6,
            }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <Ionicons name="star-outline" size={14} color={SCHEDULE_PARTNER.textMuted} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: SCHEDULE_PARTNER.textMuted }}>{rating.toFixed(1)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
