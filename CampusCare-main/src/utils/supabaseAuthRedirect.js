/**
 * URLs used in Supabase email links (signup confirmation, etc.).
 * Add each returned origin + path in Supabase → Authentication → URL Configuration → Redirect URLs.
 *
 * Uses `publicAppUrl`: set VITE_PUBLIC_APP_ORIGIN to your deployed origin (default is Vercel) so confirmation
 * links resolve to production even during local signup tests.
 *
 * @param {string} [pathname] pathname starting with "/", e.g. "/signin"
 */
import { getPublicAppOrigin } from "./publicAppUrl";

export function getAuthEmailRedirectUrl(pathname = "/signin") {
  const origin = getPublicAppOrigin();
  const rawBase =
    (typeof import.meta !== "undefined" ? import.meta.env.BASE_URL : "/") || "/";
  const prefix = rawBase.replace(/\/$/, "");
  const pathBase = prefix === "" || prefix === "/" ? "" : prefix;
  const tail = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin}${pathBase}${tail}`;
}
