import { z } from "zod";
import { tool, type Tool } from "ai";
import type {
  CVData,
  EducationEntry,
  ExperienceEntry,
  VolunteeringEntry,
} from "./cv-schema";
import { emptyCV } from "./cv-schema";

/**
 * Each list-mutation tool returns an ack that includes the up-to-date
 * entries (with indices) so the LLM knows what to target on subsequent
 * remove / update calls. This eliminates the previous bug where the bot
 * couldn't remove or edit entries because it had no stable references.
 */

interface IndexedEntry {
  index: number;
  label: string;
  dates?: string;
}

function fmtEducation(e: EducationEntry, i: number): IndexedEntry {
  return {
    index: i,
    label:
      [e.degree, e.field, e.institution].filter(Boolean).join(" · ") ||
      "(ללא כותרת)",
    dates: [e.start, e.end].filter(Boolean).join("–") || undefined,
  };
}

function fmtExperience(x: ExperienceEntry, i: number): IndexedEntry {
  return {
    index: i,
    label:
      [x.role, x.company].filter(Boolean).join(" · ") || "(ללא כותרת)",
    dates: [x.start, x.end].filter(Boolean).join("–") || undefined,
  };
}

function fmtVolunteering(v: VolunteeringEntry, i: number): IndexedEntry {
  return {
    index: i,
    label:
      [v.role, v.organization].filter(Boolean).join(" · ") || "(ללא כותרת)",
    dates: [v.start, v.end].filter(Boolean).join("–") || undefined,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Tool definitions (Vercel AI SDK format)
// ────────────────────────────────────────────────────────────────────────────

export function buildCvTools(state: { cv: CVData }) {
  const tools: Record<string, Tool> = {
    // ── Personal ─────────────────────────────────────────────────────────
    update_personal: tool({
      description:
        'עדכון "פרטים אישיים" של המשתמש. מעבירים רק שדות שהמשתמש סיפק. שולחים רק שדות שיש להם ערך.',
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
        return { ok: true, section: "personal", value: state.cv.personal };
      },
    }),

    // ── Summary ──────────────────────────────────────────────────────────
    update_summary: tool({
      description:
        'הגדרה או החלפה של תקציר הקורות חיים (paragraph אחד). עבור עריכת תקציר קיים - גם כן זה הכלי הנכון.',
      parameters: z.object({ text: z.string().min(1) }),
      execute: async ({ text }) => {
        state.cv.summary = text;
        return { ok: true, section: "summary" };
      },
    }),

    // ── Education ────────────────────────────────────────────────────────
    add_education: tool({
      description:
        'הוספת פריט אחד לסעיף "השכלה וקורסים". משתמש כאשר המשתמש מספר על מוסד / קורס חדש שטרם נרשם.',
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
        return {
          ok: true,
          section: "education",
          total: state.cv.education.length,
          entries: state.cv.education.map(fmtEducation),
        };
      },
    }),

    update_education_at: tool({
      description:
        'עדכון פריט קיים בסעיף "השכלה" לפי אינדקס. שלח רק שדות שצריך לשנות. השתמש לתקן טעויות או להוסיף פרטים שחסרו.',
      parameters: z.object({
        index: z.number().int().nonnegative(),
        institution: z.string().optional(),
        degree: z.string().optional(),
        field: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        grade: z.string().optional(),
        highlights: z.array(z.string()).optional(),
      }),
      execute: async ({ index, ...patch }) => {
        if (index < 0 || index >= state.cv.education.length) {
          return {
            ok: false,
            error: `אין פריט באינדקס ${index}; יש ${state.cv.education.length} פריטים.`,
            entries: state.cv.education.map(fmtEducation),
          };
        }
        state.cv.education[index] = { ...state.cv.education[index], ...patch };
        return {
          ok: true,
          section: "education",
          updated_index: index,
          entries: state.cv.education.map(fmtEducation),
        };
      },
    }),

    remove_education_at: tool({
      description:
        'מחיקת פריט מסעיף "השכלה" לפי אינדקס. השתמש כאשר המשתמש אומר במפורש להסיר / למחוק / לבטל פריט.',
      parameters: z.object({
        index: z.number().int().nonnegative(),
      }),
      execute: async ({ index }) => {
        if (index < 0 || index >= state.cv.education.length) {
          return {
            ok: false,
            error: `אין פריט באינדקס ${index}; יש ${state.cv.education.length} פריטים.`,
            entries: state.cv.education.map(fmtEducation),
          };
        }
        const removed = state.cv.education.splice(index, 1)[0];
        return {
          ok: true,
          section: "education",
          removed_label: fmtEducation(removed, index).label,
          entries: state.cv.education.map(fmtEducation),
        };
      },
    }),

    // ── Experience ───────────────────────────────────────────────────────
    add_experience: tool({
      description:
        'הוספת תפקיד אחד לסעיף "ניסיון תעסוקתי". משתמש כאשר המשתמש מספר על תפקיד חדש שטרם נרשם.',
      parameters: z.object({
        company: z.string(),
        role: z.string(),
        start: z.string(),
        end: z.string().optional(),
        bullets: z.array(z.string()).default([]),
      }),
      execute: async (input) => {
        state.cv.experience.push({ ...input, bullets: input.bullets ?? [] });
        return {
          ok: true,
          section: "experience",
          total: state.cv.experience.length,
          entries: state.cv.experience.map(fmtExperience),
        };
      },
    }),

    update_experience_at: tool({
      description:
        'עדכון תפקיד קיים ב"ניסיון תעסוקתי" לפי אינדקס. שלח רק שדות שצריך לשנות.',
      parameters: z.object({
        index: z.number().int().nonnegative(),
        company: z.string().optional(),
        role: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        bullets: z.array(z.string()).optional(),
      }),
      execute: async ({ index, ...patch }) => {
        if (index < 0 || index >= state.cv.experience.length) {
          return {
            ok: false,
            error: `אין תפקיד באינדקס ${index}; יש ${state.cv.experience.length} תפקידים.`,
            entries: state.cv.experience.map(fmtExperience),
          };
        }
        state.cv.experience[index] = {
          ...state.cv.experience[index],
          ...patch,
        };
        return {
          ok: true,
          section: "experience",
          updated_index: index,
          entries: state.cv.experience.map(fmtExperience),
        };
      },
    }),

    remove_experience_at: tool({
      description:
        'מחיקת תפקיד מ"ניסיון תעסוקתי" לפי אינדקס. השתמש כאשר המשתמש אומר במפורש להסיר.',
      parameters: z.object({
        index: z.number().int().nonnegative(),
      }),
      execute: async ({ index }) => {
        if (index < 0 || index >= state.cv.experience.length) {
          return {
            ok: false,
            error: `אין תפקיד באינדקס ${index}; יש ${state.cv.experience.length} תפקידים.`,
            entries: state.cv.experience.map(fmtExperience),
          };
        }
        const removed = state.cv.experience.splice(index, 1)[0];
        return {
          ok: true,
          section: "experience",
          removed_label: fmtExperience(removed, index).label,
          entries: state.cv.experience.map(fmtExperience),
        };
      },
    }),

    // ── Military (single object, not list) ────────────────────────────────
    set_military: tool({
      description:
        'הגדרת "ניסיון צבאי". אפשר לסמן skipped אם המשתמש לא שירת, או national_service אם שירות לאומי. גם לעריכה - זה הכלי הנכון.',
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
        return { ok: true, section: "military", value: state.cv.military };
      },
    }),

    // ── Volunteering ─────────────────────────────────────────────────────
    add_volunteering: tool({
      description:
        'הוספת פריט אחד לסעיף "התנדבויות".',
      parameters: z.object({
        organization: z.string(),
        role: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async (input) => {
        state.cv.volunteering.push(input);
        return {
          ok: true,
          section: "volunteering",
          total: state.cv.volunteering.length,
          entries: state.cv.volunteering.map(fmtVolunteering),
        };
      },
    }),

    update_volunteering_at: tool({
      description:
        'עדכון התנדבות קיימת לפי אינדקס. שלח רק שדות שצריך לשנות.',
      parameters: z.object({
        index: z.number().int().nonnegative(),
        organization: z.string().optional(),
        role: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async ({ index, ...patch }) => {
        if (index < 0 || index >= state.cv.volunteering.length) {
          return {
            ok: false,
            error: `אין התנדבות באינדקס ${index}; יש ${state.cv.volunteering.length} התנדבויות.`,
            entries: state.cv.volunteering.map(fmtVolunteering),
          };
        }
        state.cv.volunteering[index] = {
          ...state.cv.volunteering[index],
          ...patch,
        };
        return {
          ok: true,
          section: "volunteering",
          updated_index: index,
          entries: state.cv.volunteering.map(fmtVolunteering),
        };
      },
    }),

    remove_volunteering_at: tool({
      description:
        'מחיקת התנדבות לפי אינדקס. השתמש כאשר המשתמש אומר במפורש להסיר.',
      parameters: z.object({
        index: z.number().int().nonnegative(),
      }),
      execute: async ({ index }) => {
        if (index < 0 || index >= state.cv.volunteering.length) {
          return {
            ok: false,
            error: `אין התנדבות באינדקס ${index}; יש ${state.cv.volunteering.length} התנדבויות.`,
            entries: state.cv.volunteering.map(fmtVolunteering),
          };
        }
        const removed = state.cv.volunteering.splice(index, 1)[0];
        return {
          ok: true,
          section: "volunteering",
          removed_label: fmtVolunteering(removed, index).label,
          entries: state.cv.volunteering.map(fmtVolunteering),
        };
      },
    }),

    // ── Skills (already replace-style) ────────────────────────────────────
    update_skills: tool({
      description:
        'החלפת רשימות כישורים. שולחים תמיד רשימה מלאה, לא דלתא. גם לעריכה - שלח את הרשימה החדשה במלואה.',
      parameters: z.object({
        technical: z.array(z.string()).optional(),
        languages: z
          .array(z.object({ name: z.string(), level: z.string() }))
          .optional(),
        soft: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        state.cv.skills = { ...state.cv.skills, ...input };
        return { ok: true, section: "skills", value: state.cv.skills };
      },
    }),

    // ── Completion ───────────────────────────────────────────────────────
    mark_complete: tool({
      description:
        'קוראים לכלי הזה כאשר כל שבעת הסעיפים מולאו והמשתמש מאושר. הצעד הבא הוא הצעה ליצירת PDF.',
      parameters: z.object({}),
      execute: async () => {
        state.cv.meta.last_updated = new Date().toISOString();
        return { ok: true, section: "complete" };
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
