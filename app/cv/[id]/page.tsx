import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { CVData } from "@/lib/cv-schema";
import { CVWorkbench } from "@/components/CVWorkbench";

export default async function CVPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: cv, error } = await supabase
    .from("cvs")
    .select("id, title, status, data, pdf_path")
    .eq("id", id)
    .single();

  if (error || !cv) notFound();

  return (
    <CVWorkbench
      cvId={cv.id}
      initialData={(cv.data as CVData) ?? null}
      initialStatus={cv.status}
      initialPdfPath={cv.pdf_path}
    />
  );
}
