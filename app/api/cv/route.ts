import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { emptyCV } from "@/lib/cv-schema";

export async function POST() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("cvs")
    .insert({ user_id: user.id, data: emptyCV() })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
