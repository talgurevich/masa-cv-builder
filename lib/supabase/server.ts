import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

/** Acts as the logged-in member (their session cookie from the members' site), so RLS applies. */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Setting cookies in a Server Component is a no-op when there's
          // no Response; the middleware refreshes the session instead.
        }
      },
    },
  });
}
