"use client";

import { useEffect, useState } from "react";
import { ChatPane } from "./ChatPane";
import { CVPreviewPane } from "./CVPreviewPane";
import type { CVData } from "@/lib/cv-schema";
import { emptyCV } from "@/lib/cv-schema";

interface Props {
  cvId: string;
  initialData: CVData | null;
  initialStatus: string;
  initialPdfPath: string | null;
}

export function CVWorkbench({
  cvId,
  initialData,
  initialStatus,
  initialPdfPath,
}: Props) {
  const [cvData, setCvData] = useState<CVData>(initialData ?? emptyCV());
  const [status, setStatus] = useState(initialStatus);
  const [pdfPath, setPdfPath] = useState<string | null>(initialPdfPath);

  // After every chat turn, re-fetch the CV row so the preview pane reflects
  // the tool-applied mutations. (Cheap; the row is small.)
  async function refreshCV() {
    const res = await fetch(`/api/cv/${cvId}/chat`, { method: "GET" });
    if (!res.ok) return;
    const cv = await res.json();
    if (cv?.data) setCvData(cv.data);
    if (cv?.status) setStatus(cv.status);
    if (cv?.pdf_path !== undefined) setPdfPath(cv.pdf_path);
  }

  useEffect(() => {
    // No-op on mount — we already have the SSR snapshot.
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] xl:grid-cols-[450px_1fr] gap-4 p-4 max-w-[1600px] mx-auto h-[calc(100vh-3.5rem)]">
      <div className="card overflow-hidden">
        <ChatPane cvId={cvId} onTurnComplete={refreshCV} />
      </div>
      <div className="card overflow-hidden">
        <CVPreviewPane
          cvId={cvId}
          data={cvData}
          status={status}
          pdfPath={pdfPath}
          onPdfPath={setPdfPath}
        />
      </div>
    </div>
  );
}
