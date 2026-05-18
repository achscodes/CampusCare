import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

/**
 * Live updates for student-submitted rows in `discipline_incident_reports` (mobile app).
 * @param {(payload: import("@supabase/supabase-js").RealtimePostgresChangesPayload<Record<string, unknown>>) => void} onUpdate
 */
export function useRealtimeIncidentReports(onUpdate) {
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase || typeof onUpdate !== "function") {
      return undefined;
    }

    const channel = supabase
      .channel("discipline-incident-reports-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "discipline_incident_reports",
        },
        (payload) => {
          onUpdate(payload);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}
