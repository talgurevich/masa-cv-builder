# masa-cv-builder

A hosted, conversational Hebrew CV builder for **'מסע אל האופק'** teams and
students. Web app companion to the standalone Claude Code skill at
[talgurevich/cv-skill](https://github.com/talgurevich/cv-skill).

> **Status:** design phase. No app code yet — see `docs/design.md` for the
> full architecture spec.

---

## What this is

A Next.js web app that lets students and team members build a professional
Hebrew CV through a friendly conversation, with a live preview pane and
one-click PDF download. Powered by Claude Sonnet 4.6 with the same prompt
that drives the Claude Code skill.

```
   Browser (chat + live CV preview)
      │
      ▼
   Next.js (Vercel)  ─────►  Anthropic Claude API
      │                       (system prompt = SKILL.md, cached)
      ▼
   Supabase (Postgres + Storage)
      │
      ▼
   Fly.io PDF worker (reuses generate_pdf.py)
```

## Stack

- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind + shadcn/ui (RTL)
- **Chat:** Vercel AI SDK with streaming + tool use
- **LLM:** Anthropic Claude Sonnet 4.6 (with prompt caching)
- **Auth:** Clerk (Google + magic link, allowlist-gated)
- **DB + storage:** Supabase
- **PDF microservice:** Fly.io machine running the existing
  [`generate_pdf.py`](https://github.com/talgurevich/cv-skill/blob/main/skills/cv-builder/scripts/generate_pdf.py)

## How this relates to `cv-skill`

The [cv-skill repo](https://github.com/talgurevich/cv-skill) is the source
of truth for the Hebrew CV-building **prompt + PDF template**. This app
copies those assets at integration time:

| From `cv-skill` | Into `masa-cv-builder` |
|---|---|
| `skills/cv-builder/SKILL.md` | `app/lib/prompts/cv-builder-system.md` (system prompt) |
| `skills/cv-builder/templates/cv_schema.json` | `app/lib/cv-schema.ts` (typed) |
| `skills/cv-builder/templates/cv_template.html` | `app/lib/cv-template.tsx` (React port) + reused as-is in the PDF worker |
| `skills/cv-builder/scripts/generate_pdf.py` | `pdf-worker/generate_pdf.py` (verbatim) |

When the skill prompt or template improves upstream, sync those four files
manually. No git submodule (deliberate — see `docs/design.md` §non-goals).

## Architecture

Full design lives in **[`docs/design.md`](./docs/design.md)** — covers:

- Data model (Postgres schema + RLS)
- API routes (Next.js App Router)
- The 8 tool definitions Claude uses to mutate CV state
- Frontend component tree
- PDF microservice (Dockerfile + Flask wrapper)
- Auth strategy (Clerk + email allowlist)
- Costs (~$5–20/mo at expected scale)
- Risks & decisions
- Phased build plan (~2 weeks)

## Next steps

1. Read `docs/design.md`.
2. Decide on any open questions in §12 of the design doc.
3. When ready, scaffold Next.js + Supabase + Clerk per §13 day-by-day plan.

## License

Internal — not yet licensed for redistribution. The underlying skill is
[MIT](https://github.com/talgurevich/cv-skill/blob/main/LICENSE).

---

Built by **'מסע אל האופק'** for their teams and students.
