import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { CVData } from "@/lib/cv-schema";
import { renderCvDocx } from "@/lib/cv-docx";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: cv, error } = await supabase
    .from("cvs")
    .select("id, user_id, data, status")
    .eq("id", id)
    .single();
  if (error || !cv) return new NextResponse("CV not found", { status: 404 });

  let docxBuf: Buffer;
  try {
    docxBuf = await renderCvDocx(cv.data as CVData);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `DOCX render failed: ${msg}` }, { status: 500 });
  }

  const data = cv.data as CVData;
  const baseName =
    (data?.personal?.name && String(data.personal.name).trim()) || "cv";
  const safeName = baseName.replace(/[\\/:*?"<>|]/g, "").trim() || "cv";

  return new NextResponse(new Uint8Array(docxBuf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        safeName,
      )}.docx`,
      "Cache-Control": "no-store",
    },
  });
}
