import { NextResponse } from "next/server";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import type { CVData } from "@/lib/cv-schema";
import { renderCvHtml } from "@/lib/cv-template";

export const runtime = "nodejs";
export const maxDuration = 60;

const LOCAL_CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
];

async function resolveBrowserConfig(): Promise<{
  args: string[];
  executablePath: string;
  headless: boolean;
}> {
  // Vercel sets AWS_LAMBDA_FUNCTION_NAME for its Node runtime; locally it's undefined.
  const isServerless = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL;

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return {
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    };
  }

  const { existsSync } = await import("node:fs");
  const localPath =
    process.env.CHROME_PATH ||
    LOCAL_CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!localPath) {
    throw new Error(
      "No local Chrome found. Set CHROME_PATH or install Google Chrome."
    );
  }
  return { args: [], executablePath: localPath, headless: true };
}

async function renderPdf(data: CVData): Promise<Buffer> {
  const puppeteer = (await import("puppeteer-core")).default;
  const config = await resolveBrowserConfig();

  const browser = await puppeteer.launch({
    args: config.args,
    executablePath: config.executablePath,
    headless: config.headless,
  });

  try {
    const page = await browser.newPage();
    const html = renderCvHtml(data);
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => (document as Document & { fonts: { ready: Promise<void> } }).fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", right: "16mm", bottom: "14mm", left: "16mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

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

  let pdfBuf: Buffer;
  try {
    pdfBuf = await renderPdf(cv.data as CVData);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `PDF render failed: ${msg}` }, { status: 500 });
  }

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

  await supabase.from("cvs").update({ pdf_path: path }).eq("id", id);

  const { data: signed, error: signErr } = await service.storage
    .from("cv-pdfs")
    .createSignedUrl(path, 60 * 5);

  if (signErr) {
    return NextResponse.json({ error: signErr.message }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: signed.signedUrl, path });
}
