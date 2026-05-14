import { NextResponse } from "next/server";
import { streamText, convertToCoreMessages, type Message, type CoreMessage } from "ai";
import { supabaseServer } from "@/lib/supabase/server";
import { chatModel, loadSystemPrompt } from "@/lib/anthropic";
import { buildCvTools, loadIntoState } from "@/lib/cv-tools";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  messages: Message[];
}

// Threshold beyond which we fold older turns into a single summary block.
// Tuned so a healthy "build a full CV" run (~25-40 turns) stays uncompacted,
// while sessions that meander or are resumed many times stay bounded.
const COMPACT_AFTER = 60;
const KEEP_RECENT = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: cvRow, error: cvErr } = await supabase
    .from("cvs")
    .select("id, data")
    .eq("id", id)
    .single();
  if (cvErr || !cvRow) {
    return new NextResponse("CV not found", { status: 404 });
  }

  const { messages }: ChatRequest = await request.json();

  // Persist the new user message before streaming. We capture parts too so
  // that interactive-clarification replies (which originate as parts) stay
  // faithful on reload.
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.role === "user") {
    const stored: StoredMessage = {
      id: lastMsg.id ?? randomUUID(),
      role: "user",
      content:
        typeof lastMsg.content === "string"
          ? lastMsg.content
          : JSON.stringify(lastMsg.content),
      parts: lastMsg.parts,
      createdAt: new Date().toISOString(),
    };
    await supabase.from("messages").insert({
      cv_id: id,
      role: "user",
      content: stored,
    });
  }

  const state = loadIntoState(cvRow.data);

  // ── Per-tool persistence (debounced) ──────────────────────────────────
  // Each tool execute calls persist(); writes are coalesced to ~150ms.
  let pendingWrite: NodeJS.Timeout | null = null;
  let lastWrittenSerialized = JSON.stringify(state.cv);
  let inflight: Promise<unknown> | null = null;
  function flushNow() {
    const serialized = JSON.stringify(state.cv);
    if (serialized === lastWrittenSerialized) return;
    lastWrittenSerialized = serialized;
    inflight = Promise.resolve(
      supabase
        .from("cvs")
        .update({
          data: state.cv,
          ...(state.cv.meta.last_updated ? { status: "complete" } : {}),
        })
        .eq("id", id)
    );
  }
  function persist() {
    if (pendingWrite) clearTimeout(pendingWrite);
    pendingWrite = setTimeout(() => {
      pendingWrite = null;
      flushNow();
    }, 150);
  }

  const tools = buildCvTools(state, { persist });

  // ── Conversation compaction ───────────────────────────────────────────
  // If the message history has grown large, fold the older portion into a
  // single synthetic assistant note before sending. This keeps token cost
  // bounded across long-running / heavily-resumed sessions.
  const compacted = compactMessages(messages);
  const coreMessages = convertToCoreMessages(compacted);

  // ── Inject the current CV snapshot ────────────────────────────────────
  // Authoritative state for the LLM regardless of session age. Placed AFTER
  // the cached system prompt so the cache stays warm even as cv.data changes.
  const cvSnapshot: CoreMessage = {
    role: "system",
    content: [
      "מצב נוכחי של קורות החיים (מקור האמת — אל תכפיל פריטים שכבר קיימים):",
      "<current_cv>",
      JSON.stringify(state.cv, null, 2),
      "</current_cv>",
      "השתמש ב-id מהמבנה הזה לקריאות update/remove על פריטים קיימים.",
    ].join("\n"),
  };

  const result = streamText({
    model: chatModel(),
    system: loadSystemPrompt(),
    messages: [cvSnapshot, ...coreMessages],
    tools,
    maxSteps: 8,
    experimental_providerMetadata: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
    async onFinish({ text, response }) {
      // Wait for any in-flight per-tool write to complete, then ensure a
      // final flush. Belt-and-suspenders: covers the case where the last
      // tool fired right before stream end and the debounce hasn't elapsed.
      if (pendingWrite) {
        clearTimeout(pendingWrite);
        pendingWrite = null;
        flushNow();
      }
      if (inflight) await inflight;

      // Persist the assistant turn(s) with parts (text + tool-invocation)
      // so chat history on reload renders chips and stays faithful.
      const stored = buildAssistantStoredMessages(response.messages, text);
      if (stored.length > 0) {
        await supabase.from("messages").insert(
          stored.map((s) => ({
            cv_id: id,
            role: "assistant",
            content: s,
          }))
        );
      }
    },
  });

  return result.toDataStreamResponse();
}

// GET returns the CV row + persisted messages so the workbench can hydrate.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const [cvRes, msgRes] = await Promise.all([
    supabase
      .from("cvs")
      .select("id, title, status, data, pdf_path, updated_at")
      .eq("id", id)
      .single(),
    supabase
      .from("messages")
      .select("content, role, created_at")
      .eq("cv_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (cvRes.error || !cvRes.data) {
    return new NextResponse("CV not found", { status: 404 });
  }

  // Backfill any missing ids on list entries so the client sees the same
  // shape the LLM does.
  const hydrated = cvRes.data.data
    ? loadIntoState(cvRes.data.data).cv
    : cvRes.data.data;

  return NextResponse.json({
    ...cvRes.data,
    data: hydrated,
    messages: (msgRes.data ?? []).map((row) => row.content),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: Message["parts"];
  createdAt: string;
}

/**
 * Convert the assistant's `response.messages` (CoreMessage[]) into one or more
 * v4 UI Message-shaped records with `parts`. We collapse a (tool_call,
 * tool_result) pair into a single tool-invocation part on the originating
 * assistant message. Subsequent assistant turns (after a tool round-trip)
 * become their own row.
 */
function buildAssistantStoredMessages(
  responseMessages: CoreMessage[],
  finalText: string
): StoredMessage[] {
  type ToolResultEntry = { toolName: string; result: unknown };
  const toolResultsById = new Map<string, ToolResultEntry>();

  for (const msg of responseMessages) {
    if (msg.role !== "tool") continue;
    const parts = Array.isArray(msg.content) ? msg.content : [];
    for (const p of parts) {
      if (p && typeof p === "object" && "type" in p && p.type === "tool-result") {
        const tr = p as { toolCallId: string; toolName: string; result: unknown };
        toolResultsById.set(tr.toolCallId, {
          toolName: tr.toolName,
          result: tr.result,
        });
      }
    }
  }

  const stored: StoredMessage[] = [];
  for (const msg of responseMessages) {
    if (msg.role !== "assistant") continue;
    const parts: NonNullable<Message["parts"]> = [];
    let collectedText = "";
    const contentArr = Array.isArray(msg.content) ? msg.content : [];
    for (const p of contentArr) {
      if (!p || typeof p !== "object" || !("type" in p)) continue;
      if (p.type === "text") {
        const tp = p as { type: "text"; text: string };
        collectedText += tp.text;
        parts.push({ type: "text", text: tp.text });
      } else if (p.type === "tool-call") {
        const tc = p as {
          type: "tool-call";
          toolCallId: string;
          toolName: string;
          args: unknown;
        };
        const matching = toolResultsById.get(tc.toolCallId);
        parts.push({
          type: "tool-invocation",
          toolInvocation: matching
            ? {
                state: "result",
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args as Record<string, unknown>,
                result: matching.result,
                step: 0,
              }
            : {
                state: "call",
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args as Record<string, unknown>,
                step: 0,
              },
        });
      }
    }
    if (parts.length === 0 && !collectedText) continue;
    stored.push({
      id: randomUUID(),
      role: "assistant",
      content: collectedText,
      parts,
      createdAt: new Date().toISOString(),
    });
  }

  // Fallback: nothing got collected but the SDK saw a final text → keep at
  // least the text so the user sees something.
  if (stored.length === 0 && finalText) {
    stored.push({
      id: randomUUID(),
      role: "assistant",
      content: finalText,
      parts: [{ type: "text", text: finalText }],
      createdAt: new Date().toISOString(),
    });
  }

  return stored;
}

/**
 * If a conversation has grown beyond the compaction threshold, replace the
 * older prefix with a single synthetic assistant note that names what was
 * already covered. We can do this safely because (a) the canonical CV state
 * is injected into every turn anyway and (b) we keep the most recent
 * KEEP_RECENT messages verbatim so multi-turn references still work.
 */
function compactMessages(msgs: Message[]): Message[] {
  if (msgs.length <= COMPACT_AFTER) return msgs;
  const drop = msgs.length - KEEP_RECENT;
  const recent = msgs.slice(drop);
  const note: Message = {
    id: randomUUID(),
    role: "assistant",
    content:
      `[הערה אוטומטית: ${drop} הודעות קודמות הוסרו מההיסטוריה לחסכון בטוקנים. ` +
      `מצב הקורות חיים העדכני מוזרק לכל פנייה בנפרד; אם משהו חסר — שאל את המשתמש.]`,
  };
  return [note, ...recent];
}
