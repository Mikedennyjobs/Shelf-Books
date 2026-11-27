export type Cand = {
  source: "gutenberg" | "archive";
  sourceId: string;
  label: string;
  title: string;
  author: string;
  authorYears: string | null;
  cover: string | null;
  summary: string | null;
  subjects: string[];
  textUrls: string[];
  epub: string;
  pdf: string;
  downloads?: number;
};

const flip = (n: string) => (n.includes(", ") ? n.split(", ").slice(1).join(" ") + " " + n.split(", ")[0] : n);
const years = (a: any) => (a && (a.birth_year || a.death_year) ? `${a.birth_year ?? "?"}\u2013${a.death_year ?? ""}` : null);

function fromGutendex(b: any): Cand {
  const f = b.formats || {};
  const textUrls = Object.keys(f).filter((k) => k.startsWith("text/plain")).map((k) => f[k]);
  textUrls.push(`https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.txt`);
  const a = b.authors?.[0];
  return {
    source: "gutenberg",
    sourceId: String(b.id),
    label: "Project Gutenberg",
    title: b.title,
    author: a?.name ? flip(a.name) : "Unknown author",
    authorYears: years(a),
    cover: f["image/jpeg"] || null,
    summary: (b.summaries && b.summaries[0]) || null,
    subjects: [...(b.bookshelves || []), ...(b.subjects || [])].slice(0, 8),
    textUrls: [...new Set(textUrls)] as string[],
    epub: f["application/epub+zip"] || "",
    pdf: "",
    downloads: b.download_count,
  };
}

export async function gutendex(params: Record<string, string>): Promise<Cand[]> {
  const u = new URL("https://gutendex.com/books/");
  Object.entries(params).forEach(([k, v]) => v && u.searchParams.set(k, v));
  const r = await fetch(u.toString(), { next: { revalidate: 3600 } });
  if (!r.ok) throw new Error("gutendex");
  const d = await r.json();
  return (d.results || []).slice(0, 24).map(fromGutendex);
}

export async function archive(q: string): Promise<Cand[]> {
  const query = `(${q}) AND mediatype:texts AND (licenseurl:*creativecommons.org* OR licenseurl:*publicdomain*)`;
  const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=description&rows=10&output=json`;
  const r = await fetch(u, { next: { revalidate: 3600 } });
  if (!r.ok) throw new Error("archive");
  const d = await r.json();
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  return (d.response?.docs || []).map((x: any) => ({
    source: "archive" as const,
    sourceId: x.identifier,
    label: "Internet Archive",
    title: one(x.title) || x.identifier,
    author: one(x.creator) || "Unknown author",
    authorYears: null,
    cover: `https://archive.org/services/img/${x.identifier}`,
    summary: one(x.description) ? String(one(x.description)).replace(/<[^>]+>/g, "").slice(0, 400) : null,
    subjects: [],
    textUrls: [`https://archive.org/download/${x.identifier}/${x.identifier}_djvu.txt`],
    epub: `https://archive.org/download/${x.identifier}/${x.identifier}.epub`,
    pdf: `https://archive.org/download/${x.identifier}/${x.identifier}.pdf`,
  }));
}

// Turn a stored subject like "Category: Novels" or "Sisters -- Fiction" into a search topic.
export const topicOf = (subjects: string[] = []) =>
  (subjects[0] || "").replace(/^Category:\s*/i, "").split(" -- ")[0].replace(/\(.*?\)/g, "").trim();
