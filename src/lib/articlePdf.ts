/**
 * PDF attachments for literature articles.
 *
 * Files live in a private Supabase Storage bucket under `<user_id>/…`, so the
 * storage RLS policies isolate them per user (see migration 0014). The
 * article row only keeps a pointer in `sources.metadata.pdf`.
 *
 * `article-pdfs` is the dedicated bucket. Databases where 0014 hasn't been
 * applied yet fall back to the existing private `voice-notes` bucket (0005),
 * which has the same per-user folder policies.
 */

export const PDF_BUCKETS = ["article-pdfs", "voice-notes"] as const;
export type PdfBucket = (typeof PDF_BUCKETS)[number];

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export type ArticlePdf = {
  bucket: PdfBucket;
  path: string;
  name: string;
  size: number;
};

/** The PDF pointer stored on an article, if any (tolerates bad metadata). */
export function pdfOf(metadata: Record<string, unknown> | null | undefined): ArticlePdf | null {
  const p = metadata?.pdf as Partial<ArticlePdf> | undefined;
  if (!p || typeof p.path !== "string" || !PDF_BUCKETS.includes(p.bucket as PdfBucket)) {
    return null;
  }
  return {
    bucket: p.bucket as PdfBucket,
    path: p.path,
    name: typeof p.name === "string" ? p.name : "makale.pdf",
    size: typeof p.size === "number" ? p.size : 0,
  };
}

/** Storage path for a new upload, inside the user's own folder. */
export function pdfPathFor(userId: string, bucket: PdfBucket): string {
  const id = crypto.randomUUID();
  return bucket === "article-pdfs" ? `${userId}/${id}.pdf` : `${userId}/article-pdfs/${id}.pdf`;
}

/** Server-side check that a client-supplied pointer belongs to the user. */
export function isOwnPdfPath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/`) && path.endsWith(".pdf") && !path.includes("..");
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

// ---- Best-effort metadata extraction (browser) ----------------------------

const DOI_RE = /\b(10\.\d{4,9}\/[^\s"'<>()[\]{}]+)/i;

function cleanDoi(raw: string): string {
  return raw.replace(/[.,;:]+$/, "").replace(/\\$/, "");
}

/** Decodes a PDF literal string body: escapes and UTF-16BE (BOM) text. */
function decodePdfString(s: string): string {
  const unescaped = s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, e: string) => {
    if (/^[0-7]/.test(e)) return String.fromCharCode(parseInt(e, 8));
    return { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[e] ?? e;
  });
  if (unescaped.startsWith("\xfe\xff")) {
    let out = "";
    for (let i = 2; i + 1 < unescaped.length; i += 2) {
      out += String.fromCharCode((unescaped.charCodeAt(i) << 8) | unescaped.charCodeAt(i + 1));
    }
    return out;
  }
  return unescaped;
}

function decodeHexString(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  let bytes = "";
  for (let i = 0; i + 1 < clean.length; i += 2) {
    bytes += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  }
  return decodePdfString(bytes.replace(/[()\\]/g, "\\$&"));
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Rejects titles that are really file names or producer junk. */
function plausibleTitle(t: string | undefined): string | undefined {
  const s = t?.replace(/\s+/g, " ").trim();
  if (!s || s.length < 8 || s.length > 400) return undefined;
  if (/\.(pdf|docx?|tex|indd)$/i.test(s) || /^microsoft word/i.test(s) || /^untitled/i.test(s)) {
    return undefined;
  }
  if (!/[\p{L}]{3}/u.test(s)) return undefined;
  return s;
}

function findTitle(text: string): string | undefined {
  const xmp = text.match(/<dc:title>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/);
  const fromXmp = plausibleTitle(xmp ? decodeXml(xmp[1]) : undefined);
  if (fromXmp) return fromXmp;
  const lit = text.match(/\/Title\s*\(((?:\\.|[^\\)])*)\)/);
  if (lit) {
    const t = plausibleTitle(decodePdfString(lit[1]));
    if (t) return t;
  }
  const hex = text.match(/\/Title\s*<([0-9a-fA-F\s]+)>/);
  return hex ? plausibleTitle(decodeHexString(hex[1])) : undefined;
}

function findDoi(text: string): string | undefined {
  const tagged =
    text.match(/<prism:doi>\s*([^<\s]+)\s*<\/prism:doi>/i) ??
    text.match(/\/doi\s*\(((?:\\.|[^\\)])*)\)/i) ??
    text.match(/doi(?:\.org\/|:\s*)(10\.\d{4,9}\/[^\s"'<>()[\]{}]+)/i);
  const raw = tagged?.[1] ?? text.match(DOI_RE)?.[1];
  return raw ? cleanDoi(decodeXml(raw)) : undefined;
}

async function inflate(bytes: Uint8Array): Promise<string | null> {
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
    const buf = await new Response(stream).arrayBuffer();
    return new TextDecoder("latin1").decode(buf);
  } catch {
    return null;
  }
}

/**
 * Looks for the article's DOI and title inside a PDF without any library:
 * XMP metadata, the Info dictionary and the first compressed streams
 * (object streams and page text). Best effort — returns what it finds.
 */
export async function extractPdfMeta(file: File): Promise<{ doi?: string; title?: string }> {
  const buf = new Uint8Array(await file.slice(0, 25 * 1024 * 1024).arrayBuffer());
  const text = new TextDecoder("latin1").decode(buf);

  let doi = findDoi(text);
  let title = findTitle(text);
  if (doi && title) return { doi, title };

  // Most modern PDFs compress metadata and page text; inflate the first few
  // FlateDecode streams and search those too.
  const streamRe = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  let inspected = 0;
  while ((m = streamRe.exec(text)) && inspected < 40 && !(doi && title)) {
    const dictStart = text.lastIndexOf("<<", m.index);
    if (dictStart < 0 || !/\/FlateDecode/.test(text.slice(dictStart, m.index))) continue;
    const start = m.index + m[0].length;
    const end = text.indexOf("endstream", start);
    if (end < 0) break;
    streamRe.lastIndex = end;
    if (end - start > 4 * 1024 * 1024) continue;
    inspected++;
    const inflated = await inflate(buf.subarray(start, end));
    if (!inflated) continue;
    doi ??= findDoi(inflated);
    title ??= findTitle(inflated);
  }
  return { doi, title };
}

// ---- In-app viewer highlights ----------------------------------------------

export const PDF_HIGHLIGHT_COLORS = ["#fde047", "#86efac", "#7dd3fc", "#f9a8d4", "#fdba74"] as const;

/** One rectangle of a highlight, as fractions (0–1) of the page box so it stays aligned at any zoom. */
export type PdfRect = { x: number; y: number; w: number; h: number };

export type PdfHighlight = {
  id: string;
  /** 1-based page number. */
  page: number;
  text: string;
  color: string;
  rects: PdfRect[];
};

/** Highlights stored on an article in `sources.metadata.pdfHighlights` (tolerates bad metadata). */
export function pdfHighlightsOf(
  metadata: Record<string, unknown> | null | undefined,
): PdfHighlight[] {
  const raw = metadata?.pdfHighlights;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (h): h is PdfHighlight =>
      !!h &&
      typeof h.id === "string" &&
      typeof h.page === "number" &&
      typeof h.text === "string" &&
      typeof h.color === "string" &&
      Array.isArray(h.rects),
  );
}

/**
 * Deep link into the in-app viewer for a post-it that was saved from a PDF
 * (its blockquote carries `data-pdf-page` / `data-pdf-hl`), or null otherwise.
 */
export function pdfDeepLink(articleId: string, content: string): string | null {
  const m = /<blockquote[^>]*\sdata-pdf-page="(\d+)"(?:[^>]*\sdata-pdf-hl="([\w-]+)")?/.exec(content);
  if (!m) return null;
  const q = new URLSearchParams({ page: m[1] });
  if (m[2]) q.set("hl", m[2]);
  return `/library/${articleId}/pdf?${q}`;
}
