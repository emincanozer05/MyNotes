"use client";

import { CloseIcon } from "@/components/CloseIcon";
import { formatDate, initials, nameKey, type Contact } from "@/lib/network";
import { LEVEL_COLORS } from "./NetworkGraph";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-xs font-semibold leading-5 text-[var(--muted)]">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((i) => (
        <span key={i} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs">
          {i}
        </span>
      ))}
    </span>
  );
}

/** One profile section; hidden entirely when none of its rows have data. */
function Section({
  title,
  rows,
}: {
  title: string;
  rows: [string, React.ReactNode | null][];
}) {
  const filled = rows.filter(([, v]) => v !== null);
  if (filled.length === 0) return null;
  return (
    <section className="border-t border-[var(--border)] pt-3">
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </h3>
      <dl>
        {filled.map(([label, value]) => (
          <Row key={label} label={label}>
            {value}
          </Row>
        ))}
      </dl>
    </section>
  );
}

const text = (v: string) => (v ? v : null);
const list = (v: string[]) => (v.length > 0 ? <Chips items={v} /> : null);

/** Right-hand profile panel for the selected person. */
export function ContactPanel({
  contact,
  known,
  onSelectName,
  onEdit,
  onDelete,
  onClose,
  deleting,
}: {
  contact: Contact;
  /** Lower-cased names that exist as contacts (mutual contacts are clickable). */
  known: Set<string>;
  onSelectName: (name: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  deleting: boolean;
}) {
  const { personal: pe, contact: co, professional: pr, relationship: re, network_development: nd } =
    contact.profile;
  const location = [pe.city, pe.country].filter(Boolean).join(", ");
  const met = [re.met_on ? formatDate(re.met_on) : "", re.met_at].filter(Boolean).join(" · ");
  const ring = LEVEL_COLORS[re.relationship_level] ?? "var(--border-strong)";

  function exportJson() {
    const blob = new Blob([JSON.stringify(contact.profile, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${contact.full_name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <aside className="animate-in flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-1)]">
      <div className="flex items-start gap-3 p-4">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-[var(--surface-2)] text-lg font-bold text-[var(--muted)]"
          style={{ borderColor: ring }}
        >
          {pe.profile_photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pe.profile_photo} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(contact.full_name)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight">{contact.full_name}</h2>
          {(pe.job_title || pe.organization) && (
            <p className="mt-0.5 text-sm">
              {pe.job_title}
              {pe.job_title && pe.organization ? " · " : ""}
              {pe.organization && <span className="text-[var(--muted)]">{pe.organization}</span>}
            </p>
          )}
          {(pe.occupation || location) && (
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {[pe.occupation, location].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Paneli kapat"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <CloseIcon />
        </button>
      </div>

      {(re.relationship_type || re.relationship_level || nd.relationship_status) && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {[re.relationship_type, re.relationship_level, nd.relationship_status]
            .filter(Boolean)
            .map((b) => (
              <span
                key={b}
                className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs font-medium"
              >
                {b}
              </span>
            ))}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {pe.short_bio && (
          <p className="text-sm leading-relaxed text-[var(--foreground)]/90">{pe.short_bio}</p>
        )}

        <Section
          title="Kişisel Bilgiler"
          rows={[
            ["Doğum Günü", pe.birthday ? formatDate(pe.birthday) : null],
            ["Konum", text(location)],
          ]}
        />
        <Section
          title="İletişim"
          rows={[
            [
              "Telefon",
              co.phone ? (
                <a href={`tel:${co.phone.replace(/\s+/g, "")}`} className="hover:underline">
                  {co.phone}
                </a>
              ) : null,
            ],
            [
              "E-posta",
              co.email ? (
                <a href={`mailto:${co.email}`} className="text-[var(--accent-text)] hover:underline">
                  {co.email}
                </a>
              ) : null,
            ],
          ]}
        />
        <Section
          title="Profesyonel Profil"
          rows={[
            ["Sektör", text(pr.sector)],
            ["Uzmanlık", list(pr.expertise)],
            ["Önceki Kurumlar", list(pr.previous_organizations)],
            ["Eğitim", list(pr.education)],
            ["Projeler", list(pr.projects)],
            ["İlgi Alanları", list(pr.professional_interests)],
            ["Ortak İlgi", list(pr.shared_interests)],
          ]}
        />
        <Section
          title="İlişki Yönetimi"
          rows={[
            ["Tanışma", text(met)],
            ["İlişki Türü", text(re.relationship_type)],
            ["İlişki Düzeyi", text(re.relationship_level)],
            [
              "Ortak Tanıdıklar",
              re.mutual_contacts.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {re.mutual_contacts.map((n) =>
                    known.has(nameKey(n)) ? (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onSelectName(n)}
                        className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent-text)] hover:underline"
                      >
                        {n}
                      </button>
                    ) : (
                      <span key={n} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs">
                        {n}
                      </span>
                    ),
                  )}
                </span>
              ) : null,
            ],
          ]}
        />
        <Section
          title="Network Geliştirme"
          rows={[
            ["İlişki Hedefi", text(nd.relationship_goal)],
            ["İş Birliği", list(nd.collaboration_areas)],
            ["Karşılıklı Katkı", text(nd.mutual_value)],
            ["İlişki Durumu", text(nd.relationship_status)],
          ]}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-3">
        <button
          type="button"
          onClick={onEdit}
          className="btn-gradient rounded-full px-4 py-1.5 text-xs font-semibold"
        >
          Düzenle
        </button>
        <button
          type="button"
          onClick={exportJson}
          className="btn-ghost rounded-full px-3 py-1.5 text-xs font-semibold"
          title="Profili JSON olarak indir"
        >
          JSON indir
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="ml-auto rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"
        >
          {deleting ? "Siliniyor…" : "Sil"}
        </button>
      </div>
    </aside>
  );
}
