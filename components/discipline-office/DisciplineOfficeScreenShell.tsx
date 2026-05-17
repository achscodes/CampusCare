import type { ReactNode } from 'react';
import { View } from 'react-native';

type DisciplineOfficeScreenShellProps = {
  children: ReactNode;
};

/**
 * Solid background shell matching Figma design.
 */
export function DisciplineOfficeScreenShell({ children }: DisciplineOfficeScreenShellProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
      <View className="flex-1 bg-transparent">{children}</View>
    </View>
  );
}
