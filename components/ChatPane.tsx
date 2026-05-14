"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useRef } from "react";
import type { Message } from "ai";
import { ToolCallChip } from "./ToolCallChip";
import { ThinkingIndicator } from "./ThinkingIndicator";

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
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  });

  useEffect(() => {
    if (initRef.current) return;
    if (messages.length === 0 && (initialMessages?.length ?? 0) === 0) {
      initRef.current = true;
      append({ role: "user", content: FIRST_TURN_PROMPT });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (status === "ready") {
      inputRef.current?.focus();
    }
  }, [status]);

  function handlePaneClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, [data-keep-selection]"))
      return;
    if (window.getSelection()?.toString()) return;
    inputRef.current?.focus();
  }

  const isLoading = status === "submitted" || status === "streaming";

  const visibleMessages = messages.filter(
    (m, i) => !(i === 0 && m.role === "user" && m.content === FIRST_TURN_PROMPT)
  );

  const contentSize = useMemo(() => {
    let size = 0;
    for (const m of messages) {
      if (typeof m.content === "string") size += m.content.length;
      if (m.parts) size += JSON.stringify(m.parts).length;
      if (m.toolInvocations) size += JSON.stringify(m.toolInvocations).length;
    }
    return size;
  }, [messages]);

  // The latest in-flight tool name (if any) — drives the ThinkingIndicator
  // label so users see "מעדכן השכלה..." instead of a generic "..."
  const latestTool = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const parts = m.parts ?? [];
      for (let j = parts.length - 1; j >= 0; j--) {
        const p = parts[j];
        if (p.type === "tool-invocation") {
          const inv = p.toolInvocation;
          if (inv.state === "call" || inv.state === "partial-call") {
            return inv.toolName;
          }
          // Found the most recent invocation but it's already resolved.
          return null;
        }
      }
      const tis = m.toolInvocations ?? [];
      for (let j = tis.length - 1; j >= 0; j--) {
        const inv = tis[j];
        if (inv.state === "call" || inv.state === "partial-call") {
          return inv.toolName;
        }
        return null;
      }
    }
    return null;
  }, [messages]);

  // Find the most recent assistant clarification request. Only the latest one
  // is interactive; older clarifications stay visible as inert chips.
  const pendingClarificationKey = useMemo(() => {
    if (isLoading) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const parts = m.parts ?? [];
      for (let j = parts.length - 1; j >= 0; j--) {
        const p = parts[j];
        if (p.type === "tool-invocation") {
          const inv = p.toolInvocation;
          if (
            inv.toolName === "ask_for_clarification" &&
            inv.state === "result"
          ) {
            return `${m.id}:${inv.toolCallId}`;
          }
        }
      }
      // First assistant message we see that doesn't end on a clarification
      // means there's no pending one.
      return null;
    }
    return null;
  }, [messages, isLoading]);

  function pickClarification(value: string) {
    append({ role: "user", content: value });
  }

  return (
    <div className="flex flex-col h-full" onClick={handlePaneClick}>
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">שיחה</h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {visibleMessages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            pendingClarificationKey={pendingClarificationKey}
            onPickClarification={pickClarification}
          />
        ))}
        <ThinkingIndicator
          status={status}
          contentSize={contentSize}
          activeTool={latestTool}
        />
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

interface ClarificationResult {
  ok: boolean;
  kind?: "clarification";
  question?: string;
  options?: { value: string; label: string }[];
}

function MessageBubble({
  message,
  pendingClarificationKey,
  onPickClarification,
}: {
  message: Message;
  pendingClarificationKey: string | null;
  onPickClarification: (value: string) => void;
}) {
  const isUser = message.role === "user";
  const parts = message.parts;
  const toolInvocations = message.toolInvocations;

  function renderInvocation(inv: {
    state: string;
    toolName: string;
    toolCallId: string;
    result?: unknown;
  }) {
    if (inv.toolName === "ask_for_clarification" && inv.state === "result") {
      const result = inv.result as ClarificationResult | undefined;
      const isPending =
        pendingClarificationKey === `${message.id}:${inv.toolCallId}`;
      if (result?.question && result?.options) {
        return (
          <ClarificationPanel
            question={result.question}
            options={result.options}
            interactive={isPending}
            onPick={onPickClarification}
          />
        );
      }
    }
    return (
      <ToolCallChip name={inv.toolName} state={inv.state} />
    );
  }

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
              return (
                <div key={i}>
                  {renderInvocation(p.toolInvocation)}
                </div>
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
              <div key={i}>{renderInvocation(inv)}</div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ClarificationPanel({
  question,
  options,
  interactive,
  onPick,
}: {
  question: string;
  options: { value: string; label: string }[];
  interactive: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <div className="my-1 rounded-xl bg-white/40 px-3 py-2">
      <div className="text-sm mb-2 text-slate-700">{question}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => onPick(opt.value)}
            className={[
              "text-sm rounded-full px-3 py-1 border transition",
              interactive
                ? "bg-white border-slate-300 hover:border-ink hover:bg-slate-50 text-slate-800"
                : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
