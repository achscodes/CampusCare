import { useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

const SDAO_REALTIME_TABLES = [
  "sdao_beneficiaries",
  "sdao_scholarship_applications",
  "sdao_clearance_records",
  "sdao_referrals",
  "inter_office_document_requests",
  "discipline_referrals",
  "health_referrals",
];

/**
 * Subscribes to every table that feeds the SDAO dashboards and invokes
 * `onChange` (debounced) whenever any of them mutates. The callback is expected
 * to call the page's existing `refreshSdao()` loader.
 *
 * @param {(payload?: import("@supabase/supabase-js").RealtimePostgresChangesPayload<Record<string, unknown>>) => void} onChange
 * @param {{ enabled?: boolean, debounceMs?: number, channelName?: string }} [options]
 */
export function useRealtimeSdaoData(onChange, options = {}) {
  const { enabled = true, debounceMs = 350, channelName = "sdao-data-realtime" } = options;
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  useEffect(() => {
    if (!enabled) return undefined;
    if (!isSupabaseConfigured() || !supabase) return undefined;

    let timerId = null;
    let lastPayload = null;
    const fire = () => {
      timerId = null;
      const payload = lastPayload;
      lastPayload = null;
      try {
        callbackRef.current?.(payload);
      } catch (err) {
        console.warn("[useRealtimeSdaoData] onChange handler threw", err);
      }
    };
    const schedule = (payload) => {
      lastPayload = payload;
      if (timerId != null) return;
      timerId = window.setTimeout(fire, debounceMs);
    };

    let channel = supabase.channel(channelName);
    for (const table of SDAO_REALTIME_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => schedule(payload),
      );
    }
    channel.subscribe();

    return () => {
      if (timerId != null) window.clearTimeout(timerId);
      supabase.removeChannel(channel);
    };
  }, [enabled, debounceMs, channelName]);
}
