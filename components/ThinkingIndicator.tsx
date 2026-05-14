"use client";

import { useEffect, useRef, useState } from "react";
import { TOOL_LABELS_HE } from "./ToolCallChip";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

interface Props {
  status: ChatStatus;
  /** Length of the JSON-serialized messages array (or any monotonic counter
   *  that increases when new content arrives). Used to detect pauses. */
  contentSize: number;
  /** Name of the currently in-flight tool, if any. When set, the indicator
   *  shows a tool-specific label instead of the generic "background action". */
  activeTool?: string | null;
}

const ACTIVE_VERBS: Record<string, string> = {
  update_personal: "מעדכן פרטים אישיים",
  update_summary: "מעדכן תקציר",
  add_education: "מוסיף השכלה",
  update_education: "מעדכן השכלה",
  remove_education: "מוחק השכלה",
  add_experience: "מוסיף ניסיון תעסוקתי",
  update_experience: "מעדכן ניסיון תעסוקתי",
  remove_experience: "מוחק ניסיון תעסוקתי",
  set_military: "מעדכן ניסיון צבאי",
  add_volunteering: "מוסיף התנדבות",
  update_volunteering: "מעדכן התנדבות",
  remove_volunteering: "מוחק התנדבות",
  update_skills: "מעדכן כישורים",
  ask_for_clarification: "מבקש הבהרה",
  mark_complete: "מסיים את קורות החיים",
};

function activeLabel(toolName: string): string {
  return ACTIVE_VERBS[toolName] ?? TOOL_LABELS_HE[toolName] ?? toolName;
}

export function ThinkingIndicator({ status, contentSize, activeTool }: Props) {
  const lastSizeRef = useRef(contentSize);
  const lastChangeRef = useRef(Date.now());
  const [, force] = useState(0);

  useEffect(() => {
    if (contentSize !== lastSizeRef.current) {
      lastSizeRef.current = contentSize;
      lastChangeRef.current = Date.now();
    }
  }, [contentSize]);

  useEffect(() => {
    if (status !== "streaming" && status !== "submitted") return;
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [status]);

  if (status === "ready" || status === "error") return null;

  const sincePause = Date.now() - lastChangeRef.current;
  const isPaused = status === "streaming" && sincePause > 600;
  const isSubmitting = status === "submitted";

  let label: string;
  if (isSubmitting) {
    label = "שולח...";
  } else if (isPaused) {
    label = activeTool ? `${activeLabel(activeTool)}...` : "מבצע פעולה ברקע...";
  } else {
    label = "מקליד...";
  }

  return (
    <div className="flex justify-end" aria-live="polite">
      <div
        className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 text-slate-600 px-3 py-2 text-sm"
        role="status"
      >
        <span className="flex gap-1" aria-hidden="true">
          <span
            className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: "120ms" }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: "240ms" }}
          />
        </span>
        <span>{label}</span>
      </div>
    </div>
  );
}
