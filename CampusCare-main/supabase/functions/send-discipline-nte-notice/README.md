# `send-discipline-nte-notice`

Sends a **Notice To Explain (NTE)** email to a student (Resend) and updates `discipline_cases`:

- `respondent_email`, `nte_sent_at`, `status` → `pending` (unless case is `escalated` / `ongoing` / `closed`)

Requires an authenticated DO staff session (Supabase JWT).

## Request body

| Field | Type | Notes |
|-------|------|-------|
| `caseId` | string | Required. `discipline_cases.id`. |
| `toEmail` | string | Required. Primary recipient. |
| `subject` | string | Optional. Defaults to `NOTICE TO EXPLAIN`. |
| `textBody` | string | Optional plain-text memo body. Memo header lines (`DATE:`, `TO:`, etc.) are stripped server-side. |
| `htmlBody` | string | Optional rendered HTML. Generated from `textBody` if omitted. |
| `attachments` | `Array<{ filename, content }>` | Optional. Up to 5; base64-encoded `content`. |
| `ccEmails` | `string[]` | Optional. Up to **2** Cc recipients. Lowercased, de-duped, validated to contain `@`. The primary recipient is removed if accidentally included. |

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

## Resend 403: “This API key is not authorized to send emails from <domain>”

Resend will reject the request whenever the `from` address is not on a domain
verified in your Resend account. The default `from` is
`CampusCare Discipline Office <noreply@campuscare.click>` — change it via the
`NTE_EMAIL_FROM` secret to an address on **your** verified domain.

Checklist:

1. In **resend.com → Domains**, verify a domain you control (e.g.
   `campuscare.click`). All DNS records must be green.
2. Pick a sending address on that domain (e.g. `noreply@campuscare.click`).
3. Set the secret and redeploy:

   ```bash
   npx supabase secrets set NTE_EMAIL_FROM="CampusCare Discipline Office <noreply@campuscare.click>"
   npx supabase functions deploy send-discipline-nte-notice
   ```
4. Retry from the app. The function now surfaces a clearer error pointing back
   to `NTE_EMAIL_FROM` when Resend returns 403 for sender authorization.

> Do **not** use `@nu-dasma.edu.ph` unless that domain is verified in the same
> Resend account whose API key is in `RESEND_API_KEY`.
