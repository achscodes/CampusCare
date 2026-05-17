import { getEdgeFunctionInvokeUrl, getSupabaseProjectRef } from "../lib/supabaseClient";

/**
 * Supabase `functions.invoke()` sets `error` on any non-2xx response; the JSON body
 * usually contains `{ error: "human message" }`. This helper reads that message.
 *
 * @param {unknown} fnError
 * @param {unknown} data
 * @returns {Promise<string>}
 */
export async function resolveEdgeFunctionInvokeMessage(fnError, data) {
  if (data && typeof data === "object" && data.ok === false && typeof data.error === "string") {
    return data.error;
  }
  if (fnError) {
    try {
      const ctx = fnError.context;
      const res = ctx && typeof ctx === "object" && "json" in ctx && typeof ctx.json === "function" ? ctx : null;
      if (res) {
        const body = typeof res.clone === "function" ? await res.clone().json() : await res.json();
        if (body?.error && typeof body.error === "string") return body.error;
      }
    } catch {
      /* ignore parse errors */
    }
    const msg = fnError.message || "Request failed.";
    return msg;
  }
  return "";
}

/**
 * Network / missing deploy (404) — not an application error from function body.
 * @param {unknown} fnError
 * @param {string} [parsedMessage]
 */
export function isEdgeFunctionUnreachable(fnError, parsedMessage) {
  const msg = String(parsedMessage || fnError?.message || "").toLowerCase();
  const ctx = fnError && typeof fnError === "object" ? fnError.context : null;
  const status =
    (ctx && typeof ctx === "object" && "status" in ctx && ctx.status) ||
    (ctx && typeof ctx === "object" && ctx.response && ctx.response.status) ||
    (fnError && typeof fnError === "object" && "status" in fnError && fnError.status);

  if (
    msg.includes("failed to send a request to the edge function") ||
    msg.includes("failed to send") ||
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("network request failed") ||
    msg.includes("functionsrelayerror")
  ) {
    return true;
  }
  if (status === 404 || status === 502 || status === 503) return true;
  return false;
}

/**
 * Actionable message when the function URL cannot be reached (usually not deployed).
 * @param {string} functionSlug
 * @param {string} [detail]
 */
export function formatEdgeFunctionDeployHelp(functionSlug, detail) {
  const slug = String(functionSlug || "edge-function").replace(/^\//, "");
  const target = getEdgeFunctionInvokeUrl(slug);
  const ref = getSupabaseProjectRef();
  const dash = ref ? `https://supabase.com/dashboard/project/${ref}/functions` : "";

  const lines = [
    detail && !isEdgeFunctionUnreachable(null, detail) ? detail : `Could not reach ${slug}.`,
    "",
    "The Edge Function is probably not deployed to your Supabase project yet.",
    "",
    "From the CampusCare repo root (folder with supabase/functions/):",
    `  npx supabase link --project-ref YOUR_PROJECT_REF`,
    `  npx supabase functions deploy ${slug}`,
    `  npx supabase secrets set RESEND_API_KEY=re_your_key`,
  ];

  if (slug === "send-discipline-nte-notice") {
    lines.push('  npx supabase secrets set NTE_EMAIL_FROM="CampusCare <noreply@campuscare.click>"');
    lines.push("", "See: supabase/functions/send-discipline-nte-notice/README.md");
  }

  lines.push(
    "",
    "Local dev: run `npx supabase start`, then in another terminal `npx supabase functions serve`,",
    "and set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from `supabase status` in .env.local",
  );

  if (target) lines.push("", `App calls: ${target}`);
  if (dash) lines.push(`Deploy in Dashboard: ${dash}`);

  return lines.join("\n");
}
