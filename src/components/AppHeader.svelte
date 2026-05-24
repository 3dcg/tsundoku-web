<script>
  import { syncing, syncError, replaceAllBooks, exportJson, books } from "../lib/store.js";
  let { onSignOut, onMessage } = $props();

  let fileInput;
  let menuOpen = $state(false);

  function openImport() {
    menuOpen = false;
    fileInput?.click();
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!Array.isArray(json.books)) {
        alert("JSONの形式が不正です（books配列が見つかりません）");
        return;
      }
      const ok = confirm(`${json.books.length}冊を読み込みます。現在のデータはすべて置き換えられます。よろしいですか？`);
      if (!ok) return;
      await replaceAllBooks(json.books);
      onMessage?.(`${json.books.length}冊をインポートしました。`);
    } catch (e) {
      alert(`インポート失敗: ${e.message}`);
    } finally {
      event.target.value = ""; // allow re-selecting the same file
    }
  }

  function handleExport() {
    menuOpen = false;
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 10);
    a.download = `Tsundoku-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function toggleMenu() { menuOpen = !menuOpen; }
</script>

<header class="app-header">
  <div class="ah-status">
    {#if $syncing}
      <span class="ah-syncing">同期中…</span>
    {:else if $syncError}
      <span class="ah-error" title={$syncError}>⚠ 保存エラー</span>
    {:else}
      <span class="ah-ok">✓ Drive同期OK</span>
    {/if}
  </div>

  <div class="ah-menu-wrap">
    <button class="ah-menu-btn" onclick={toggleMenu} aria-haspopup="true" aria-expanded={menuOpen}>⋯</button>
    {#if menuOpen}
      <div class="ah-menu" role="menu">
        <button onclick={openImport} role="menuitem">JSONインポート…</button>
        <button onclick={handleExport} role="menuitem" disabled={$books.length === 0}>JSONエクスポート</button>
        <hr>
        <button onclick={() => { menuOpen = false; onSignOut?.(); }} role="menuitem">サインアウト</button>
      </div>
    {/if}
  </div>

  <input type="file" accept=".json,application/json" bind:this={fileInput} onchange={handleImport} style="display: none;" />
</header>

<style>
  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1em;
    margin-bottom: 0.6em;
    font-size: 0.85em;
    color: #666;
  }
  .ah-syncing { color: #c08020; }
  .ah-error { color: #b34040; cursor: help; }
  .ah-ok { color: #5a8f4e; }

  .ah-menu-wrap {
    position: relative;
  }
  .ah-menu-btn {
    background: transparent;
    color: #555;
    border: 1px solid #c5c5c5;
    padding: 0.2em 0.7em;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1em;
    line-height: 1;
  }
  .ah-menu-btn:hover { background: #f3f3f3; }
  .ah-menu {
    position: absolute;
    right: 0;
    top: 110%;
    background: #fff;
    border: 1px solid #c5c5c5;
    border-radius: 6px;
    min-width: 180px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    z-index: 100;
    padding: 0.3em 0;
  }
  .ah-menu button {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0.5em 0.9em;
    font-size: 0.9em;
    color: #333;
    cursor: pointer;
  }
  .ah-menu button:hover:not(:disabled) {
    background: #f0f4f1;
  }
  .ah-menu button:disabled {
    color: #aaa;
    cursor: not-allowed;
  }
  .ah-menu hr {
    border: none;
    border-top: 1px solid #eee;
    margin: 0.2em 0;
  }
</style>
