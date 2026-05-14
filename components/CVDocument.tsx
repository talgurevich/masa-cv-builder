/**
 * Live HTML rendering of a CVData object. Mirrors the PDF template.
 *
 * When `onChange` is provided, fields become inline-editable (click → edit).
 * Each commit calls `onChange` with the next full CVData, which the parent
 * is expected to optimistic-set and PATCH to the server.
 */

"use client";

import type { CVData, EducationEntry, ExperienceEntry, VolunteeringEntry } from "@/lib/cv-schema";
import { EditableText, EditableTextarea } from "./Editable";

interface Props {
  data: CVData;
  onChange?: (next: CVData) => void;
}

export function CVDocument({ data, onChange }: Props) {
  const { personal, summary, education, experience, military, volunteering, skills } =
    data;
  const editable = !!onChange;

  const isEmpty =
    !personal?.name &&
    !summary &&
    !(education[0]?.institution) &&
    !(experience[0]?.company) &&
    !(military?.role || military?.unit) &&
    !(volunteering[0]?.organization) &&
    !(skills?.technical?.length) &&
    !(skills?.languages?.length);

  if (isEmpty) return <EmptyPreview />;

  function update(patch: Partial<CVData>) {
    onChange?.({ ...data, ...patch });
  }
  function updatePersonal(patch: Partial<CVData["personal"]>) {
    update({ personal: { ...personal, ...patch } });
  }
  function updateEducationAt(id: string, patch: Partial<EducationEntry>) {
    update({
      education: education.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  }
  function removeEducation(id: string) {
    update({ education: education.filter((e) => e.id !== id) });
  }
  function updateExperienceAt(id: string, patch: Partial<ExperienceEntry>) {
    update({
      experience: experience.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  }
  function removeExperience(id: string) {
    update({ experience: experience.filter((e) => e.id !== id) });
  }
  function updateVolunteeringAt(id: string, patch: Partial<VolunteeringEntry>) {
    update({
      volunteering: volunteering.map((v) =>
        v.id === id ? { ...v, ...patch } : v
      ),
    });
  }
  function removeVolunteering(id: string) {
    update({ volunteering: volunteering.filter((v) => v.id !== id) });
  }

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
      <header className="border-b-2 border-ink pb-2.5 mb-4">
        <h1 className="m-0 mb-1 text-[22pt] font-bold text-ink">
          {editable ? (
            <EditableText
              value={personal.name ?? ""}
              placeholder="הוסף שם מלא"
              onCommit={(v) => updatePersonal({ name: v })}
              ariaLabel="שם מלא"
            />
          ) : (
            personal.name || ""
          )}
        </h1>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10pt] text-slate-600">
          <ContactItem
            value={personal.phone}
            placeholder="טלפון"
            editable={editable}
            onCommit={(v) => updatePersonal({ phone: v })}
          />
          <ContactItem
            value={personal.email}
            placeholder="אימייל"
            editable={editable}
            onCommit={(v) => updatePersonal({ email: v })}
          />
          <ContactItem
            value={personal.city}
            placeholder="עיר"
            editable={editable}
            onCommit={(v) => updatePersonal({ city: v })}
          />
          {(personal.linkedin || editable) && (
            <ContactItem
              value={personal.linkedin}
              placeholder="קישור LinkedIn"
              editable={editable}
              link
              onCommit={(v) => updatePersonal({ linkedin: v })}
            />
          )}
          {(personal.github || editable) && (
            <ContactItem
              value={personal.github}
              placeholder="קישור GitHub"
              editable={editable}
              link
              onCommit={(v) => updatePersonal({ github: v })}
            />
          )}
          {(personal.portfolio || editable) && (
            <ContactItem
              value={personal.portfolio}
              placeholder="קישור פורטפוליו"
              editable={editable}
              link
              onCommit={(v) => updatePersonal({ portfolio: v })}
            />
          )}
        </div>
      </header>

      {(summary || editable) && (
        <Section title="תקציר">
          {editable ? (
            <EditableTextarea
              value={summary}
              placeholder="לחץ להוסיף תקציר…"
              onCommit={(v) => update({ summary: v })}
              ariaLabel="תקציר"
              className="text-justify"
            />
          ) : (
            <p className="m-0 text-justify">{summary}</p>
          )}
        </Section>
      )}

      {education.length > 0 && education[0]?.institution && (
        <Section title="השכלה וקורסים">
          {education.map((edu) => (
            <Entry
              key={edu.id}
              title={
                editable ? (
                  <EditableText
                    value={[edu.degree, edu.field].filter(Boolean).join(" · ") || ""}
                    placeholder="תואר · תחום"
                    onCommit={(v) => {
                      const [degree, field] = v.split(/\s*·\s*/);
                      updateEducationAt(edu.id, {
                        degree: degree ?? "",
                        field: field ?? "",
                      });
                    }}
                  />
                ) : (
                  [edu.degree, edu.field].filter(Boolean).join(" · ")
                )
              }
              sub={
                editable ? (
                  <EditableText
                    value={edu.institution}
                    placeholder="מוסד"
                    onCommit={(v) => updateEducationAt(edu.id, { institution: v })}
                  />
                ) : (
                  edu.institution
                )
              }
              dates={
                editable ? (
                  <EditableDates
                    start={edu.start}
                    end={edu.end}
                    onCommit={(s, e) =>
                      updateEducationAt(edu.id, { start: s, end: e })
                    }
                  />
                ) : (
                  dateRange(edu.start, edu.end)
                )
              }
              onRemove={editable ? () => removeEducation(edu.id) : undefined}
            >
              {(edu.grade || editable) && (
                <div className="text-[9.5pt] text-slate-500 mb-1">
                  ציון ממוצע:{" "}
                  {editable ? (
                    <EditableText
                      value={edu.grade ?? ""}
                      placeholder="—"
                      onCommit={(v) => updateEducationAt(edu.id, { grade: v })}
                      className="ltr"
                    />
                  ) : (
                    <span className="ltr">{edu.grade}</span>
                  )}
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

      {experience.length > 0 && experience[0]?.company && (
        <Section title="ניסיון תעסוקתי">
          {experience.map((job) => (
            <Entry
              key={job.id}
              title={
                editable ? (
                  <span>
                    <EditableText
                      value={job.role}
                      placeholder="תפקיד"
                      onCommit={(v) => updateExperienceAt(job.id, { role: v })}
                    />
                    {" · "}
                    <EditableText
                      value={job.company}
                      placeholder="חברה"
                      onCommit={(v) => updateExperienceAt(job.id, { company: v })}
                    />
                  </span>
                ) : (
                  [job.role, job.company].filter(Boolean).join(" · ")
                )
              }
              dates={
                editable ? (
                  <EditableDates
                    start={job.start}
                    end={job.end}
                    onCommit={(s, e) =>
                      updateExperienceAt(job.id, { start: s ?? "", end: e })
                    }
                  />
                ) : (
                  dateRange(job.start, job.end)
                )
              }
              onRemove={editable ? () => removeExperience(job.id) : undefined}
            >
              {job.bullets.length > 0 && (
                <ul className="m-0 mt-1 pr-5 list-disc">
                  {job.bullets.map((b, j) => (
                    <li key={j}>
                      {editable ? (
                        <EditableText
                          value={b}
                          placeholder="…"
                          onCommit={(v) => {
                            const next = job.bullets.slice();
                            if (v) next[j] = v;
                            else next.splice(j, 1);
                            updateExperienceAt(job.id, { bullets: next });
                          }}
                        />
                      ) : (
                        b
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Entry>
          ))}
        </Section>
      )}

      {showMilitary && (
        <Section title={military.national_service ? "שירות לאומי" : "ניסיון צבאי"}>
          <Entry
            title={
              editable ? (
                <span>
                  <EditableText
                    value={military.role ?? ""}
                    placeholder="תפקיד"
                    onCommit={(v) =>
                      update({ military: { ...military, role: v } })
                    }
                  />
                  {" · "}
                  <EditableText
                    value={military.unit ?? ""}
                    placeholder="יחידה"
                    onCommit={(v) =>
                      update({ military: { ...military, unit: v } })
                    }
                  />
                </span>
              ) : (
                [military.role, military.unit].filter(Boolean).join(" · ")
              )
            }
            dates={
              editable ? (
                <EditableDates
                  start={military.start}
                  end={military.end}
                  onCommit={(s, e) =>
                    update({ military: { ...military, start: s, end: e } })
                  }
                />
              ) : (
                dateRange(military.start, military.end)
              )
            }
          >
            {(military.rank || editable) && (
              <div className="text-[9.5pt] text-slate-500 mb-1">
                דרגת שחרור:{" "}
                {editable ? (
                  <EditableText
                    value={military.rank ?? ""}
                    placeholder="—"
                    onCommit={(v) =>
                      update({ military: { ...military, rank: v } })
                    }
                  />
                ) : (
                  military.rank
                )}
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

      {volunteering.length > 0 && volunteering[0]?.organization && (
        <Section title="התנדבויות">
          {volunteering.map((v) => (
            <Entry
              key={v.id}
              title={
                editable ? (
                  <span>
                    <EditableText
                      value={v.role ?? ""}
                      placeholder="תפקיד"
                      onCommit={(val) => updateVolunteeringAt(v.id, { role: val })}
                    />
                    {" · "}
                    <EditableText
                      value={v.organization}
                      placeholder="ארגון"
                      onCommit={(val) =>
                        updateVolunteeringAt(v.id, { organization: val })
                      }
                    />
                  </span>
                ) : (
                  [v.role, v.organization].filter(Boolean).join(" · ")
                )
              }
              dates={
                editable ? (
                  <EditableDates
                    start={v.start}
                    end={v.end}
                    onCommit={(s, e) =>
                      updateVolunteeringAt(v.id, { start: s, end: e })
                    }
                  />
                ) : (
                  dateRange(v.start, v.end)
                )
              }
              onRemove={editable ? () => removeVolunteering(v.id) : undefined}
            >
              {(v.description || editable) && (
                <div className="text-[9.5pt] text-slate-500">
                  {editable ? (
                    <EditableTextarea
                      value={v.description ?? ""}
                      placeholder="תיאור קצר…"
                      onCommit={(val) =>
                        updateVolunteeringAt(v.id, { description: val })
                      }
                    />
                  ) : (
                    v.description
                  )}
                </div>
              )}
            </Entry>
          ))}
        </Section>
      )}

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

function ContactItem({
  value,
  placeholder,
  editable,
  link,
  onCommit,
}: {
  value?: string;
  placeholder: string;
  editable: boolean;
  link?: boolean;
  onCommit: (next: string) => void;
}) {
  if (editable) {
    return (
      <EditableText
        value={value ?? ""}
        placeholder={placeholder}
        onCommit={onCommit}
        className={link ? "text-blue-700 ltr" : ""}
      />
    );
  }
  if (!value) return null;
  if (link) {
    return (
      <a href={value} className="text-blue-700 ltr">
        {placeholder}
      </a>
    );
  }
  return <span dir="auto">{value}</span>;
}

function EditableDates({
  start,
  end,
  onCommit,
}: {
  start?: string;
  end?: string;
  onCommit: (start: string | undefined, end: string | undefined) => void;
}) {
  return (
    <span className="ltr">
      <EditableText
        value={start ?? ""}
        placeholder="התחלה"
        onCommit={(v) => onCommit(v || undefined, end)}
      />
      {" – "}
      <EditableText
        value={end ?? ""}
        placeholder="סיום"
        onCommit={(v) => onCommit(start, v || undefined)}
      />
    </span>
  );
}

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
  onRemove,
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  dates?: React.ReactNode;
  children?: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <div className="mb-2.5 group relative">
      <div className="flex items-baseline justify-between gap-2.5 mb-0.5">
        <div className="font-bold text-slate-700 text-[11pt] flex items-center gap-1.5">
          {title}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition text-slate-400 hover:text-red-600 text-xs"
              aria-label="מחק פריט"
              title="מחק פריט"
            >
              ×
            </button>
          )}
        </div>
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

function EmptyPreview() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-16 px-8">
      <svg
        width="120"
        height="150"
        viewBox="0 0 120 150"
        className="mb-6 opacity-40"
        aria-hidden="true"
      >
        <rect
          x="2"
          y="2"
          width="116"
          height="146"
          rx="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        <line x1="20" y1="28" x2="80" y2="28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <line x1="20" y1="44" x2="100" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <line x1="20" y1="56" x2="70" y2="56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <line x1="20" y1="80" x2="60" y2="80" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <line x1="20" y1="96" x2="100" y2="96" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        <line x1="20" y1="108" x2="90" y2="108" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        <line x1="20" y1="120" x2="75" y2="120" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      </svg>
      <p className="text-base font-medium text-slate-500">
        מה שתספר/י בצ&apos;אט יופיע כאן בזמן אמת
      </p>
      <p className="text-sm mt-2 max-w-sm leading-relaxed">
        קורות החיים יתעדכנו אוטומטית עם כל פרט שתמסור/תמסרי לבוט.
        כשנסיים נוכל להפיק קובץ PDF מעוצב.
      </p>
    </div>
  );
}
