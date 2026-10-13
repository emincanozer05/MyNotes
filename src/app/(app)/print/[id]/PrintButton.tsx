"use client";

import { Icon } from "@/components/Icon";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold"
    >
      <Icon name="printer" /> Yazdır / PDF (A4)
    </button>
  );
}
