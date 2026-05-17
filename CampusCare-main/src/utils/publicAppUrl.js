/**
 * Canonical public app origin for transactional emails and Supabase redirect URLs.
 * Set VITE_PUBLIC_APP_ORIGIN in .env.local for production parity (recommended when admins use localhost).
 */
export const DEFAULT_PUBLIC_APP_ORIGIN = "https://campus-care-nine.vercel.app";

export function getPublicAppOrigin() {
  const fromEnv =
    typeof import.meta !== "undefined" ? import.meta.env?.VITE_PUBLIC_APP_ORIGIN : undefined;
  const trimmed = String(fromEnv ?? "").trim().replace(/\/+$/, "");
  if (trimmed) return trimmed;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  return DEFAULT_PUBLIC_APP_ORIGIN;
}

/** e.g. https://campus-care-nine.vercel.app/signin when VITE_PUBLIC_APP_ORIGIN is set or defaults apply. */
export function getPublicSignInUrl() {
  const origin = getPublicAppOrigin();
  const rawBase =
    (typeof import.meta !== "undefined" ? import.meta.env?.BASE_URL : "/") || "/";
  const prefix = rawBase.replace(/\/$/, "");
  const pathBase = prefix === "" || prefix === "/" ? "" : prefix;
  return `${origin}${pathBase}/signin`;
}
