import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { LoginButton } from "@/components/LoginButton";

export default async function HomePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/cv");

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-slate-50">
      <div className="card max-w-md w-full p-10 text-center space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">בונה קורות חיים</h1>
          <p className="text-slate-500">עבור הצוותים והסטודנטים של מסע אל האופק</p>
        </div>
        <p className="text-slate-700 leading-relaxed">
          שיחה ידידותית בעברית שמרכיבה לך קורות חיים מקצועיים, עם תצוגה חיה
          ויצירת PDF בלחיצה.
        </p>
        <LoginButton />
        <p className="text-xs text-slate-400">
          ההתחברות מאובטחת ע&quot;י Google. רק כתובות מאומתות מורשות לגשת.
        </p>
      </div>
    </main>
  );
}
