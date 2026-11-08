import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { BASE_PATH, MEMBERS_URL } from "@/lib/paths";

/**
 * The members' site already checks the login before forwarding /cv here; this repeats the check
 * so the app's own address (*.vercel.app) is closed too. Refreshes the members' Supabase session,
 * and sends anyone not logged in, or no longer on a Monday board, to the members' login page.
 * API calls get a 401 instead of a redirect.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // getClaims verifies the JWT; don't run other code between creating the client and this call.
  const { data } = await supabase.auth.getClaims();

  // request.nextUrl.pathname is relative to the basePath ("/", "/<id>", "/api/...").
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  const deny = (reason: "login" | "denied") => {
    if (isApi) {
      return NextResponse.json({ error: "נדרשת התחברות לאתר החברים." }, { status: 401 });
    }
    const url = new URL("/login", MEMBERS_URL);
    if (reason === "denied") url.searchParams.set("error", "denied");
    else url.searchParams.set("next", `${BASE_PATH}${pathname === "/" ? "" : pathname}${search}`);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!data?.claims) return deny("login");

  const { data: member } = await supabase.rpc("am_i_member");
  if (member !== true) return deny("denied");

  return response;
}

export const config = {
  // Next.js prefixes these with the basePath (/cv).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
