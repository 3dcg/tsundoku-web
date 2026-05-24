import { DEFAULT_STATUS, STATUS_PRIORITY } from "./constants.js";

let nextId = 1;

export function newId() {
  return `b-${Date.now().toString(36)}-${(nextId++).toString(36)}`;
}

export function createBook(attrs = {}) {
  return {
    id: attrs.id || newId(),
    title: attrs.title || "",
    author: attrs.author || "",
    why_wanted: attrs.why_wanted || "",
    format: attrs.format || "",
    status: attrs.status || DEFAULT_STATUS,
    tags_text: attrs.tags_text || "",
    memo: attrs.memo || "",
    position: typeof attrs.position === "number" ? attrs.position : 0,
    created_at: attrs.created_at || new Date().toISOString(),
    updated_at: attrs.updated_at || new Date().toISOString(),
    deleted_at: attrs.deleted_at || null,
  };
}

export function parseTags(tagsText) {
  return (tagsText || "")
    .split(/[,、]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export function allTags(books) {
  const set = new Set();
  for (const b of books) {
    if (b.deleted_at) continue;
    for (const t of parseTags(b.tags_text)) set.add(t);
  }
  return Array.from(set).sort();
}

export function sortByStatusPriority(books) {
  return [...books].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] || 99;
    const pb = STATUS_PRIORITY[b.status] || 99;
    if (pa !== pb) return pa - pb;
    if (a.position !== b.position) return a.position - b.position;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export function validateBook(book) {
  const errors = [];
  if (!book.title || book.title.trim() === "") errors.push("タイトルは必須です");
  return errors;
}
