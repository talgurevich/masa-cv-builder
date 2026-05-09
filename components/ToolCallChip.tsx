interface Props {
  name: string;
  state: string;
}

const HEBREW_LABELS: Record<string, string> = {
  update_personal: "עדכון פרטים אישיים",
  update_summary: "עדכון תקציר",
  add_education: "הוספת השכלה",
  update_education_at: "עדכון השכלה",
  remove_education_at: "מחיקת השכלה",
  add_experience: "הוספת ניסיון תעסוקתי",
  update_experience_at: "עדכון ניסיון תעסוקתי",
  remove_experience_at: "מחיקת ניסיון תעסוקתי",
  set_military: "עדכון ניסיון צבאי",
  add_volunteering: "הוספת התנדבות",
  update_volunteering_at: "עדכון התנדבות",
  remove_volunteering_at: "מחיקת התנדבות",
  update_skills: "עדכון כישורים",
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
