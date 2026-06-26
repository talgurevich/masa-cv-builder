import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { LoginButton } from "@/components/LoginButton";

const MASA_LOGO =
  "https://static.wixstatic.com/media/44011a_f5fbcd849b7a4e26b6505c7ee1214aac~mv2.png";
const MASA_URL = "https://www.masaelhaofek.org";

export default async function HomePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/cv");

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <a
            href={MASA_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MASA_LOGO}
              alt="מסע אל האופק"
              className="h-10 w-auto"
            />
            <span className="hidden sm:block text-sm font-semibold text-ink">
              בונה קורות חיים
            </span>
          </a>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#features" className="text-slate-600 hover:text-ink transition">
              מה כלול
            </a>
            <a href="#how" className="text-slate-600 hover:text-ink transition">
              איך זה עובד
            </a>
            <a
              href="#start"
              className="rounded-lg bg-ink text-white px-3.5 py-1.5 font-medium hover:bg-ink/90 transition"
            >
              התחברות
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        id="start"
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(1100px 480px at 90% -10%, #e8f0fb 0%, transparent 60%), radial-gradient(900px 420px at -10% 110%, #fdf2e0 0%, transparent 60%), #ffffff",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 text-center lg:text-right">
            <span className="inline-flex items-center gap-2 rounded-full bg-ink/10 text-ink px-3 py-1 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-ink" />
              עבור בוגרות ובוגרי מסע אל האופק
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-ink leading-tight">
              קורות החיים שלך,
              <br />
              נבנים בשיחה.
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-xl mx-auto lg:mx-0">
              בונה קורות חיים בעברית שעובד איתך בשיחה ידידותית — מתרגם את הסיפור
              שלך לקובץ מקצועי, מעוצב, ומוכן לשליחה.
            </p>
            <div className="pt-2 max-w-sm mx-auto lg:mx-0">
              <LoginButton />
              <p className="text-xs text-slate-400 mt-3">
                ההתחברות מאובטחת ע&quot;י Google.
              </p>
            </div>
          </div>

          {/* Preview mock card */}
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-amber-100/40 to-sky-100/40 blur-2xl rounded-3xl" />
            <div className="relative card p-6 sm:p-8 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
              </div>
              <div className="space-y-4">
                <div>
                  <div className="h-6 w-2/3 bg-ink/90 rounded mb-2" />
                  <div className="h-3 w-1/2 bg-slate-200 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-1/3 bg-ink/70 rounded" />
                  <div className="h-2 w-full bg-slate-100 rounded" />
                  <div className="h-2 w-11/12 bg-slate-100 rounded" />
                  <div className="h-2 w-10/12 bg-slate-100 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-1/4 bg-ink/70 rounded" />
                  <div className="h-2 w-full bg-slate-100 rounded" />
                  <div className="h-2 w-9/12 bg-slate-100 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-1/5 bg-ink/70 rounded" />
                  <div className="flex flex-wrap gap-2">
                    <span className="h-5 px-3 rounded-full bg-slate-100" />
                    <span className="h-5 w-16 rounded-full bg-slate-100" />
                    <span className="h-5 w-10 rounded-full bg-slate-100" />
                    <span className="h-5 w-14 rounded-full bg-slate-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 sm:py-20 bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-ink">
              מה מחכה לך
            </h2>
            <p className="text-slate-600 mt-3 leading-relaxed">
              כלי שנבנה במיוחד עבור הקהילה של מסע אל האופק — פשוט, אישי ובעברית.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Feature
              title="שיחה ידידותית בעברית"
              body="ספר/י את הסיפור שלך, ובינתיים אנחנו מארגנים את הפרטים — השכלה, ניסיון, צבא, התנדבויות וכישורים."
              icon={<ChatIcon />}
            />
            <Feature
              title="תצוגה חיה תוך כדי"
              body="רואים את קורות החיים נבנים בזמן אמת בצד המסך — עיצוב נקי ב-RTL, מוכן להדפסה."
              icon={<EyeIcon />}
            />
            <Feature
              title="ייצוא ל-PDF ו-DOCX"
              body="הורדה בלחיצה — קובץ PDF מהוקצע לשליחה, או DOCX לעריכה אישית ב-Word."
              icon={<DownloadIcon />}
            />
            <Feature
              title="התאמה למשרה מסוימת"
              body="מדביקים תיאור משרה — ואנחנו מציעים חידוד של התקציר והבולטים שמתאים לדרישות."
              icon={<TargetIcon />}
            />
            <Feature
              title="ליווי לאורך כל הדרך"
              body="הבוט שואל את השאלות הנכונות בסדר הנכון — לא צריך לדעת מאיפה להתחיל."
              icon={<CompassIcon />}
            />
            <Feature
              title="שמירה אוטומטית"
              body="חוזרים מתי שרוצים — הנתונים נשמרים בחשבון האישי, והתצוגה ממשיכה בדיוק היכן שעצרת."
              icon={<SaveIcon />}
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-ink">איך זה עובד</h2>
            <p className="text-slate-600 mt-3">שלושה שלבים, רבע שעה, וזהו.</p>
          </div>
          <ol className="grid sm:grid-cols-3 gap-6">
            <Step n={1} title="מתחברים" body="כניסה מהירה עם Google — בלי טפסים." />
            <Step
              n={2}
              title="מספרים"
              body="עונים בשיחה על הפרטים — אפשר גם לערוך ידנית כל סעיף."
            />
            <Step
              n={3}
              title="מורידים"
              body="לוחצים על 'צור PDF' או 'צור DOCX' — הקובץ אצלך."
            />
          </ol>
          <div className="text-center mt-12">
            <a
              href="#start"
              className="inline-flex items-center justify-center rounded-lg bg-ink text-white px-6 py-3 font-semibold hover:bg-ink/90 transition"
            >
              להתחיל עכשיו
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-100 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 grid sm:grid-cols-2 gap-8 items-center">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MASA_LOGO}
              alt="מסע אל האופק"
              className="h-12 w-auto"
            />
            <div>
              <div className="font-semibold text-ink">מסע אל האופק</div>
              <a
                href={MASA_URL}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-slate-500 hover:text-ink transition"
              >
                www.masaelhaofek.org
              </a>
            </div>
          </div>
          <div className="text-sm text-slate-500 sm:text-left">
            © {new Date().getFullYear()} בונה קורות חיים · נבנה עבור קהילת מסע אל האופק
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card p-6 hover:shadow-md transition">
      <div className="w-11 h-11 rounded-xl bg-ink/10 text-ink grid place-items-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-ink text-lg mb-1.5">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="card p-6 relative">
      <div className="w-9 h-9 rounded-full bg-ink text-white grid place-items-center font-bold mb-3">
        {n}
      </div>
      <h3 className="font-semibold text-ink mb-1">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{body}</p>
    </li>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function CompassIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}
function SaveIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
