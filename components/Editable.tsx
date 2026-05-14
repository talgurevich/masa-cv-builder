"use client";

import { useEffect, useRef, useState } from "react";

interface BaseProps {
  value: string;
  placeholder?: string;
  onCommit: (next: string) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Click-to-edit single-line text. Falls back to a placeholder when empty so
 * the user can discover where they can click. Commits on blur or Enter,
 * cancels on Escape.
 */
export function EditableText({
  value,
  placeholder = "—",
  onCommit,
  className = "",
  ariaLabel,
}: BaseProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next !== value) onCommit(next);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        dir="auto"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value);
            setEditing(false);
          }
        }}
        className={[
          "bg-white border border-ink/40 rounded px-1.5 py-0.5 outline-none focus:border-ink",
          className,
        ].join(" ")}
        aria-label={ariaLabel}
        data-keep-selection
      />
    );
  }

  const display = value || placeholder;
  const isEmpty = !value;

  return (
    <span
      tabIndex={0}
      role="button"
      aria-label={ariaLabel ?? "ערוך"}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={[
        "inline-block min-w-[2ch] rounded px-1 -mx-1 cursor-text transition",
        "hover:bg-slate-100 hover:ring-1 hover:ring-slate-200",
        "focus:outline-none focus:bg-slate-100 focus:ring-1 focus:ring-ink/30",
        isEmpty ? "text-slate-400 italic" : "",
        className,
      ].join(" ")}
    >
      {display}
    </span>
  );
}

/**
 * Multi-line variant for summary / bullets / descriptions.
 */
export function EditableTextarea({
  value,
  placeholder = "—",
  onCommit,
  className = "",
  ariaLabel,
}: BaseProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const next = draft.replace(/\s+$/g, "");
    if (next !== value) onCommit(next);
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        dir="auto"
        rows={Math.max(2, Math.min(8, draft.split("\n").length + 1))}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value);
            setEditing(false);
          }
        }}
        className={[
          "w-full bg-white border border-ink/40 rounded px-1.5 py-1 outline-none focus:border-ink resize-y",
          className,
        ].join(" ")}
        aria-label={ariaLabel}
        data-keep-selection
      />
    );
  }

  const isEmpty = !value;

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label={ariaLabel ?? "ערוך"}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={[
        "rounded px-1 -mx-1 cursor-text transition whitespace-pre-wrap",
        "hover:bg-slate-100 hover:ring-1 hover:ring-slate-200",
        "focus:outline-none focus:bg-slate-100 focus:ring-1 focus:ring-ink/30",
        isEmpty ? "text-slate-400 italic" : "",
        className,
      ].join(" ")}
    >
      {value || placeholder}
    </div>
  );
}
