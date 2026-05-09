import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { CVData } from "@/lib/cv-schema";
import { CVWorkbench } from "@/components/CVWorkbench";
import type { Message } from "ai";

export default async function CVPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const [cvRes, msgRes] = await Promise.all([
    supabase
      .from("cvs")
      .select("id, title, status, data, pdf_path")
      .eq("id", id)
      .single(),
    supabase
      .from("messages")
      .select("content, created_at")
      .eq("cv_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (cvRes.error || !cvRes.data) notFound();

  const initialMessages = (msgRes.data ?? []).map(
    (row) => row.content as Message
  );

  return (
    <CVWorkbench
      cvId={cvRes.data.id}
      initialData={(cvRes.data.data as CVData) ?? null}
      initialStatus={cvRes.data.status}
      initialPdfPath={cvRes.data.pdf_path}
      initialMessages={initialMessages}
    />
  );
}
