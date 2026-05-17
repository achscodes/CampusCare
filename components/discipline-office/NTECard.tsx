import { Pressable, Text, View } from 'react-native';

import { IconsaxTimerIcon } from '@/components/icons/IconsaxTimerIcon';
import { Ionicons } from '@expo/vector-icons';

export type NTEStatus = 'pending_response' | 'responded' | 'waived' | 'escalated';

export type NTECardProps = {
  id: string;
  caseType: string;
  description: string;
  issuedAtLabel: string;
  deadlineLabel?: string;
  status: NTEStatus;
  isOverdue?: boolean;
  onRespond?: () => void;
  /** `nested` — soft tile on tinted list panel. `default` — outlined card. */
  variant?: 'default' | 'nested';
  /** Formatted label showing when the response was submitted */
  respondedAtLabel?: string;
  /** Formatted label showing when the NTE was waived */
  waivedAtLabel?: string;
};

export function NTECard({
  id,
  caseType,
  description,
  issuedAtLabel,
  deadlineLabel,
  status,
  isOverdue,
  onRespond,
  variant = 'default',
  respondedAtLabel,
  waivedAtLabel,
}: NTECardProps) {
  const isPending = status === 'pending_response';

  return (
    <View
      style={{
        borderRadius: variant === 'nested' ? 12 : 16,
        backgroundColor: '#FAFAFA',
        padding: 20,
        gap: 20,
        borderWidth: 1,
        borderColor: '#F5F5F5',
      }}>
      {/* Header section */}
      <View style={{ gap: 12 }}>
        <View style={{ gap: 8 }}>
          {/* Title row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text
              style={{
                flex: 1,
                fontSize: 20,
                fontWeight: '600',
                color: '#000000',
                letterSpacing: -0.32,
              }}>
              {caseType}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '400',
                color: '#414651',
                letterSpacing: -0.24,
              }}>
              {issuedAtLabel}
            </Text>
          </View>

          {/* Description */}
          <Text
            style={{
              fontSize: 14,
              fontWeight: '400',
              color: '#717680',
              lineHeight: 16,
            }}>
            {description}
          </Text>
        </View>

        {/* Tags */}
        <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          {/* Deadline tag with timer icon */}
          {deadlineLabel && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#F5F5F5',
                borderRadius: 9999,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}>
              <IconsaxTimerIcon size={16} color="#252B37" />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: '#252B37',
                  letterSpacing: -0.24,
                }}>
                Due {deadlineLabel}
              </Text>
            </View>
          )}

          {/* Status tag */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#F5F5F5',
              borderRadius: 9999,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: '#252B37',
                letterSpacing: -0.24,
              }}>
              {isOverdue ? 'Overdue' : 'Minor Case'}
            </Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: '#E9EAEB' }} />

      {/* CTA Button */}
      {isPending && onRespond && (
        <Pressable
          onPress={onRespond}
          style={{
            backgroundColor: '#2970FF',
            borderWidth: 2,
            borderColor: '#84ADFF',
            borderRadius: 24,
            paddingHorizontal: 12,
            paddingVertical: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="active:opacity-80">
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: '#FFFFFF',
              letterSpacing: -0.28,
            }}>
            Explain my side
          </Text>
        </Pressable>
      )}

      {/* Submitted footer */}
      {status === 'responded' && respondedAtLabel && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="checkmark" size={16} color="#717680" />
          <Text
            style={{
              fontSize: 12,
              fontWeight: '400',
              color: '#717680',
            }}>
            Submitted at {respondedAtLabel}
          </Text>
        </View>
      )}

      {/* Waived footer */}
      {status === 'waived' && waivedAtLabel && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="checkmark" size={16} color="#717680" />
          <Text
            style={{
              fontSize: 12,
              fontWeight: '400',
              color: '#717680',
            }}>
            Waived at {waivedAtLabel}
          </Text>
        </View>
      )}
    </View>
  );
}
