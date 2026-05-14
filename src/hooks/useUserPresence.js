import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import {
  IDLE_AFTER_MS,
  OFFLINE_AFTER_IDLE_MS,
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
 * Tracks activity, idle (5m), long-idle offline (60m in idle), manual DND / break / offline.
 * Syncs `profiles.presence_status` + `last_active_at` when Supabase is configured.
 */
export function useUserPresence(enabled) {
  const [status, setStatus] = useState(/** @type {Presence} */ ("online"));
  const lastActivityRef = useRef(Date.now());
  const idleEnteredAtRef = useRef(/** @type {number | null} */ (null));
  const manualRef = useRef(/** @type {null | "do_not_disturb" | "on_break" | "offline"} */ (null));
  const lastSentActivityRef = useRef(0);
  /** After boot: true if profile row supports presence columns; false if select failed (e.g. migration not applied). */
  const [presenceDbReady, setPresenceDbReady] = useState(false);
  const presenceDbReadyRef = useRef(false);

  const computeNext = useCallback(() => {
    const manual = manualRef.current;
    const now = Date.now();
    if (manual === "on_break") return /** @type {Presence} */ ("on_break");
    if (manual === "do_not_disturb") return /** @type {Presence} */ ("do_not_disturb");
    if (manual === "offline") return /** @type {Presence} */ ("offline");

    const last = lastActivityRef.current;
    const idleAt = last + IDLE_AFTER_MS;
    if (now < idleAt) {
      return /** @type {Presence} */ ("online");
    }
    if (idleEnteredAtRef.current === null) idleEnteredAtRef.current = idleAt;
    const idleEntered = idleEnteredAtRef.current;
    if (now - idleEntered >= OFFLINE_AFTER_IDLE_MS) {
      return /** @type {Presence} */ ("offline");
    }
    return /** @type {Presence} */ ("idle");
  }, []);

  const applyComputed = useCallback(() => {
    const next = computeNext();
    setStatus((prev) => {
      if (prev === next) return prev;
      return next;
    });
  }, [computeNext]);

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

    let intervalId = /** @type {ReturnType<typeof setInterval> | null} */ (null);
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
        lastActivityRef.current = Date.now();
        idleEnteredAtRef.current = null;
        presenceDbReadyRef.current = false;
        setPresenceDbReady(false);
        setStatus("online");
        intervalId = window.setInterval(() => {
          applyComputed();
        }, 10_000);
        applyComputed();
        return;
      }

      const ps = normalizePresenceStatus(row?.presence_status);
      manualRef.current = null;
      if (ps === "on_break") manualRef.current = "on_break";
      else if (ps === "do_not_disturb") manualRef.current = "do_not_disturb";
      // DB "offline" is usually logout / inactive — do not treat as manual; signing in forces online again.

      lastActivityRef.current = Date.now();
      idleEnteredAtRef.current = null;

      if (manualRef.current === null) {
        await patchMyProfile({ presence_status: "online", last_active_at: new Date().toISOString() });
        setStatus("online");
      } else {
        const initial =
          manualRef.current === "on_break"
            ? "on_break"
            : manualRef.current === "do_not_disturb"
              ? "do_not_disturb"
              : "offline";
        setStatus(initial);
      }

      intervalId = window.setInterval(() => {
        applyComputed();
      }, 10_000);
      applyComputed();
      presenceDbReadyRef.current = true;
      setPresenceDbReady(true);
    };

    void boot();

    const onActivity = () => {
      const m = manualRef.current;
      if (m === "on_break" || m === "do_not_disturb" || m === "offline") return;
      lastActivityRef.current = Date.now();
      idleEnteredAtRef.current = null;
      flushLastActive();
      applyComputed();
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true, capture: true });
    }

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity, true);
      }
    };
  }, [enabled, applyComputed, flushLastActive]);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured() || !supabase || !presenceDbReady) return undefined;
    const t = window.setTimeout(() => {
      void patchMyProfile({ presence_status: status });
    }, 450);
    return () => window.clearTimeout(t);
  }, [enabled, status, presenceDbReady]);

  const setManualStatus = useCallback(
    /** @param {"online"|"do_not_disturb"|"on_break"|"offline"} choice */
    async (choice) => {
      lastActivityRef.current = Date.now();
      idleEnteredAtRef.current = null;
      const iso = new Date().toISOString();
      if (choice === "online") {
        manualRef.current = null;
        if (presenceDbReadyRef.current) {
          await patchMyProfile({ presence_status: "online", last_active_at: iso });
        }
        setStatus("online");
        return;
      }
      if (choice === "do_not_disturb") {
        manualRef.current = "do_not_disturb";
        if (presenceDbReadyRef.current) {
          await patchMyProfile({ presence_status: "do_not_disturb", last_active_at: iso });
        }
        setStatus("do_not_disturb");
        return;
      }
      if (choice === "on_break") {
        manualRef.current = "on_break";
        if (presenceDbReadyRef.current) {
          await patchMyProfile({ presence_status: "on_break", last_active_at: iso });
        }
        setStatus("on_break");
        return;
      }
      if (choice === "offline") {
        manualRef.current = "offline";
        if (presenceDbReadyRef.current) {
          await patchMyProfile({ presence_status: "offline", last_active_at: iso });
        }
        setStatus("offline");
      }
    },
    [],
  );

  return { status, setManualStatus };
}
