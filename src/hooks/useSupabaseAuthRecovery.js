import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { writeCampusCareSession, readCampusCareSession, clearCampusCareSession } from "../utils/campusCareSession";
import { syncCampusCareSessionFromSupabaseUser } from "../utils/campusCareAuth";

/**
 * Hook to recover existing Supabase sessions on app load.
 * Restores the campuscare_session from Supabase auth state if available.
 * Runs once on mount.
 */
export function useSupabaseAuthRecovery() {
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      console.log("[AUTH] Supabase not configured, skipping auth recovery");
      return;
    }

    let cancelled = false;

    const recoverSession = async () => {
      try {
        console.log("[AUTH] → Recovering session from Supabase...");

        // Get current Supabase session (from localStorage, sessionStorage, or URL)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[AUTH] ✗ Error retrieving session:", sessionError);
          return;
        }

        if (!sessionData?.session) {
          console.log("[AUTH] → No active Supabase session found");
          // Clear local session if no Supabase session exists
          const existing = readCampusCareSession();
          if (existing?.userId) {
            console.log("[AUTH] → Clearing stale local session");
            clearCampusCareSession();
          }
          return;
        }

        const { session } = sessionData;
        const authUser = session.user;

        console.log("[AUTH] ✓ Supabase session found for:", authUser.id);

        // Check if we already have a valid local session
        const existing = readCampusCareSession();
        if (existing?.userId === authUser.id) {
          console.log("[AUTH] → Valid local session already exists");
          return;
        }

        // Sync the Supabase user to local campuscare session
        const sync = await syncCampusCareSessionFromSupabaseUser(authUser, {
          rememberMe: false,
          emailFallback: authUser.email,
        });

        if (sync.ok) {
          console.log("[AUTH] ✓ Session recovered and synced successfully");
        } else {
          console.warn("[AUTH] ⚠ Session recovery partial failure:", sync.accountStatus);
          clearCampusCareSession();
        }
      } catch (err) {
        console.error("[AUTH] ✗ Unexpected error during auth recovery:", err);
      }
    };

    // Run recovery
    recoverSession();

    // Cleanup function
    return () => {
      cancelled = true;
    };
  }, []);
}
