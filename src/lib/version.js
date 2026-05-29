// 新バージョン検知。
//
// 仕組み:
//   - ビルド時に vite.config.js が __BUILD_ID__ をバンドルへ埋め込み、同じ値を version.json に出力。
//   - 実行中のアプリは version.json を no-store で取得し、埋め込み値と比べる。
//   - 値が違えば「サーバー側に新しい版が出た」= updateAvailable を true にする。
//   - 起動時・アプリに復帰した時(visibilitychange/focus)にチェックする。
//     ホーム画面アプリ(PWA)はindex.htmlを強くキャッシュするので、この能動チェックが効く。
//
// 自動リロードしない理由: 入力途中のフォームを巻き込まないため。
// 検知したらバナーを出し、ユーザーがタップしたら reloadApp() で読み直す。

import { writable } from "svelte/store";

const CURRENT = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

export const updateAvailable = writable(false);

let timer;

async function checkForUpdate() {
  // devビルドでは version.json を出していないのでスキップ
  if (CURRENT === "dev") return;
  try {
    const url = `${import.meta.env.BASE_URL}version.json?_=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const { buildId } = await res.json();
    if (buildId && buildId !== CURRENT) {
      updateAvailable.set(true);
    }
  } catch {
    // オフライン等は黙って無視
  }
}

export function startUpdateWatcher() {
  checkForUpdate();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });
  window.addEventListener("focus", checkForUpdate);
  // 開きっぱなしでも拾えるよう、控えめに定期チェック(30分)
  clearInterval(timer);
  timer = setInterval(checkForUpdate, 30 * 60 * 1000);
}

// 強制的にネットワークから読み直す。クエリを足してindex.htmlのキャッシュも確実に外す。
export function reloadApp() {
  const u = new URL(window.location.href);
  u.searchParams.set("_v", Date.now().toString());
  window.location.replace(u.toString());
}
