"use client";

import { useState } from "react";
import { getArticlePdfUrl } from "./actions";

/** Opens an article's private PDF in a new tab via a short-lived signed URL. */
export function PdfOpenButton({
  articleId,
  label = "📄 PDF",
  className = "btn-ghost rounded-full px-3 py-1.5 text-xs font-semibold",
}: {
  articleId: string;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function open() {
    // Open the tab synchronously (inside the click) so popup blockers allow
    // it, then point it at the signed URL once the server returns it.
    const tab = window.open("", "_blank");
    setBusy(true);
    try {
      const res = await getArticlePdfUrl(articleId);
      if (res.url) {
        if (tab) tab.location.href = res.url;
        else window.location.href = res.url;
      } else {
        tab?.close();
        window.alert(res.error ?? "PDF açılamadı.");
      }
    } catch {
      tab?.close();
      window.alert("Sunucuya ulaşılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      title="Yüklenen PDF'i yeni sekmede aç"
      className={`${className} disabled:opacity-50`}
    >
      {busy ? "Açılıyor…" : label}
    </button>
  );
}
