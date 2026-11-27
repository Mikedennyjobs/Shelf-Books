export type Shelf = "want" | "listening" | "finished";
export const SHELF_LABEL: Record<Shelf, string> = { want: "Want to Listen", listening: "Currently Listening", finished: "Finished" };

// One shape for a book whether it is already in the library or still a search result.
export type Ref = {
  key: string;
  bookId?: string;
  source: string;
  sourceId?: string;
  title: string;
  author: string;
  authorYears?: string | null;
  cover?: string | null;
  summary?: string | null;
  subjects?: string[];
  epub?: string;
  pdf?: string;
  label: string;
  textUrls?: string[];
  owner?: string | null;
};

const LABELS: Record<string, string> = { gutenberg: "Project Gutenberg", archive: "Internet Archive", upload: "Your upload" };

export const refFromBook = (b: any): Ref => ({
  key: "b:" + b.id,
  bookId: b.id,
  source: b.source,
  sourceId: b.source_id || undefined,
  title: b.title,
  author: b.author || "Unknown author",
  authorYears: b.author_years,
  cover: b.cover_url,
  summary: b.summary,
  subjects: b.subjects || [],
  epub: b.epub_url || "",
  pdf: b.pdf_url || "",
  label: LABELS[b.source] || "Library",
  owner: b.owner,
});

export const refFromCand = (c: any): Ref => ({
  key: c.source + ":" + c.sourceId,
  source: c.source,
  sourceId: c.sourceId,
  title: c.title,
  author: c.author,
  authorYears: c.authorYears,
  cover: c.cover,
  summary: c.summary,
  subjects: c.subjects || [],
  epub: c.epub,
  pdf: c.pdf,
  label: c.label,
  textUrls: c.textUrls,
});

export const GENRES = [
  { name: "Classics", topic: "popular", a: "#A8532A", b: "#5E2E14" },
  { name: "Philosophy", topic: "philosophy", a: "#7B4A60", b: "#3D2230" },
  { name: "Self-Help", topic: "success", a: "#3B7A5E", b: "#1D3F30" },
  { name: "Mystery", topic: "detective and mystery", a: "#3E4A5E", b: "#1C2230" },
  { name: "Romance", topic: "love stories", a: "#9A4A5C", b: "#522432" },
  { name: "Poetry", topic: "poetry", a: "#6A5D86", b: "#32294A" },
];
export const MORE_GENRES = [
  { name: "Adventure", topic: "adventure" },
  { name: "Fantasy", topic: "fantasy" },
  { name: "Science Fiction", topic: "science fiction" },
  { name: "Horror", topic: "horror" },
  { name: "History", topic: "history" },
  { name: "Biography", topic: "biography" },
  { name: "Children", topic: "children" },
];
