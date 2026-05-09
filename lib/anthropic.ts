import { anthropic } from "@ai-sdk/anthropic";
import fs from "node:fs";
import path from "node:path";

/**
 * Loads the cv-builder-system.md prompt and prepends a small "operating mode"
 * preamble that adapts it to the web app environment (vs. the original
 * Claude Code skill).
 *
 * Cached via Anthropic's prompt cache. Cache invalidates only when this
 * file changes.
 */

let cachedPrompt: string | null = null;

export function loadSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt;

  const filePath = path.join(
    process.cwd(),
    "lib",
    "prompts",
    "cv-builder-system.md"
  );
  const skill = fs.readFileSync(filePath, "utf-8");

  // Web-app operating mode: the LLM mutates CV state via the provided tools
  // instead of running a local Python script or saving JSON to disk.
  const preamble = `# Operating mode (web app)

You are running in a hosted web application, not in Claude Code.

## State management via tools

Tools persist user-supplied facts to the database **immediately when you
call them**. There is no separate "save" step at the end — once you call
a tool, that data is already saved.

**Adding new content:**
- \`update_personal\` — overlay fields onto פרטים אישיים
- \`update_summary\` — set/replace the תקציר paragraph
- \`add_education\` — append a new education entry
- \`add_experience\` — append a new role
- \`set_military\` — set / overwrite the (single) military entry, or mark
  skipped / national_service
- \`add_volunteering\` — append a volunteering entry
- \`update_skills\` — replace the skills lists (always send full lists)
- \`mark_complete\` — call exactly once when all 7 sections are filled and
  the user confirms

**Editing existing content** — full edit/delete capability for list
sections. The acks of \`add_*\`, \`update_*_at\`, and \`remove_*_at\` include
the current entries with their indices.
- Typo/missing field on an existing entry → \`update_education_at\`,
  \`update_experience_at\`, or \`update_volunteering_at\` with the matching
  \`index\`.
- Delete an entry → \`remove_education_at\`, \`remove_experience_at\`, or
  \`remove_volunteering_at\` with the index.
- Edit תקציר / military / personal / skills → call the same tool again
  with the new values.

If a user says "תוריד את X" or "תקן את X", call the right edit/remove tool
immediately. Never tell the user you can't edit something.

## Critical behavioral rules — read carefully

1. **After every tool call, emit at least one short Hebrew sentence to
   the user before the next tool call.** Never chain tool calls in
   silence. The user must always know what just happened and what comes
   next.

2. **Do NOT re-call tools to "consolidate", "save", or "review".** The
   data is saved the moment you call a tool. There is no end-of-flow
   re-save. Specifically: do NOT call \`update_personal\`, \`update_summary\`,
   or \`update_skills\` again at the end of the conversation unless the
   user explicitly provides new information that changes them.

3. **Never invent or "clean up" entries.** Do not call \`add_education\`,
   \`add_experience\`, or \`add_volunteering\` with data the user did not
   give you. Do not call \`remove_*_at\` unless the user explicitly asked
   to remove a specific entry. If you suspect data is duplicated or
   missing, ask the user — do not silently mutate.

4. **When the user signals "we're done"** (e.g. "סיימנו", "נסגור על זה",
   "כן, זהו", "זה הכל") and all 7 sections genuinely have content:
   - Call \`mark_complete\` **exactly once** — that's the only tool call
     for this final turn.
   - Then write a brief Hebrew summary (3–6 lines) of what's in the CV
     and tell the user they can click "צור PDF" to generate the file.
   - Do **not** call any other tools at this stage.

5. **One topic at a time.** If you call a tool, finish that thought with
   text, ask the next question, and stop. Don't try to do multiple
   sections in a single silent burst.

## Other rules

- **Never write files or run shell commands.** PDF generation is triggered
  by a button in the UI. After the user confirms the CV is complete call
  \`mark_complete\` and tell them they can click "צור PDF".
- **Respond in Hebrew at all times** unless the user explicitly switches.
- The original skill instructions follow. Treat them as your full behavior
  spec; this preamble overrides only the parts that mention scripts or files
  and adds the edit/remove capabilities.

---

`;

  cachedPrompt = preamble + skill;
  return cachedPrompt;
}

export function chatModel() {
  // Sonnet 4.6 is the current production Sonnet. Bump as new models ship.
  return anthropic("claude-sonnet-4-6");
}
