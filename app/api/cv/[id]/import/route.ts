import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { detectSourceType, extractCvFromUpload } from "@/lib/cv-import";
import { buildImportSeedMessage } from "@/lib/cv-import-seed";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: cvRow, error: cvErr } = await supabase
    .from("cvs")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (cvErr || !cvRow) return new NextResponse("CV not found", { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "לא נמצא קובץ בהעלאה." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "הקובץ ריק." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "הקובץ גדול מ-5MB. נסה/י קובץ קטן יותר." },
      { status: 400 },
    );
  }

  const sourceType = detectSourceType(file.type, file.name);
  if (!sourceType) {
    return NextResponse.json(
      { error: "סוג קובץ לא נתמך. אנא העלה/י PDF או DOCX." },
      { status: 400 },
    );
  }

  let data;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    data = await extractCvFromUpload({ type: sourceType, data: buf });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `לא הצלחנו לנתח את הקובץ: ${msg}` },
      { status: 500 },
    );
  }

  // Replace the CV data and wipe any prior chat history so the bot's
  // opening turn is the post-import confirmation.
  const updates: Record<string, unknown> = { data, status: "imported" };
  if (data.personal?.name?.trim()) {
    updates.title = `קורות חיים — ${data.personal.name.trim()}`;
  }

  const { error: updErr } = await supabase
    .from("cvs")
    .update(updates)
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  await supabase.from("messages").delete().eq("cv_id", id);

  const seed = buildImportSeedMessage(data);
  await supabase.from("messages").insert({
    cv_id: id,
    role: "assistant",
    content: seed,
  });

  return NextResponse.json({ id, data });
}
