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

- **State is managed via tool calls.** Whenever the user gives you new
  information for any section, immediately call the matching tool
  (\`update_personal\`, \`update_summary\`, \`add_education\`, \`add_experience\`,
  \`set_military\`, \`add_volunteering\`, \`update_skills\`, \`mark_complete\`).
  Do NOT keep CV state only in chat — every fact must be persisted via a tool.
- **Never write files or run shell commands.** PDF generation is triggered by
  a button in the UI, not by you. After the user confirms the CV is complete
  call \`mark_complete\` and tell them they can click "צור PDF".
- **Don't re-read the saved JSON.** The tools are append-only adders for list
  sections (education, experience, volunteering); the user-facing UI shows
  a live preview, so they can see what's stored.
- **Respond in Hebrew at all times** unless the user explicitly switches.
- The original skill instructions follow. Treat them as your full behavior
  spec; this preamble overrides only the parts that mention scripts or files.

---

`;

  cachedPrompt = preamble + skill;
  return cachedPrompt;
}

export function chatModel() {
  // Sonnet 4.6 is the current production Sonnet. Bump as new models ship.
  return anthropic("claude-sonnet-4-6");
}
