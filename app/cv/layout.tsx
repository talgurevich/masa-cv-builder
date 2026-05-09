import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export default async function CVLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
          <Link href="/cv" className="font-bold text-ink">
            בונה קורות חיים
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              התנתקות ({user.email})
            </button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
