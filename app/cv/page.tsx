import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { NewCVButton } from "@/components/NewCVButton";

export default async function CVListPage() {
  const supabase = await supabaseServer();
  const { data: cvs } = await supabase
    .from("cvs")
    .select("id, title, status, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">קורות החיים שלי</h1>
        <NewCVButton />
      </div>

      {(!cvs || cvs.length === 0) && (
        <div className="card p-10 text-center text-slate-500">
          <p className="mb-4">עדיין לא בנית קורות חיים.</p>
          <NewCVButton />
        </div>
      )}

      <ul className="space-y-3">
        {(cvs ?? []).map((cv) => (
          <li key={cv.id}>
            <Link
              href={`/cv/${cv.id}`}
              className="card p-4 flex items-center justify-between hover:shadow-md transition"
            >
              <div>
                <div className="font-semibold">{cv.title}</div>
                <div className="text-xs text-slate-500">
                  עודכן:{" "}
                  <span className="ltr">
                    {new Date(cv.updated_at).toLocaleDateString("he-IL")}
                  </span>
                </div>
              </div>
              <span
                className={`text-xs rounded-full px-2 py-0.5 ${
                  cv.status === "complete" || cv.status === "tuned"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {cv.status === "complete"
                  ? "הושלם"
                  : cv.status === "tuned"
                  ? "הותאם למשרה"
                  : "טיוטה"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
