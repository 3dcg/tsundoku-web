// Book cover lookup via Google Books API.
// Results are cached in localStorage (keyed by title|author) so we neither
// refetch on every render nor bloat the Drive-synced book data with URLs.

const CACHE_KEY = "tsundoku.covers.v1";
// Re-try a "not found" lookup after this long (covers get added over time).
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let cache = null;

function loadCache() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    cache = raw ? JSON.parse(raw) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota or private mode — caching is best-effort, ignore.
  }
}

function keyFor(title, author) {
  return `${(title || "").trim()}|${(author || "").trim()}`.toLowerCase();
}

function buildQuery(title, author) {
  const parts = [];
  if (title) parts.push(`intitle:${title}`);
  if (author) parts.push(`inauthor:${author}`);
  return parts.join("+");
}

// Returns a cover image URL string, or null if none is available.
export async function fetchCover(title, author) {
  if (!title) return null;
  const store = loadCache();
  const key = keyFor(title, author);
  const hit = store[key];
  if (hit) {
    if (hit.url) return hit.url;
    if (Date.now() - hit.at < MISS_TTL_MS) return null; // negative cache still fresh
  }

  let url = null;
  try {
    const q = encodeURIComponent(buildQuery(title, author));
    // An API key is required for reliable quota; keyless requests share a tiny
    // global anonymous quota and quickly return 429. Injected at build time.
    const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_KEY;
    const keyParam = apiKey ? `&key=${apiKey}` : "";
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&country=JP&maxResults=1${keyParam}`,
    );
    if (!res.ok) {
      // 429 (quota) / 5xx are transient — don't cache, so it retries next load.
      return null;
    }
    const data = await res.json();
    const links = data.items?.[0]?.volumeInfo?.imageLinks;
    const raw = links?.thumbnail || links?.smallThumbnail;
    if (raw) url = raw.replace(/^http:/, "https:");
  } catch {
    // Network/offline — leave url null, do not poison the cache permanently.
    return null;
  }

  // Only a real "no cover found" answer gets cached (incl. negative TTL).
  store[key] = { url, at: Date.now() };
  saveCache();
  return url;
}
