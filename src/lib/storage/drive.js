import { get } from "svelte/store";
import { accessToken, clearCachedToken } from "../auth.js";
import { DRIVE_FILE_NAME } from "../config.js";

const FILES_API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

let cachedFileId = null;

function token() {
  const t = get(accessToken);
  if (!t) throw new Error("アクセストークンがありません。サインインしてください。");
  return t;
}

async function driveFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token()}`,
    },
  });
  if (res.status === 401) {
    // Token is invalid or expired — clear so the UI prompts re-auth.
    clearCachedToken();
    cachedFileId = null;
    throw new Error("認証期限切れ。もう一度サインインしてください。");
  }
  return res;
}

async function findFileId() {
  if (cachedFileId) return cachedFileId;
  const q = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
  const url = `${FILES_API}?q=${q}&spaces=drive&fields=files(id,name)`;
  const res = await driveFetch(url);
  if (!res.ok) throw new Error(`Drive list失敗: ${res.status}`);
  const json = await res.json();
  if (json.files && json.files.length > 0) {
    cachedFileId = json.files[0].id;
    return cachedFileId;
  }
  return null;
}

async function createFile(data) {
  const metadata = { name: DRIVE_FILE_NAME, mimeType: "application/json" };
  const body = JSON.stringify(data);

  const boundary = `tsundoku-boundary-${Date.now()}`;
  const multipart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    body + `\r\n` +
    `--${boundary}--`;

  const res = await driveFetch(`${UPLOAD_API}?uploadType=multipart`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  if (!res.ok) throw new Error(`Drive create失敗: ${res.status}`);
  const json = await res.json();
  cachedFileId = json.id;
  return cachedFileId;
}

async function readFile(fileId) {
  const res = await driveFetch(`${FILES_API}/${fileId}?alt=media`);
  if (!res.ok) throw new Error(`Drive read失敗: ${res.status}`);
  return await res.json();
}

async function updateFile(fileId, data) {
  const res = await driveFetch(`${UPLOAD_API}/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Drive update失敗: ${res.status}`);
  return await res.json();
}

export const driveBackend = {
  async load() {
    const fileId = await findFileId();
    if (!fileId) return { books: [] };
    try {
      const data = await readFile(fileId);
      return data || { books: [] };
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  async save(data) {
    const fileId = await findFileId();
    if (fileId) {
      await updateFile(fileId, data);
    } else {
      await createFile(data);
    }
  },

  resetCache() {
    cachedFileId = null;
  },
};
