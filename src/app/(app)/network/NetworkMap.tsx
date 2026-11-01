"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { contactEdges, initials, nameKey, type Contact } from "@/lib/network";
import { NetworkGraph } from "./NetworkGraph";
import { ContactPanel } from "./ContactPanel";
import { ContactForm } from "./ContactForm";
import { deleteContact } from "./actions";

/** Network Haritası: search + graph + profile panel + add/edit form. */
export function NetworkMap({
  contacts,
  setupError,
}: {
  contacts: Contact[];
  setupError: string | null;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);
  const [form, setForm] = useState<{ key: number; contactId: string | null } | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

  const edges = useMemo(() => contactEdges(contacts), [contacts]);
  const byId = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const idByName = useMemo(
    () => new Map(contacts.map((c) => [nameKey(c.full_name), c.id])),
    [contacts],
  );
  const known = useMemo(() => new Set(idByName.keys()), [idByName]);

  // A deleted (or not yet loaded) contact simply closes the panel.
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const editing = form?.contactId ? (byId.get(form.contactId) ?? null) : null;

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return [];
    return contacts
      .filter((c) => {
        const p = c.profile;
        return [
          c.full_name,
          p.personal.occupation,
          p.personal.job_title,
          p.personal.organization,
          p.professional.sector,
          ...p.professional.expertise,
        ]
          .join(" ")
          .toLocaleLowerCase("tr")
          .includes(q);
      })
      .slice(0, 8);
  }, [contacts, query]);

  function select(id: string, center = true) {
    setSelectedId(id);
    if (center) setFocus({ id, nonce: Date.now() });
  }

  function pickResult(id: string) {
    select(id);
    setQuery("");
    setSearchOpen(false);
  }

  function handleDelete() {
    if (!selected) return;
    if (!window.confirm(`${selected.full_name} ağdan silinsin mi?`)) return;
    const id = selected.id;
    startDelete(async () => {
      const res = await deleteContact(id);
      if (res.error) {
        window.alert(res.error);
        return;
      }
      setSelectedId(null);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:h-[calc(100dvh-8.5rem)] lg:min-h-[520px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Network Haritası</h1>
          <p className="mt-0.5 text-[13px] text-[var(--muted)]">
            {contacts.length} kişi · {edges.length} bağlantı — kişiye tıkla, profilini
            gör; sürükle, kaydır ve yakınlaştır.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) pickResult(results[0].id);
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="Kişi, meslek veya kurum ara…"
              aria-label="Ağda kişi ara"
              className="w-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm outline-none transition-colors focus:border-[var(--brand-1)]"
            />
            {searchOpen && results.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-2)]">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickResult(c.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-2)] text-[10px] font-bold text-[var(--muted)]">
                        {c.profile.personal.profile_photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.profile.personal.profile_photo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initials(c.full_name)
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{c.full_name}</span>
                        {(c.profile.personal.occupation || c.profile.personal.organization) && (
                          <span className="block truncate text-xs text-[var(--muted)]">
                            {[c.profile.personal.occupation, c.profile.personal.organization]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => setForm({ key: Date.now(), contactId: null })}
            disabled={Boolean(setupError)}
            className="btn-gradient shrink-0 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            + Kişi Ekle
          </button>
        </div>
      </div>

      {setupError && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {setupError}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="relative h-[62vh] min-h-[360px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:h-auto lg:flex-1">
          {/* Faint dot grid gives the canvas depth without decoration */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(var(--border) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          {contacts.length > 0 ? (
            <NetworkGraph
              contacts={contacts}
              edges={edges}
              selectedId={selected?.id ?? null}
              onSelect={(id) => (id ? select(id, false) : setSelectedId(null))}
              focus={focus}
            />
          ) : (
            <div className="relative flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-base font-semibold">Ağın henüz boş</p>
              <p className="max-w-sm text-sm text-[var(--muted)]">
                İlk kişiyi ekle; ortak tanıdıklarını yazdıkça harita kendiliğinden
                büyüyüp bağlantılar oluşur.
              </p>
              {!setupError && (
                <button
                  type="button"
                  onClick={() => setForm({ key: Date.now(), contactId: null })}
                  className="btn-gradient mt-1 rounded-full px-4 py-2 text-sm font-semibold"
                >
                  + İlk kişiyi ekle
                </button>
              )}
            </div>
          )}
        </div>

        {selected && (
          <div className="h-[75vh] lg:h-auto lg:min-h-0 lg:w-[380px] lg:shrink-0">
            <ContactPanel
              key={selected.id}
              contact={selected}
              known={known}
              onSelectName={(name) => {
                const id = idByName.get(nameKey(name));
                if (id) select(id);
              }}
              onEdit={() => setForm({ key: Date.now(), contactId: selected.id })}
              onDelete={handleDelete}
              onClose={() => setSelectedId(null)}
              deleting={deleting}
            />
          </div>
        )}
      </div>

      {form && (
        <ContactForm
          key={form.key}
          open
          onClose={() => setForm(null)}
          contactId={form.contactId}
          initial={editing?.profile ?? null}
          otherNames={contacts
            .filter((c) => c.id !== form.contactId)
            .map((c) => c.full_name)}
          onSaved={(id) => {
            setForm(null);
            router.refresh();
            select(id);
          }}
        />
      )}
    </div>
  );
}
