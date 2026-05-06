import { createClient } from "@supabase/supabase-js";

/**
 * @param {string | undefined} raw
 */
function normalizeSupabaseUrl(raw) {
  if (!raw || typeof raw !== "string") return "";
  let u = raw.trim().replace(/\/+$/, "");
  if (u.endsWith("/rest/v1")) {
    u = u.slice(0, -"/rest/v1".length);
  }
  return u.replace(/\/+$/, "");
}

function pickAnonKey() {
  const candidates = [
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    import.meta.env.VITE_SUPABASE_KEY,
  ];
  const found = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  return found ? found.trim() : "";
}

const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const anonKey = pickAnonKey();

export const isSupabaseConfigured = () =>
  Boolean(url && anonKey && /^https?:\/\//i.test(url));

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
export const supabase = isSupabaseConfigured()
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
      db: { schema: "public" },
      global: {
        headers: {
          "x-client-info": "campuscare-v1",
        },
      },
    })
  : null;

// Debug logging in browser console
if (typeof window !== "undefined") {
  if (isSupabaseConfigured()) {
    console.log("[SUPABASE] ✓ Supabase client initialized successfully");
    console.log("[SUPABASE] URL:", url);
  } else {
    console.warn(
      "[SUPABASE] ✗ Supabase not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local",
    );
    console.warn("[SUPABASE] VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL ? "✓ Set" : "✗ Missing");
    console.warn("[SUPABASE] VITE_SUPABASE_ANON_KEY:", anonKey ? "✓ Set" : "✗ Missing");
  }
}
