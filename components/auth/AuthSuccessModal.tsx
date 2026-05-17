import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type AuthSuccessModalProps = {
  visible: boolean;
  onClose: () => void;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  iconBg?: string;
  title: string;
  message: string;
  buttonLabel: string;
};

export function AuthSuccessModal({
  visible,
  onClose,
  icon,
  iconColor = '#2970FF',
  iconBg = 'rgba(41,112,255,0.08)',
  title,
  message,
  buttonLabel,
}: AuthSuccessModalProps) {
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 18, stiffness: 260, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const close = () => {
    Animated.parallel([
      Animated.timing(scrimOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.85, duration: 180, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      scrimOpacity.setValue(0);
      scale.setValue(0.85);
      contentOpacity.setValue(0);
      onClose();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          opacity: scrimOpacity,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
        }}>
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={close}
        />

        <Animated.View
          style={{
            transform: [{ scale }],
            opacity: contentOpacity,
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            paddingTop: 32,
            paddingBottom: 24,
            paddingHorizontal: 24,
            width: '100%',
            maxWidth: 340,
            alignItems: 'center',
          }}>
          {/* Icon */}
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: iconBg,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
            <Ionicons name={icon} size={32} color={iconColor} />
          </View>

          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: '#181D27',
              textAlign: 'center',
              letterSpacing: -0.3,
              marginBottom: 8,
            }}>
            {title}
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: '#535862',
              textAlign: 'center',
              lineHeight: 21,
              marginBottom: 28,
            }}>
            {message}
          </Text>

          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={buttonLabel}
            className="active:opacity-80"
            style={{
              backgroundColor: '#2970FF',
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
              width: '100%',
            }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
              {buttonLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
