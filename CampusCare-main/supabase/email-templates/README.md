# CampusCare Supabase Auth email templates

HTML here matches the **welcome staff email** styling (CampusCare header gradient, typography, footer pattern).

Hosted Supabase does **not** read these files automatically — paste each body into:

**Dashboard → Authentication → Email Templates**

| File | Paste into Supabase template | Notes |
|------|-------------------------------|-------|
| `recovery-password-otp.html` | **Reset Password** | Uses `{{ .Token }}`; app verifies OTP on `/forgot-password`. See `ForgotPasswordPage.jsx`. |
| `confirm-signup.html` | **Confirm signup** | Uses `{{ .ConfirmationURL }}`. |
| `magic-link-signin.html` | **Magic Link** | Uses `{{ .ConfirmationURL }}` for passwordless sign-in links. |

## Subjects (suggestions)

- Reset password — `Reset your password — CampusCare`
- Confirm signup — `Confirm your email — CampusCare`
- Magic link — `Your CampusCare sign-in link`

## Production URLs

Canonical app host in templates:

- Sign-in — `https://campus-care-nine.vercel.app/signin`
- Forgot password flow — `https://campus-care-nine.vercel.app/forgot-password`

If these change, edit the `.html` files (search `campus-care-nine.vercel.app`).

Also set **`VITE_PUBLIC_APP_ORIGIN=https://campus-care-nine.vercel.app`** in `.env.local` so the app generates Supabase redirects (signup + password recovery) for that origin when you operate from localhost.

## URL configuration

Under **Authentication → URL Configuration**:

- Add the same origins to **Redirect URLs** (signup confirmation, OAuth, recovery `redirect_to`), e.g.
  - `https://campus-care-nine.vercel.app/**`
  - `http://localhost:5173/**` (development)
