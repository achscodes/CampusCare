import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { StatusIcon } from '@/components/icons/StatusIcon';
import { DEFAULT_SOURCE_BY_CATEGORY } from '@/lib/notifications/types';
import type { NotificationItem, NotificationStatusType } from '@/lib/notifications/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

export type NotificationListRowProps = {
  item: NotificationItem;
  onArchive: (id: string) => void;
  onMarkRead: (id: string) => void;
  isLast: boolean;
  /** When set, the card slides out to the left after this delay (ms), then calls onArchive */
  animateOutDelay?: number;
};

function resolveVariant(type?: NotificationStatusType): 'success' | 'info' | 'error' {
  if (type === 'success' || type === 'error') return type;
  return 'info';
}

/** Three horizontal dots as SVG circles */
function ThreeDotIcon() {
  return (
    <Svg width={18} height={8} viewBox="0 0 18 8">
      <Circle cx={2}  cy={4} r={1.6} fill="#717680" />
      <Circle cx={9}  cy={4} r={1.6} fill="#717680" />
      <Circle cx={16} cy={4} r={1.6} fill="#717680" />
    </Svg>
  );
}

export function NotificationListRow({
  item,
  onArchive,
  onMarkRead,
  isLast,
  animateOutDelay,
}: NotificationListRowProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (animateOutDelay === undefined) return;
    translateX.value = withDelay(
      animateOutDelay,
      withTiming(
        -SCREEN_WIDTH,
        { duration: 300, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onArchive)(item.id);
        },
      ),
    );
  }, [animateOutDelay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleMarkRead = () => {
    setMenuVisible(false);
    onMarkRead(item.id);
  };

  const handleArchive = () => {
    setMenuVisible(false);
    onArchive(item.id);
  };

  const variant = resolveVariant(item.notificationType);

  return (
    <>
      {/* ── Card ── */}
      <Animated.View style={animatedStyle}>
      <View
        style={{
          marginBottom: isLast ? 0 : 8,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#F5F5F5',
          backgroundColor: item.read ? '#FFFFFF' : 'rgba(245,248,255,0.9)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 20,
          paddingLeft: 18,
          paddingRight: 12,
          paddingVertical: 20,
        }}>

        {/* ── Left: Status icon (size=40 → 32px icon + 4px padding renders the bg+ring) ── */}
        <View style={{ flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>
          <StatusIcon variant={variant} size={40} />
        </View>

        {/* ── Right: Content column, gap 4 per Figma ── */}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>

          {/* Row A: title sub-col + three-dot */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', width: '100%' }}>

            {/* Title + time·source stacked, flex:1 */}
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              {/* Title — Inter Medium 14, auto-capitalized */}
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  letterSpacing: -0.28,
                  color: '#181D27',
                  textTransform: 'capitalize',
                }}>
                {item.title}
              </Text>

              {/* time · source — single Text guarantees both always render */}
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, fontWeight: '400', color: '#717680' }}>
                {`${item.timeLabel}  •  ${item.source ?? DEFAULT_SOURCE_BY_CATEGORY[item.category] ?? 'CampusCare'}`}
              </Text>
            </View>

            {/* Three-dot button — shrink-0, 24×12 hit area */}
            <TouchableOpacity
              onPress={() => setMenuVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="More options"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ flexShrink: 0, marginLeft: 8, paddingTop: 2 }}>
              <ThreeDotIcon />
            </TouchableOpacity>
          </View>

          {/* Row B: Body — Inter Light 14 */}
          <Text
            numberOfLines={3}
            style={{
              fontSize: 14,
              fontWeight: '300',
              letterSpacing: -0.56,
              color: '#000000',
              lineHeight: 20,
            }}>
            {item.body}
          </Text>

        </View>
      </View>
      </Animated.View>

      {/* ── Three-dot bottom-sheet modal ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
          onPress={() => setMenuVisible(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 12,
              paddingBottom: 40,
              paddingHorizontal: 24,
            }}>
            {/* Handle */}
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#D0D5DD',
                marginBottom: 24,
              }}
            />
            {/* Notification title */}
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12,
                fontWeight: '500',
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: '#717680',
                marginBottom: 8,
              }}>
              {item.title}
            </Text>

            {/* Mark as read */}
            {!item.read && (
              <TouchableOpacity
                onPress={handleMarkRead}
                accessibilityRole="button"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 16,
                  borderTopWidth: 1,
                  borderTopColor: '#F5F5F5',
                  gap: 14,
                }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#F0FDF4',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ fontSize: 18, lineHeight: 22 }}>✓</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '500', color: '#181D27' }}>
                  Mark as read
                </Text>
              </TouchableOpacity>
            )}

            {/* Archive */}
            <TouchableOpacity
              onPress={handleArchive}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                borderTopWidth: 1,
                borderTopColor: '#F5F5F5',
                gap: 14,
              }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#FFF1F0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontSize: 18, lineHeight: 22 }}>🗑</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '500', color: '#EF4444' }}>
                Archive
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
