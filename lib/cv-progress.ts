import type { CVData } from "./cv-schema";

export interface SectionProgress {
  key: string;
  label: string;
  done: boolean;
}

export interface CVProgress {
  done: number;
  total: number;
  percent: number;
  currentLabel: string | null;
  sections: SectionProgress[];
}

/**
 * Heuristic completion check for each of the 7 sections. "Done" means the
 * section has been meaningfully filled OR explicitly skipped (military) OR
 * implicitly skipped because the user has progressed past it (volunteering).
 */
export function cvProgress(cv: CVData): CVProgress {
  const personal = !!(cv.personal?.name && cv.personal?.phone && cv.personal?.email);
  const summary = !!cv.summary?.trim();
  const education = cv.education.length > 0 && !!cv.education[0]?.institution;
  const experience = cv.experience.length > 0 && !!cv.experience[0]?.company;
  const military =
    cv.military?.skipped === true ||
    !!cv.military?.role ||
    !!cv.military?.unit ||
    cv.military?.national_service === true;
  const skills =
    (cv.skills?.technical?.length ?? 0) > 0 ||
    (cv.skills?.languages?.length ?? 0) > 0 ||
    (cv.skills?.soft?.length ?? 0) > 0;
  // Volunteering is implicit-done if the user has progressed into skills, or
  // has an explicit entry, or the CV is marked complete.
  const volunteering =
    (cv.volunteering.length > 0 && !!cv.volunteering[0]?.organization) ||
    skills ||
    !!cv.meta?.last_updated;

  const sections: SectionProgress[] = [
    { key: "personal", label: "פרטים אישיים", done: personal },
    { key: "summary", label: "תקציר", done: summary },
    { key: "education", label: "השכלה", done: education },
    { key: "experience", label: "ניסיון תעסוקתי", done: experience },
    { key: "military", label: "ניסיון צבאי", done: military },
    { key: "volunteering", label: "התנדבויות", done: volunteering },
    { key: "skills", label: "כישורים", done: skills },
  ];

  const done = sections.filter((s) => s.done).length;
  const currentLabel = sections.find((s) => !s.done)?.label ?? null;

  return {
    sections,
    done,
    total: sections.length,
    percent: Math.round((done / sections.length) * 100),
    currentLabel,
  };
}
