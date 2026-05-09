import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useRealtimeMedicalRecords(onUpdate) {
  useEffect(() => {
    const channel = supabase
      .channel('medical-records-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'medical_records',
      }, (payload) => {
        console.log('[REALTIME] Medical records update:', payload);
        if (onUpdate) onUpdate(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}