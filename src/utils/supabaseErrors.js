/**
 * @param {import("@supabase/supabase-js").AuthError | Error | null | undefined} error
 * @returns {string}
 */
export function formatAuthError(error) {
  if (!error) return "Something went wrong. Please try again.";
  let msg = String(error.message || "");
  try {
    const parsed = JSON.parse(msg);
    if (parsed && typeof parsed.message === "string") {
      msg = parsed.message;
    }
  } catch {
    /* keep msg */
  }

  if (/database error querying schema|querying schema/i.test(msg)) {
    return (
      "We’re having trouble accessing your account right now. " +
      "Please try again in a moment. If the issue continues, contact support."
    );
  }

  if (/No API key found|apikey.*header|No `apikey`/i.test(msg)) {
    return (
      "We couldn’t complete sign-in due to a configuration issue. " +
      "Please refresh and try again. If it still fails, contact support."
    );
  }

  if (/confirmation email|error sending.*email|send.*confirm|email.*could not be sent/i.test(msg)) {
    return (
      "We couldn’t send a confirmation email right now. " +
      "Please try again later."
    );
  }

  if (/already registered|already been registered/i.test(msg)) {
    return "This email is already registered.";
  }
  if (/invalid login credentials|invalid email or password/i.test(msg)) {
    return (
      "Invalid email or password. Please check your credentials and try again."
    );
  }
  if (/email not confirmed/i.test(msg)) {
    return "Please confirm your email before signing in.";
  }
  if (/password should be at least|password is too short/i.test(msg)) {
    return "Password does not meet the server requirements.";
  }
  if (/otp_expired|token has expired|expired/i.test(msg)) {
    return "This code has expired. Request a new one.";
  }
  if (/invalid.*token|otp.*invalid|invalid otp/i.test(msg)) {
    return "Invalid verification code. Try again.";
  }
  if (/rate limit|too many requests|too many emails/i.test(msg)) {
    return "Too many request, try again later";
  }

  return msg || "Something went wrong. Please try again.";
}
