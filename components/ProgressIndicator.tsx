"use client";

import type { CVData } from "@/lib/cv-schema";
import { cvProgress } from "@/lib/cv-progress";

interface Props {
  data: CVData;
}

export function ProgressIndicator({ data }: Props) {
  const progress = cvProgress(data);
  const isComplete = progress.done === progress.total;

  return (
    <div
      className="card px-4 py-3 mb-3"
      role="progressbar"
      aria-valuenow={progress.done}
      aria-valuemax={progress.total}
      aria-label="התקדמות בניית קורות החיים"
    >
      <div className="flex items-center justify-between mb-2 gap-3">
        <div className="text-sm">
          {isComplete ? (
            <span className="font-semibold text-green-700">
              סיימנו! מוכן/ה להפיק PDF
            </span>
          ) : (
            <>
              <span className="font-semibold text-slate-700">
                <span className="ltr">
                  {progress.done}/{progress.total}
                </span>{" "}
                סעיפים
              </span>
              {progress.currentLabel && (
                <span className="text-slate-500">
                  {" "}
                  · עכשיו: {progress.currentLabel}
                </span>
              )}
            </>
          )}
        </div>

        {/* Section dots — quick at-a-glance map */}
        <div
          className="flex gap-1.5 items-center"
          aria-hidden="true"
        >
          {progress.sections.map((s) => (
            <span
              key={s.key}
              title={s.label}
              className={[
                "w-2 h-2 rounded-full transition-colors",
                s.done ? "bg-ink" : "bg-slate-200",
              ].join(" ")}
            />
          ))}
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={[
            "h-full rounded-full transition-all duration-500",
            isComplete ? "bg-green-500" : "bg-ink",
          ].join(" ")}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
