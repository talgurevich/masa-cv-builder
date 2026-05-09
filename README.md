# masa-cv-builder

Hosted, conversational Hebrew CV builder for **'מסע אל האופק'** teams and
students. Companion web app to the standalone Claude Code skill at
[talgurevich/cv-skill](https://github.com/talgurevich/cv-skill).

```
   Browser  →  Next.js (Vercel)  →  Anthropic Claude (Sonnet 4.6 + tools)
                     │
                     ▼
                 Supabase (Auth + Postgres + Storage)
                     │
                     ▼
                 Fly.io PDF worker (Chromium + generate_pdf.py)
```

## What's here

- `app/` — Next.js 15 App Router (chat page, dashboard, auth, API routes)
- `components/` — chat pane, live CV preview pane, login button, etc.
- `lib/` — Supabase clients (browser + server + middleware), Anthropic
  helper, CV schema, **the 8 tool definitions** that Claude calls to mutate
  CV state
- `lib/prompts/cv-builder-system.md` — system prompt (mirrored from `cv-skill`)
- `supabase/migrations/0001_init.sql` — schema, RLS policies, allowlist
  trigger, storage bucket
- `pdf-worker/` — standalone Flask + Chromium service for Fly.io
- `docs/design.md` — full architecture spec

## Setup

### 0. Prerequisites

- Node 20+
- A Supabase project ([create one](https://supabase.com/dashboard))
- A Vercel project (we'll connect it later)
- An Anthropic API key
- Fly.io CLI (`brew install flyctl`) for the PDF worker
- A Google Cloud OAuth client (Web type) for sign-in

### 1. Configure Supabase

In the Supabase dashboard:

1. **Run the migration** — open SQL Editor and paste
   `supabase/migrations/0001_init.sql`. This creates `users`, `cvs`,
   `messages`, `allowed_emails`, the `cv-pdfs` storage bucket, and all
   RLS policies.
2. **Enable Google OAuth** — Authentication → Providers → Google →
   paste your Google OAuth client ID and secret. Copy the redirect URL
   Supabase shows you and add it to your Google OAuth client's
   "Authorized redirect URIs".
3. **Add your email to the allowlist:**
   ```sql
   insert into public.allowed_emails (email) values ('you@example.com');
   ```
   Anyone not in this table gets blocked at sign-in by the trigger.

### 2. Configure Vercel + env vars

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

You need:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — same page, "Service role" secret. Keep server-only.
- `ANTHROPIC_API_KEY` — https://console.anthropic.com → API Keys
- `PDF_WORKER_URL` — fill in after step 4
- `RENDER_SHARED_SECRET` — `openssl rand -hex 32`

When deploying to Vercel, set the same vars under Project Settings → Environment Variables.

### 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### 4. Deploy the PDF worker

See [`pdf-worker/README.md`](./pdf-worker/README.md) for the full Fly.io
walkthrough. Short version:

```bash
cd pdf-worker
fly auth login
fly launch --no-deploy
fly secrets set RENDER_SHARED_SECRET=$(openssl rand -hex 32)
fly deploy
```

Take the resulting `*.fly.dev` URL and put it in Vercel's `PDF_WORKER_URL`.
Use the **same** `RENDER_SHARED_SECRET` value on Vercel and Fly.

### 5. Deploy the app

Push to GitHub, connect the repo in Vercel, set the env vars, deploy. After
the first deploy, add the Vercel URL (e.g. `https://masa-cv.vercel.app`)
as an allowed Site URL in Supabase → Authentication → URL Configuration.

## How the conversation flow works

1. User opens a new CV → frontend POSTs `/api/cv` to create a draft row
2. Page loads → ChatPane sends a synthetic first turn that asks Claude to
   send the Hebrew welcome message and start the first section
3. Each user reply streams into `/api/cv/[id]/chat` which:
   - Loads the current `cvs.data` JSON
   - Builds the 8 tools with handlers that mutate that JSON
   - Streams Claude's response with tool use enabled
   - Persists the mutated JSON back to Postgres on `onFinish`
4. The CVPreviewPane re-fetches the row after each turn and re-renders
   the live preview (`<CVDocument>`) — same layout as the printed PDF
5. When `mark_complete` fires, the "צור PDF" button activates → POST
   `/api/cv/[id]/render` → Fly worker → Supabase Storage → signed URL

## Syncing with the skill repo

When the prompt or PDF template is improved upstream in `cv-skill`, copy
the four files:

| From `cv-skill` | To `masa-cv-builder` |
|---|---|
| `skills/cv-builder/SKILL.md` | `lib/prompts/cv-builder-system.md` |
| `skills/cv-builder/templates/cv_schema.json` | `lib/cv-schema.ts` (port to TS) |
| `skills/cv-builder/templates/cv_template.html` | `pdf-worker/templates/cv_template.html` |
| `skills/cv-builder/scripts/generate_pdf.py` | `pdf-worker/generate_pdf.py` |

Note: the **font stack** in `pdf-worker/templates/cv_template.html` is
intentionally different (adds `Noto Sans Hebrew` for Linux container
rendering). Don't overwrite that line when syncing.

## Architecture deep-dive

See [`docs/design.md`](./docs/design.md) for the full design — data model,
tool schemas, route signatures, risks, costs, and the 2-week build plan.

## License

Internal — not yet licensed for redistribution. The underlying skill is
[MIT](https://github.com/talgurevich/cv-skill/blob/main/LICENSE).

---

Built by **'מסע אל האופק'** for their teams and students.
