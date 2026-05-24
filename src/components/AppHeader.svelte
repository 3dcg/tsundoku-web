<script>
  import { syncing, syncError } from "../lib/store.js";
  let { onSignOut } = $props();
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
  <button class="ah-signout" onclick={onSignOut}>サインアウト</button>
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
  .ah-signout {
    background: transparent;
    color: #555;
    border: 1px solid #c5c5c5;
    padding: 0.3em 0.8em;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85em;
  }
  .ah-signout:hover { background: #f3f3f3; }
</style>
