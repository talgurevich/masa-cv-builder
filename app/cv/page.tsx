import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { NewCVButton } from "@/components/NewCVButton";
import { CVUpload } from "@/components/CVUpload";

export default async function CVListPage() {
  const supabase = await supabaseServer();
  const { data: cvs } = await supabase
    .from("cvs")
    .select("id, title, status, updated_at")
    .order("updated_at", { ascending: false });

  const isEmpty = !cvs || cvs.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">קורות החיים שלי</h1>
        {!isEmpty && <NewCVButton />}
      </div>

      {isEmpty && (
        <div className="space-y-4">
          <p className="text-slate-500 text-center">
            עדיין לא בנית קורות חיים — אפשר להתחיל בשיחה, או להעלות קובץ קיים.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-xl bg-ink/10 text-ink grid place-items-center">
                <ChatIcon />
              </div>
              <h2 className="font-semibold text-ink text-lg">להתחיל בשיחה</h2>
              <p className="text-sm text-slate-600">
                עונים על שאלות בעברית, והקובץ נבנה תוך כדי.
              </p>
              <NewCVButton />
            </div>
            <CVUpload />
          </div>
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
                    : cv.status === "imported"
                    ? "bg-sky-100 text-sky-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {cv.status === "complete"
                  ? "הושלם"
                  : cv.status === "tuned"
                  ? "הותאם למשרה"
                  : cv.status === "imported"
                  ? "יובא"
                  : "טיוטה"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {!isEmpty && (
        <div className="pt-2">
          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              להעלות קורות חיים מקובץ קיים
            </summary>
            <div className="mt-4">
              <CVUpload compact />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
