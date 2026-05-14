import { z } from "zod";
import { tool, type Tool } from "ai";
import { randomUUID } from "node:crypto";
import type {
  CVData,
  EducationEntry,
  ExperienceEntry,
  VolunteeringEntry,
} from "./cv-schema";
import { emptyCV } from "./cv-schema";

/**
 * Tools for mutating a CVData state container. List entries are addressed by
 * stable `id` (uuid). Indices are not used — they shift on remove and confuse
 * the LLM across multi-turn sessions.
 *
 * Each tool calls `persist()` after mutating so the DB is durable mid-stream
 * (a dropped connection won't lose data already collected). Callers wire
 * `persist` to a debounced supabase update.
 */

interface IndexedEntry {
  id: string;
  label: string;
  dates?: string;
}

function fmtEducation(e: EducationEntry): IndexedEntry {
  return {
    id: e.id,
    label:
      [e.degree, e.field, e.institution].filter(Boolean).join(" · ") ||
      "(ללא כותרת)",
    dates: [e.start, e.end].filter(Boolean).join("–") || undefined,
  };
}

function fmtExperience(x: ExperienceEntry): IndexedEntry {
  return {
    id: x.id,
    label:
      [x.role, x.company].filter(Boolean).join(" · ") || "(ללא כותרת)",
    dates: [x.start, x.end].filter(Boolean).join("–") || undefined,
  };
}

function fmtVolunteering(v: VolunteeringEntry): IndexedEntry {
  return {
    id: v.id,
    label:
      [v.role, v.organization].filter(Boolean).join(" · ") || "(ללא כותרת)",
    dates: [v.start, v.end].filter(Boolean).join("–") || undefined,
  };
}

interface BuildToolsOptions {
  persist: () => void;
}

export function buildCvTools(
  state: { cv: CVData },
  opts: BuildToolsOptions = { persist: () => {} }
) {
  const { persist } = opts;

  const tools: Record<string, Tool> = {
    // ── Personal ─────────────────────────────────────────────────────────
    update_personal: tool({
      description:
        'עדכון "פרטים אישיים" של המשתמש. שלח רק שדות שהמשתמש סיפק.',
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
        persist();
        return { ok: true, section: "personal", value: state.cv.personal };
      },
    }),

    // ── Summary ──────────────────────────────────────────────────────────
    update_summary: tool({
      description:
        "הגדרה או החלפה של תקציר הקורות חיים. גם לעריכה - זה הכלי הנכון.",
      parameters: z.object({ text: z.string().min(1) }),
      execute: async ({ text }) => {
        state.cv.summary = text;
        persist();
        return { ok: true, section: "summary" };
      },
    }),

    // ── Education ────────────────────────────────────────────────────────
    add_education: tool({
      description: 'הוספת פריט אחד לסעיף "השכלה וקורסים".',
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
        const entry: EducationEntry = { id: randomUUID(), ...input };
        state.cv.education.push(entry);
        persist();
        return {
          ok: true,
          section: "education",
          id: entry.id,
          total: state.cv.education.length,
        };
      },
    }),

    update_education: tool({
      description:
        'עדכון פריט קיים בסעיף "השכלה" לפי id. שלח רק שדות שצריך לשנות. ה-id מופיע ב-<current_cv>.',
      parameters: z.object({
        id: z.string(),
        institution: z.string().optional(),
        degree: z.string().optional(),
        field: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        grade: z.string().optional(),
        highlights: z.array(z.string()).optional(),
      }),
      execute: async ({ id, ...patch }) => {
        const idx = state.cv.education.findIndex((e) => e.id === id);
        if (idx === -1) {
          return {
            ok: false,
            error: `אין פריט השכלה עם id=${id}.`,
            entries: state.cv.education.map(fmtEducation),
          };
        }
        state.cv.education[idx] = { ...state.cv.education[idx], ...patch };
        persist();
        return { ok: true, section: "education", id };
      },
    }),

    remove_education: tool({
      description:
        'מחיקת פריט מסעיף "השכלה" לפי id. השתמש כאשר המשתמש מבקש במפורש למחוק.',
      parameters: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const idx = state.cv.education.findIndex((e) => e.id === id);
        if (idx === -1) {
          return {
            ok: false,
            error: `אין פריט השכלה עם id=${id}.`,
            entries: state.cv.education.map(fmtEducation),
          };
        }
        const removed = state.cv.education.splice(idx, 1)[0];
        persist();
        return {
          ok: true,
          section: "education",
          removed_label: fmtEducation(removed).label,
        };
      },
    }),

    // ── Experience ───────────────────────────────────────────────────────
    add_experience: tool({
      description: 'הוספת תפקיד אחד לסעיף "ניסיון תעסוקתי".',
      parameters: z.object({
        company: z.string(),
        role: z.string(),
        start: z.string(),
        end: z.string().optional(),
        bullets: z.array(z.string()).default([]),
      }),
      execute: async (input) => {
        const entry: ExperienceEntry = {
          id: randomUUID(),
          ...input,
          bullets: input.bullets ?? [],
        };
        state.cv.experience.push(entry);
        persist();
        return {
          ok: true,
          section: "experience",
          id: entry.id,
          total: state.cv.experience.length,
        };
      },
    }),

    update_experience: tool({
      description:
        'עדכון תפקיד קיים ב"ניסיון תעסוקתי" לפי id. שלח רק שדות שצריך לשנות.',
      parameters: z.object({
        id: z.string(),
        company: z.string().optional(),
        role: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        bullets: z.array(z.string()).optional(),
      }),
      execute: async ({ id, ...patch }) => {
        const idx = state.cv.experience.findIndex((e) => e.id === id);
        if (idx === -1) {
          return {
            ok: false,
            error: `אין תפקיד עם id=${id}.`,
            entries: state.cv.experience.map(fmtExperience),
          };
        }
        state.cv.experience[idx] = { ...state.cv.experience[idx], ...patch };
        persist();
        return { ok: true, section: "experience", id };
      },
    }),

    remove_experience: tool({
      description:
        'מחיקת תפקיד מ"ניסיון תעסוקתי" לפי id. השתמש כאשר המשתמש אומר במפורש להסיר.',
      parameters: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const idx = state.cv.experience.findIndex((e) => e.id === id);
        if (idx === -1) {
          return {
            ok: false,
            error: `אין תפקיד עם id=${id}.`,
            entries: state.cv.experience.map(fmtExperience),
          };
        }
        const removed = state.cv.experience.splice(idx, 1)[0];
        persist();
        return {
          ok: true,
          section: "experience",
          removed_label: fmtExperience(removed).label,
        };
      },
    }),

    // ── Military (single object, not list) ────────────────────────────────
    set_military: tool({
      description:
        'הגדרת "ניסיון צבאי". skipped אם לא שירת, national_service אם שירות לאומי. גם לעריכה.',
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
        persist();
        return { ok: true, section: "military", value: state.cv.military };
      },
    }),

    // ── Volunteering ─────────────────────────────────────────────────────
    add_volunteering: tool({
      description: 'הוספת פריט אחד לסעיף "התנדבויות".',
      parameters: z.object({
        organization: z.string(),
        role: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async (input) => {
        const entry: VolunteeringEntry = { id: randomUUID(), ...input };
        state.cv.volunteering.push(entry);
        persist();
        return {
          ok: true,
          section: "volunteering",
          id: entry.id,
          total: state.cv.volunteering.length,
        };
      },
    }),

    update_volunteering: tool({
      description:
        'עדכון התנדבות קיימת לפי id. שלח רק שדות שצריך לשנות.',
      parameters: z.object({
        id: z.string(),
        organization: z.string().optional(),
        role: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async ({ id, ...patch }) => {
        const idx = state.cv.volunteering.findIndex((e) => e.id === id);
        if (idx === -1) {
          return {
            ok: false,
            error: `אין התנדבות עם id=${id}.`,
            entries: state.cv.volunteering.map(fmtVolunteering),
          };
        }
        state.cv.volunteering[idx] = {
          ...state.cv.volunteering[idx],
          ...patch,
        };
        persist();
        return { ok: true, section: "volunteering", id };
      },
    }),

    remove_volunteering: tool({
      description: "מחיקת התנדבות לפי id.",
      parameters: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const idx = state.cv.volunteering.findIndex((e) => e.id === id);
        if (idx === -1) {
          return {
            ok: false,
            error: `אין התנדבות עם id=${id}.`,
            entries: state.cv.volunteering.map(fmtVolunteering),
          };
        }
        const removed = state.cv.volunteering.splice(idx, 1)[0];
        persist();
        return {
          ok: true,
          section: "volunteering",
          removed_label: fmtVolunteering(removed).label,
        };
      },
    }),

    // ── Skills (replace-style) ────────────────────────────────────────────
    update_skills: tool({
      description:
        "החלפת רשימות כישורים. שלח את הרשימות המלאות, לא דלתא.",
      parameters: z.object({
        technical: z.array(z.string()).optional(),
        languages: z
          .array(z.object({ name: z.string(), level: z.string() }))
          .optional(),
        soft: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        state.cv.skills = { ...state.cv.skills, ...input };
        persist();
        return { ok: true, section: "skills", value: state.cv.skills };
      },
    }),

    // ── Disambiguation ────────────────────────────────────────────────────
    ask_for_clarification: tool({
      description:
        "שואל את המשתמש להבהרה כשיש אי-בהירות שצריך לפתור לפני פעולה (למשל: מספר פריטים מתאימים לבקשה). הצג 2–4 אפשרויות ברורות.",
      parameters: z.object({
        question: z.string(),
        options: z
          .array(
            z.object({
              value: z.string(),
              label: z.string(),
            })
          )
          .min(2)
          .max(4),
      }),
      execute: async (input) => {
        // No state mutation — the UI renders option buttons and waits for
        // the user to pick one. The result is returned so the LLM can also
        // see what it asked.
        return { ok: true, kind: "clarification", ...input };
      },
    }),

    // ── Completion ───────────────────────────────────────────────────────
    mark_complete: tool({
      description:
        "קוראים לכלי הזה כאשר כל שבעת הסעיפים מולאו והמשתמש מאושר. הצעד הבא הוא הצעה ליצירת PDF.",
      parameters: z.object({}),
      execute: async () => {
        state.cv.meta.last_updated = new Date().toISOString();
        persist();
        return { ok: true, section: "complete" };
      },
    }),
  };

  return tools;
}

/**
 * Apply a saved CVData (from Postgres) into a fresh state container. Backfills
 * stable IDs onto any list entries that don't yet have one (covers rows that
 * predate the id refactor).
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

  for (const e of cv.education) {
    if (!e.id) e.id = randomUUID();
  }
  for (const e of cv.experience) {
    if (!e.id) e.id = randomUUID();
  }
  for (const v of cv.volunteering) {
    if (!v.id) v.id = randomUUID();
  }

  return { cv };
}
