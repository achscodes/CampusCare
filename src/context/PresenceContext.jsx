import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { useUserPresence } from "../hooks/useUserPresence";
import { setPresenceDnd } from "../utils/presenceDndGate";

const PresenceContext = createContext(null);

export function usePresenceOptional() {
  return useContext(PresenceContext);
}

export function PresenceProvider({ children }) {
  const location = useLocation();
  const [authed, setAuthed] = useState(false);
  const publicPath = /^\/($|signin|signup|terms|privacy|forgot-password)/.test(location.pathname);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return undefined;
    void supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data?.session?.user);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const enabled = authed && !publicPath;
  const { status, setManualStatus } = useUserPresence(enabled);

  useEffect(() => {
    return () => setPresenceDnd(false);
  }, []);

  useEffect(() => {
    setPresenceDnd(!!enabled && status === "do_not_disturb");
  }, [enabled, status]);

  const value = useMemo(() => ({ status, setManualStatus, presenceEnabled: enabled }), [status, setManualStatus, enabled]);

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}
