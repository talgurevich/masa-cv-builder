"use client";

import { useState } from "react";
import type { Message } from "ai";
import { ChatPane } from "./ChatPane";
import { CVPreviewPane } from "./CVPreviewPane";
import { ProgressIndicator } from "./ProgressIndicator";
import type { CVData } from "@/lib/cv-schema";
import { emptyCV } from "@/lib/cv-schema";

interface Props {
  cvId: string;
  initialData: CVData | null;
  initialStatus: string;
  initialPdfPath: string | null;
  initialMessages: Message[];
}

type MobileView = "chat" | "preview";

export function CVWorkbench({
  cvId,
  initialData,
  initialStatus,
  initialPdfPath,
  initialMessages,
}: Props) {
  const [cvData, setCvData] = useState<CVData>(initialData ?? emptyCV());
  const [status, setStatus] = useState(initialStatus);
  const [pdfPath, setPdfPath] = useState<string | null>(initialPdfPath);
  const [mobileView, setMobileView] = useState<MobileView>("chat");

  // After every chat turn, re-fetch the CV row so the preview pane reflects
  // the tool-applied mutations.
  async function refreshCV() {
    const res = await fetch(`/api/cv/${cvId}/chat`, { method: "GET" });
    if (!res.ok) return;
    const cv = await res.json();
    if (cv?.data) setCvData(cv.data);
    if (cv?.status) setStatus(cv.status);
    if (cv?.pdf_path !== undefined) setPdfPath(cv.pdf_path);
  }

  return (
    <div className="px-3 sm:px-4 pt-3 pb-3 max-w-[1600px] mx-auto h-[calc(100vh-3.5rem)] flex flex-col">
      <ProgressIndicator data={cvData} />

      {/* Mobile view switcher — visible only below `lg` */}
      <div className="lg:hidden mb-3 grid grid-cols-2 gap-2">
        <ToggleButton
          active={mobileView === "chat"}
          onClick={() => setMobileView("chat")}
        >
          שיחה
        </ToggleButton>
        <ToggleButton
          active={mobileView === "preview"}
          onClick={() => setMobileView("preview")}
        >
          תצוגה מקדימה
        </ToggleButton>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] xl:grid-cols-[450px_1fr] gap-3 lg:gap-4 min-h-0">
        <div
          className={[
            "card overflow-hidden min-h-0",
            mobileView === "chat" ? "flex flex-col" : "hidden lg:flex lg:flex-col",
          ].join(" ")}
        >
          <ChatPane
            cvId={cvId}
            initialMessages={initialMessages}
            onTurnComplete={refreshCV}
          />
        </div>
        <div
          className={[
            "card overflow-hidden min-h-0",
            mobileView === "preview"
              ? "flex flex-col"
              : "hidden lg:flex lg:flex-col",
          ].join(" ")}
        >
          <CVPreviewPane
            cvId={cvId}
            data={cvData}
            status={status}
            pdfPath={pdfPath}
            onPdfPath={setPdfPath}
          />
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-lg py-2 text-sm font-medium border transition",
        active
          ? "bg-ink text-white border-ink"
          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
