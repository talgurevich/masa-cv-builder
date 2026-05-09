/**
 * Live HTML rendering of a CVData object. Mirrors skills/cv-builder/templates/
 * cv_template.html so the on-screen preview matches the printed PDF.
 */

import type { CVData } from "@/lib/cv-schema";

interface Props {
  data: CVData;
}

export function CVDocument({ data }: Props) {
  const { personal, summary, education, experience, military, volunteering, skills } =
    data;

  const contactParts = [
    personal.phone,
    personal.email,
    personal.city,
    personal.linkedin && (
      <a key="li" href={personal.linkedin} className="text-blue-700 ltr">
        LinkedIn
      </a>
    ),
    personal.github && (
      <a key="gh" href={personal.github} className="text-blue-700 ltr">
        GitHub
      </a>
    ),
    personal.portfolio && (
      <a key="pf" href={personal.portfolio} className="text-blue-700 ltr">
        פורטפוליו
      </a>
    ),
  ].filter(Boolean);

  const showMilitary =
    military &&
    !military.skipped &&
    (military.role || military.unit || (military.bullets ?? []).length > 0);

  const hasAnySkills =
    (skills?.technical?.length ?? 0) > 0 ||
    (skills?.languages?.length ?? 0) > 0 ||
    (skills?.soft?.length ?? 0) > 0;

  return (
    <article className="text-[10.5pt] leading-relaxed text-body" dir="rtl">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="border-b-2 border-ink pb-2.5 mb-4">
        <h1 className="m-0 mb-1 text-[22pt] font-bold text-ink">
          {personal.name || ""}
        </h1>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10pt] text-slate-600">
          {contactParts.map((p, i) => (
            <span key={i} className="flex items-center gap-3">
              {typeof p === "string" ? (
                <span dir="auto">{p}</span>
              ) : (
                p
              )}
              {i < contactParts.length - 1 && (
                <span className="text-slate-300">·</span>
              )}
            </span>
          ))}
        </div>
      </header>

      {/* ── Summary ───────────────────────────────────────────────────── */}
      {summary && (
        <Section title="תקציר">
          <p className="m-0 text-justify">{summary}</p>
        </Section>
      )}

      {/* ── Education ─────────────────────────────────────────────────── */}
      {education.length > 0 && education[0]?.institution && (
        <Section title="השכלה וקורסים">
          {education.map((edu, i) => (
            <Entry
              key={i}
              title={[edu.degree, edu.field].filter(Boolean).join(" · ")}
              sub={edu.institution}
              dates={dateRange(edu.start, edu.end)}
            >
              {edu.grade && (
                <div className="text-[9.5pt] text-slate-500 mb-1">
                  ציון ממוצע: <span className="ltr">{edu.grade}</span>
                </div>
              )}
              {edu.highlights && edu.highlights.length > 0 && (
                <ul className="m-0 mt-1 pr-5 list-disc">
                  {edu.highlights.map((h, j) => (
                    <li key={j}>{h}</li>
                  ))}
                </ul>
              )}
            </Entry>
          ))}
        </Section>
      )}

      {/* ── Experience ────────────────────────────────────────────────── */}
      {experience.length > 0 && experience[0]?.company && (
        <Section title="ניסיון תעסוקתי">
          {experience.map((job, i) => (
            <Entry
              key={i}
              title={[job.role, job.company].filter(Boolean).join(" · ")}
              dates={dateRange(job.start, job.end)}
            >
              {job.bullets.length > 0 && (
                <ul className="m-0 mt-1 pr-5 list-disc">
                  {job.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
            </Entry>
          ))}
        </Section>
      )}

      {/* ── Military ──────────────────────────────────────────────────── */}
      {showMilitary && (
        <Section title={military.national_service ? "שירות לאומי" : "ניסיון צבאי"}>
          <Entry
            title={[military.role, military.unit].filter(Boolean).join(" · ")}
            dates={dateRange(military.start, military.end)}
          >
            {military.rank && (
              <div className="text-[9.5pt] text-slate-500 mb-1">
                דרגת שחרור: {military.rank}
              </div>
            )}
            {military.bullets && military.bullets.length > 0 && (
              <ul className="m-0 mt-1 pr-5 list-disc">
                {military.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            )}
          </Entry>
        </Section>
      )}

      {/* ── Volunteering ──────────────────────────────────────────────── */}
      {volunteering.length > 0 && volunteering[0]?.organization && (
        <Section title="התנדבויות">
          {volunteering.map((v, i) => (
            <Entry
              key={i}
              title={[v.role, v.organization].filter(Boolean).join(" · ")}
              dates={dateRange(v.start, v.end)}
            >
              {v.description && (
                <div className="text-[9.5pt] text-slate-500">
                  {v.description}
                </div>
              )}
            </Entry>
          ))}
        </Section>
      )}

      {/* ── Skills ────────────────────────────────────────────────────── */}
      {hasAnySkills && (
        <Section title="כישורים">
          {(skills.technical?.length ?? 0) > 0 && (
            <div className="mb-1.5 leading-7">
              <span className="font-bold text-slate-700 ml-2">
                כישורים מקצועיים:
              </span>
              {skills.technical!.map((s, i) => (
                <Chip key={i}>{s}</Chip>
              ))}
            </div>
          )}
          {(skills.languages?.length ?? 0) > 0 && (
            <div className="mb-1.5">
              <span className="font-bold text-slate-700 ml-2">שפות:</span>
              {skills.languages!.map((l, i) => (
                <span key={i}>
                  <span className="font-semibold">{l.name}</span>
                  {l.level && (
                    <span className="text-slate-500 text-[9.5pt]">
                      {" "}
                      ({l.level})
                    </span>
                  )}
                  {i < skills.languages!.length - 1 && " · "}
                </span>
              ))}
            </div>
          )}
          {(skills.soft?.length ?? 0) > 0 && (
            <div className="leading-7">
              <span className="font-bold text-slate-700 ml-2">
                כישורים רכים:
              </span>
              {skills.soft!.map((s, i) => (
                <Chip key={i}>{s}</Chip>
              ))}
            </div>
          )}
        </Section>
      )}
    </article>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3.5">
      <h2 className="text-[12.5pt] font-bold text-ink m-0 mb-2 pb-0.5 border-b border-slate-200">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Entry({
  title,
  sub,
  dates,
  children,
}: {
  title?: string;
  sub?: string;
  dates?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5">
      <div className="flex items-baseline justify-between gap-2.5 mb-0.5">
        <div className="font-bold text-slate-700 text-[11pt]">{title}</div>
        {dates && (
          <div className="text-[9.5pt] text-slate-500 whitespace-nowrap ltr">
            {dates}
          </div>
        )}
      </div>
      {sub && <div className="text-[10pt] text-slate-600 font-semibold mb-1">{sub}</div>}
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-slate-100 text-slate-700 text-[9.5pt] rounded-full px-2 py-0.5 ml-1 mb-1">
      {children}
    </span>
  );
}

function dateRange(start?: string, end?: string): string {
  if (!start && !end) return "";
  if (start && end) return `${start} – ${end}`;
  return start || end || "";
}
