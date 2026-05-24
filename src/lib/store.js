import { writable, get } from "svelte/store";
import { createBook, sortByStatusPriority, parseTags } from "./book.js";
import { localStorageBackend } from "./storage/local.js";
import { STATUS_PRIORITY } from "./constants.js";

const backend = localStorageBackend;

export const books = writable([]);
export const loaded = writable(false);

async function persist() {
  await backend.save({ books: get(books) });
}

export async function loadAll() {
  const data = await backend.load();
  books.set(Array.isArray(data.books) ? data.books : []);
  loaded.set(true);
}

export function visibleBooks() {
  return sortByStatusPriority(get(books).filter(b => !b.deleted_at));
}

function nextPositionFor(status) {
  const peers = get(books).filter(b => !b.deleted_at && b.status === status);
  if (peers.length === 0) return 0;
  return Math.max(...peers.map(b => b.position)) + 1;
}

export async function addBook(attrs) {
  const book = createBook({ ...attrs, position: nextPositionFor(attrs.status || "unread") });
  books.update(arr => [...arr, book]);
  await persist();
  return book;
}

export async function updateBook(id, attrs) {
  const list = get(books);
  const idx = list.findIndex(b => b.id === id);
  if (idx === -1) return null;
  const old = list[idx];
  const next = { ...old, ...attrs, updated_at: new Date().toISOString() };

  // If status changed, move to end of new status group
  if (attrs.status && attrs.status !== old.status) {
    next.position = nextPositionFor(attrs.status);
  }

  books.update(arr => arr.map(b => (b.id === id ? next : b)));
  await persist();
  return next;
}

export async function discardBook(id) {
  await updateBook(id, { deleted_at: new Date().toISOString() });
}

export async function restoreBook(id) {
  await updateBook(id, { deleted_at: null });
}

export async function reorderWithin(statusKey, orderedIds) {
  const list = get(books);
  const updated = list.map(b => {
    if (b.status !== statusKey || b.deleted_at) return b;
    const idx = orderedIds.indexOf(b.id);
    return idx === -1 ? b : { ...b, position: idx };
  });
  books.set(updated);
  await persist();
}
