import { supabase } from "../lib/supabaseClient";
import { getAuthEmailRedirectUrl } from "../utils/supabaseAuthRedirect";
import { resolveEdgeFunctionInvokeMessage } from "../utils/supabaseEdgeFunctionInvoke";

/**
 * Request a password recovery OTP via Resend (Edge Function).
 * Code is verified with supabase.auth.verifyOtp({ type: 'recovery' }).
 *
 * @param {string} email
 * @returns {Promise<{ ok: true, otpLength: number, nextResendAt?: string } | { ok: false, error: string }>}
 */
export async function requestPasswordRecoveryOtp(email) {
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const redirectTo = getAuthEmailRedirectUrl("/forgot-password");

  const { data, error } = await supabase.functions.invoke("password-recovery-otp", {
    body: { action: "request", email: email.trim(), redirectTo },
  });

  if (data?.ok === true && typeof data.otpLength === "number") {
    return {
      ok: true,
      otpLength: data.otpLength,
      nextResendAt: data.nextResendAt,
    };
  }

  const message = await resolveEdgeFunctionInvokeMessage(error, data);
  return { ok: false, error: message };
}
