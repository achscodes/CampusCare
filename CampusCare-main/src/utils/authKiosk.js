import { supabase } from "../lib/supabaseClient";
import { normalizeHsoDesignation } from "./hsoAccess";

/**
 * Queue-display kiosk accounts skip login OTP and idle auto-logout.
 * @param {import("@supabase/supabase-js").User | null | undefined} authUser
 */
export async function isQueueDisplayKioskUser(authUser) {
  if (!authUser?.id || !supabase) return false;

  const meta = authUser.user_metadata || {};
  if (normalizeHsoDesignation(meta.designation) === "queue_display") return true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("designation, office")
    .eq("id", authUser.id)
    .maybeSingle();

  return normalizeHsoDesignation(profile?.designation) === "queue_display";
}

/**
 * @param {{ designation?: string | null } | null | undefined} session
 */
export function isQueueDisplayKioskSession(session) {
  return normalizeHsoDesignation(session?.designation) === "queue_display";
}
