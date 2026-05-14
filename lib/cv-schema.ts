/**
 * Source of truth for the structured CV stored in cvs.data (jsonb).
 * Mirrors skills/cv-builder/templates/cv_schema.json from the cv-skill repo.
 */

export interface PersonalDetails {
  name: string;
  phone: string;
  email: string;
  city: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  extra?: string;
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree?: string;
  field?: string;
  start?: string;
  end?: string;
  grade?: string;
  highlights?: string[];
}

export interface ExperienceEntry {
  id: string;
  company: string;
  role: string;
  start: string;
  end?: string;
  bullets: string[];
}

export interface MilitaryService {
  role?: string;
  unit?: string;
  rank?: string;
  start?: string;
  end?: string;
  bullets?: string[];
  skipped?: boolean;
  national_service?: boolean;
}

export interface VolunteeringEntry {
  id: string;
  organization: string;
  role?: string;
  start?: string;
  end?: string;
  description?: string;
}

export interface LanguageProficiency {
  name: string;
  level: string;
}

export interface SkillsBlock {
  technical?: string[];
  languages?: LanguageProficiency[];
  soft?: string[];
}

export interface CVMeta {
  tuned_to_job?: boolean;
  job_keywords?: string[];
  last_updated?: string;
}

export interface CVData {
  personal: Partial<PersonalDetails>;
  summary: string;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  military: MilitaryService;
  volunteering: VolunteeringEntry[];
  skills: SkillsBlock;
  meta: CVMeta;
}

export function emptyCV(): CVData {
  return {
    personal: {},
    summary: "",
    education: [],
    experience: [],
    military: {},
    volunteering: [],
    skills: { technical: [], languages: [], soft: [] },
    meta: {},
  };
}
