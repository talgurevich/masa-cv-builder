import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CVData } from "./cv-schema";

const ExtractedSchema = z.object({
  personal: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      city: z.string().optional(),
      linkedin: z.string().optional(),
      github: z.string().optional(),
      portfolio: z.string().optional(),
      extra: z.string().optional(),
    })
    .default({}),
  summary: z.string().default(""),
  education: z
    .array(
      z.object({
        institution: z.string().default(""),
        degree: z.string().optional(),
        field: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        grade: z.string().optional(),
        highlights: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  experience: z
    .array(
      z.object({
        company: z.string().default(""),
        role: z.string().default(""),
        start: z.string().default(""),
        end: z.string().optional(),
        bullets: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  military: z
    .object({
      role: z.string().optional(),
      unit: z.string().optional(),
      rank: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      bullets: z.array(z.string()).default([]),
      national_service: z.boolean().optional(),
    })
    .default({}),
  volunteering: z
    .array(
      z.object({
        organization: z.string().default(""),
        role: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .default([]),
  skills: z
    .object({
      technical: z.array(z.string()).default([]),
      languages: z
        .array(z.object({ name: z.string(), level: z.string().default("") }))
        .default([]),
      soft: z.array(z.string()).default([]),
    })
    .default({ technical: [], languages: [], soft: [] }),
});

const EXTRACTION_TOOL = {
  name: "save_cv",
  description:
    "Persist the structured CV extracted from the uploaded document. Call exactly once with everything you found.",
  input_schema: {
    type: "object" as const,
    properties: {
      personal: {
        type: "object",
        description: "Personal/contact details. Omit fields not present in the source.",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          city: { type: "string" },
          linkedin: { type: "string" },
          github: { type: "string" },
          portfolio: { type: "string" },
          extra: { type: "string" },
        },
      },
      summary: {
        type: "string",
        description:
          "Professional summary / about / objective paragraph. Empty string if not present.",
      },
      education: {
        type: "array",
        description: "Education and courses, most recent first.",
        items: {
          type: "object",
          properties: {
            institution: { type: "string" },
            degree: { type: "string" },
            field: { type: "string" },
            start: { type: "string", description: "Year or month/year, as appears in source." },
            end: { type: "string", description: "Year, month/year, or 'בהווה'." },
            grade: { type: "string" },
            highlights: { type: "array", items: { type: "string" } },
          },
          required: ["institution"],
        },
      },
      experience: {
        type: "array",
        description: "Professional experience, most recent first.",
        items: {
          type: "object",
          properties: {
            company: { type: "string" },
            role: { type: "string" },
            start: { type: "string" },
            end: { type: "string", description: "End date, or 'בהווה' for current roles." },
            bullets: {
              type: "array",
              items: { type: "string" },
              description: "Accomplishments / responsibilities, one per bullet.",
            },
          },
          required: ["company", "role", "start"],
        },
      },
      military: {
        type: "object",
        description: "Single military or national-service entry. Omit fields not present.",
        properties: {
          role: { type: "string" },
          unit: { type: "string" },
          rank: { type: "string", description: "Discharge rank." },
          start: { type: "string" },
          end: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
          national_service: {
            type: "boolean",
            description: "True if שירות לאומי instead of שירות צבאי.",
          },
        },
      },
      volunteering: {
        type: "array",
        items: {
          type: "object",
          properties: {
            organization: { type: "string" },
            role: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
            description: { type: "string" },
          },
          required: ["organization"],
        },
      },
      skills: {
        type: "object",
        properties: {
          technical: { type: "array", items: { type: "string" } },
          languages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                level: {
                  type: "string",
                  description: "e.g. שפת אם, רמה גבוהה, רמה בסיסית.",
                },
              },
              required: ["name"],
            },
          },
          soft: { type: "array", items: { type: "string" } },
        },
      },
    },
    required: ["personal", "summary", "education", "experience", "skills"],
  },
};

const SYSTEM_PROMPT = `You extract structured CVs from uploaded documents.

Rules:
- Only extract information that is actually present in the document. Do NOT invent, infer, or fabricate any field.
- If a field is missing, omit it (or use an empty string / empty array as appropriate).
- Preserve the original language of the content. CVs from Israeli candidates are usually in Hebrew — keep them in Hebrew.
- Keep dates in the format they appear in the source.
- Bullet points should be split per item — do not concatenate multiple bullets into one string.
- Phone numbers and emails: copy verbatim. Do not reformat.
- Call the save_cv tool exactly once with everything you found.`;

const USER_INSTRUCTION = `Extract this CV into the save_cv tool. Remember: only what's actually in the document. If a section is missing, leave it empty.`;

export type ImportSource =
  | { type: "pdf"; data: Buffer }
  | { type: "docx"; data: Buffer };

export async function extractCvFromUpload(source: ImportSource): Promise<CVData> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let userContent: Anthropic.Messages.ContentBlockParam[];

  if (source.type === "pdf") {
    userContent = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: source.data.toString("base64"),
        },
      },
      { type: "text", text: USER_INSTRUCTION },
    ];
  } else {
    const mammoth = (await import("mammoth")).default;
    const { value: text } = await mammoth.extractRawText({ buffer: source.data });
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error("הקובץ ריק או לא ניתן לקרוא ממנו טקסט.");
    }
    userContent = [
      {
        type: "text",
        text: `${USER_INSTRUCTION}\n\n--- CV TEXT ---\n${trimmed}`,
      },
    ];
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "save_cv" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("המודל לא החזיר נתונים מובנים. נסה/י שוב.");
  }

  const parsed = ExtractedSchema.parse(toolUse.input);

  return normalize(parsed);
}

function normalize(parsed: z.infer<typeof ExtractedSchema>): CVData {
  return {
    personal: parsed.personal,
    summary: parsed.summary,
    education: parsed.education.map((e) => ({
      id: randomUUID(),
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      start: e.start,
      end: e.end,
      grade: e.grade,
      highlights: e.highlights ?? [],
    })),
    experience: parsed.experience.map((j) => ({
      id: randomUUID(),
      company: j.company,
      role: j.role,
      start: j.start,
      end: j.end,
      bullets: j.bullets ?? [],
    })),
    military: parsed.military,
    volunteering: parsed.volunteering.map((v) => ({
      id: randomUUID(),
      organization: v.organization,
      role: v.role,
      start: v.start,
      end: v.end,
      description: v.description,
    })),
    skills: parsed.skills,
    meta: { last_updated: new Date().toISOString() },
  };
}

export function detectSourceType(mime: string, filename: string): ImportSource["type"] | null {
  if (mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) return "pdf";
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.toLowerCase().endsWith(".docx")
  ) {
    return "docx";
  }
  return null;
}
