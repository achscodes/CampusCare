import { forwardRef, ReactNode, useCallback, useImperativeHandle, useState } from 'react';
import {
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  onClose: () => void;
  /** Extra bottom padding inside the sheet (on top of safe area). Default: 24 */
  bottomPadding?: number;
  /** Whether tapping outside dismisses the sheet. Default: true */
  dismissOnBackdropPress?: boolean;
};

export type BottomSheetModalHandle = {
  /** Play the dismiss animation, then run optional callback (e.g. navigate). */
  dismiss: (afterClose?: () => void) => void;
};

/**
 * Custom bottom sheet modal powered by react-native-reanimated.
 * All animations run on the UI thread so a heavy React tree won't drop frames.
 *
 * Flow:
 * 1. Sheet mounts hidden (opacity 0) while offscreen at translateY 1000.
 * 2. onLayout fires with the real height → translateY snaps to that height
 *    and opacity flips to 1 in the same UI-thread frame.
 * 3. A spring animates translateY to 0 and the backdrop fades in.
 */
export const BottomSheetModal = forwardRef<BottomSheetModalHandle, Props>(function BottomSheetModal(
  { children, onClose, bottomPadding = 24, dismissOnBackdropPress = true },
  ref,
) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(1000);
  const sheetOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const [measured, setMeasured] = useState(false);
  const [ready, setReady] = useState(false);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (measured) return;
      const h = e.nativeEvent.layout.height;
      setMeasured(true);

      // Jump to off-screen position + reveal, then spring in.
      translateY.value = h;
      sheetOpacity.value = 1;
      backdropOpacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
      translateY.value = withSpring(
        0,
        { damping: 26, stiffness: 180, mass: 1, overshootClamping: true },
        (finished) => {
          if (finished) runOnJS(setReady)(true);
        },
      );
    },
    [measured, translateY, sheetOpacity, backdropOpacity],
  );

  const handleDismiss = useCallback(
    (afterClose?: () => void) => {
      backdropOpacity.value = withTiming(0, { duration: 240, easing: Easing.in(Easing.quad) });
      translateY.value = withTiming(
        1000,
        { duration: 280, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (!finished) return;
          if (afterClose) runOnJS(afterClose)();
          else runOnJS(onClose)();
        },
      );
    },
    [translateY, backdropOpacity, onClose],
  );

  useImperativeHandle(ref, () => ({ dismiss: handleDismiss }), [handleDismiss]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const sheet = (
    <Animated.View
      onLayout={handleLayout}
      style={[
        styles.sheet,
        { paddingBottom: Math.max(insets.bottom, 12) + bottomPadding },
        sheetStyle,
      ]}>
      <View style={styles.handle} />
      {children}
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdropPress ? () => handleDismiss() : undefined}
          accessibilityRole="button"
          accessibilityLabel="Close modal"
        />
      </Animated.View>

      {ready && Platform.OS === 'ios' ? (
        <KeyboardAvoidingView behavior="padding" pointerEvents="box-none" style={styles.keyboardWrap}>
          {sheet}
        </KeyboardAvoidingView>
      ) : (
        <View pointerEvents="box-none" style={styles.keyboardWrap}>
          {sheet}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  keyboardWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 20,
  },
});
