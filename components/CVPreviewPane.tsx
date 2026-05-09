"use client";

import { useState } from "react";
import type { CVData } from "@/lib/cv-schema";
import { CVDocument } from "./CVDocument";

interface Props {
  cvId: string;
  data: CVData;
  status: string;
  pdfPath: string | null;
  onPdfPath: (p: string | null) => void;
}

export function CVPreviewPane({
  cvId,
  data,
  status,
  pdfPath,
  onPdfPath,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  async function generatePDF() {
    setGenerating(true);
    setSignedUrl(null);
    try {
      const res = await fetch(`/api/cv/${cvId}/render`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const { signedUrl, path } = await res.json();
      setSignedUrl(signedUrl);
      onPdfPath(path);
    } catch (err) {
      alert("שגיאה ביצירת PDF: " + (err instanceof Error ? err.message : err));
    } finally {
      setGenerating(false);
    }
  }

  const ready = status === "complete" || status === "tuned";

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">תצוגה חיה</h2>
        <div className="flex items-center gap-2">
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 underline"
            >
              הורד PDF
            </a>
          )}
          <button
            onClick={generatePDF}
            disabled={!ready || generating}
            title={
              ready
                ? "הפק PDF מוכן להורדה"
                : "קודם נסיים למלא את כל הסעיפים"
            }
            className="rounded-lg bg-ink text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-ink/90 transition"
          >
            {generating ? "מפיק…" : pdfPath ? "הפק מחדש" : "צור PDF"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
        <div className="mx-auto bg-white shadow-md max-w-[210mm] aspect-[210/297] p-[14mm]">
          <CVDocument data={data} />
        </div>
      </div>
    </div>
  );
}
