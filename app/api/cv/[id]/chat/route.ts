import { NextResponse } from "next/server";
import { streamText, convertToCoreMessages, type Message } from "ai";
import { supabaseServer } from "@/lib/supabase/server";
import { chatModel, loadSystemPrompt } from "@/lib/anthropic";
import { buildCvTools, loadIntoState } from "@/lib/cv-tools";
import type { CVData } from "@/lib/cv-schema";

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

  // ── auth ───────────────────────────────────────────────────────────────
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  // ── load CV (RLS makes sure only the owner reads) ──────────────────────
  const { data: cvRow, error: cvErr } = await supabase
    .from("cvs")
    .select("id, data")
    .eq("id", id)
    .single();

  if (cvErr || !cvRow) {
    return new NextResponse("CV not found", { status: 404 });
  }

  // ── parse incoming messages ────────────────────────────────────────────
  const { messages }: ChatRequest = await request.json();

  // ── set up tool state on the existing CV ───────────────────────────────
  const state = loadIntoState(cvRow.data);
  const tools = buildCvTools(state);

  // ── stream from Claude with tool-use loop ──────────────────────────────
  const result = streamText({
    model: chatModel(),
    system: loadSystemPrompt(),
    messages: convertToCoreMessages(messages),
    tools,
    // Allow Claude to chain multiple tool calls in one turn (e.g. add several
    // education entries) before yielding back to the user.
    maxSteps: 8,
    experimental_providerMetadata: {
      anthropic: {
        // Cache the system prompt block. Anthropic prompt cache TTL is 5 min.
        cacheControl: { type: "ephemeral" },
      },
    },
    async onFinish() {
      // Persist the mutated CV. RLS allows because user owns the row.
      const updates: { data: CVData; status?: string } = { data: state.cv };
      if (state.cv.meta.last_updated) updates.status = "complete";
      await supabase.from("cvs").update(updates).eq("id", id);
    },
  });

  return result.toDataStreamResponse();
}

// Also expose GET to fetch the current CV row for the preview pane.
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

  const { data: cv, error } = await supabase
    .from("cvs")
    .select("id, title, status, data, pdf_path, updated_at")
    .eq("id", id)
    .single();

  if (error || !cv) return new NextResponse("CV not found", { status: 404 });
  return NextResponse.json(cv);
}
