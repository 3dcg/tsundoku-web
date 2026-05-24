<script>
  import { authError } from "../lib/auth.js";

  let { onSignIn } = $props();
</script>

<div class="signin-screen">
  <h1>積読管理</h1>
  <p class="signin-lead">あなたの<strong>Google Drive</strong>にデータを保存して、PCとスマホで同じ積読を扱えます。</p>

  <button class="btn-primary btn-large" onclick={onSignIn}>Googleでサインイン</button>

  {#if $authError}
    <p class="signin-error">{$authError}</p>
  {/if}

  <p class="signin-note">
    保存先はあなたのGoogle Drive直下に作られる <code>Tsundoku.json</code> ファイルだけです。<br>
    アプリは「自分が作ったファイル」しか触れないスコープ（drive.file）で動きます。
  </p>
</div>

<style>
  .signin-screen {
    max-width: 480px;
    margin: 4em auto;
    text-align: center;
    padding: 0 1em;
  }
  .signin-screen h1 {
    font-size: 1.8em;
    margin-bottom: 0.4em;
  }
  .signin-lead {
    color: #444;
    margin: 0.6em 0 1.6em;
  }
  .signin-error {
    color: #b34040;
    margin-top: 1em;
    font-size: 0.9em;
  }
  .signin-note {
    font-size: 0.78em;
    color: #888;
    margin-top: 2em;
    line-height: 1.7;
  }
  .signin-note code {
    background: #eee;
    padding: 0.1em 0.4em;
    border-radius: 3px;
  }
</style>
