import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { CVData } from "./cv-schema";

const HEBREW_FONT = "Arial";
const HEADING_COLOR = "1D3557";
const SUB_COLOR = "4A5568";
const DATE_COLOR = "718096";

function nonEmpty(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function rtlRun(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text,
    rightToLeft: true,
    font: HEBREW_FONT,
    bold: opts.bold,
    size: opts.size,
    color: opts.color,
  });
}

function rtlPara(children: TextRun[], opts: { spacingAfter?: number; spacingBefore?: number } = {}) {
  return new Paragraph({
    children,
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { after: opts.spacingAfter ?? 80, before: opts.spacingBefore ?? 0 },
  });
}

function sectionHeading(text: string) {
  return new Paragraph({
    children: [rtlRun(text, { bold: true, size: 26, color: HEADING_COLOR })],
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 240, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "E2E8F0", space: 2 },
    },
  });
}

function bullet(text: string) {
  return new Paragraph({
    children: [rtlRun(text, { size: 21 })],
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    bullet: { level: 0 },
    spacing: { after: 40 },
  });
}

function joinDates(start?: string, end?: string): string {
  const parts: string[] = [];
  if (nonEmpty(start)) parts.push(String(start));
  if (nonEmpty(start) && nonEmpty(end)) parts.push("–");
  if (nonEmpty(end)) parts.push(String(end));
  return parts.join(" ");
}

function entryHeader(title: string, dates: string): Paragraph {
  const runs: TextRun[] = [];
  if (title) runs.push(rtlRun(title, { bold: true, size: 23 }));
  if (title && dates) runs.push(rtlRun("   ", { size: 23 }));
  if (dates) runs.push(rtlRun(dates, { size: 20, color: DATE_COLOR }));
  return rtlPara(runs, { spacingAfter: 40 });
}

export async function renderCvDocx(raw: Partial<CVData>): Promise<Buffer> {
  const personal = raw.personal ?? {};
  const summary = raw.summary ?? "";
  const education = raw.education ?? [];
  const experience = raw.experience ?? [];
  const military = raw.military ?? {};
  const volunteering = raw.volunteering ?? [];
  const skills = raw.skills ?? {};

  const children: Paragraph[] = [];

  // Header — name
  if (nonEmpty(personal.name)) {
    children.push(
      new Paragraph({
        children: [rtlRun(String(personal.name), { bold: true, size: 44, color: HEADING_COLOR })],
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 80 },
      }),
    );
  }

  // Contact line
  const contactBits: string[] = [];
  if (nonEmpty(personal.phone)) contactBits.push(String(personal.phone));
  if (nonEmpty(personal.email)) contactBits.push(String(personal.email));
  if (nonEmpty(personal.city)) contactBits.push(String(personal.city));
  if (nonEmpty(personal.linkedin)) contactBits.push(`LinkedIn: ${personal.linkedin}`);
  if (nonEmpty(personal.github)) contactBits.push(`GitHub: ${personal.github}`);
  if (nonEmpty(personal.portfolio)) contactBits.push(`פורטפוליו: ${personal.portfolio}`);
  if (contactBits.length > 0) {
    children.push(
      rtlPara([rtlRun(contactBits.join(" · "), { size: 20, color: SUB_COLOR })], {
        spacingAfter: 80,
      }),
    );
  }
  if (nonEmpty(personal.extra)) {
    children.push(
      rtlPara([rtlRun(String(personal.extra), { size: 20, color: SUB_COLOR })], {
        spacingAfter: 160,
      }),
    );
  }

  // Summary
  if (nonEmpty(summary)) {
    children.push(sectionHeading("תקציר"));
    children.push(rtlPara([rtlRun(summary, { size: 21 })]));
  }

  // Education
  const eduFiltered = education.filter((e) => nonEmpty(e?.institution) || nonEmpty(e?.degree));
  if (eduFiltered.length > 0) {
    children.push(sectionHeading("השכלה וקורסים"));
    eduFiltered.forEach((edu) => {
      const titleParts: string[] = [];
      if (nonEmpty(edu.degree)) titleParts.push(String(edu.degree));
      if (nonEmpty(edu.field)) titleParts.push(String(edu.field));
      children.push(entryHeader(titleParts.join(" · "), joinDates(edu.start, edu.end)));
      if (nonEmpty(edu.institution)) {
        children.push(
          rtlPara([rtlRun(String(edu.institution), { bold: true, size: 21, color: SUB_COLOR })], {
            spacingAfter: 40,
          }),
        );
      }
      if (nonEmpty(edu.grade)) {
        children.push(
          rtlPara([rtlRun(`ציון ממוצע: ${edu.grade}`, { size: 20, color: DATE_COLOR })], {
            spacingAfter: 40,
          }),
        );
      }
      (edu.highlights ?? []).forEach((h) => children.push(bullet(h)));
    });
  }

  // Experience
  const expFiltered = experience.filter((j) => nonEmpty(j?.company) || nonEmpty(j?.role));
  if (expFiltered.length > 0) {
    children.push(sectionHeading("ניסיון תעסוקתי"));
    expFiltered.forEach((job) => {
      const titleParts: string[] = [];
      if (nonEmpty(job.role)) titleParts.push(String(job.role));
      if (nonEmpty(job.company)) titleParts.push(String(job.company));
      children.push(entryHeader(titleParts.join(" · "), joinDates(job.start, job.end)));
      (job.bullets ?? []).forEach((b) => children.push(bullet(b)));
    });
  }

  // Military / national service
  const militaryHasContent =
    !military.skipped &&
    (nonEmpty(military.role) ||
      nonEmpty(military.unit) ||
      (military.bullets && military.bullets.length > 0));
  if (militaryHasContent) {
    children.push(sectionHeading(military.national_service ? "שירות לאומי" : "ניסיון צבאי"));
    const titleParts: string[] = [];
    if (nonEmpty(military.role)) titleParts.push(String(military.role));
    if (nonEmpty(military.unit)) titleParts.push(String(military.unit));
    children.push(entryHeader(titleParts.join(" · "), joinDates(military.start, military.end)));
    if (nonEmpty(military.rank)) {
      children.push(
        rtlPara([rtlRun(`דרגת שחרור: ${military.rank}`, { size: 20, color: DATE_COLOR })], {
          spacingAfter: 40,
        }),
      );
    }
    (military.bullets ?? []).forEach((b) => children.push(bullet(b)));
  }

  // Volunteering
  const volFiltered = volunteering.filter((v) => nonEmpty(v?.organization) || nonEmpty(v?.role));
  if (volFiltered.length > 0) {
    children.push(sectionHeading("התנדבויות"));
    volFiltered.forEach((v) => {
      const titleParts: string[] = [];
      if (nonEmpty(v.role)) titleParts.push(String(v.role));
      if (nonEmpty(v.organization)) titleParts.push(String(v.organization));
      children.push(entryHeader(titleParts.join(" · "), joinDates(v.start, v.end)));
      if (nonEmpty(v.description)) {
        children.push(
          rtlPara([rtlRun(String(v.description), { size: 21 })], { spacingAfter: 40 }),
        );
      }
    });
  }

  // Skills
  const technical = skills.technical ?? [];
  const languages = skills.languages ?? [];
  const soft = skills.soft ?? [];
  const langValid = languages.filter((l) => nonEmpty(l?.name));
  const skillsHasContent = technical.length > 0 || langValid.length > 0 || soft.length > 0;
  if (skillsHasContent) {
    children.push(sectionHeading("כישורים"));
    if (technical.length > 0) {
      children.push(
        rtlPara(
          [
            rtlRun("כישורים מקצועיים: ", { bold: true, size: 21 }),
            rtlRun(technical.join(" · "), { size: 21 }),
          ],
          { spacingAfter: 60 },
        ),
      );
    }
    if (langValid.length > 0) {
      const langText = langValid
        .map((l) => (nonEmpty(l.level) ? `${l.name} (${l.level})` : String(l.name)))
        .join(" · ");
      children.push(
        rtlPara(
          [rtlRun("שפות: ", { bold: true, size: 21 }), rtlRun(langText, { size: 21 })],
          { spacingAfter: 60 },
        ),
      );
    }
    if (soft.length > 0) {
      children.push(
        rtlPara(
          [
            rtlRun("כישורים רכים: ", { bold: true, size: 21 }),
            rtlRun(soft.join(" · "), { size: 21 }),
          ],
          { spacingAfter: 60 },
        ),
      );
    }
  }

  const doc = new Document({
    creator: "Masa CV Builder",
    title: nonEmpty(personal.name) ? `${personal.name} — קורות חיים` : "קורות חיים",
    styles: {
      default: {
        document: {
          run: { font: HEBREW_FONT, size: 21, rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
      },
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          quickFormat: true,
          run: { font: HEBREW_FONT, rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 800, right: 900, bottom: 800, left: 900 },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
