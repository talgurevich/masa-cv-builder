"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  /** If provided, uploads replace the existing CV. Otherwise a new one is created. */
  cvId?: string;
  /** Override the default redirect to /cv/[id]. */
  onDone?: (cvId: string) => void;
  /** Visual variant. */
  compact?: boolean;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ".pdf,.docx";

export function CVUpload({ cvId, onDone, compact = false }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (file.size === 0) {
      setError("הקובץ ריק.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("הקובץ גדול מ-5MB.");
      return;
    }
    const name = file.name.toLowerCase();
    const isPdf =
      file.type === "application/pdf" || name.endsWith(".pdf");
    const isDocx =
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx");
    if (!isPdf && !isDocx) {
      setError("רק PDF או DOCX נתמכים.");
      return;
    }

    if (cvId) {
      const ok = window.confirm(
        "פעולה זו תחליף את הנתונים הקיימים בקורות החיים. להמשיך?",
      );
      if (!ok) return;
    }

    setStatus("uploading");
    const fd = new FormData();
    fd.append("file", file);

    try {
      setStatus("analyzing");
      const url = cvId ? `/api/cv/${cvId}/import` : `/api/cv/import`;
      const res = await fetch(url, { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "שגיאה לא ידועה" }));
        throw new Error(body.error || "ניתוח הקובץ נכשל.");
      }
      const { id } = await res.json();
      if (onDone) onDone(id);
      else router.push(`/cv/${id}`);
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const busy = status !== "idle";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (busy) return;
        const file = e.dataTransfer.files?.[0];
        if (file) void handleFile(file);
      }}
      className={[
        "rounded-xl border-2 border-dashed transition text-center",
        compact ? "p-5" : "p-8",
        dragging
          ? "border-ink bg-ink/5"
          : busy
            ? "border-slate-200 bg-slate-50"
            : "border-slate-300 bg-white hover:border-ink/60 hover:bg-slate-50",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {!busy && (
        <>
          <div className="mx-auto w-12 h-12 rounded-xl bg-ink/10 text-ink grid place-items-center mb-3">
            <UploadIcon />
          </div>
          <div className={`font-semibold text-ink ${compact ? "text-base" : "text-lg"}`}>
            יש לי כבר קורות חיים
          </div>
          <p className="text-slate-600 text-sm mt-1 mb-4">
            גרירת קובץ PDF או DOCX לכאן, או לחיצה לבחירה
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-ink text-white px-4 py-2 text-sm font-medium hover:bg-ink/90 transition"
          >
            בחר/י קובץ
          </button>
          <p className="text-xs text-slate-400 mt-3">עד 5MB · PDF או DOCX</p>
        </>
      )}

      {busy && (
        <div className="py-3 space-y-3">
          <Spinner />
          <p className="text-sm text-slate-600">
            {status === "uploading" ? "מעלה את הקובץ…" : "מנתח את התוכן…"}
          </p>
          <p className="text-xs text-slate-400">זה ייקח כמה שניות</p>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="mx-auto w-8 h-8 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
  );
}
