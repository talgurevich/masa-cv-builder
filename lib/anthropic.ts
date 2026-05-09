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

Every fact the user gives you must be persisted via a tool call — never
keep CV state only in chat memory.

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

**Editing existing content** — you have full edit/delete capability for
all list sections. The acks of \`add_*\`, \`update_*_at\`, and \`remove_*_at\`
include the current entries with their indices, so you always know what
each index points to. When the user asks you to fix or remove something:
- For typos / extra info on an existing entry → \`update_education_at\`,
  \`update_experience_at\`, or \`update_volunteering_at\` with the matching
  \`index\` and only the fields that change.
- To delete an entry → \`remove_education_at\`, \`remove_experience_at\`, or
  \`remove_volunteering_at\` with the index.
- To edit the תקציר → call \`update_summary\` again with the new text.
- To change military / personal / skills → call the same tool again with
  the new values.

You are never stuck. If a user says "תוריד את X" or "תקן את X" or
"זה לא נכון, זה היה ב-2007", call the appropriate update or remove tool
immediately — do **not** tell the user you can't edit something.

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
