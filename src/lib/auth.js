import { writable, get } from "svelte/store";
import { GOOGLE_CLIENT_ID, DRIVE_SCOPE } from "./config.js";

export const accessToken = writable(null);
export const authError = writable(null);

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
    // Give up after 10 seconds
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
      accessToken.set(response.access_token);
      if (pendingResolve) { pendingResolve(response.access_token); pendingResolve = null; }
    },
  });
}

// Trigger interactive sign-in (user clicks button)
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

// Try silent re-auth (no UI) — works if user previously authorized
export function trySilentSignIn() {
  if (!tokenClient) return Promise.resolve(null);
  return new Promise(resolve => {
    pendingResolve = resolve;
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

export function signOut() {
  const token = get(accessToken);
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
  accessToken.set(null);
}
