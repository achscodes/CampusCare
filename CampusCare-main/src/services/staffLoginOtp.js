import { supabase } from "../lib/supabaseClient";
import {
  resolveEdgeFunctionInvokeMessage,
  isEdgeFunctionUnreachable,
  formatEdgeFunctionDeployHelp,
} from "../utils/supabaseEdgeFunctionInvoke";

const FUNCTION_SLUG = "staff-login-otp";

async function invokeStaffLoginOtp(body) {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then restart the dev server.",
    );
  }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) {
    throw new Error(sessionErr.message || "Could not read your sign-in session.");
  }
  if (!sessionData?.session?.access_token) {
    throw new Error("Sign in with your password first, then enter the verification code.");
  }

  const { data, error } = await supabase.functions.invoke(FUNCTION_SLUG, { body });

  if (error) {
    const msg = await resolveEdgeFunctionInvokeMessage(error, data);
    if (isEdgeFunctionUnreachable(error, msg)) {
      throw new Error(formatEdgeFunctionDeployHelp(FUNCTION_SLUG, msg));
    }
    throw new Error(msg || "Could not complete sign-in verification.");
  }

  if (data && typeof data === "object" && data.ok === false) {
    throw new Error(data.error || "Could not complete sign-in verification.");
  }

  return data;
}

/** @returns {Promise<{ emailSentMask?: string, expiresAt?: string, nextResendAt?: string }>} */
export async function requestLoginOtp() {
  return invokeStaffLoginOtp({ action: "request" });
}

/** @param {string} otp */
export async function verifyLoginOtp(otp) {
  return invokeStaffLoginOtp({ action: "verify", otp });
}

export const LOGIN_OTP_LENGTH = 6;
export const LOGIN_OTP_TTL_MS = 2 * 60 * 1000;
export const LOGIN_OTP_RESEND_COOLDOWN_MS = 2 * 60 * 1000;
