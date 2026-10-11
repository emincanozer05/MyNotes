"use client";

import { CloseIcon } from "@/components/CloseIcon";
import { useId, useRef, useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import {
  RELATIONSHIP_LEVELS,
  RELATIONSHIP_STATUSES,
  RELATIONSHIP_TYPES,
  SECTORS,
  emptyProfile,
  initials,
  nameKey,
  normalizeProfile,
  type ContactProfile,
} from "@/lib/network";
import { saveContact } from "./actions";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--brand-1)]";

/** Center-crops and downsizes a photo to a small JPEG data URL (~10KB). */
function resizePhoto(file: File, size = 192): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size,
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Görsel okunamadı."));
    };
    img.src = url;
  });
}

function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
        {label}
        {hint && <span className="ml-1 font-normal opacity-80">— {hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** Chip list editor: Enter or comma adds, Backspace on empty removes. */
function ListInput({
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  suggestions?: string[];
}) {
  const [text, setText] = useState("");
  const listId = useId();

  function commit(raw = text) {
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const next = [...value];
    for (const p of parts) {
      if (!next.some((v) => nameKey(v) === nameKey(p))) next.push(p);
    }
    onChange(next);
    setText("");
  }

  return (
    <div className="flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 transition-colors focus-within:border-[var(--brand-1)]">
      {value.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-medium"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            aria-label={`${v} kaldır`}
            className="text-[var(--muted)] hover:text-rose-500"
          >
            <CloseIcon size={10} />
          </button>
        </span>
      ))}
      <input
        value={text}
        list={suggestions ? listId : undefined}
        onChange={(e) => {
          const v = e.target.value;
          // A datalist pick is committed right away. Picks arrive as
          // "insertReplacementText" (Chromium) or a plain Event (Firefox);
          // normal typing ("insertText") never auto-commits a partial name.
          const inputType = (e.nativeEvent as InputEvent).inputType;
          const picked =
            (inputType === "insertReplacementText" || inputType === undefined) &&
            suggestions?.includes(v);
          if (picked) commit(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !text && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => commit()}
        placeholder={value.length === 0 ? placeholder : ""}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions
            .filter((s) => !value.some((v) => nameKey(v) === nameKey(s)))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      )}
    </div>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3 border-t border-[var(--border)] pt-4">
      <legend className="pr-2 text-sm font-bold">
        <span className="mr-1.5 text-[var(--muted)]">{n}.</span>
        {title}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** Create / edit a contact profile (all five profile sections). */
export function ContactForm({
  open,
  onClose,
  contactId,
  initial,
  otherNames,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  contactId: string | null;
  initial: ContactProfile | null;
  /** Names of everyone else in the network (mutual contact suggestions). */
  otherNames: string[];
  onSaved: (id: string) => void;
}) {
  const [p, setP] = useState<ContactProfile>(() => initial ?? emptyProfile());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const photoRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const typeList = useId();
  const sectorList = useId();

  function set<S extends keyof ContactProfile, K extends keyof ContactProfile[S]>(
    section: S,
    key: K,
    value: ContactProfile[S][K],
  ) {
    setP((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  }

  async function handlePhoto(file: File) {
    try {
      set("personal", "profile_photo", await resizePhoto(file));
    } catch {
      setError("Fotoğraf okunamadı.");
    }
  }

  async function handleJson(file: File) {
    try {
      const parsed = normalizeProfile(JSON.parse(await file.text()));
      // Keep the current photo when the imported profile has none.
      if (!parsed.personal.profile_photo) {
        parsed.personal.profile_photo = p.personal.profile_photo;
      }
      setP(parsed);
      setError(null);
    } catch {
      setError("JSON dosyası okunamadı. Örnek profil yapısında olmalı.");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!p.personal.full_name.trim()) {
      setError("Ad Soyad zorunludur.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveContact(contactId, p);
      if (res.error || !res.id) setError(res.error ?? "Kaydedilemedi.");
      else onSaved(res.id);
    });
  }

  const photo = p.personal.profile_photo;

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-3xl" labelledBy={titleId}>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-bold">
              {contactId ? "Kişiyi düzenle" : "Yeni kişi"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Yalnızca Ad Soyad zorunlu; diğer alanları istediğin zaman doldurabilirsin.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => jsonRef.current?.click()}
              className="btn-ghost rounded-full px-3 py-1.5 text-xs font-semibold"
              title="Örnek profil yapısındaki bir JSON dosyasından doldur"
            >
              JSON içe aktar
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <CloseIcon />
            </button>
          </div>
          <input
            ref={jsonRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleJson(f);
              e.target.value = "";
            }}
          />
        </div>

        <Section n={1} title="Kişisel Bilgiler">
          <div className="flex items-center gap-4 sm:col-span-2">
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)]"
              title="Profil fotoğrafı seç"
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl font-bold text-[var(--muted)]">
                  {p.personal.full_name ? initials(p.personal.full_name) : "+"}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                Değiştir
              </span>
            </button>
            <div className="text-xs text-[var(--muted)]">
              <p className="font-semibold text-[var(--foreground)]">Profil fotoğrafı</p>
              <p>Kişiyi grafikte kolayca tanımak için.</p>
              {photo && (
                <button
                  type="button"
                  onClick={() => set("personal", "profile_photo", null)}
                  className="mt-1 font-semibold text-rose-600 hover:underline dark:text-rose-400"
                >
                  Fotoğrafı kaldır
                </button>
              )}
            </div>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePhoto(f);
                e.target.value = "";
              }}
            />
          </div>
          <Field label="Ad Soyad *">
            <input
              required
              autoFocus
              value={p.personal.full_name}
              onChange={(e) => set("personal", "full_name", e.target.value)}
              className={inputCls}
              placeholder="Ahmet Yılmaz"
            />
          </Field>
          <Field label="Meslek" hint="uzmanlık / çalışma alanı">
            <input
              value={p.personal.occupation}
              onChange={(e) => set("personal", "occupation", e.target.value)}
              className={inputCls}
              placeholder="Spor Bilimci"
            />
          </Field>
          <Field label="Unvan" hint="mevcut görevi">
            <input
              value={p.personal.job_title}
              onChange={(e) => set("personal", "job_title", e.target.value)}
              className={inputCls}
              placeholder="Atletik Performans Direktörü"
            />
          </Field>
          <Field label="Kurum / Şirket">
            <input
              value={p.personal.organization}
              onChange={(e) => set("personal", "organization", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Şehir">
            <input
              value={p.personal.city}
              onChange={(e) => set("personal", "city", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Ülke">
            <input
              value={p.personal.country}
              onChange={(e) => set("personal", "country", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Doğum Günü" hint="isteğe bağlı">
            <input
              type="date"
              value={p.personal.birthday}
              onChange={(e) => set("personal", "birthday", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Kısa Biyografi" wide>
            <textarea
              rows={2}
              value={p.personal.short_bio}
              onChange={(e) => set("personal", "short_bio", e.target.value)}
              className={inputCls}
            />
          </Field>
        </Section>

        <Section n={2} title="İletişim Bilgileri">
          <Field label="Telefon">
            <input
              type="tel"
              value={p.contact.phone}
              onChange={(e) => set("contact", "phone", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="E-posta">
            <input
              type="email"
              value={p.contact.email}
              onChange={(e) => set("contact", "email", e.target.value)}
              className={inputCls}
            />
          </Field>
        </Section>

        <Section n={3} title="Profesyonel Profil">
          <Field label="Sektör">
            <input
              list={sectorList}
              value={p.professional.sector}
              onChange={(e) => set("professional", "sector", e.target.value)}
              className={inputCls}
              placeholder="Spor, teknoloji, akademi…"
            />
            <datalist id={sectorList}>
              {SECTORS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Uzmanlık Alanları">
            <ListInput
              value={p.professional.expertise}
              onChange={(v) => set("professional", "expertise", v)}
              placeholder="Yaz, Enter'a bas"
            />
          </Field>
          <Field label="Önceki Kurumlar">
            <ListInput
              value={p.professional.previous_organizations}
              onChange={(v) => set("professional", "previous_organizations", v)}
              placeholder="Yaz, Enter'a bas"
            />
          </Field>
          <Field label="Eğitim">
            <ListInput
              value={p.professional.education}
              onChange={(v) => set("professional", "education", v)}
              placeholder="Üniversite, bölüm…"
            />
          </Field>
          <Field label="Projeler">
            <ListInput
              value={p.professional.projects}
              onChange={(v) => set("professional", "projects", v)}
              placeholder="Yaz, Enter'a bas"
            />
          </Field>
          <Field label="Profesyonel İlgi Alanları">
            <ListInput
              value={p.professional.professional_interests}
              onChange={(v) => set("professional", "professional_interests", v)}
              placeholder="Yaz, Enter'a bas"
            />
          </Field>
          <Field label="Ortak İlgi Alanları" hint="birlikte konuşabileceğiniz konular" wide>
            <ListInput
              value={p.professional.shared_interests}
              onChange={(v) => set("professional", "shared_interests", v)}
              placeholder="Yaz, Enter'a bas"
            />
          </Field>
        </Section>

        <Section n={4} title="İlişki Yönetimi">
          <Field label="Tanışma Tarihi">
            <input
              type="date"
              value={p.relationship.met_on}
              onChange={(e) => set("relationship", "met_on", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Tanışma Yeri">
            <input
              value={p.relationship.met_at}
              onChange={(e) => set("relationship", "met_at", e.target.value)}
              className={inputCls}
              placeholder="İstanbul, Spor Bilimleri Konferansı"
            />
          </Field>
          <Field label="İlişki Türü">
            <input
              list={typeList}
              value={p.relationship.relationship_type}
              onChange={(e) => set("relationship", "relationship_type", e.target.value)}
              className={inputCls}
              placeholder="Arkadaş, meslektaş, mentor…"
            />
            <datalist id={typeList}>
              {RELATIONSHIP_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="İlişki Düzeyi">
            <select
              value={p.relationship.relationship_level}
              onChange={(e) => set("relationship", "relationship_level", e.target.value)}
              className={inputCls}
            >
              <option value="">Seç…</option>
              {RELATIONSHIP_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Ortak Tanıdıklar"
            hint="ağda olmayan isimler yeni kişi olarak eklenir"
            wide
          >
            <ListInput
              value={p.relationship.mutual_contacts}
              onChange={(v) => set("relationship", "mutual_contacts", v)}
              placeholder="İsim yaz veya listeden seç"
              suggestions={otherNames}
            />
          </Field>
        </Section>

        <Section n={5} title="Network Geliştirme">
          <Field label="İlişki Hedefi" wide>
            <input
              value={p.network_development.relationship_goal}
              onChange={(e) =>
                set("network_development", "relationship_goal", e.target.value)
              }
              className={inputCls}
              placeholder="İlişkiyi hangi yönde geliştirmek istiyorsun?"
            />
          </Field>
          <Field label="İş Birliği Alanları">
            <ListInput
              value={p.network_development.collaboration_areas}
              onChange={(v) => set("network_development", "collaboration_areas", v)}
              placeholder="Ortak araştırma, seminer…"
            />
          </Field>
          <Field label="İlişki Durumu">
            <select
              value={p.network_development.relationship_status}
              onChange={(e) =>
                set("network_development", "relationship_status", e.target.value)
              }
              className={inputCls}
            >
              <option value="">Seç…</option>
              {RELATIONSHIP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Karşılıklı Katkı" hint="birbirinize nasıl yardımcı olabilirsiniz" wide>
            <textarea
              rows={2}
              value={p.network_development.mutual_value}
              onChange={(e) => set("network_development", "mutual_value", e.target.value)}
              className={inputCls}
            />
          </Field>
        </Section>

        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 rounded-b-2xl border-t border-[var(--border)] bg-[var(--surface)] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost rounded-full px-4 py-2 text-sm font-semibold"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={pending}
            className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
