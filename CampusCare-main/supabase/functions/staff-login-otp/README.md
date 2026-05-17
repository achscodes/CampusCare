# `staff-login-otp`

Sends and verifies a **6-digit email OTP** after password sign-in (2-minute code lifetime, 2-minute resend cooldown).

## Actions

| `action` | Auth | Description |
|----------|------|-------------|
| `request` | Bearer (post–`signInWithPassword`) | Email OTP; returns `expiresAt`, `nextResendAt` |
| `verify` | Bearer | Validates OTP; client then calls `syncCampusCareSessionFromSupabaseUser` |

## Secrets

| Secret | Required |
|--------|----------|
| `RESEND_API_KEY` | Yes |
| `LOGIN_OTP_EMAIL_FROM` or `PASSWORD_CHANGE_EMAIL_FROM` or `STAFF_WELCOME_EMAIL_FROM` | Optional sender |
| `LOGIN_OTP_PEPPER` or `PASSWORD_CHANGE_OTP_PEPPER` | Optional (falls back to service key prefix) |

## Deploy

```bash
npm run supabase:functions:deploy:staff-login-otp
```

Apply migration `20260629120000_staff_login_otp_challenges.sql` first.
