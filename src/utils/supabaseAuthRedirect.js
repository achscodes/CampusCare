/**
 * URLs used in Supabase email links (signup confirmation, etc.).
 * Add each returned origin + path in Supabase → Authentication → URL Configuration → Redirect URLs.
 *
 * @param {string} [pathname] pathname starting with "/", e.g. "/signin"
 */
export function getAuthEmailRedirectUrl(pathname = "/signin") {
  if (typeof window === "undefined") {
    return pathname;
  }
  const origin = window.location.origin;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin}${base}${path}`;
}
