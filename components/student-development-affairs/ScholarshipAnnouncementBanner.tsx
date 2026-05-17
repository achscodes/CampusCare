import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconsaxMegaphoneIcon } from '@/components/icons/IconsaxMegaphoneIcon';

/** Brand blue used across CampusCare (CTAs, icons, accents). */
const BRAND_BLUE = '#2970FF';
const BRAND_BLUE_SURFACE = '#F0F7FF';

const VARIANT_STYLES = {
  /** Figma 1265:4436 — warning surface + amber accent. */
  warning: {
    background: '#FFFCF5',
    border: '#FDB022',
    icon: '#FDB022',
  },
  /** Default — soft tint + `#2970FF` border & icon (same as app buttons / links). */
  info: {
    background: BRAND_BLUE_SURFACE,
    border: BRAND_BLUE,
    icon: BRAND_BLUE,
  },
} as const;

export type ScholarshipAnnouncementBannerVariant = keyof typeof VARIANT_STYLES;

export type ScholarshipAnnouncementBannerProps = {
  variant?: ScholarshipAnnouncementBannerVariant;
  title?: string;
  message: string;
  className?: string;
  /** When false, the close control is hidden. @default true */
  dismissible?: boolean;
  /** Called after the user dismisses the banner (local hide + optional side effects). */
  onDismiss?: () => void;
};

/**
 * Announcement callout under the scholarships search — default `info` uses brand `#2970FF`.
 */
const CLOSE_ICON_COLOR = '#535862';

export function ScholarshipAnnouncementBanner({
  variant = 'info',
  title = 'Announcement',
  message,
  className,
  dismissible = true,
  onDismiss,
}: ScholarshipAnnouncementBannerProps) {
  const t = VARIANT_STYLES[variant];
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  if (dismissed) {
    return null;
  }

  return (
    <View
      className={`overflow-hidden rounded-xl pl-[13px] pr-4 py-4 ${className ?? ''}`}
      style={{
        backgroundColor: t.background,
        borderLeftWidth: 3,
        borderLeftColor: t.border,
        borderTopWidth: 1,
        borderTopColor: '#FFFFFF',
        borderRightWidth: 1,
        borderRightColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#FFFFFF',
        borderRadius: 10,
      }}>
      <View className="flex-row gap-4">
        <View className="pt-1 ml-1">
          <IconsaxMegaphoneIcon size={24} color={t.icon} />
        </View>
        <View className="min-w-0 flex-1 gap-2">
          <View className="flex-row items-start gap-2">
            <Text className="min-w-0 flex-1 pr-1 text-lg font-semibold leading-6 text-[#1F2024]">{title}</Text>
            {dismissible ? (
              <Pressable
                accessibilityLabel="Dismiss announcement"
                accessibilityRole="button"
                className="-mr-1 -mt-0.5 shrink-0 rounded-full p-1.5 active:opacity-60"
                hitSlop={10}
                onPress={handleDismiss}>
                <Ionicons name="close" size={22} color={CLOSE_ICON_COLOR} />
              </Pressable>
            ) : null}
          </View>
          <Text className="text-sm leading-6 text-[#535862]">{message}</Text>
        </View>
      </View>
    </View>
  );
}
