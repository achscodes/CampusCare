import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { friendlyAuthError } from './friendlyAuthError';

type ApiResult = { ok: boolean; message: string };

const NOT_CONFIGURED: ApiResult = {
  ok: false,
  message: 'Authentication service is not configured.',
};


/**
 * Sends a one-time password (OTP) and magic link to the given email via Supabase.
 * Only works for existing registered users.
 */
export async function sendOtp(email: string): Promise<ApiResult> {
  if (!isSupabaseConfigured || !supabase) return NOT_CONFIGURED;

  // Try to send OTP with shouldCreateUser: false
  // This will both check if user exists AND send OTP if they do
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false }, // Prevent auto-registration
  });

  // If error is "User not allowed", user doesn't exist
  if (error && error.message.includes('User not allowed')) {
    return { 
      ok: false, 
      message: 'This email is not registered. Please create an account first.' 
    };
  }

  // For any other errors, use the friendly error handler
  if (error) return { ok: false, message: friendlyAuthError(error.message) };
  
  // Success - OTP was sent to existing user
  return { ok: true, message: 'OTP sent.' };
}

/**
 * Verifies the 6-digit OTP code submitted by the user.
 */
export async function verifyOtp(email: string, token: string): Promise<ApiResult> {
  if (!isSupabaseConfigured || !supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) return { ok: false, message: friendlyAuthError(error.message) };
  return { ok: true, message: 'Verified.' };
}

/**
 * Creates a user account with email verification
 */
export async function createUser(email: string, password: string, metadata: Record<string, any>): Promise<ApiResult> {
  if (!isSupabaseConfigured || !supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  if (error) return { ok: false, message: friendlyAuthError(error.message) };
  return { ok: true, message: 'Account created successfully.' };
}
