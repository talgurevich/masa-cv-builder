import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { loadIntoState } from "@/lib/cv-tools";
import type { CVData } from "@/lib/cv-schema";

export const runtime = "nodejs";

/**
 * PATCH /api/cv/[id] — direct-edit endpoint used by the click-to-edit preview.
 *
 * Body shape: { data: Partial<CVData> }
 *
 * Any section present in `data` REPLACES that section. For list sections
 * (education, experience, volunteering) the client sends the full updated
 * array, ids preserved. This keeps the contract simple and idempotent.
 */

const EduSchema = z.object({
  id: z.string(),
  institution: z.string(),
  degree: z.string().optional(),
  field: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  grade: z.string().optional(),
  highlights: z.array(z.string()).optional(),
});

const ExpSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  start: z.string(),
  end: z.string().optional(),
  bullets: z.array(z.string()),
});

const VolSchema = z.object({
  id: z.string(),
  organization: z.string(),
  role: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  description: z.string().optional(),
});

const PatchSchema = z.object({
  data: z
    .object({
      personal: z
        .object({
          name: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          city: z.string().optional(),
          linkedin: z.string().optional(),
          github: z.string().optional(),
          portfolio: z.string().optional(),
          extra: z.string().optional(),
        })
        .optional(),
      summary: z.string().optional(),
      education: z.array(EduSchema).optional(),
      experience: z.array(ExpSchema).optional(),
      volunteering: z.array(VolSchema).optional(),
      military: z
        .object({
          role: z.string().optional(),
          unit: z.string().optional(),
          rank: z.string().optional(),
          start: z.string().optional(),
          end: z.string().optional(),
          bullets: z.array(z.string()).optional(),
          skipped: z.boolean().optional(),
          national_service: z.boolean().optional(),
        })
        .optional(),
      skills: z
        .object({
          technical: z.array(z.string()).optional(),
          languages: z
            .array(z.object({ name: z.string(), level: z.string() }))
            .optional(),
          soft: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "patch must include at least one section",
    }),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: row, error } = await supabase
    .from("cvs")
    .select("data")
    .eq("id", id)
    .single();
  if (error || !row) return new NextResponse("CV not found", { status: 404 });

  const current = loadIntoState(row.data).cv;
  const next: CVData = {
    ...current,
    ...parsed.data.data,
    // Preserve meta — patch endpoint never edits last_updated implicitly.
    meta: current.meta,
  };

  const { error: updErr } = await supabase
    .from("cvs")
    .update({ data: next })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: next });
}
