# `password-change-otp`

Authenticated password change with **email OTP** (Resend).

| Action body | Behavior |
|-------------|-----------|
| `{"action":"request","currentPassword":"..."}` | Verifies current password, emails a **6-digit** code (10 min TTL). Cooldown ~60s between sends. |
| `{"action":"confirm","otp":"123456","newPassword":"..."}` | Verifies code, updates password, sets `user_metadata.must_change_password` to `false`. |

## Requirements

1. Apply migration `20260627120000_password_change_otp_challenges.sql` (SQL Editor or `supabase db push`).
2. Deploy: `npx supabase functions deploy password-change-otp`
3. **RESEND_API_KEY** must be set (same as `create-staff-account`). Optional: `PASSWORD_CHANGE_EMAIL_FROM`, `PASSWORD_CHANGE_OTP_PEPPER`.
