# `send-discipline-nte-notice`

Sends a **Notice To Explain (NTE)** email to a student (Resend) and updates `discipline_cases`:

- `respondent_email`, `nte_sent_at`, `status` → `pending` (unless case is `escalated` / `ongoing` / `closed`)

Requires an authenticated DO staff session (Supabase JWT).

## Secrets

| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Required to send email |
| `NTE_EMAIL_FROM` | Optional sender (default: `CampusCare Discipline Office <noreply@campuscare.click>`) |
| `STAFF_WELCOME_EMAIL_FROM` | Fallback sender if `NTE_EMAIL_FROM` unset |

```bash
npx supabase secrets set RESEND_API_KEY=re_your_key_here
npx supabase secrets set NTE_EMAIL_FROM="CampusCare <noreply@campuscare.click>"
```

## Deploy (hosted Supabase)

From repo root (`CampusCare-main/`, folder that contains `supabase/functions/`):

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy send-discipline-nte-notice
```

Use the **same** project ref as `VITE_SUPABASE_URL` (`https://YOUR_PROJECT_REF.supabase.co`).

Verify in Dashboard → **Edge Functions** that `send-discipline-nte-notice` appears.

## Local development

1. `npx supabase start`
2. `.env.local`: `VITE_SUPABASE_URL=http://127.0.0.1:54321` and anon key from `npx supabase status`
3. Second terminal: `npx supabase functions serve`
4. Optional: `VITE_SUPABASE_FUNCTIONS_URL=http://127.0.0.1:54321/functions/v1`

## App error: “Failed to send a request to the Edge Function”

The browser calls:

`https://<project>.supabase.co/functions/v1/send-discipline-nte-notice`

That URL **does not exist** until you deploy (or run `functions serve` locally). Deploy steps above fix this.
