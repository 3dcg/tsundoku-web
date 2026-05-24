import { writable, get } from "svelte/store";
import { createBook, sortByStatusPriority } from "./book.js";
import { localStorageBackend } from "./storage/local.js";
import { driveBackend } from "./storage/drive.js";
import { STATUS_PRIORITY } from "./constants.js";

// Backend can be swapped at runtime (local for offline/dev, drive once signed in)
let backend = localStorageBackend;

export function useDriveBackend() {
  backend = driveBackend;
  driveBackend.resetCache?.();
  loaded.set(false);
}

export function useLocalBackend() {
  backend = localStorageBackend;
  loaded.set(false);
}

export const books = writable([]);
export const loaded = writable(false);
export const syncing = writable(false);
export const syncError = writable(null);

async function persist() {
  syncing.set(true);
  syncError.set(null);
  try {
    await backend.save({ books: get(books) });
  } catch (e) {
    console.error("Save failed", e);
    syncError.set(e.message || "保存に失敗しました");
  } finally {
    syncing.set(false);
  }
}

export async function loadAll() {
  syncError.set(null);
  try {
    const data = await backend.load();
    books.set(Array.isArray(data.books) ? data.books : []);
    loaded.set(true);
  } catch (e) {
    console.error("Load failed", e);
    syncError.set(e.message || "読み込みに失敗しました");
    books.set([]);
    loaded.set(true);
  }
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

// Replace all books with the given array (used by import). Saves immediately.
export async function replaceAllBooks(newBooks) {
  if (!Array.isArray(newBooks)) throw new Error("books配列が不正です");
  books.set(newBooks.map(b => createBook(b)));
  await persist();
}

// Export current state as JSON string (for download)
export function exportJson() {
  return JSON.stringify({ books: get(books) }, null, 2);
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
