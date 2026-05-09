import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Setting cookies in a Server Component is a no-op when there's
            // no Response — we rely on the middleware/route handler to refresh.
          }
        },
      },
    }
  );
}

/**
 * Service-role client for trusted server-side operations that need to bypass
 * RLS (e.g. mirroring auth.users into public.users on first login).
 * NEVER expose this client to the browser.
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";

export function supabaseService() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
