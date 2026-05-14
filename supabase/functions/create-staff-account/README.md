# `create-staff-account`

Creates a Supabase Auth user (email + password, confirmed) and approves the matching `profiles` row. Callable by welfare **Super Admin** or **Admin** users (excluding HSO facility desk admins with `designation = admin`) whose `profiles.office` is **`health`**, **`discipline`**, or **`development`**. Callers may only create accounts for their own office (HSO welfare creates Health Services staff; DO/SDAO welfare creates Discipline or SDAO staff).

**Password:** A **16-character random password** is generated inside the function (not accepted from the client). It is emailed to the new staff member when Resend is configured. If email is not sent, the JSON response includes `initial_password` **only for the admin** so they can share it out-of-band.

After a successful create, the function can send a **welcome email** to the new staff member (department, role, sign-in email, generated password, link to `/signin`) via [Resend](https://resend.com/).

## Welcome email (optional)

Set these **Edge Function secrets** (Dashboard → Edge Functions → Secrets, or `npx supabase secrets set ...`):

| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Resend API key (`re_...`). If unset, the account is still created but **no email** is sent. |
| `STAFF_WELCOME_EMAIL_FROM` | Optional. Default: `CampusCare <onboarding@resend.dev>` (Resend test sender). For production, use a verified domain, e.g. `CampusCare <noreply@yourdomain.com>`. |

```bash
npx supabase secrets set RESEND_API_KEY=re_your_key_here
npx supabase secrets set STAFF_WELCOME_EMAIL_FROM="CampusCare <noreply@yourdomain.com>"
```

The app sends `sign_in_url` in the request body (your deployed app origin + `/signin`). If missing, the function falls back to the request `Origin` header or `http://localhost:5173/signin`.

## Why it fails from the app (“Could not reach create-staff-account”)

The browser calls `https://<project>.supabase.co/functions/v1/create-staff-account`. That endpoint **only exists** after the function is deployed (or served locally).

## Deploy (hosted Supabase)

From the repo root, with the [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`npm i -g supabase` or use `npx supabase`):

```bash
cd /path/to/CampusCare-1   # repo root — must contain supabase/functions/
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy create-staff-account
```

**`--project-ref` is only the project id** (the subdomain before `.supabase.co`), **not** the full URL.

- Correct: `npx supabase link --project-ref lgqfkuvswbvqljixashq`
- Wrong: `npx supabase link --project-ref https://lgqfkuvswbvqljixashq.supabase.co`

Use the **same** id as in `VITE_SUPABASE_URL` (`https://YOUR_PROJECT_REF.supabase.co`).

### “Unable to create CLI sign-in” / “Unknown error” (browser login)

The browser step for `npx supabase login` sometimes fails. **Use a personal access token** instead:

1. Supabase **Dashboard** → your **profile / account** (top right) → **Access Tokens** → generate a token and copy it.
2. **PowerShell** (repo root):

   ```powershell
   $env:SUPABASE_ACCESS_TOKEN="paste_your_token_here"
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy create-staff-account
   ```

3. Never commit this token or put it in the Vite `.env` — CLI only.

**If you see `Invalid access token format. Must be like sbp_...`:**

- Use a **Personal Access Token** from **Account → Access Tokens** (not the project **anon** or **service_role** API keys).
- Paste **only** the token string — it must start with **`sbp_`**.
- In PowerShell, avoid stray quotes/spaces, e.g. `$env:SUPABASE_ACCESS_TOKEN='sbp_your_token_here'` (single quotes help if the token has `$`).

Also try: `npx supabase logout` → set `SUPABASE_ACCESS_TOKEN` again → rerun `link` / `deploy`.

Secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are normally injected automatically for deployed functions. If `createUser` fails with permission errors, confirm the service role secret is available to the function in the Dashboard → Edge Functions → create-staff-account → Secrets.

**Windows:** If `supabase` is not in PATH, use `npx supabase ...` instead.

## Local development

1. `supabase start`
2. Point the app at the local API (see `.env.example` — `VITE_SUPABASE_URL=http://127.0.0.1:54321` and the anon key from `supabase status`).
3. Serve Edge Functions locally (required for “Create account”):

```bash
npx supabase functions serve
```

4. Optional: set `VITE_SUPABASE_FUNCTIONS_URL` only if your functions gateway differs from `{VITE_SUPABASE_URL}/functions/v1`.

## Verify

```bash
curl -i -X OPTIONS "https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-staff-account"
```

You should get a `200` / CORS response from a deployed function, not `404`.
