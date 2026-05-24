import { writable, get } from "svelte/store";
import { GOOGLE_CLIENT_ID, DRIVE_SCOPE } from "./config.js";

export const accessToken = writable(null);
export const authError = writable(null);

const TOKEN_KEY = "tsundoku.auth.token.v1";

function saveToken(token, expiresInSeconds) {
  // Subtract 60s buffer so we don't use a token that's about to expire mid-request.
  const expiresAt = Date.now() + (Number(expiresInSeconds || 3600) - 60) * 1000;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
  } catch (e) {
    console.warn("Failed to cache token", e);
  }
}

function loadCachedToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    if (!token || !expiresAt || Date.now() >= expiresAt) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

// Called from drive.js when a request returns 401 — token is stale; force re-auth.
export function clearCachedToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  accessToken.set(null);
}

let tokenClient = null;
let pendingResolve = null;

function waitForGoogle() {
  return new Promise(resolve => {
    if (window.google?.accounts?.oauth2) return resolve();
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
    setTimeout(() => { clearInterval(interval); resolve(); }, 10000);
  });
}

export async function initAuth() {
  await waitForGoogle();
  if (!window.google?.accounts?.oauth2) {
    authError.set("Google Identity Servicesの読み込みに失敗しました");
    return;
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: (response) => {
      if (response.error) {
        authError.set(`認証エラー: ${response.error}`);
        accessToken.set(null);
        if (pendingResolve) { pendingResolve(null); pendingResolve = null; }
        return;
      }
      authError.set(null);
      saveToken(response.access_token, response.expires_in);
      accessToken.set(response.access_token);
      if (pendingResolve) { pendingResolve(response.access_token); pendingResolve = null; }
    },
  });

  // Restore cached token if still valid — avoids re-prompting on every reload.
  const cached = loadCachedToken();
  if (cached) accessToken.set(cached);
}

export function signIn() {
  if (!tokenClient) {
    authError.set("認証が初期化されていません。ページを再読み込みしてください。");
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    pendingResolve = resolve;
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

export function signOut() {
  const token = get(accessToken);
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
  clearCachedToken();
}
