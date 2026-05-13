import type { CVData } from "./cv-schema";

function escape(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nonEmpty(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function renderCvHtml(raw: Partial<CVData>): string {
  const personal = raw.personal ?? {};
  const summary = raw.summary ?? "";
  const education = raw.education ?? [];
  const experience = raw.experience ?? [];
  const military = raw.military ?? {};
  const volunteering = raw.volunteering ?? [];
  const skills = raw.skills ?? {};

  const contactBits: string[] = [];
  if (nonEmpty(personal.phone)) contactBits.push(`<span>${escape(personal.phone)}</span>`);
  if (nonEmpty(personal.email)) contactBits.push(`<span>${escape(personal.email)}</span>`);
  if (nonEmpty(personal.city)) contactBits.push(`<span>${escape(personal.city)}</span>`);
  if (nonEmpty(personal.linkedin))
    contactBits.push(`<a href="${escape(personal.linkedin)}">LinkedIn</a>`);
  if (nonEmpty(personal.github))
    contactBits.push(`<a href="${escape(personal.github)}">GitHub</a>`);
  if (nonEmpty(personal.portfolio))
    contactBits.push(`<a href="${escape(personal.portfolio)}">פורטפוליו</a>`);

  const contactRow = contactBits.join(`<span class="dot">·</span>`);

  const summarySection = nonEmpty(summary)
    ? `
  <section class="cv-section">
    <h2>תקציר</h2>
    <p class="summary">${escape(summary)}</p>
  </section>`
    : "";

  const eduEntries = education
    .filter((e) => nonEmpty(e?.institution) || nonEmpty(e?.degree))
    .map((edu) => {
      const titleParts: string[] = [];
      if (nonEmpty(edu.degree)) titleParts.push(escape(edu.degree));
      if (nonEmpty(edu.field)) titleParts.push(escape(edu.field));
      const title = titleParts.join(" · ");
      const datesParts: string[] = [];
      if (nonEmpty(edu.start)) datesParts.push(escape(edu.start));
      if (nonEmpty(edu.start) && nonEmpty(edu.end)) datesParts.push("–");
      if (nonEmpty(edu.end)) datesParts.push(escape(edu.end));
      const dates = datesParts.join(" ");
      const highlights =
        edu.highlights && edu.highlights.length > 0
          ? `\n        <ul class="bullets">\n          ${edu.highlights
              .map((h) => `<li>${escape(h)}</li>`)
              .join("")}\n        </ul>`
          : "";
      return `
      <div class="entry">
        <div class="entry-header">
          <div class="entry-title">${title}</div>
          <div class="entry-dates">${dates}</div>
        </div>
        ${nonEmpty(edu.institution) ? `<div class="entry-sub">${escape(edu.institution)}</div>` : ""}
        ${nonEmpty(edu.grade) ? `<div class="entry-extra">ציון ממוצע: ${escape(edu.grade)}</div>` : ""}${highlights}
      </div>`;
    })
    .join("");
  const eduSection = eduEntries
    ? `
  <section class="cv-section">
    <h2>השכלה וקורסים</h2>${eduEntries}
  </section>`
    : "";

  const expEntries = experience
    .filter((j) => nonEmpty(j?.company) || nonEmpty(j?.role))
    .map((job) => {
      const titleParts: string[] = [];
      if (nonEmpty(job.role)) titleParts.push(escape(job.role));
      if (nonEmpty(job.company)) titleParts.push(escape(job.company));
      const title = titleParts.join(" · ");
      const datesParts: string[] = [];
      if (nonEmpty(job.start)) datesParts.push(escape(job.start));
      if (nonEmpty(job.start) && nonEmpty(job.end)) datesParts.push("–");
      if (nonEmpty(job.end)) datesParts.push(escape(job.end));
      const dates = datesParts.join(" ");
      const bullets =
        job.bullets && job.bullets.length > 0
          ? `\n        <ul class="bullets">\n          ${job.bullets
              .map((b) => `<li>${escape(b)}</li>`)
              .join("")}\n        </ul>`
          : "";
      return `
      <div class="entry">
        <div class="entry-header">
          <div class="entry-title">${title}</div>
          <div class="entry-dates">${dates}</div>
        </div>${bullets}
      </div>`;
    })
    .join("");
  const expSection = expEntries
    ? `
  <section class="cv-section">
    <h2>ניסיון תעסוקתי</h2>${expEntries}
  </section>`
    : "";

  const militaryHasContent =
    !military.skipped &&
    (nonEmpty(military.role) ||
      nonEmpty(military.unit) ||
      (military.bullets && military.bullets.length > 0));
  let militarySection = "";
  if (militaryHasContent) {
    const titleParts: string[] = [];
    if (nonEmpty(military.role)) titleParts.push(escape(military.role));
    if (nonEmpty(military.unit)) titleParts.push(escape(military.unit));
    const title = titleParts.join(" · ");
    const datesParts: string[] = [];
    if (nonEmpty(military.start)) datesParts.push(escape(military.start));
    if (nonEmpty(military.start) && nonEmpty(military.end)) datesParts.push("–");
    if (nonEmpty(military.end)) datesParts.push(escape(military.end));
    const dates = datesParts.join(" ");
    const bullets =
      military.bullets && military.bullets.length > 0
        ? `\n      <ul class="bullets">\n        ${military.bullets
            .map((b) => `<li>${escape(b)}</li>`)
            .join("")}\n      </ul>`
        : "";
    const heading = military.national_service ? "שירות לאומי" : "ניסיון צבאי";
    militarySection = `
  <section class="cv-section">
    <h2>${heading}</h2>
    <div class="entry">
      <div class="entry-header">
        <div class="entry-title">${title}</div>
        <div class="entry-dates">${dates}</div>
      </div>
      ${nonEmpty(military.rank) ? `<div class="entry-extra">דרגת שחרור: ${escape(military.rank)}</div>` : ""}${bullets}
    </div>
  </section>`;
  }

  const volEntries = volunteering
    .filter((v) => nonEmpty(v?.organization) || nonEmpty(v?.role))
    .map((v) => {
      const titleParts: string[] = [];
      if (nonEmpty(v.role)) titleParts.push(escape(v.role));
      if (nonEmpty(v.organization)) titleParts.push(escape(v.organization));
      const title = titleParts.join(" · ");
      const datesParts: string[] = [];
      if (nonEmpty(v.start)) datesParts.push(escape(v.start));
      if (nonEmpty(v.start) && nonEmpty(v.end)) datesParts.push("–");
      if (nonEmpty(v.end)) datesParts.push(escape(v.end));
      const dates = datesParts.join(" ");
      return `
      <div class="entry">
        <div class="entry-header">
          <div class="entry-title">${title}</div>
          <div class="entry-dates">${dates}</div>
        </div>
        ${nonEmpty(v.description) ? `<div class="entry-extra">${escape(v.description)}</div>` : ""}
      </div>`;
    })
    .join("");
  const volSection = volEntries
    ? `
  <section class="cv-section">
    <h2>התנדבויות</h2>${volEntries}
  </section>`
    : "";

  const technical = skills.technical ?? [];
  const languages = skills.languages ?? [];
  const soft = skills.soft ?? [];
  const skillsHasContent =
    technical.length > 0 ||
    (languages.length > 0 && nonEmpty(languages[0]?.name)) ||
    soft.length > 0;

  let skillsSection = "";
  if (skillsHasContent) {
    const techBlock =
      technical.length > 0
        ? `
    <div class="skill-group skill-chip-row" style="margin-bottom:6px;">
      <span class="skill-label">כישורים מקצועיים:</span>
      ${technical.map((s) => `<span class="chip">${escape(s)}</span>`).join("")}
    </div>`
        : "";

    const langValid = languages.filter((l) => nonEmpty(l?.name));
    const langBlock =
      langValid.length > 0
        ? `
    <div class="skill-group" style="margin-bottom:6px;">
      <span class="skill-label">שפות:</span>
      ${langValid
        .map(
          (l, i) =>
            `<span class="lang-line">
        <span class="lang-name">${escape(l.name)}</span>${nonEmpty(l.level) ? ` <span class="lang-level">(${escape(l.level)})</span>` : ""}${i < langValid.length - 1 ? " ·" : ""}
      </span>`
        )
        .join("")}
    </div>`
        : "";

    const softBlock =
      soft.length > 0
        ? `
    <div class="skill-group skill-chip-row">
      <span class="skill-label">כישורים רכים:</span>
      ${soft.map((s) => `<span class="chip">${escape(s)}</span>`).join("")}
    </div>`
        : "";

    skillsSection = `
  <section class="cv-section">
    <h2>כישורים</h2>${techBlock}${langBlock}${softBlock}
  </section>`;
  }

  const extraRow = nonEmpty(personal.extra)
    ? `<div class="contact" style="margin-top:4px;">${escape(personal.extra)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${escape(personal.name) || "קורות חיים"} — קורות חיים</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page {
    size: A4;
    margin: 14mm 16mm;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    direction: rtl;
    text-align: right;
    color: #1f2933;
    font-family: 'Noto Sans Hebrew', 'Arial Hebrew', 'SF Hebrew', 'Liberation Sans', 'Arial', 'Helvetica', sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { max-width: 100%; }

  header.cv-head {
    border-bottom: 2px solid #1d3557;
    padding-bottom: 10px;
    margin-bottom: 16px;
  }
  header.cv-head h1 {
    margin: 0 0 4px 0;
    font-size: 22pt;
    font-weight: 700;
    color: #1d3557;
    letter-spacing: 0.2px;
  }
  .contact {
    font-size: 10pt;
    color: #4a5568;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
  }
  .contact span.dot { color: #cbd5e0; }
  .contact a { color: #2b6cb0; text-decoration: none; }

  section.cv-section {
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  section.cv-section h2 {
    font-size: 12.5pt;
    font-weight: 700;
    color: #1d3557;
    margin: 0 0 8px 0;
    padding-bottom: 3px;
    border-bottom: 1px solid #e2e8f0;
    letter-spacing: 0.3px;
  }

  .entry { margin-bottom: 10px; page-break-inside: avoid; }
  .entry:last-child { margin-bottom: 0; }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 2px;
  }
  .entry-title {
    font-weight: 700;
    color: #2d3748;
    font-size: 11pt;
  }
  .entry-dates {
    font-size: 9.5pt;
    color: #718096;
    white-space: nowrap;
    font-weight: 400;
    direction: ltr;
    unicode-bidi: isolate;
  }
  .entry-sub {
    font-size: 10pt;
    color: #4a5568;
    margin-bottom: 4px;
    font-weight: 600;
  }
  .entry-extra {
    font-size: 9.5pt;
    color: #718096;
    margin-bottom: 4px;
  }
  ul.bullets {
    margin: 4px 0 0 0;
    padding: 0 18px 0 0;
  }
  ul.bullets li {
    margin-bottom: 2px;
  }

  p.summary {
    margin: 0;
    text-align: justify;
  }

  .skills-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 20px;
  }
  .skill-group .skill-label {
    font-weight: 700;
    color: #2d3748;
    margin-left: 6px;
  }
  .skill-chip-row { line-height: 1.7; }
  .chip {
    display: inline-block;
    background: #edf2f7;
    color: #2d3748;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 9.5pt;
    margin-left: 4px;
    margin-bottom: 3px;
  }
  .lang-line { margin-bottom: 2px; }
  .lang-name { font-weight: 600; }
  .lang-level { color: #718096; font-size: 9.5pt; }

  footer.cv-foot {
    margin-top: 18px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    text-align: center;
    font-size: 8.5pt;
    color: #a0aec0;
  }

  @media print {
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="page">

  <header class="cv-head">
    <h1>${escape(personal.name) || ""}</h1>
    <div class="contact">${contactRow}</div>
    ${extraRow}
  </header>
${summarySection}${eduSection}${expSection}${militarySection}${volSection}${skillsSection}

</div>
</body>
</html>`;
}
