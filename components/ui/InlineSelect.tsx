import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppInput } from './AppInput';
import { IconsaxArrowDownIcon } from '@/components/icons/IconsaxArrowDownIcon';

const BRAND = '#2970FF';
const BORDER = '#E9EAEB';
const TEXT = '#252B37';
const MUTED = '#717680';
const BG_SELECTED = '#F5F8FF';

type Props<T extends string> = {
  placeholder?: string;
  /** Current selected value */
  value?: T | '';
  /** Option list */
  options: readonly T[];
  /** Error message shown beneath field */
  error?: string;
  /** Fires on option select */
  onChange: (value: T) => void;
  /** Controlled open state (optional) */
  open?: boolean;
  /** Fires when the user toggles the dropdown */
  onOpenChange?: (open: boolean) => void;
  /** Disable interaction */
  disabled?: boolean;
};

/**
 * Inline dropdown — expands a list directly beneath the trigger field.
 * Matches the visual language of `AppInput`. Can be fully controlled via
 * `open` / `onOpenChange` so a parent can ensure only one dropdown opens
 * at a time.
 */
export function InlineSelect<T extends string>({
  placeholder,
  value,
  options,
  error,
  onChange,
  open,
  onOpenChange,
  disabled,
}: Props<T>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? !!open : uncontrolledOpen;

  const chevronAnim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(chevronAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [chevronAnim, isOpen]);

  const rotation = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const toggle = () => {
    if (disabled) return;
    const next = !isOpen;
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const close = () => {
    if (!isControlled) setUncontrolledOpen(false);
    onOpenChange?.(false);
  };

  const select = (opt: T) => {
    onChange(opt);
    close();
  };

  return (
    <View>
      <Pressable onPress={toggle} accessibilityRole="button" disabled={disabled}>
        <View pointerEvents="none">
          <AppInput
            placeholder={placeholder}
            value={value}
            error={error}
            editable={false}
            suffix={
              <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                <IconsaxArrowDownIcon size={16} color={MUTED} />
              </Animated.View>
            }
            suffixDivider
          />
        </View>
      </Pressable>

      {isOpen ? (
        <View style={styles.panel}>
          {options.map((opt, i) => {
            const selected = value === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => select(opt)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={({ pressed }) => [
                  styles.row,
                  i < options.length - 1 && styles.rowDivider,
                  selected && styles.rowSelected,
                  pressed && !selected && styles.rowPressed,
                ]}>
                <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]} numberOfLines={2}>
                  {opt}
                </Text>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F2F3F5',
  },
  rowSelected: { backgroundColor: BG_SELECTED },
  rowPressed: { backgroundColor: '#F9FAFB' },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: TEXT, letterSpacing: -0.14 },
  rowLabelSelected: { color: BRAND, fontWeight: '600' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: BRAND, backgroundColor: BRAND },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
});
