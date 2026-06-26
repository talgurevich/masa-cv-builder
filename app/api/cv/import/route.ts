import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { detectSourceType, extractCvFromUpload } from "@/lib/cv-import";
import { buildImportSeedMessage } from "@/lib/cv-import-seed";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

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

  const title = data.personal?.name?.trim()
    ? `קורות חיים — ${data.personal.name.trim()}`
    : "קורות חיים מיובאים";

  const { data: row, error } = await supabase
    .from("cvs")
    .insert({
      user_id: user.id,
      data,
      status: "imported",
      title,
    })
    .select("id")
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "שגיאה ביצירת רשומה." },
      { status: 500 },
    );
  }

  const seed = buildImportSeedMessage(data);
  await supabase.from("messages").insert({
    cv_id: row.id,
    role: "assistant",
    content: seed,
  });

  return NextResponse.json({ id: row.id, data });
}
