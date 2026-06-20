// ISBN utilities: normalize, look up bibliographic data (openBD), and build a
// National Diet Library cover thumbnail URL.

// Strip hyphens/spaces; keep digits and a trailing X (ISBN-10 check char).
export function normalizeIsbn(raw) {
  return (raw || "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

export function isValidIsbn(isbn) {
  const n = normalizeIsbn(isbn);
  return n.length === 10 || n.length === 13;
}

// Convert a 978-prefixed ISBN-13 to ISBN-10 (recomputing the check digit).
// Returns the input unchanged if already 10 digits, or null if not convertible.
export function isbn13to10(isbn) {
  const n = normalizeIsbn(isbn);
  if (n.length === 10) return n;
  if (n.length !== 13 || !n.startsWith("978")) return null;
  const core = n.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(core[i]);
  const c = (11 - (sum % 11)) % 11;
  return core + (c === 10 ? "X" : String(c));
}

// Amazon cover image keyed by ISBN-10. Best 和書 coverage, but missing titles
// return a 1×1 placeholder gif — callers must check naturalWidth, not just error.
export function amazonCover(isbn) {
  const i10 = isbn13to10(isbn);
  return i10 ? `https://images-na.ssl-images-amazon.com/images/P/${i10}.jpg` : null;
}

// NDL thumbnail is a deterministic URL keyed by ISBN. It may 403 for some
// books/clients, so callers should treat a load error as "no cover here".
export function ndlThumbnail(isbn) {
  const n = normalizeIsbn(isbn);
  return n ? `https://ndlsearch.ndl.go.jp/thumbnail/${n}.jpg` : null;
}

// openBD encodes authors like "Williams,Robin,1953- 吉川,典秀" — space-separated
// authors, each "surname,given,birthyear-". Drop year tokens and inner commas
// (correct for Japanese names; western names get concatenated — user can edit).
function cleanAuthor(raw) {
  if (!raw) return "";
  return raw
    .split(/\s+/)
    .map(a => a.replace(/\d{3,4}-?\d{0,4}/g, "").replace(/,/g, "").trim())
    .filter(Boolean)
    .join(", ");
}

// Look up title/author/publisher from openBD (free, no key, CORS-enabled).
// Returns null if the ISBN is unknown there.
export async function fetchBookByIsbn(isbn) {
  const n = normalizeIsbn(isbn);
  if (!isValidIsbn(n)) return null;
  const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${n}`);
  if (!res.ok) throw new Error(`openBD ${res.status}`);
  const data = await res.json();
  const summary = data?.[0]?.summary;
  if (!summary) return null;
  return {
    isbn: n,
    title: summary.title || "",
    author: cleanAuthor(summary.author),
    publisher: summary.publisher || "",
    cover: summary.cover || "",
  };
}
