import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { isSuperAdminSession } from "./superAdmin";
import { clearCampusCareSession, writeCampusCareSession } from "./campusCareSession";

export async function logoutCampusCare() {
  clearCampusCareSession();
  if (isSupabaseConfigured() && supabase) {
    await supabase.auth.signOut();
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
    return { ok: false };
  }

  const meta = authUser.user_metadata || {};

  let pres = await supabase
    .from("profiles")
    .select("first_name, middle_initial, last_name, office, role, account_status")
    .eq("id", authUser.id)
    .maybeSingle();
  if (pres.error) {
    pres = await supabase
      .from("profiles")
      .select("first_name, middle_initial, last_name, office, role")
      .eq("id", authUser.id)
      .maybeSingle();
  }
  const profile = pres.data ?? null;

  const office = profile?.office ?? meta.office ?? "health";
  const displayName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
    : [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim();

  const role = profile?.role ?? meta.role ?? "Staff";
  const accountStatus = profile?.account_status ?? "approved";

  const session = {
    userId: authUser.id,
    email: authUser.email ?? emailFallback,
    office,
    role,
    name: displayName || authUser.email || emailFallback,
    rememberMe,
    accountStatus,
  };

  if (!isSuperAdminSession(session) && (accountStatus === "pending" || accountStatus === "rejected")) {
    return { ok: false, accountStatus };
  }

  writeCampusCareSession(session, rememberMe);
  return { ok: true, session };
}
