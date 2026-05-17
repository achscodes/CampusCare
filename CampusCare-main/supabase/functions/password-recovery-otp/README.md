# `password-recovery-otp`

Sends **forgot-password** verification codes via **Resend** (same API key as other CampusCare emails). Uses `auth.admin.generateLink({ type: 'recovery' })` so codes still work with `verifyOtp({ type: 'recovery' })` — no Supabase Auth SMTP required.

## Deploy

```bash
npx supabase functions deploy password-recovery-otp
npx supabase db query --linked -f supabase/migrations/20260630120000_password_recovery_send_log.sql
```

`RESEND_API_KEY` must already be set on the project (Edge Function secrets).

## Body

```json
{ "action": "request", "email": "user@example.com", "redirectTo": "https://campus-care-nine.vercel.app/forgot-password" }
```
