import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useRealtimeAppointments(onUpdate) {
  useEffect(() => {
    const channel = supabase
      .channel('appointments-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'health_appointments',
      }, (payload) => {
        console.log('[REALTIME] Appointments update:', payload);
        if (onUpdate) onUpdate(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}