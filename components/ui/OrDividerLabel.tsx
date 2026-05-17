import { Text, View } from 'react-native';

const LINE = '#F0F2F5';
const LABEL = '#98A2B3';

export type OrDividerLabelProps = {
  label?: string;
  className?: string;
};

/**
 * Horizontal rule with centered label (Figma upload flow — "OR").
 */
export function OrDividerLabel({ label = 'OR', className }: OrDividerLabelProps) {
  return (
    <View className={`h-6 w-full flex-row items-center ${className ?? ''}`}>
      <View className="h-px flex-1" style={{ backgroundColor: LINE }} />
      <View className="bg-white px-2">
        <Text className="text-center text-xs font-semibold" style={{ color: LABEL }}>
          {label}
        </Text>
      </View>
      <View className="h-px flex-1" style={{ backgroundColor: LINE }} />
    </View>
  );
}
