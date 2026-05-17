/**
 * Maps raw Supabase / network error messages to user-friendly, non-technical text.
 * Centralised so every auth screen shows consistent, human-readable feedback.
 */
export function friendlyAuthError(raw: string): string {
  const msg = raw.toLowerCase();
 
  if (msg.includes('rate limit') || msg.includes('too many requests'))
    return 'You\u2019ve made too many attempts. Please wait a minute and try again.';
 
  if (msg.includes('user not found') || msg.includes('no user'))
    return 'We couldn\u2019t find an account with that email. Please check or sign up first.';
 
  if (msg.includes('invalid') && msg.includes('otp'))
    return 'That code is incorrect or has expired. Please try again or request a new one.';
 
  if (msg.includes('already registered') || msg.includes('already been registered'))
    return 'This email is already registered. Try signing in instead.';
 
  if (msg.includes('email not confirmed'))
    return 'Your email hasn\u2019t been confirmed yet. Please check your inbox.';
 
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout'))
    return 'Unable to connect. Please check your internet and try again.';
 
  if (msg.includes('signup') && msg.includes('disabled'))
    return 'New sign-ups are currently unavailable. Please contact support.';
 
  if (msg.includes('invalid login'))
    return 'The login credentials are incorrect. Please try again.';
 
  if (msg.includes('password'))
    return 'There was an issue with your account setup. Please try again.';
 
  return 'Something went wrong on our end. Please try again shortly.';
}