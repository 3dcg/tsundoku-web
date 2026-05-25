// Google OAuth 2.0 — Authorization Code Flow + PKCE
//
// 仕組み:
//   1. signIn() で PKCE verifier/challenge を作って Google にリダイレクト
//   2. Google が ?code=... 付きで戻ってくる
//   3. initAuth() がそれを検出して code → tokens に交換
//   4. refresh_token を localStorage に保存（長期）
//   5. access_token は ensureFreshToken() で必要に応じて refresh_token から再発行
//
// なぜ implicit flow からの乗り換え?
//   implicit flow は refresh_token が出ないので 1 時間で必ず再ログインが必要
//   PKCE フローなら refresh_token で何ヶ月でも持続する
//   ※ refresh_token を localStorage に置くのは drive.file という最小権限ゆえ許容

import { writable, get } from "svelte/store";
import { GOOGLE_CLIENT_ID, DRIVE_SCOPE } from "./config.js";

export const accessToken = writable(null);
export const authError = writable(null);

const TOKENS_KEY = "tsundoku.auth.tokens.v2";
const PKCE_VERIFIER_KEY = "tsundoku.auth.verifier";
const PKCE_STATE_KEY = "tsundoku.auth.state";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

// --- token storage ----------------------------------------------------------

function saveTokens({ access_token, refresh_token, expires_in }) {
  const expiresAt = Date.now() + (Number(expires_in || 3600) - 60) * 1000;
  const existing = loadTokens() || {};
  const payload = {
    access_token,
    refresh_token: refresh_token || existing.refresh_token, // refresh は新規発行されないこともある
    expiresAt,
  };
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Failed to cache tokens", e);
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

// drive.js から 401 時に呼ばれる。refresh_token も無効化されている可能性が高いので全消し。
export function clearCachedToken() {
  clearTokens();
}

// --- PKCE helpers -----------------------------------------------------------

function base64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(byteLength = 32) {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  return crypto.subtle.digest("SHA-256", enc);
}

function redirectUri() {
  // 末尾スラッシュ込みのオリジン+パス。Google Cloud Console の登録と完全一致が必須。
  const { origin, pathname } = window.location;
  // /tsundoku-web/index.html などで来ることはないが念のため末尾を正規化
  const path = pathname.endsWith("/") ? pathname : pathname.replace(/[^/]*$/, "");
  return origin + path;
}

// --- core API ---------------------------------------------------------------

// アプリ起動直後に呼ぶ:
//   1. URLに?code=がついていればトークン交換
//   2. キャッシュ済みトークンがあれば期限チェック→必要なら refresh
export async function initAuth() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const stateInUrl = url.searchParams.get("state");
  const errorInUrl = url.searchParams.get("error");

  if (errorInUrl) {
    authError.set(`認証エラー: ${errorInUrl}`);
    cleanUrl();
    return;
  }

  if (code) {
    const savedState = sessionStorage.getItem(PKCE_STATE_KEY);
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(PKCE_STATE_KEY);
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    cleanUrl(); // ?code= をURLから消す（再読込で二重交換されないように）

    if (!savedState || savedState !== stateInUrl) {
      authError.set("認証エラー: state不一致（CSRFの疑い）");
      return;
    }
    if (!verifier) {
      authError.set("認証エラー: verifierが見つかりません");
      return;
    }
    try {
      const tokens = await exchangeCodeForTokens(code, verifier);
      const saved = saveTokens(tokens);
      accessToken.set(saved.access_token);
      authError.set(null);
    } catch (e) {
      authError.set(`トークン取得失敗: ${e.message}`);
    }
    return;
  }

  // URL に code が無い → キャッシュ確認
  const cached = loadTokens();
  if (!cached) return;

  if (Date.now() < cached.expiresAt) {
    // access_token がまだ生きてる
    accessToken.set(cached.access_token);
    return;
  }

  // 期限切れ → refresh で更新
  if (cached.refresh_token) {
    try {
      const tokens = await refreshAccessToken(cached.refresh_token);
      const saved = saveTokens(tokens);
      accessToken.set(saved.access_token);
    } catch (e) {
      console.warn("Refresh failed:", e);
      clearTokens();
    }
  } else {
    clearTokens();
  }
}

function cleanUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("scope");
  url.searchParams.delete("authuser");
  url.searchParams.delete("prompt");
  url.searchParams.delete("error");
  window.history.replaceState({}, "", url.toString());
}

// ユーザー操作でサインインボタンが押されたとき呼ぶ。Googleへフルリダイレクト。
export async function signIn() {
  const verifier = randomString(32);
  const challenge = base64url(await sha256(verifier));
  const state = randomString(16);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(PKCE_STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: DRIVE_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    access_type: "offline",     // refresh_token を出してもらう
    prompt: "consent",           // 確実にrefresh_tokenを再発行させる
    include_granted_scopes: "true",
  });

  window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function exchangeCodeForTokens(code, verifier) {
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return await res.json();
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return await res.json();
}

// Drive APIを呼ぶ前に呼ぶ。期限切れ間近なら refresh して新しいトークンを返す。
// 戻り値: 有効な access_token、または null（refresh不能=要再ログイン）
export async function ensureFreshToken() {
  const cached = loadTokens();
  if (!cached) return null;

  if (Date.now() < cached.expiresAt) {
    return cached.access_token;
  }

  if (!cached.refresh_token) {
    clearTokens();
    return null;
  }

  try {
    const tokens = await refreshAccessToken(cached.refresh_token);
    const saved = saveTokens(tokens);
    accessToken.set(saved.access_token);
    return saved.access_token;
  } catch (e) {
    console.warn("Refresh failed:", e);
    clearTokens();
    return null;
  }
}

export function signOut() {
  const cached = loadTokens();
  if (cached?.access_token) {
    // revokeは結果を待たない（fire-and-forget）
    fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(cached.access_token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).catch(() => {});
  }
  clearTokens();
}

// 後方互換のため残す（App.svelteから呼ばれているが、新フローでは initAuth が全部やってくれる）
export async function trySilentRefresh() {
  const token = await ensureFreshToken();
  return token;
}
