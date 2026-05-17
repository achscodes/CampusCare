import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type LogoutModalProps = {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const SCRIM_BG = 'rgba(0,0,0,0.5)';
const SHEET_BG = '#FFFFFF';
const HANDLE_BG = '#D1D5DB';
const TITLE_COLOR = '#000000';
const DESC_COLOR = '#717680';
const PRIMARY_BG = '#D92D20';
const BORDER_COLOR = '#FECDCA';
const PRIMARY_TEXT = '#FFFFFF';
const SECONDARY_TEXT = '#717680';

/**
 * Reusable bottom-sheet logout confirmation modal.
 * Manages its own enter/exit animations.
 */
export function LogoutModal({ visible, onConfirm, onCancel }: LogoutModalProps) {
  const insets = useSafeAreaInsets();
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const animateOut = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(scrimOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 400, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      sheetTranslateY.setValue(400);
      scrimOpacity.setValue(0);
      cb?.();
    });
  };

  const handleConfirm = () => animateOut(onConfirm);
  const handleCancel = () => animateOut(onCancel);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleCancel}>
      <Animated.View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: SCRIM_BG,
          opacity: scrimOpacity,
        }}>
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={handleCancel}
        />

        <Animated.View
          style={{
            transform: [{ translateY: sheetTranslateY }],
            backgroundColor: SHEET_BG,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 10,
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 24) + 8,
          }}>
          {/* Drag handle */}
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: HANDLE_BG,
              alignSelf: 'center',
              marginBottom: 28,
            }}
          />

          {/* Title */}
          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: TITLE_COLOR,
              textAlign: 'center',
              letterSpacing: -0.3,
              marginVertical: 20,
            }}>
            Are you sure?
          </Text>

          {/* Description */}
          <Text
            style={{
              fontSize: 16,
              color: DESC_COLOR,
              textAlign: 'center',
              lineHeight: 21,
              paddingHorizontal: 24,
              marginBottom: 32,
            }}>
            You'll need to use your magic link to sign back in. This action will log you out of your account.
          </Text>

          {/* Primary */}
          <Pressable
            onPress={handleConfirm}
            accessibilityRole="button"
            accessibilityLabel="Confirm log out"
            className="active:opacity-80"
            style={{
              backgroundColor: PRIMARY_BG,
              borderWidth: 1,
              borderColor: BORDER_COLOR,
              borderRadius: 28,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 16,
            }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: PRIMARY_TEXT }}>
              Yes, logout
            </Text>
          </Pressable>

          {/* Secondary */}
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            className="active:opacity-60"
            style={{
              alignItems: 'center',
              paddingVertical: 8,
            }}>
            <Text style={{ fontSize: 16, fontWeight: '500', color: SECONDARY_TEXT }}>
              Nevermind
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
