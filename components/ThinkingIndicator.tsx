"use client";

import { useEffect, useRef, useState } from "react";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

interface Props {
  status: ChatStatus;
  /** Length of the JSON-serialized messages array (or any monotonic counter
   *  that increases when new content arrives). Used to detect pauses. */
  contentSize: number;
}

/**
 * Visible thinking indicator that distinguishes:
 *   - "שולח..." while the request is in-flight before the first chunk
 *   - "מקליד..." while text is actively streaming
 *   - "מבצע פעולה ברקע..." when the stream pauses (a server-side tool is
 *     running). Detected by watching contentSize — if it hasn't changed
 *     for more than ~600ms while status is still streaming, we're paused.
 *
 * Renders nothing when status is "ready" or "error".
 */
export function ThinkingIndicator({ status, contentSize }: Props) {
  const lastSizeRef = useRef(contentSize);
  const lastChangeRef = useRef(Date.now());
  const [, force] = useState(0); // force re-render via interval

  // Update the change timestamp whenever content grows.
  useEffect(() => {
    if (contentSize !== lastSizeRef.current) {
      lastSizeRef.current = contentSize;
      lastChangeRef.current = Date.now();
    }
  }, [contentSize]);

  // While loading, tick every 200ms so the "paused" state can flip on.
  useEffect(() => {
    if (status !== "streaming" && status !== "submitted") return;
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [status]);

  if (status === "ready" || status === "error") return null;

  const sincePause = Date.now() - lastChangeRef.current;
  const isPaused = status === "streaming" && sincePause > 600;
  const isSubmitting = status === "submitted";

  const label = isSubmitting
    ? "שולח..."
    : isPaused
      ? "מבצע פעולה ברקע..."
      : "מקליד...";

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
