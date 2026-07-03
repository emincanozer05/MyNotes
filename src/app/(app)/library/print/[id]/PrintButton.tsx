"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold"
    >
      🖨 Yazdır / PDF (A4)
    </button>
  );
}
