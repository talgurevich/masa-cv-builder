# CV Builder Web App — Design Doc

A hosted, conversational Hebrew CV builder for **'מסע אל האופק'** teams and
students. Reuses the prompt and PDF pipeline from this skill repo as the
internal building blocks.

---

## 1. Context & goals

- Internal-only product. Audience: students and team members of 'מסע אל האופק'.
- Conversational, Hebrew-first CV building. Same flow the Claude Code skill
  delivers today, but as a hosted web app with login, history, and PDF download.
- Reuses two existing assets:
  1. `skills/cv-builder/SKILL.md` → becomes the cached system prompt for the
     Anthropic API.
  2. `skills/cv-builder/scripts/generate_pdf.py` → becomes a tiny PDF
     microservice (no rewrite).

### Non-goals (v1)

- Public signup, billing, marketing site.
- Multiple CV themes/templates.
- Translation to other languages (Hebrew-only ships first).
- Mobile-native apps (responsive web is enough).
- ATS scoring, peer review, analytics dashboards.

---

## 2. User flow

1. Visitor hits the app → sees a single Hebrew CTA: **"כניסה"**.
2. Clerk modal: Google sign-in or magic-link email (allowlist enforced).
3. After login, lands on the dashboard:
   - Sidebar with their existing CVs (or empty state).
   - Big button: **"+ קורות חיים חדשים"**.
4. Click it → split-pane view:
   - **Left:** chat (the SKILL.md flow exactly as it runs in Claude Code today).
   - **Right:** live CV preview, updates as Claude calls tools.
5. After the seven sections are filled, the assistant offers:
   - **"להתאים לתיאור משרה"** (paste JD field appears).
   - **"צור PDF"**.
6. Generate → PDF stored in Supabase Storage → signed URL download.
7. Resume any time from the sidebar.

---

## 3. Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + Tailwind + shadcn/ui | RTL config in `tailwind.config.ts` (`direction: 'rtl'` on root) |
| Chat UI | Vercel AI SDK (`useChat`) | Streaming + tool-call rendering out of the box |
| LLM | Anthropic Claude Sonnet 4.6 with prompt caching | Cache hit on the SKILL.md system prompt |
| Auth | Clerk | Google + magic link, allowlist by email domain |
| DB | Supabase (Postgres) | Users, CV drafts, message history |
| File storage | Supabase Storage | PDFs, private bucket, signed URLs |
| PDF renderer | Existing `generate_pdf.py` dockerized on Fly.io | One always-on machine, ~$1–3/mo |
| Hosting | Vercel (Next.js) + Fly.io (PDF worker) | Both have generous free tiers |

---

## 4. Architecture (one diagram)

```
   Browser (Next.js client)
      │  ▲
      │  │ stream
      ▼  │
   Next.js server (Vercel)  ─────────►  Anthropic API
      │                                 (Claude Sonnet 4.6 + tools)
      │
      ▼
   Supabase  (Postgres + Storage + RLS)
      │
      ▼
   Fly.io PDF worker
   (Python + Chromium + generate_pdf.py)
```

---

## 5. Data model

```sql
create table users (
  id            uuid primary key default gen_random_uuid(),
  clerk_id      text unique not null,
  email         text not null,
  display_name  text,
  created_at    timestamptz default now()
);

create table cvs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  title             text not null default 'קורות חיים',
  data              jsonb not null default '{}'::jsonb,    -- matches cv_schema.json
  status            text not null default 'draft',         -- draft | complete | tuned
  job_description   text,
  job_keywords      text[],
  pdf_path          text,                                  -- Supabase Storage key
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table messages (
  id           uuid primary key default gen_random_uuid(),
  cv_id        uuid not null references cvs(id) on delete cascade,
  role         text not null,                               -- system | user | assistant | tool
  content      jsonb not null,                              -- {text, tool_use, tool_result}
  created_at   timestamptz default now()
);

create index on cvs (user_id, updated_at desc);
create index on messages (cv_id, created_at);
```

**RLS** policies on `cvs` and `messages`: every row scoped to `auth.uid()`.
Service role key on the server bypasses RLS only inside trusted API routes.

---

## 6. API surface (Next.js App Router)

| Route | Method | Purpose |
|---|---|---|
| `/api/cv` | POST | Create CV draft (returns `{id}`) |
| `/api/cv/[id]` | GET | Fetch full CV + messages |
| `/api/cv/[id]` | PATCH | Rename, archive |
| `/api/cv/[id]` | DELETE | Soft delete |
| `/api/cv/[id]/chat` | POST | Stream chat with tool use (the heart) |
| `/api/cv/[id]/render` | POST | Forward to Fly.io renderer, return signed URL |
| `/api/cv/[id]/tune` | POST | Apply JD tuning |

The `chat` route is the only complex one. Pseudocode:

```ts
// app/api/cv/[id]/chat/route.ts
export const runtime = 'nodejs'  // not Edge — Anthropic SDK + tool loop

export async function POST(req, { params }) {
  const { userMessage } = await req.json();
  const cv = await loadCV(params.id, currentUserId());
  const history = await loadMessages(params.id);

  await persistMessage(params.id, 'user', userMessage);

  const stream = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' }}],
    messages: [...history.toAnthropic(), { role: 'user', content: userMessage }],
    tools: cvTools,                              // 8 tools, see §7
    onToolCall: async ({ name, input }) => {
      const result = await applyTool(cv, name, input);  // mutates DB
      return result;
    },
    onFinish: async ({ messages }) => {
      await persistAssistantTurn(params.id, messages);
    },
  });

  return stream.toDataStreamResponse();
}
```

---

## 7. Tools (state mutation surface)

Eight tools, strict JSON schemas. Server-side handlers validate input, merge
into `cvs.data` (jsonb), update `cvs.updated_at`, and return a small ack
that Claude sees as a `tool_result`.

```ts
export const cvTools = {
  update_personal: {
    description: 'Update פרטים אישיים. Pass only fields the user provided.',
    parameters: z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      city: z.string().optional(),
      linkedin: z.string().url().optional(),
      github: z.string().url().optional(),
      portfolio: z.string().url().optional(),
    }),
  },
  update_summary: {
    description: 'Set or replace the תקציר section.',
    parameters: z.object({ text: z.string().min(1) }),
  },
  add_education: {
    description: 'Append one education entry.',
    parameters: z.object({
      institution: z.string(),
      degree: z.string().optional(),
      field: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      grade: z.string().optional(),
      highlights: z.array(z.string()).optional(),
    }),
  },
  add_experience: {
    description: 'Append one professional experience entry.',
    parameters: z.object({
      company: z.string(),
      role: z.string(),
      start: z.string(),
      end: z.string().optional(),
      bullets: z.array(z.string()).default([]),
    }),
  },
  set_military: {
    description: 'Set ניסיון צבאי, or mark as skipped, or set as שירות לאומי.',
    parameters: z.object({
      skipped: z.boolean().default(false),
      national_service: z.boolean().default(false),
      role: z.string().optional(),
      unit: z.string().optional(),
      rank: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      bullets: z.array(z.string()).optional(),
    }),
  },
  add_volunteering: {
    description: 'Append one volunteering entry.',
    parameters: z.object({
      organization: z.string(),
      role: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      description: z.string().optional(),
    }),
  },
  update_skills: {
    description: 'Replace skills lists. Always send the full list, not deltas.',
    parameters: z.object({
      technical: z.array(z.string()).optional(),
      languages: z.array(z.object({ name: z.string(), level: z.string() })).optional(),
      soft: z.array(z.string()).optional(),
    }),
  },
  mark_complete: {
    description: 'Call once all 7 sections are filled. Triggers PDF offer.',
    parameters: z.object({}),
  },
};
```

**Why "always send full list" for skills:** simpler merge, no orphaned items.

---

## 8. Frontend component tree

```
app/
├── (marketing)/
│   └── page.tsx                        # /,  one-button "כניסה"
├── (app)/
│   ├── layout.tsx                      # sidebar + auth gate
│   ├── cv/
│   │   ├── page.tsx                    # CV list / dashboard
│   │   └── [id]/
│   │       └── page.tsx                # ChatPane | CVPreviewPane
│   └── api/
│       └── cv/
│           ├── route.ts                # POST = create
│           └── [id]/
│               ├── route.ts            # GET / PATCH / DELETE
│               ├── chat/route.ts       # streaming chat
│               ├── render/route.ts     # PDF
│               └── tune/route.ts       # JD tuning
├── lib/
│   ├── anthropic.ts                    # SDK + cached system prompt loader
│   ├── cv-tools.ts                     # tool defs + handlers
│   ├── cv-template.tsx                 # React port of cv_template.html
│   ├── prompts/cv-builder-system.md    # ← copied from this skill
│   └── db.ts                           # Supabase client
└── components/
    ├── ChatPane.tsx                    # useChat() wrapper, RTL
    ├── CVPreviewPane.tsx               # renders cv-template.tsx live
    ├── Message.tsx
    ├── ToolCallChip.tsx                # "✓ עדכון תקציר" etc.
    ├── JobDescriptionDrawer.tsx        # JD paste + tune flow
    └── PDFDownloadButton.tsx
```

The CV preview is just the existing `cv_template.html` ported to JSX with the
same CSS — so the on-screen preview matches the printed PDF exactly.

---

## 9. PDF microservice

Tiny Flask app, single endpoint, wraps the existing script verbatim.

```python
# pdf-worker/app.py
from flask import Flask, request, send_file, abort
from pathlib import Path
import os, tempfile
from generate_pdf import render_html, html_to_pdf

app = Flask(__name__)
SECRET = os.environ['RENDER_SHARED_SECRET']

@app.post('/render')
def render():
    if request.headers.get('Authorization') != f'Bearer {SECRET}':
        abort(401)
    data = request.get_json(force=True)
    html = render_html(data)
    out = Path(tempfile.mkstemp(suffix='.pdf')[1])
    html_to_pdf(html, out)
    return send_file(out, mimetype='application/pdf',
                     as_attachment=True, download_name='cv.pdf')
```

```dockerfile
FROM python:3.12-slim
RUN apt-get update && apt-get install -y \
      chromium fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
# Bundle Hebrew fonts so the container doesn't depend on the host
COPY fonts/Heebo-*.ttf fonts/Assistant-*.ttf /usr/share/fonts/truetype/hebrew/
RUN fc-cache -f
COPY . /app
WORKDIR /app
RUN pip install --no-cache-dir flask jinja2 gunicorn
ENV CHROME_PATH=/usr/bin/chromium
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:8080", "--timeout", "60", "app:app"]
```

Fly.io config: 1 always-on machine, 256MB RAM, internal-only by default,
public via authenticated proxy. Total cost <$3/mo at expected load.

The Next.js `/render` route: load CV data → POST to Fly worker → upload
returned PDF blob to Supabase Storage at
`cvs/{user_id}/{cv_id}/{ISO timestamp}.pdf` → return a 5-minute signed URL.

---

## 10. Auth strategy

- **Clerk** with two enabled methods: Google OAuth, email magic link.
- Allowlist enforcement: a `allowed_emails` table (or domain regex) checked
  in a Clerk webhook on `user.created` — auto-delete users not on the list.
- Admin invites: simple Postgres insert + a one-line "send invite" mailer.
- Sessions: Clerk JWT in cookies; server reads `userId` via Clerk's helper
  and maps to a row in `users` (created on first login).

---

## 11. Costs at expected scale (~200 active students)

| Service | Estimate |
|---|---|
| Vercel (Hobby) | $0 |
| Anthropic API (Claude Sonnet 4.6 with caching) | $5–15 / month |
| Supabase (Free tier) | $0 (until 500MB DB or 1GB storage) |
| Fly.io PDF worker | $0–3 / month |
| Clerk (Free tier) | $0 (up to 10K MAU) |
| **Total** | **~$5–20 / month** |

---

## 12. Risks & decisions to make

1. **Tool-use loop in Edge runtime won't work.** Use `runtime = 'nodejs'`
   for `/api/cv/[id]/chat`. Edge functions can't keep streaming connections
   open through multi-turn tool loops cleanly with the Anthropic SDK.

2. **State race when Claude fires several tools in one turn.** Apply them
   sequentially in `onToolCall`; only commit to DB once at end of turn (or
   wrap each in a transaction). Don't write per tool from many parallel
   handlers.

3. **Hebrew fonts on Linux containers.** Bundle Heebo + Assistant TTFs into
   the Docker image (see §9). Don't rely on `fc-cache` finding system fonts.

4. **iOS Safari + RTL textareas** can mis-position the cursor inside the
   input. Test on a real device by week 1; fix with `dir="auto"` if needed.

5. **PDF cold starts.** Either keep one Fly machine warm (`auto_stop_machines = false`)
   or use `min_machines_running = 1`.

6. **Privacy.** CVs contain PII. Mandatory: (a) RLS on `cvs` and `messages`,
   (b) private Supabase bucket, (c) short-TTL signed URLs (5–15 min), (d)
   encrypted backups, (e) GDPR-style "delete my data" admin action.

7. **Prompt drift.** When the SKILL.md changes, the cached system prompt
   invalidates. That's fine — the cache rebuilds on the next request.
   Just don't tweak it casually mid-day.

---

## 13. Phased build plan (~2 weeks of focused work)

### Week 1 — chat + state

| Day | Goal |
|---|---|
| 1 | Next.js scaffold, Clerk auth, RTL Tailwind, Supabase migrations + RLS |
| 2 | `/api/cv/[id]/chat` streaming with Anthropic SDK + cached system prompt |
| 3 | All 8 tools wired with strict schemas; server-side merge logic |
| 4 | `ChatPane` component, message rendering, tool-call chips |
| 5 | `CVPreviewPane` (port `cv_template.html` → React); live updates |
| 6 | Save & resume; CV list dashboard |
| 7 | Buffer + polish |

### Week 2 — PDF + tuning + ship

| Day | Goal |
|---|---|
| 8 | Dockerize `generate_pdf.py`, bundle Hebrew fonts, deploy Fly worker |
| 9 | `/api/cv/[id]/render` route; Storage upload; download UI |
| 10 | JD-tuning flow (paste → tool call → diff preview → confirm) |
| 11 | Mobile polish, error/empty/loading states, copy review |
| 12 | Deploy, invite 5 internal users |
| 13–14 | Iterate on feedback |

### What I'd build first if I had only one day

The **chat → tool calls → live preview → PDF download** path with hard-coded
auth (one test user, no Clerk yet). Skip dashboard, skip JD tuning, skip
mobile. Get the magic moment working: type → see CV update → click → get a
beautiful Hebrew PDF. Everything else is layering on top of that.

---

## 14. Glossary of files to copy from this repo

| From | To | Purpose |
|---|---|---|
| `skills/cv-builder/SKILL.md` | `app/lib/prompts/cv-builder-system.md` | System prompt (cache target) |
| `skills/cv-builder/templates/cv_schema.json` | `app/lib/cv-schema.ts` (port to TS) | Source of truth for the `cvs.data` jsonb |
| `skills/cv-builder/templates/cv_template.html` | `app/lib/cv-template.tsx` + `app/lib/cv-template.css` | Server-side render via React for the preview pane |
| `skills/cv-builder/scripts/generate_pdf.py` | `pdf-worker/generate_pdf.py` | PDF microservice (verbatim) |

---

*This doc is intentionally short on UI mocks and long on contracts — the
contracts (data model, tools, routes) are what take time to get right; the
UI is mostly shadcn/ui defaults plus copy.*
