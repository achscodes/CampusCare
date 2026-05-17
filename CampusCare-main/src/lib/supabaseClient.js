import { createClient } from "@supabase/supabase-js";
import { devLog, devWarn } from "../utils/devLog";

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

/** Optional override for Edge Functions base URL (e.g. local `supabase start`). */
function normalizeFunctionsUrl(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw.trim().replace(/\/+$/, "");
}

const functionsUrl = normalizeFunctionsUrl(import.meta.env.VITE_SUPABASE_FUNCTIONS_URL);

/**
 * Full URL used for `supabase.functions.invoke("create-staff-account")` (for diagnostics / support).
 * @param {string} [slug="create-staff-account"]
 * @returns {string}
 */
export function getEdgeFunctionInvokeUrl(slug = "create-staff-account") {
  if (!url) return "";
  const base = (functionsUrl || `${url}/functions/v1`).replace(/\/+$/, "");
  const name = String(slug || "").replace(/^\//, "");
  return name ? `${base}/${name}` : base;
}

/**
 * @param {string} [supabaseApiUrl]
 * @returns {string} project ref or ""
 */
export function getSupabaseProjectRef(supabaseApiUrl = url) {
  const m = String(supabaseApiUrl || "").match(/https?:\/\/([a-z0-9]{10,})\.supabase\.co/i);
  return m ? m[1] : "";
}

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
      ...(functionsUrl ? { functions: { url: functionsUrl } } : {}),
    })
  : null;

if (typeof window !== "undefined") {
  if (isSupabaseConfigured()) {
    devLog("[SUPABASE] ✓ Supabase client initialized");
    devLog("[SUPABASE] URL:", url);
    if (functionsUrl) devLog("[SUPABASE] Functions URL override:", functionsUrl);
  } else {
    devWarn(
      "[SUPABASE] Not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).",
    );
    devWarn("[SUPABASE] VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL ? "set" : "missing");
    devWarn("[SUPABASE] anon key:", anonKey ? "set" : "missing");
  }
}
