import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import {
  PRESENCE_ACTIVITY_DEBOUNCE_MS,
  normalizePresenceStatus,
} from "../constants/userPresence";

/** @typedef {import("../constants/userPresence").UserPresenceStatus} Presence */

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click", "wheel"];

async function patchMyProfile(updates) {
  if (!isSupabaseConfigured() || !supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) return;
  await supabase.from("profiles").update(updates).eq("id", uid);
}

/**
 * Tracks activity for `last_active_at` and exposes a manual Online / On break toggle.
 *
 * Idle and Do-not-disturb statuses were removed: signed-in staff are always
 * Online unless they explicitly switch to On break. Offline is reserved for
 * logged-out users (set during sign-out by `campusCareAuth`).
 */
export function useUserPresence(enabled) {
  const [status, setStatus] = useState(/** @type {Presence} */ ("online"));
  const manualRef = useRef(/** @type {null | "on_break"} */ (null));
  const lastSentActivityRef = useRef(0);
  const [presenceDbReady, setPresenceDbReady] = useState(false);
  const presenceDbReadyRef = useRef(false);

  const flushLastActive = useCallback(() => {
    if (!presenceDbReadyRef.current) return;
    const now = Date.now();
    if (now - lastSentActivityRef.current < PRESENCE_ACTIVITY_DEBOUNCE_MS) return;
    lastSentActivityRef.current = now;
    void patchMyProfile({ last_active_at: new Date().toISOString() });
  }, []);

  useEffect(() => {
    if (!enabled) {
      presenceDbReadyRef.current = false;
      setPresenceDbReady(false);
      setStatus("offline");
      return undefined;
    }

    let cancelled = false;

    const boot = async () => {
      if (!isSupabaseConfigured() || !supabase) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid || cancelled) return;

      const { data: row, error } = await supabase
        .from("profiles")
        .select("presence_status,last_active_at")
        .eq("id", uid)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        manualRef.current = null;
        presenceDbReadyRef.current = false;
        setPresenceDbReady(false);
        setStatus("online");
        return;
      }

      const ps = normalizePresenceStatus(row?.presence_status);
      manualRef.current = ps === "on_break" ? "on_break" : null;

      if (manualRef.current === null) {
        await patchMyProfile({ presence_status: "online", last_active_at: new Date().toISOString() });
        setStatus("online");
      } else {
        setStatus("on_break");
      }

      presenceDbReadyRef.current = true;
      setPresenceDbReady(true);
    };

    void boot();

    const onActivity = () => {
      if (manualRef.current === "on_break") return;
      flushLastActive();
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true, capture: true });
    }

    return () => {
      cancelled = true;
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity, true);
      }
    };
  }, [enabled, flushLastActive]);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured() || !supabase || !presenceDbReady) return undefined;
    const t = window.setTimeout(() => {
      void patchMyProfile({ presence_status: status });
    }, 450);
    return () => window.clearTimeout(t);
  }, [enabled, status, presenceDbReady]);

  const setManualStatus = useCallback(
    /** @param {"online"|"on_break"} choice */
    async (choice) => {
      const iso = new Date().toISOString();
      if (choice === "on_break") {
        manualRef.current = "on_break";
        if (presenceDbReadyRef.current) {
          await patchMyProfile({ presence_status: "on_break", last_active_at: iso });
        }
        setStatus("on_break");
        return;
      }
      manualRef.current = null;
      if (presenceDbReadyRef.current) {
        await patchMyProfile({ presence_status: "online", last_active_at: iso });
      }
      setStatus("online");
    },
    [],
  );

  return { status, setManualStatus };
}
