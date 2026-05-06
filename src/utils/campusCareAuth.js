import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { isSuperAdminSession } from "./superAdmin";
import { clearCampusCareSession, writeCampusCareSession } from "./campusCareSession";

export async function logoutCampusCare() {
  clearCampusCareSession();
  if (isSupabaseConfigured() && supabase) {
    try {
      console.log("[AUTH] Signing out from Supabase...");
      await supabase.auth.signOut();
      console.log("[AUTH] ✓ Signed out successfully from Supabase");
    } catch (err) {
      console.error("[AUTH] ✗ Error signing out:", err);
    }
  }
}

/**
 * After Supabase sign-in/sign-up, load `profiles` and store `campuscare_session_v1`.
 * @param {import("@supabase/supabase-js").User} authUser
 * @param {{ rememberMe?: boolean; emailFallback?: string }} opts
 * @returns {Promise<{ ok: true; session: object } | { ok: false; accountStatus?: string }>}
 */
export async function syncCampusCareSessionFromSupabaseUser(authUser, opts = {}) {
  const { rememberMe = false, emailFallback = "" } = opts;
  if (!supabase || !authUser) {
    console.error("[AUTH] ✗ syncCampusCareSessionFromSupabaseUser: Missing supabase or authUser");
    return { ok: false };
  }

  try {
    const meta = authUser.user_metadata || {};
    console.log("[AUTH] → Syncing session for user:", authUser.id);

    let pres = await supabase
      .from("profiles")
      .select("first_name, middle_initial, last_name, office, role, account_status")
      .eq("id", authUser.id)
      .maybeSingle();
    
    if (pres.error) {
      console.warn("[AUTH] ⚠ Profile query error (with account_status):", pres.error);
      pres = await supabase
        .from("profiles")
        .select("first_name, middle_initial, last_name, office, role")
        .eq("id", authUser.id)
        .maybeSingle();
      if (pres.error) {
        console.error("[AUTH] ✗ Profile query error (fallback):", pres.error);
      }
    }
    const profile = pres.data ?? null;

    const office = profile?.office ?? meta.office ?? "health";
    const displayName = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
      : [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim();

    const role = profile?.role ?? meta.role ?? "Staff";
    const accountStatus = profile?.account_status ?? "approved";

    // DEBUG: Log office resolution chain
    console.log("[AUTH] Debug office resolution:", {
      profileOffice: profile?.office,
      metaOffice: meta.office,
      finalOffice: office,
      profileExists: !!profile,
    });

    const session = {
      userId: authUser.id,
      email: authUser.email ?? emailFallback,
      office,
      role,
      name: displayName || authUser.email || emailFallback,
      rememberMe,
      accountStatus,
    };

    console.log("[AUTH] ✓ Session synced. Office:", office, "Role:", role, "Status:", accountStatus);

    if (!isSuperAdminSession(session) && (accountStatus === "pending" || accountStatus === "rejected")) {
      console.warn("[AUTH] ⚠ Account not approved. Status:", accountStatus);
      return { ok: false, accountStatus };
    }

    writeCampusCareSession(session, rememberMe);
    return { ok: true, session };
  } catch (err) {
    console.error("[AUTH] ✗ Error syncing session:", err);
    return { ok: false };
  }
}
