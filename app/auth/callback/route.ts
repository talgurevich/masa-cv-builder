import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Supabase Auth redirects here after Google OAuth. Exchange the code for
 * a session, then send the user on to the app. If the email isn't on the
 * allowlist, the trigger raises and the exchange fails — we render an
 * error.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/cv";

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing-code", url.origin));
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const reason = encodeURIComponent(error.message);
    return NextResponse.redirect(
      new URL(`/?error=${reason}`, url.origin)
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
