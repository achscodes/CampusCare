import { forwardRef, ReactNode, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

const BRAND   = '#2970FF';
const ERROR   = '#F04438';
const BORDER  = '#E9EAEB';
const TEXT    = '#252B37';
const MUTED   = '#717680';
const LABEL   = '#414651';
const BG      = '#FFFFFF';

/**
 * Character set presets for the input:
 * - `text`       → any characters (default)
 * - `numeric`    → digits only `0-9`
 * - `alpha`      → letters only `a-zA-Z` (plus space)
 * - `alphanumeric` → letters + digits (plus space)
 * - `email`      → letters, `@ . _ - +` (no digits, no spaces)
 */
export type AppInputType = 'text' | 'numeric' | 'alpha' | 'alphanumeric' | 'email';

const FILTERS: Record<AppInputType, RegExp | null> = {
  text: null,
  numeric: /[^0-9]/g,
  alpha: /[^a-zA-Z ]/g,
  alphanumeric: /[^a-zA-Z0-9 ]/g,
  email: /[^a-zA-Z@._\-+]/g,
};

export type AppInputProps = Omit<TextInputProps, 'style'> & {
  /** Label shown above the field */
  label?: string;
  /** Helper/description text shown below the field */
  description?: string;
  /** Error message — overrides description and applies error styling */
  error?: string;
  /** Element rendered inside the field to the LEFT of the input (icon or element) */
  prefix?: ReactNode;
  /** Element rendered inside the field to the RIGHT of the input (icon or element) */
  suffix?: ReactNode;
  /** Show a thin vertical separator between prefix and input */
  prefixDivider?: boolean;
  /** Show a thin vertical separator between input and suffix */
  suffixDivider?: boolean;
  /** Disables interaction + greys out the field */
  disabled?: boolean;
  /** Restrict which characters can be typed. Default: `text` (no restriction) */
  inputType?: AppInputType;
  /** Custom regex of characters to DISALLOW (overrides `inputType`). Matched chars are stripped. */
  disallowPattern?: RegExp;
  /** Override container style (outer wrapper) */
  containerStyle?: ViewStyle;
  /** Override input row style */
  fieldStyle?: ViewStyle;
};

/**
 * Reusable text input with prefix/suffix slots, optional dividers,
 * description/error text, and polished focus UX.
 */
export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInput(
  {
    label,
    description,
    error,
    prefix,
    suffix,
    prefixDivider = false,
    suffixDivider = false,
    disabled = false,
    inputType = 'text',
    disallowPattern,
    containerStyle,
    fieldStyle,
    onFocus,
    onBlur,
    onChangeText,
    editable,
    placeholderTextColor,
    ...rest
  },
  ref,
) {
  const filter = disallowPattern ?? FILTERS[inputType];
  const handleChangeText = (v: string) => {
    const filtered = filter ? v.replace(filter, '') : v;
    onChangeText?.(filtered);
  };
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  const isEditable = editable !== false && !disabled;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.field,
          focused && !hasError && styles.fieldFocused,
          hasError && styles.fieldError,
          disabled && styles.fieldDisabled,
          fieldStyle,
        ]}>
        {prefix ? (
          <>
            <View style={styles.slot}>{prefix}</View>
            {prefixDivider ? <View style={styles.divider} /> : null}
          </>
        ) : null}

        <TextInput
          ref={ref}
          {...rest}
          editable={isEditable}
          placeholderTextColor={placeholderTextColor ?? '#A4A7AE'}
          selectionColor={BRAND}
          style={styles.input}
          onChangeText={handleChangeText}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />

        {suffix ? (
          <>
            {suffixDivider ? <View style={styles.divider} /> : null}
            <View style={styles.slot}>{suffix}</View>
          </>
        ) : null}
      </View>

      {hasError ? (
        <Text style={styles.error}>{error}</Text>
      ) : description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
  );
});

/** Convenience pressable slot for tap-targetable prefix/suffix icons */
export function AppInputSlotButton({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: LABEL,
    letterSpacing: -0.14,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: BG,
    paddingHorizontal: 16,
    gap: 12,
  },
  fieldFocused: {
    borderColor: BRAND,
    borderWidth: 1.5,
    boxShadow: '0 0 0 3px rgba(41, 112, 255, 0.12)',
  },
  fieldError: {
    borderColor: ERROR,
    boxShadow: '0 0 0 3px rgba(240, 68, 56, 0.12)',
  },
  fieldDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.7,
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 10,
    backgroundColor: BORDER,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    color: TEXT,
    letterSpacing: -0.16,
    padding: 0,
    margin: 0,
    textAlignVertical: 'center',
  },
  description: {
    fontSize: 14,
    fontWeight: '400',
    color: MUTED,
    letterSpacing: -0.14,
    lineHeight: 20,
  },
  error: {
    fontSize: 14,
    fontWeight: '400',
    color: ERROR,
    letterSpacing: -0.14,
    lineHeight: 20,
  },
});
