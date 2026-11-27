import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";

export function cleanGutenberg(raw: string) {
  let t = raw.replace(/\r/g, "");
  const s = t.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  if (s >= 0) t = t.slice(t.indexOf("\n", s) + 1);
  const e = t.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (e >= 0) t = t.slice(0, e);
  return t.trim();
}

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const htmlToText = (html: string) =>
  decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  ).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

export async function epubToText(buf: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buf);
  const container = await zip.file("META-INF/container.xml")?.async("string");
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error("This does not look like a valid EPUB.");
  const opf = await zip.file(opfPath)!.async("string");
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const manifest: Record<string, string> = {};
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = m[0].match(/\bid="([^"]+)"/)?.[1];
    const href = m[0].match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) manifest[id] = href;
  }
  const order = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map((m) => m[1]);
  const parts: string[] = [];
  for (const id of order) {
    const href = manifest[id];
    if (!href) continue;
    const f = zip.file(decodeURIComponent(base + href));
    if (f) parts.push(htmlToText(await f.async("string")));
  }
  return parts.join("\n\n");
}

export async function pdfToText(buf: ArrayBuffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const t = Array.isArray(text) ? text.join("\n\n") : text;
  if (t.replace(/\s/g, "").length < 500)
    throw new Error("This PDF looks scanned (no selectable text). It needs OCR before it can be read aloud.");
  return t;
}

// PDFs rarely have real paragraph breaks. Rebuild ~500-character paragraphs so reading and progress work well.
export function normalizeParagraphs(text: string) {
  const t = text.replace(/\r/g, "");
  const blanks = (t.match(/\n\s*\n/g) || []).length;
  if (blanks > t.length / 4000) return t;
  const flat = t.replace(/\s+/g, " ").trim();
  const sentences = flat.match(/[^.!?]+[.!?]+["'”’)\]]*\s*|[^.!?]+$/g) || [flat];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    cur += s;
    if (cur.length > 500) { out.push(cur.trim()); cur = ""; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.join("\n\n");
}
