"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "ai";
import { ChatPane } from "./ChatPane";
import { CVPreviewPane } from "./CVPreviewPane";
import { ProgressIndicator } from "./ProgressIndicator";
import type { CVData } from "@/lib/cv-schema";
import { emptyCV } from "@/lib/cv-schema";
import { supabaseBrowser } from "@/lib/supabase/browser";

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

  // Track the last serialization we set/wrote ourselves so realtime
  // notifications about our own writes don't cause redundant re-renders.
  const localSerializedRef = useRef(JSON.stringify(cvData));
  useEffect(() => {
    localSerializedRef.current = JSON.stringify(cvData);
  }, [cvData]);

  const refreshCV = useCallback(async () => {
    const res = await fetch(`/api/cv/${cvId}/chat`, { method: "GET" });
    if (!res.ok) return;
    const cv = await res.json();
    if (cv?.data) setCvData(cv.data);
    if (cv?.status) setStatus(cv.status);
    if (cv?.pdf_path !== undefined) setPdfPath(cv.pdf_path);
  }, [cvId]);

  // ── Realtime sync: update local state when another tab/device mutates ────
  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`cvs:${cvId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cvs",
          filter: `id=eq.${cvId}`,
        },
        (payload) => {
          const remote = payload.new as {
            data?: CVData;
            status?: string;
            pdf_path?: string | null;
          };
          if (!remote) return;
          if (remote.data) {
            const serialized = JSON.stringify(remote.data);
            if (serialized !== localSerializedRef.current) {
              localSerializedRef.current = serialized;
              setCvData(remote.data);
            }
          }
          if (remote.status) setStatus(remote.status);
          if (remote.pdf_path !== undefined) setPdfPath(remote.pdf_path);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cvId]);

  // Optimistic direct edit from the preview. Apply locally first, then PATCH.
  // On failure, refetch authoritative state to recover from drift.
  const patchInflight = useRef<AbortController | null>(null);
  const commitEdit = useCallback(
    async (next: CVData) => {
      setCvData(next);
      localSerializedRef.current = JSON.stringify(next);
      patchInflight.current?.abort();
      const ctrl = new AbortController();
      patchInflight.current = ctrl;
      try {
        const res = await fetch(`/api/cv/${cvId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: next }),
          signal: ctrl.signal,
        });
        if (!res.ok && !ctrl.signal.aborted) {
          console.warn("PATCH failed", await res.text());
          refreshCV();
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.warn("PATCH error", err);
        refreshCV();
      }
    },
    [cvId, refreshCV]
  );

  return (
    <div className="px-3 sm:px-4 pt-3 pb-3 max-w-[1600px] mx-auto h-[calc(100vh-3.5rem)] flex flex-col">
      <ProgressIndicator data={cvData} />

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
            onChange={commitEdit}
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
