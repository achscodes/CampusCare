/**
 * One row in landing_page_visits (Supabase migration 20260412000000_landing_live_metrics.sql).
 * Used for UTC month-to-date "Monthly Visits" on the landing page.
 *
 * In DEV, React StrictMode runs effects twice; we dedupe by path so the same navigation inserts once.
 */

const DEDUPE_MS = 1500;

let lastPathKey = "";
let lastRecordedAt = 0;

/**
 * @param {import("@supabase/supabase-js").SupabaseClient | null} client
 * @param {string} [pathKey] Route key for deduping (e.g. "/", "/signin"). Default "/".
 * @returns {Promise<{ error: import("@supabase/supabase-js").PostgrestError | null, skipped?: boolean }>}
 */
export async function recordAppVisit(client, pathKey = "/") {
  if (!client) return { error: null };

  const key = pathKey.replace(/\/$/, "") || "/";
  const now = Date.now();
  if (key === lastPathKey && now - lastRecordedAt < DEDUPE_MS) {
    return { error: null, skipped: true };
  }
  lastPathKey = key;
  lastRecordedAt = now;

  const { error } = await client.from("landing_page_visits").insert({});
  if (error && import.meta.env.DEV) {
    console.warn("[CampusCare] recordAppVisit failed:", error.message);
  }
  return { error };
}
