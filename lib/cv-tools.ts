import { z } from "zod";
import { tool, type Tool } from "ai";
import type { CVData } from "./cv-schema";
import { emptyCV } from "./cv-schema";

/**
 * Each tool returns a small ack object. The LLM sees the ack as a
 * tool_result, the server commits the mutated CV to Postgres after the
 * turn ends.
 */

type Ack = { ok: true; section: string; note?: string };

function ackOf(section: string, note?: string): Ack {
  return { ok: true, section, note };
}

// ────────────────────────────────────────────────────────────────────────────
// Tool definitions (Vercel AI SDK format)
// ────────────────────────────────────────────────────────────────────────────

export function buildCvTools(state: { cv: CVData }) {
  const tools: Record<string, Tool> = {
    update_personal: tool({
      description:
        'עדכון "פרטים אישיים" של המשתמש. מעבירים רק שדות שהמשתמש סיפק; שדות שלא סופקו - השאר ריקים. חובה לוודא ערך לפני שליחה.',
      parameters: z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        city: z.string().optional(),
        linkedin: z.string().optional(),
        github: z.string().optional(),
        portfolio: z.string().optional(),
      }),
      execute: async (input) => {
        state.cv.personal = { ...state.cv.personal, ...input };
        return ackOf("personal");
      },
    }),

    update_summary: tool({
      description: 'הגדרה או החלפה של תקציר הקורות חיים (paragraph אחד).',
      parameters: z.object({
        text: z.string().min(1),
      }),
      execute: async ({ text }) => {
        state.cv.summary = text;
        return ackOf("summary");
      },
    }),

    add_education: tool({
      description:
        'הוספת פריט אחד לסעיף "השכלה וקורסים". קוראים לכלי הזה פעם לכל מוסד / קורס נפרד.',
      parameters: z.object({
        institution: z.string(),
        degree: z.string().optional(),
        field: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        grade: z.string().optional(),
        highlights: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        state.cv.education.push(input);
        return ackOf("education", `entries: ${state.cv.education.length}`);
      },
    }),

    add_experience: tool({
      description:
        'הוספת תפקיד אחד לסעיף "ניסיון תעסוקתי". קוראים לכלי פעם לכל תפקיד נפרד.',
      parameters: z.object({
        company: z.string(),
        role: z.string(),
        start: z.string(),
        end: z.string().optional(),
        bullets: z.array(z.string()).default([]),
      }),
      execute: async (input) => {
        state.cv.experience.push({ ...input, bullets: input.bullets ?? [] });
        return ackOf("experience", `roles: ${state.cv.experience.length}`);
      },
    }),

    set_military: tool({
      description:
        'הגדרת "ניסיון צבאי". אפשר לסמן skipped אם המשתמש לא שירת, או national_service אם שירות לאומי.',
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
      execute: async (input) => {
        state.cv.military = { ...state.cv.military, ...input };
        return ackOf("military");
      },
    }),

    add_volunteering: tool({
      description:
        'הוספת פריט אחד לסעיף "התנדבויות". קוראים פעם לכל התנדבות נפרדת.',
      parameters: z.object({
        organization: z.string(),
        role: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async (input) => {
        state.cv.volunteering.push(input);
        return ackOf(
          "volunteering",
          `entries: ${state.cv.volunteering.length}`
        );
      },
    }),

    update_skills: tool({
      description:
        'החלפת כל רשימות הכישורים. שולחים תמיד את הרשימה המלאה, לא דלתא.',
      parameters: z.object({
        technical: z.array(z.string()).optional(),
        languages: z
          .array(z.object({ name: z.string(), level: z.string() }))
          .optional(),
        soft: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        state.cv.skills = { ...state.cv.skills, ...input };
        return ackOf("skills");
      },
    }),

    mark_complete: tool({
      description:
        'קוראים לכלי הזה כאשר כל שבעת הסעיפים מולאו והמשתמש מאושר. הצעד הבא הוא הצעה ליצירת PDF.',
      parameters: z.object({}),
      execute: async () => {
        state.cv.meta.last_updated = new Date().toISOString();
        return ackOf("complete");
      },
    }),
  };

  return tools;
}

/**
 * Apply a saved CVData (from Postgres) into a fresh state container so
 * a new chat turn can mutate it via tool calls.
 */
export function loadIntoState(data: unknown): { cv: CVData } {
  const cv = (data && typeof data === "object" ? data : emptyCV()) as CVData;
  // Defensive: ensure all keys exist so tools can push without crashes.
  cv.personal ??= {};
  cv.summary ??= "";
  cv.education ??= [];
  cv.experience ??= [];
  cv.military ??= {};
  cv.volunteering ??= [];
  cv.skills ??= { technical: [], languages: [], soft: [] };
  cv.meta ??= {};
  return { cv };
}
