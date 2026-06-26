import { randomUUID } from "node:crypto";
import type { CVData } from "./cv-schema";

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: { type: "text"; text: string }[];
  createdAt: string;
}

export function buildImportSeedMessage(data: CVData): StoredMessage {
  const text = composeSeedText(data);
  return {
    id: randomUUID(),
    role: "assistant",
    content: text,
    parts: [{ type: "text", text }],
    createdAt: new Date().toISOString(),
  };
}

function composeSeedText(data: CVData): string {
  const found: string[] = [];
  if (data.personal?.name) found.push(`שם: ${data.personal.name}`);
  if (data.experience.length > 0)
    found.push(`${data.experience.length} תפקידים`);
  if (data.education.length > 0)
    found.push(`${data.education.length} פריטי השכלה`);
  if (
    data.military &&
    !data.military.skipped &&
    (data.military.role || data.military.unit)
  ) {
    found.push(data.military.national_service ? "שירות לאומי" : "שירות צבאי");
  }
  if (data.volunteering.length > 0)
    found.push(`${data.volunteering.length} התנדבויות`);
  const skillsCount =
    (data.skills.technical?.length ?? 0) +
    (data.skills.languages?.length ?? 0) +
    (data.skills.soft?.length ?? 0);
  if (skillsCount > 0) found.push(`${skillsCount} כישורים`);

  const foundLine =
    found.length > 0
      ? `מצאתי בקובץ: ${found.join(" · ")}.`
      : "קראתי את הקובץ, אבל לא הצלחתי לאתר ממנו מספיק פרטים — נתחיל לבנות יחד.";

  return [
    "קיבלתי את הקובץ ועברתי עליו 👀",
    foundLine,
    "התצוגה משמאל מציגה את מה שזיהיתי. אפשר לעבור עליה, לתקן או להוסיף מה שחסר.",
    "מאיפה את/ה רוצה להתחיל? אם זה נראה תקין — אפשר פשוט להגיד 'הכל בסדר' ונמשיך לליטוש.",
  ].join("\n\n");
}
