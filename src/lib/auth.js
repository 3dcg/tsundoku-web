// Google OAuth 2.0 — Google Identity Services (GIS) token model
//
// 仕組み:
//   1. index.html で読み込んだ GIS スクリプト(google.accounts.oauth2)を使う
//   2. signIn() で initTokenClient().requestAccessToken() を呼び、ポップアップで同意 → access_token 取得
//   3. access_token は短命(約1時間)。期限が切れたら ensureFreshToken() が prompt:"" で
//      「裏で(UIなしで)」再取得する。Googleのログインセッションが生きている限り無音で通る。
//
// なぜ PKCE(Authorization Code)を捨てた?
//   Google の「ウェブアプリケーション」型クライアントは、PKCE を使ってもトークン交換に
//   client_secret が必須。ブラウザだけで完結する SPA は秘密鍵を安全に持てないため、
//   token エンドポイントが 400 (client_secret is missing) を返して成立しない。
//   refresh_token は出ないが、GIS の prompt:"" による無音再取得で実用上のUXは保てる。
//
// Google Cloud Console 側の必要設定:
//   - クライアント種別はそのまま「ウェブアプリケーション」でOK
//   - 「承認済みの JavaScript 生成元」にアプリのオリジンを登録すること
//       例) https://3dcg.github.io  と  http://localhost:5173
//   - GIS token model は redirect_uri を使わないので「リダイレクト URI」の登録は不要

import { writable } from "svelte/store";
import { GOOGLE_CLIENT_ID, DRIVE_SCOPE } from "./config.js";

export const accessToken = writable(null);
export const authError = writable(null);

const TOKENS_KEY = "tsundoku.auth.tokens.v3";
const SESSION_FLAG_KEY = "tsundoku.auth.hasSession";

// --- token cache (access_token のみ。refresh_token は GIS では出ない) -----------

function saveTokens({ access_token, expires_in }) {
  const expiresAt = Date.now() + (Number(expires_in || 3600) - 60) * 1000;
  const payload = { access_token, expiresAt };
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Failed to cache token", e);
  }
  return payload;
}

function loadTokens() {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearTokens() {
  try { localStorage.removeItem(TOKENS_KEY); } catch {}
  accessToken.set(null);
}

// 「一度サインイン済み」フラグ。再訪時に無音再取得を試みてよいかの判断に使う。
function hasSession() {
  try { return localStorage.getItem(SESSION_FLAG_KEY) === "1"; } catch { return false; }
}
function setSession(on) {
  try {
    if (on) localStorage.setItem(SESSION_FLAG_KEY, "1");
    else localStorage.removeItem(SESSION_FLAG_KEY);
  } catch {}
}

// drive.js から 401 時に呼ばれる。今のトークンを捨てて次回再取得させる。
export function clearCachedToken() {
  clearTokens();
}

// --- GIS token client --------------------------------------------------------

let tokenClient = null;
let pending = null; // { resolve, reject } — requestAccessToken は1リクエストずつ直列に扱う

// GIS スクリプトは async 読み込みなので、google.accounts.oauth2 が生えるまで待つ
function waitForGis(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check() {
      if (window.google?.accounts?.oauth2) return resolve();
      if (Date.now() - start > timeout) {
        return reject(new Error("GIS スクリプトの読み込みがタイムアウトしました"));
      }
      setTimeout(check, 50);
    })();
  });
}

function ensureTokenClient() {
  if (tokenClient) return;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: (resp) => {
      if (resp.error) {
        const err = new Error(resp.error_description || resp.error);
        pending?.reject(err);
        pending = null;
        return;
      }
      const saved = saveTokens(resp);
      setSession(true);
      accessToken.set(saved.access_token);
      authError.set(null);
      pending?.resolve(saved.access_token);
      pending = null;
    },
    error_callback: (err) => {
      // ユーザーがポップアップを閉じた / 無音取得が同意なしで失敗 等
      pending?.reject(new Error(err?.type || "token_error"));
      pending = null;
    },
  });
}

// requestAccessToken を Promise 化。overrides で {prompt:""}(無音) などを渡す。
function requestToken(overrides = {}) {
  return new Promise((resolve, reject) => {
    if (pending) {
      pending.reject(new Error("superseded"));
      pending = null;
    }
    pending = { resolve, reject };
    try {
      tokenClient.requestAccessToken(overrides);
    } catch (e) {
      pending = null;
      reject(e);
    }
  });
}

// --- public API --------------------------------------------------------------

// アプリ起動直後に呼ぶ:
//   1. キャッシュ済み access_token が生きていれば復元
//   2. 期限切れ & 過去にサインイン済みなら、無音(prompt:"")で再取得を試みる
export async function initAuth() {
  try {
    await waitForGis();
    ensureTokenClient();
  } catch (e) {
    authError.set(`認証の初期化に失敗: ${e.message}`);
    return;
  }

  const cached = loadTokens();
  if (cached && Date.now() < cached.expiresAt) {
    accessToken.set(cached.access_token);
    return;
  }

  if (hasSession()) {
    try {
      await requestToken({ prompt: "" }); // 無音。失敗したらサインイン画面に戻すだけ
    } catch {
      clearTokens(); // 無音取得不可 → ユーザーにサインインしてもらう
    }
  }
}

// サインインボタンが押されたとき呼ぶ。ポップアップで同意を取る（ユーザー操作起点が必須）。
export async function signIn() {
  try {
    await waitForGis();
    ensureTokenClient();
  } catch (e) {
    authError.set(`認証の初期化に失敗: ${e.message}`);
    return;
  }
  try {
    // prompt 省略 = 未同意なら同意画面、同意済みなら無音で発行（GISが判断）
    await requestToken({});
  } catch (e) {
    authError.set(`ログイン失敗: ${e.message}`);
  }
}

// Drive API を呼ぶ前に呼ぶ。期限切れなら無音で再取得して新しいトークンを返す。
// 戻り値: 有効な access_token、または null（無音取得不能=要再ログイン）
export async function ensureFreshToken() {
  const cached = loadTokens();
  if (cached && Date.now() < cached.expiresAt) {
    return cached.access_token;
  }
  if (!hasSession()) {
    clearTokens();
    return null;
  }
  try {
    await waitForGis();
    ensureTokenClient();
    return await requestToken({ prompt: "" });
  } catch (e) {
    console.warn("Silent token refresh failed:", e);
    clearTokens();
    return null;
  }
}

export function signOut() {
  const cached = loadTokens();
  if (cached?.access_token && window.google?.accounts?.oauth2) {
    // revoke は結果を待たない（fire-and-forget）
    try {
      window.google.accounts.oauth2.revoke(cached.access_token, () => {});
    } catch {}
  }
  setSession(false);
  clearTokens();
}

// 後方互換のため残す（新フローでは initAuth / ensureFreshToken が処理する）
export async function trySilentRefresh() {
  return ensureFreshToken();
}
