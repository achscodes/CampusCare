# CampusCare

Student welfare management for campus offices (Health, Discipline, Student Development). Built with **React**, **Vite**, and **Supabase** (auth, Postgres, storage).

## Local development

1. **Node.js** 20+ recommended.
2. Install dependencies:

   ```bash
   npm install
   ```

3. **Environment** — copy `.env.example` to `.env.local` and add your Supabase project values (Dashboard → **Settings** → **API**).

   Required variables:

   - `VITE_SUPABASE_URL` — project URL  
   - `VITE_SUPABASE_ANON_KEY` — **anon (public)** key only (never commit the `service_role` key)

4. Start the app:

   ```bash
   npm run dev
   ```

5. Apply database migrations to your Supabase project (SQL Editor or [Supabase CLI](https://supabase.com/docs/guides/cli)) using the files in `supabase/migrations/`.

## Production build

```bash
npm run build
npm run preview
```

Output is written to `dist/`. Deploy `dist/` to any static host (e.g. Vercel). This repo includes a `vercel.json` with SPA rewrites and baseline security headers.

### Deploy environment

On your host, set the same `VITE_*` variables as **build-time** environment variables so Vite can embed the public Supabase URL and anon key in the client bundle. The anon key is designed to be public; protect data with **Row Level Security** and server-side policies in Supabase, not by hiding the anon key.

## Security and repository hygiene

- **Never commit** `.env`, `.env.local`, or any file containing `service_role` keys, database passwords, or personal data.
- `.env.local` is gitignored. Use `.env.example` as the only env template in the repo.
- If credentials were ever committed, **rotate** them in the Supabase Dashboard (Settings → API → reset anon key if needed) and avoid pushing secrets to public remotes.
- Demo seed accounts in migrations use placeholder `@example.edu` addresses and a documented demo password — replace with your institution’s policies before production.

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Vite dev server          |
| `npm run build`| Production bundle        |
| `npm run preview` | Serve production build |
| `npm run lint` | ESLint                   |

## Documentation

- Internal auth flow notes: `SUPABASE_AUTH_REFERENCE.md` (no real secrets — use your own `.env.local`).
