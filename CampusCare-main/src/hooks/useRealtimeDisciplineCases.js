import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useRealtimeDisciplineCases(onUpdate) {
  useEffect(() => {
    const channel = supabase
      .channel('discipline-cases-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'discipline_cases',
      }, (payload) => {
        console.log('[REALTIME] Discipline cases update:', payload);
        if (onUpdate) onUpdate(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}