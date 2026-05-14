import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { readCampusCareSession, clearCampusCareSession, writeCampusCareSession } from "../utils/campusCareSession";
import { syncCampusCareSessionFromSupabaseUser } from "../utils/campusCareAuth";
import { devLog, devWarn } from "../utils/devLog";

/**
 * Hook to recover existing Supabase sessions on app load.
 * Restores the campuscare_session from Supabase auth state if available.
 * Runs once on mount.
 */
export function useSupabaseAuthRecovery() {
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      devLog("[AUTH] Supabase not configured, skipping auth recovery");
      return;
    }

    const recoverSession = async () => {
      try {
        devLog("[AUTH] Recovering session from Supabase...");

        // Get current Supabase session (from localStorage, sessionStorage, or URL)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          devWarn("[AUTH] Error retrieving session:", sessionError);
          return;
        }

        if (!sessionData?.session) {
          devLog("[AUTH] No active Supabase session found");
          // Clear local session if no Supabase session exists
          const existing = readCampusCareSession();
          if (existing?.userId) {
            devLog("[AUTH] Clearing stale local session");
            clearCampusCareSession();
          }
          return;
        }

        const { session } = sessionData;
        const authUser = session.user;

        devLog("[AUTH] Supabase session found for:", authUser.id);

        // Check if we already have a valid local session
        const existing = readCampusCareSession();
        if (existing?.userId === authUser.id) {
          devLog("[AUTH] Valid local session already exists");
          if (!existing.profileAvatarDataUrl) {
            const { data: profileRow } = await supabase
              .from("profiles")
              .select("avatar_data_url")
              .eq("id", authUser.id)
              .maybeSingle();
            const url = profileRow?.avatar_data_url;
            if (url && typeof url === "string" && url.startsWith("data:image")) {
              writeCampusCareSession({ ...existing, profileAvatarDataUrl: url });
              window.dispatchEvent(new Event("campuscare-session-updated"));
            }
          }
          return;
        }

        // Sync the Supabase user to local campuscare session
        const sync = await syncCampusCareSessionFromSupabaseUser(authUser, {
          rememberMe: false,
          emailFallback: authUser.email,
        });

        if (sync.ok) {
          devLog("[AUTH] Session recovered and synced");
        } else {
          devWarn("[AUTH] Session recovery partial failure:", sync.accountStatus);
          clearCampusCareSession();
        }
      } catch (err) {
        devWarn("[AUTH] Unexpected error during auth recovery:", err);
      }
    };

    recoverSession();
  }, []);
}
