import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { recordAppVisit } from "../utils/recordAppVisit";

/** Inserts a row into landing_page_visits (when Supabase is configured) per route change. */
export default function AppVisitLogger() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;
    recordAppVisit(supabase, pathname);
  }, [pathname]);

  return null;
}
