const KEY = "tsundoku.v1";

export const localStorageBackend = {
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : { books: [] };
    } catch (e) {
      console.error("Failed to load from localStorage", e);
      return { books: [] };
    }
  },

  async save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  },
};
