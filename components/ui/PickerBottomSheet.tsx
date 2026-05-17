import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BRAND = '#2970FF';

type Props<T extends string> = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: readonly T[];
  value?: T | '';
  onSelect: (value: T) => void;
  onClose: () => void;
};

/** Bottom-sheet picker rendered via RN Modal — can be nested inside another modal. */
export function PickerBottomSheet<T extends string>({
  visible,
  title,
  subtitle,
  options,
  value,
  onSelect,
  onClose,
}: Props<T>) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {options.map((opt) => {
              const isSelected = value === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => { onSelect(opt); onClose(); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  style={({ pressed }) => [
                    styles.row,
                    isSelected && styles.rowSelected,
                    pressed && !isSelected && styles.rowPressed,
                  ]}>
                  <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]} numberOfLines={2}>
                    {opt}
                  </Text>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              );
            })}
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 16,
  },
  header: { marginBottom: 12, gap: 4 },
  title: { fontSize: 18, fontWeight: '600', color: '#181D27', letterSpacing: -0.36 },
  subtitle: { fontSize: 14, color: '#717680', letterSpacing: -0.14, lineHeight: 20 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 12,
    marginBottom: 4,
  },
  rowSelected: { backgroundColor: '#F5F8FF' },
  rowPressed: { backgroundColor: '#F9FAFB' },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: '#181D27', letterSpacing: -0.14 },
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
