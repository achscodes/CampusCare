import { useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

const HSO_REALTIME_TABLES = [
  "health_consultations",
  "medical_records",
  "health_appointments",
  "health_referrals",
  "inter_office_document_requests",
  "discipline_referrals",
  "sdao_referrals",
];

/**
 * Subscribes to every table that feeds the Health Services Office views and
 * invokes `onChange` (debounced) whenever any of them mutates. The callback is
 * expected to refetch / merge state via the page's existing loader.
 *
 * @param {(payload?: import("@supabase/supabase-js").RealtimePostgresChangesPayload<Record<string, unknown>>) => void} onChange
 * @param {{ enabled?: boolean, debounceMs?: number, channelName?: string }} [options]
 */
export function useRealtimeHsoData(onChange, options = {}) {
  const { enabled = true, debounceMs = 350, channelName = "hso-data-realtime" } = options;
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
        console.warn("[useRealtimeHsoData] onChange handler threw", err);
      }
    };
    const schedule = (payload) => {
      lastPayload = payload;
      if (timerId != null) return;
      timerId = window.setTimeout(fire, debounceMs);
    };

    let channel = supabase.channel(channelName);
    for (const table of HSO_REALTIME_TABLES) {
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
