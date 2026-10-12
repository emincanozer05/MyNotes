import Link from "next/link";

/** Opens an article's uploaded PDF in the in-app reader (highlights + post-its). */
export function PdfOpenButton({
  articleId,
  label = "📄 PDF",
  className = "btn-ghost rounded-full px-3 py-1.5 text-xs font-semibold",
}: {
  articleId: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={`/library/${articleId}/pdf`}
      title="PDF'i site içinde aç (fosforla, Post-it'e kaydet)"
      className={className}
    >
      {label}
    </Link>
  );
}
