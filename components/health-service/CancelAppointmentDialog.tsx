import { Alert } from 'react-native';

import type { AppointmentStatus } from '../../lib/health-service/types';

/**
 * Native confirm dialog for cancelling a pending request or a confirmed Health Service appointment.
 */
export function confirmCancelAppointment(options: {
  staffName: string;
  whenLabel: string;
  status: Extract<AppointmentStatus, 'pending' | 'confirmed'>;
  onConfirm: () => void;
}): void {
  const { staffName, whenLabel, status, onConfirm } = options;
  if (status === 'pending') {
    Alert.alert(
      'Cancel this request?',
      `${whenLabel} with ${staffName}. Your booking has not been confirmed yet (demo).`,
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel request', style: 'destructive', onPress: onConfirm },
      ],
    );
    return;
  }
  Alert.alert(
    'Cancel this appointment?',
    `${whenLabel} with ${staffName}. This removes your confirmed visit and ticket from the app (demo).`,
    [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel appointment', style: 'destructive', onPress: onConfirm },
    ],
  );
}
