import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { isWelfareAdminSession } from "./welfareAdmin";
import { clearCampusCareSession, writeCampusCareSession } from "./campusCareSession";
import { devLog, devWarn } from "./devLog";
import { isHsoAdminSession, normalizeHsoDesignation } from "./hsoAccess";

export async function logoutCampusCare() {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (uid) {
        await supabase
          .from("profiles")
          .update({ presence_status: "offline", last_active_at: new Date().toISOString() })
          .eq("id", uid);
      }
    } catch {
      /* non-fatal */
    }
    try {
      devLog("[AUTH] Signing out from Supabase...");
      await supabase.auth.signOut();
      devLog("[AUTH] Signed out from Supabase");
    } catch (err) {
      devWarn("[AUTH] Error signing out:", err);
    }
  }
  clearCampusCareSession();
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
    devWarn("[AUTH] syncCampusCareSessionFromSupabaseUser: missing supabase or authUser");
    return { ok: false };
  }

  try {
    const meta = authUser.user_metadata || {};
    devLog("[AUTH] Syncing session for user:", authUser.id);

    const profileSelectVariants = [
      "first_name, middle_initial, last_name, office, role, account_status, designation, presence_status, last_active_at, avatar_data_url",
      "first_name, middle_initial, last_name, office, role, account_status, designation, presence_status, last_active_at",
      "first_name, middle_initial, last_name, office, role, account_status, designation",
      "first_name, middle_initial, last_name, office, role, account_status",
      "first_name, middle_initial, last_name, office, role",
    ];
    let pres = null;
    for (const selectCols of profileSelectVariants) {
      pres = await supabase.from("profiles").select(selectCols).eq("id", authUser.id).maybeSingle();
      if (!pres.error) break;
      devWarn("[AUTH] Profile query variant failed:", selectCols, pres.error);
    }
    const profile = pres?.data ?? null;

    const office = profile?.office ?? meta.office ?? "health";
    const displayName = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
      : [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim();

    const role = profile?.role ?? meta.role ?? "Staff";
    const accountStatus = profile?.account_status ?? meta.account_status ?? "approved";
    const designation = office === "health"
      ? normalizeHsoDesignation(profile?.designation ?? meta.designation)
      : undefined;

    devLog("[AUTH] Office resolution:", {
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
      designation,
    };

    const avatarFromDb = profile?.avatar_data_url;
    if (typeof avatarFromDb === "string" && avatarFromDb.trim()) {
      session.profileAvatarDataUrl = avatarFromDb.trim();
    }

    devLog("[AUTH] Session synced. Office:", office, "Role:", role, "Status:", accountStatus);

    const isApprovalExempt = isWelfareAdminSession(session) || isHsoAdminSession(session);
    if (!isApprovalExempt && (accountStatus === "pending" || accountStatus === "rejected")) {
      devWarn("[AUTH] Account not approved. Status:", accountStatus);
      return { ok: false, accountStatus };
    }

    writeCampusCareSession(session, rememberMe);

    const { error: presenceErr } = await supabase
      .from("profiles")
      .update({ presence_status: "online", last_active_at: new Date().toISOString() })
      .eq("id", authUser.id);
    if (presenceErr) {
      devWarn("[AUTH] Could not set profile presence online:", presenceErr.message || presenceErr);
    }

    return { ok: true, session };
  } catch (err) {
    devWarn("[AUTH] Error syncing session:", err);
    return { ok: false };
  }
}
