/**
 * Network Haritası — contact profile model. The shape mirrors the sample
 * profile JSON one-to-one so profiles can be exported/imported as-is.
 */

export interface ContactProfile {
  personal: {
    profile_photo: string | null;
    full_name: string;
    occupation: string;
    job_title: string;
    organization: string;
    city: string;
    country: string;
    birthday: string;
    short_bio: string;
  };
  contact: {
    phone: string;
    email: string;
  };
  professional: {
    sector: string;
    expertise: string[];
    previous_organizations: string[];
    education: string[];
    projects: string[];
    professional_interests: string[];
    shared_interests: string[];
  };
  relationship: {
    met_on: string;
    met_at: string;
    relationship_type: string;
    relationship_level: string;
    mutual_contacts: string[];
  };
  network_development: {
    relationship_goal: string;
    collaboration_areas: string[];
    mutual_value: string;
    relationship_status: string;
  };
}

export interface Contact {
  id: string;
  full_name: string;
  profile: ContactProfile;
  created_at: string;
}

export const RELATIONSHIP_TYPES = [
  "Arkadaş",
  "Meslektaş",
  "Mentor",
  "Akademisyen",
  "Sporcu",
  "Antrenör",
  "İş ortağı",
];

export const RELATIONSHIP_LEVELS = ["Yakın", "Düzenli iletişim", "Tanışıklık"];

export const RELATIONSHIP_STATUSES = [
  "Yeni tanışıldı",
  "İletişim sürüyor",
  "Aktif iş birliği",
  "Beklemede",
];

export const SECTORS = [
  "Spor ve Performans",
  "Teknoloji",
  "Akademi",
  "Sağlık",
  "İş dünyası",
];

export function emptyProfile(): ContactProfile {
  return {
    personal: {
      profile_photo: null,
      full_name: "",
      occupation: "",
      job_title: "",
      organization: "",
      city: "",
      country: "",
      birthday: "",
      short_bio: "",
    },
    contact: { phone: "", email: "" },
    professional: {
      sector: "",
      expertise: [],
      previous_organizations: [],
      education: [],
      projects: [],
      professional_interests: [],
      shared_interests: [],
    },
    relationship: {
      met_on: "",
      met_at: "",
      relationship_type: "",
      relationship_level: "",
      mutual_contacts: [],
    },
    network_development: {
      relationship_goal: "",
      collaboration_areas: [],
      mutual_value: "",
      relationship_status: "",
    },
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function list(v: unknown): string[] {
  const raw = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(/[,\n]/)
      : [];
  const out: string[] = [];
  for (const item of raw) {
    const s = str(item);
    if (s && !out.some((o) => o.toLocaleLowerCase("tr") === s.toLocaleLowerCase("tr")))
      out.push(s);
  }
  return out;
}

type Loose = Record<string, unknown> | null | undefined;

/**
 * Coerces any (partial / user-supplied / older) profile object into a
 * complete, trimmed ContactProfile. Used on read, on save and on JSON import.
 */
export function normalizeProfile(input: unknown): ContactProfile {
  const p = (input && typeof input === "object" ? input : {}) as Record<string, Loose>;
  const pe = (p.personal ?? {}) as Record<string, unknown>;
  const co = (p.contact ?? {}) as Record<string, unknown>;
  const pr = (p.professional ?? {}) as Record<string, unknown>;
  const re = (p.relationship ?? {}) as Record<string, unknown>;
  const nd = (p.network_development ?? {}) as Record<string, unknown>;
  const photo = str(pe.profile_photo);

  return {
    personal: {
      profile_photo: photo || null,
      full_name: str(pe.full_name),
      occupation: str(pe.occupation),
      job_title: str(pe.job_title),
      organization: str(pe.organization),
      city: str(pe.city),
      country: str(pe.country),
      birthday: str(pe.birthday),
      short_bio: str(pe.short_bio),
    },
    contact: { phone: str(co.phone), email: str(co.email) },
    professional: {
      sector: str(pr.sector),
      expertise: list(pr.expertise),
      previous_organizations: list(pr.previous_organizations),
      education: list(pr.education),
      projects: list(pr.projects),
      professional_interests: list(pr.professional_interests),
      shared_interests: list(pr.shared_interests),
    },
    relationship: {
      met_on: str(re.met_on),
      met_at: str(re.met_at),
      relationship_type: str(re.relationship_type),
      relationship_level: str(re.relationship_level),
      mutual_contacts: list(re.mutual_contacts),
    },
    network_development: {
      relationship_goal: str(nd.relationship_goal),
      collaboration_areas: list(nd.collaboration_areas),
      mutual_value: str(nd.mutual_value),
      relationship_status: str(nd.relationship_status),
    },
  };
}

export function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase("tr");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toLocaleUpperCase("tr");
}

/** Edges between contacts that list each other (either direction). */
export function contactEdges(contacts: Contact[]): { source: string; target: string }[] {
  const idByName = new Map(contacts.map((c) => [nameKey(c.full_name), c.id]));
  const seen = new Set<string>();
  const edges: { source: string; target: string }[] = [];
  for (const c of contacts) {
    for (const name of c.profile.relationship.mutual_contacts) {
      const other = idByName.get(nameKey(name));
      if (!other || other === c.id) continue;
      const key = c.id < other ? `${c.id}|${other}` : `${other}|${c.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: c.id, target: other });
    }
  }
  return edges;
}

/** dd.MM.yyyy for ISO dates; anything else is shown as typed. */
export function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : value;
}
