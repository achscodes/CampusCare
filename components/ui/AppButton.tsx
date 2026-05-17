import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

const BRAND      = '#2970FF';
const BRAND_DARK = '#155EEF';
const BRAND_SOFT = '#F5F8FF';
const DISABLED   = '#D5D7DA';

export type AppButtonVariant = 'primary' | 'secondary';

export type AppButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: AppButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
}: AppButtonProps) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        isDisabled && (isPrimary ? styles.primaryDisabled : styles.secondaryDisabled),
        pressed && !isDisabled && (isPrimary ? styles.primaryPressed : styles.secondaryPressed),
      ]}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FFFFFF' : BRAND_DARK} size="small" />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelSecondary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primary: {
    backgroundColor: BRAND,
    borderWidth: 1,
    borderColor: 'rgba(0,18,41,0.10)',
  },
  primaryPressed: {
    backgroundColor: '#1D65F5',
  },
  primaryDisabled: {
    backgroundColor: DISABLED,
    borderColor: DISABLED,
  },
  secondary: {
    backgroundColor: BRAND_SOFT,
  },
  secondaryPressed: {
    backgroundColor: '#EBF0FF',
  },
  secondaryDisabled: {
    backgroundColor: '#F0F0F0',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.32,
  },
  labelPrimary: {
    color: '#FFFFFF',
  },
  labelSecondary: {
    color: BRAND_DARK,
  },
});
