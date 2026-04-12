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
      "Supabase Auth could not read the database (this usually is not fixed by app code). " +
      "Confirm Settings → API: Project URL and anon key match your .env.local, then restart npm run dev. " +
      "Try Authentication → Add user (new email/password). If every user fails, use Project settings → Restart, check Logs → Postgres, or support.supabase.com. " +
      "If you only used SQL-seeded logins, delete those users and recreate them in Authentication so identities are valid."
    );
  }

  if (/No API key found|apikey.*header|No `apikey`/i.test(msg)) {
    return (
      "Supabase API key is missing or not loaded. " +
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (use the anon/public key from Dashboard → Settings → API), " +
      "restart npm run dev, and run a fresh production build if you deploy."
    );
  }

  if (/confirmation email|error sending.*email|send.*confirm|email.*could not be sent/i.test(msg)) {
    return (
      "Confirmation email could not be sent. Add your redirect URLs in Supabase (Auth → URL Configuration), " +
      "including http://localhost:5173/signin. Check email rate limits or custom SMTP. " +
      "For local dev, disable \"Confirm email\" under Auth → Providers → Email."
    );
  }

  if (/already registered|already been registered/i.test(msg)) {
    return "This email is already registered.";
  }
  if (/invalid login credentials|invalid email or password/i.test(msg)) {
    return (
      "Invalid email or password. Use an account under your project’s Authentication → Users (sign up in the app or add a user in the dashboard). Your supabase.com login is not the same as an app user."
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
