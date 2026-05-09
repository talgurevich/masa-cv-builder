import { NextResponse } from "next/server";
import { streamText, convertToCoreMessages, type Message } from "ai";
import { supabaseServer } from "@/lib/supabase/server";
import { chatModel, loadSystemPrompt } from "@/lib/anthropic";
import { buildCvTools, loadIntoState } from "@/lib/cv-tools";
import type { CVData } from "@/lib/cv-schema";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  messages: Message[];
}

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

  // Persist the new user message before streaming.
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.role === "user") {
    await supabase.from("messages").insert({
      cv_id: id,
      role: "user",
      content: {
        id: lastMsg.id ?? randomUUID(),
        role: "user",
        content:
          typeof lastMsg.content === "string"
            ? lastMsg.content
            : JSON.stringify(lastMsg.content),
        createdAt: new Date().toISOString(),
      },
    });
  }

  const state = loadIntoState(cvRow.data);
  const tools = buildCvTools(state);

  const result = streamText({
    model: chatModel(),
    system: loadSystemPrompt(),
    messages: convertToCoreMessages(messages),
    tools,
    maxSteps: 8,
    experimental_providerMetadata: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
    async onFinish({ text }) {
      // Persist the assistant turn (text only — tool chips are shown live but
      // not persisted; the CV state itself captures the structured changes).
      await supabase.from("messages").insert({
        cv_id: id,
        role: "assistant",
        content: {
          id: randomUUID(),
          role: "assistant",
          content: text,
          createdAt: new Date().toISOString(),
        },
      });

      const updates: { data: CVData; status?: string } = { data: state.cv };
      if (state.cv.meta.last_updated) updates.status = "complete";
      await supabase.from("cvs").update(updates).eq("id", id);
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

  return NextResponse.json({
    ...cvRes.data,
    messages: (msgRes.data ?? []).map((row) => row.content),
  });
}
