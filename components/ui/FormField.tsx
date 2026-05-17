import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

export type FormFieldProps = {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  gap?: number;
};

export function FormField({ label, children, hint, gap = 8 }: FormFieldProps) {
  return (
    <View style={{ gap }}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '400',
          color: '#000000',
          lineHeight: 20,
        }}>
        {label}
      </Text>
      {children}
      {hint != null ? (
        typeof hint === 'string' ? (
          <Text style={{ fontSize: 12, color: '#717680', lineHeight: 16 }}>{hint}</Text>
        ) : (
          hint
        )
      ) : null}
    </View>
  );
}
