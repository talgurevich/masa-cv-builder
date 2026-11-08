import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { BASE_PATH, MEMBERS_URL } from "@/lib/paths";

export default async function CVLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  // The middleware already sends logged-out visitors to the members' login; this is a backstop.
  if (!data?.claims) redirect(`${MEMBERS_URL}/login?next=${encodeURIComponent(BASE_PATH)}`);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Plain <a>: the members' home page is another app on the same domain. */}
            <a href={MEMBERS_URL} className="text-sm text-slate-500 hover:text-slate-700 shrink-0">
              → הכלים שלי
            </a>
            <span className="text-slate-300" aria-hidden>|</span>
            <Link href="/" className="font-bold text-ink truncate">
              בונה קורות חיים
            </Link>
          </div>
          <form action={`${MEMBERS_URL}/auth/signout`} method="post">
            <button
              type="submit"
              className="text-sm text-slate-500 hover:text-slate-700 truncate max-w-[50vw]"
            >
              התנתקות{email ? ` (${email})` : ""}
            </button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
