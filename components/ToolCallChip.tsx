interface Props {
  name: string;
  state: string;
}

const HEBREW_LABELS: Record<string, string> = {
  update_personal: "עדכון פרטים אישיים",
  update_summary: "עדכון תקציר",
  add_education: "הוספת השכלה",
  update_education: "עדכון השכלה",
  remove_education: "מחיקת השכלה",
  add_experience: "הוספת ניסיון תעסוקתי",
  update_experience: "עדכון ניסיון תעסוקתי",
  remove_experience: "מחיקת ניסיון תעסוקתי",
  set_military: "עדכון ניסיון צבאי",
  add_volunteering: "הוספת התנדבות",
  update_volunteering: "עדכון התנדבות",
  remove_volunteering: "מחיקת התנדבות",
  update_skills: "עדכון כישורים",
  ask_for_clarification: "בקשת הבהרה",
  mark_complete: "סיום בניית קורות החיים",
};

export function ToolCallChip({ name, state }: Props) {
  const label = HEBREW_LABELS[name] ?? name;
  const done = state === "result" || state === "output-available";
  return (
    <div className="my-1 inline-flex items-center gap-1.5 text-xs rounded-full bg-white/15 px-2 py-0.5 backdrop-blur-sm">
      <span aria-hidden>{done ? "✓" : "…"}</span>
      <span>{label}</span>
    </div>
  );
}

// Mapping used by the thinking indicator to label the in-flight tool.
export const TOOL_LABELS_HE: Record<string, string> = HEBREW_LABELS;
