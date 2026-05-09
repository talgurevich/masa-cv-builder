"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef } from "react";
import type { Message } from "ai";
import { ToolCallChip } from "./ToolCallChip";

interface Props {
  cvId: string;
  initialMessages?: Message[];
  onTurnComplete: () => void;
}

const FIRST_TURN_PROMPT =
  "התחל את השיחה: שלח את הודעת הפתיחה בעברית עם הסבר על שבעת הסעיפים, " +
  "ואז התחל לשאול את שאלות הסעיף הראשון (פרטים אישיים).";

export function ChatPane({ cvId, initialMessages, onTurnComplete }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    status,
    error,
  } = useChat({
    api: `/api/cv/${cvId}/chat`,
    initialMessages,
    onFinish: () => {
      onTurnComplete();
      // Re-focus after the assistant finishes streaming.
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  });

  // Auto-trigger the welcome on a fresh CV (only when there are no
  // persisted messages — otherwise we're resuming an existing session).
  useEffect(() => {
    if (initRef.current) return;
    if (messages.length === 0 && (initialMessages?.length ?? 0) === 0) {
      initRef.current = true;
      append({ role: "user", content: FIRST_TURN_PROMPT });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus the input on mount so users can start typing immediately.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Re-focus whenever the input becomes enabled again (e.g. after a turn).
  useEffect(() => {
    if (status === "ready") {
      inputRef.current?.focus();
    }
  }, [status]);

  // If the user clicks anywhere in the chat pane that isn't a button or a
  // text-selectable region, return focus to the input. This covers the
  // common "I clicked outside the input by accident" case.
  function handlePaneClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, [data-keep-selection]"))
      return;
    if (window.getSelection()?.toString()) return; // user is selecting text
    inputRef.current?.focus();
  }

  const isLoading = status === "submitted" || status === "streaming";

  // Hide the synthetic first-turn prompt from the user's view.
  const visibleMessages = messages.filter(
    (m, i) => !(i === 0 && m.role === "user" && m.content === FIRST_TURN_PROMPT)
  );

  return (
    <div className="flex flex-col h-full" onClick={handlePaneClick}>
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">שיחה</h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {visibleMessages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isLoading && (
          <div className="text-sm text-slate-400 animate-pulse">…</div>
        )}
        {error && (
          <div className="text-sm text-red-600">שגיאה: {error.message}</div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-100 p-3 flex gap-2"
      >
        <input
          ref={inputRef}
          dir="auto"
          value={input}
          onChange={handleInputChange}
          placeholder="כתוב/כתבי כאן…"
          autoFocus
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-ink"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="rounded-lg bg-ink text-white px-4 py-2 font-medium disabled:opacity-50 hover:bg-ink/90 transition"
        >
          שלח
        </button>
      </form>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Single message bubble. Renders text + tool invocations inline.
// ────────────────────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  // v4 represents tool calls in `toolInvocations` (deprecated path) or in
  // `parts` (newer). We support both for forward-compat.
  const parts = message.parts;
  const toolInvocations = message.toolInvocations;

  return (
    <div className={isUser ? "flex justify-start" : "flex justify-end"}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-2 leading-relaxed",
          isUser ? "bg-ink text-white" : "bg-slate-100 text-slate-800",
        ].join(" ")}
      >
        {parts ? (
          parts.map((p, i) => {
            if (p.type === "text") {
              return (
                <div key={i} className="whitespace-pre-wrap">
                  {p.text}
                </div>
              );
            }
            if (p.type === "tool-invocation") {
              const inv = p.toolInvocation;
              return (
                <ToolCallChip
                  key={i}
                  name={inv.toolName}
                  state={inv.state}
                />
              );
            }
            return null;
          })
        ) : (
          <>
            {message.content && (
              <div className="whitespace-pre-wrap">{message.content}</div>
            )}
            {toolInvocations?.map((inv, i) => (
              <ToolCallChip
                key={i}
                name={inv.toolName}
                state={inv.state}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
