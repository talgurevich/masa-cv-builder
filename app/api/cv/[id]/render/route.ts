import { NextResponse } from "next/server";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import type { CVData } from "@/lib/cv-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
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
    .select("id, user_id, data, status")
    .eq("id", id)
    .single();
  if (error || !cv) return new NextResponse("CV not found", { status: 404 });

  // ── render via Fly.io worker ───────────────────────────────────────────
  const workerUrl = process.env.PDF_WORKER_URL;
  const sharedSecret = process.env.RENDER_SHARED_SECRET;
  if (!workerUrl || !sharedSecret) {
    return NextResponse.json(
      { error: "PDF worker not configured (PDF_WORKER_URL / RENDER_SHARED_SECRET)" },
      { status: 500 }
    );
  }

  const renderRes = await fetch(`${workerUrl}/render`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sharedSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cv.data as CVData),
  });

  if (!renderRes.ok) {
    const txt = await renderRes.text();
    return NextResponse.json(
      { error: `Worker failed (${renderRes.status}): ${txt}` },
      { status: 502 }
    );
  }

  const pdfBuf = Buffer.from(await renderRes.arrayBuffer());

  // ── upload to Supabase Storage (service role bypasses RLS for inserts) ─
  const service = supabaseService();
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${user.id}/${cv.id}/${ts}.pdf`;

  const { error: uploadErr } = await service.storage
    .from("cv-pdfs")
    .upload(path, pdfBuf, {
      contentType: "application/pdf",
      cacheControl: "60",
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Update the CV row with the latest PDF path
  await supabase.from("cvs").update({ pdf_path: path }).eq("id", id);

  // ── return a short-lived signed URL ────────────────────────────────────
  const { data: signed, error: signErr } = await service.storage
    .from("cv-pdfs")
    .createSignedUrl(path, 60 * 5); // 5 minutes

  if (signErr) {
    return NextResponse.json({ error: signErr.message }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: signed.signedUrl, path });
}
