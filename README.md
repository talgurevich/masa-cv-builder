# masa-cv-builder

Conversational Hebrew CV builder for the participants of **מסע אל האופק**, served at
**https://members.masaelhaofek.co.il/cv**. Companion web app to the standalone Claude Code skill at
[talgurevich/cv-skill](https://github.com/talgurevich/cv-skill).

```
Browser → members.masaelhaofek.co.il/cv ──(rewrite in member-tools)──▶ this app (Vercel, basePath /cv)
                                                                          │
                                       Anthropic Claude (chat + tools) ◀──┤
                                                                          ▼
                                  Supabase "masa-tools-members" (members' login, Postgres, Storage)
```

## How it fits with the members' site

- **One login.** The members' site ([talgurevich/member-tools](https://github.com/talgurevich/member-tools))
  forwards `/cv` and `/cv/*` here. Its proxy checks the login and the Monday boards first, and its Supabase
  session cookie reaches this app because the browser sees one domain.
- **Checked again here.** `middleware.ts` repeats the check (`getClaims` + `am_i_member()`), so this app's own
  `*.vercel.app` address is closed too. Logged-out visitors go to the members' `/login?next=/cv...`;
  API calls get a 401.
- **Per member.** Every CV row carries the member's `auth.uid()`. RLS (in
  `masa-tools/supabase/migrations/0009_cv_builder.sql`) lets each member read and write only their own CVs,
  chat messages and PDFs, and only while they are on a board.
- **No service-role key.** The app uses the publishable key and the member's session for everything,
  including the PDF upload, so it holds nothing that can reach staff data.

## What's here

- `app/(app)/` — the CV list (`/cv`) and the workbench (`/cv/<id>`)
- `app/api/cv/` — create, import, chat (streaming, Claude + tools), patch, render PDF / DOCX
- `components/` — chat pane, live preview, upload
- `lib/paths.ts` — `BASE_PATH`, the members' URL, and `api()` for client `fetch` calls (fetch doesn't add the basePath)
- `lib/` — Supabase clients, Anthropic helper, CV schema, the tool definitions Claude calls to edit the CV
- `lib/prompts/cv-builder-system.md` — system prompt (mirrored from `cv-skill`)
- `supabase/migrations/` — **history of the old standalone project only** (that project was deleted on 2026-11-08). The live schema is
  `0009_cv_builder.sql` in the masa-tools repo, which owns the members' project migrations.
- PDFs render in `app/api/cv/[id]/render` with `@sparticuz/chromium` on Vercel, from the HTML in `lib/cv-template.ts`

## Environment

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | the members' project URL (same as member-tools) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the members' project publishable key (same as member-tools) |
| `ANTHROPIC_API_KEY` | Claude, for the chat and CV import |
| `NEXT_PUBLIC_MEMBERS_URL` | optional, defaults to `https://members.masaelhaofek.co.il` |

## Run locally

The login lives on the members' site, so run both: member-tools on port 3000 with
`CV_BUILDER_URL=http://127.0.0.1:3001` in its `.env.local`, and this app with

```bash
npm install
NEXT_PUBLIC_MEMBERS_URL=http://127.0.0.1:3000 npx next dev -p 3001
```

then open http://127.0.0.1:3000/cv (use 127.0.0.1, not localhost, as in member-tools).

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
   `/api/cv/[id]/render` → Chromium on Vercel → Supabase Storage → signed URL

## Syncing with the skill repo

When the prompt or PDF template is improved upstream in `cv-skill`, copy
these files:

| From `cv-skill` | To `masa-cv-builder` |
|---|---|
| `skills/cv-builder/SKILL.md` | `lib/prompts/cv-builder-system.md` |
| `skills/cv-builder/templates/cv_schema.json` | `lib/cv-schema.ts` (port to TS) |
| `skills/cv-builder/templates/cv_template.html` | `lib/cv-template.ts` (port the markup and CSS) |

Note: the **font stack** in `lib/cv-template.ts` loads `Noto Sans Hebrew` from Google Fonts,
because the serverless Chromium has no Hebrew system fonts. Keep that when syncing.

## Architecture deep-dive

See [`docs/design.md`](./docs/design.md) for the full design — data model,
tool schemas, route signatures, risks, costs, and the 2-week build plan.

## License

Internal — not yet licensed for redistribution. The underlying skill is
[MIT](https://github.com/talgurevich/cv-skill/blob/main/LICENSE).

---

Built by **'מסע אל האופק'** for their teams and students.
