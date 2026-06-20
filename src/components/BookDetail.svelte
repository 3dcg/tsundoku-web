<script>
  import { STATUSES, STATUS_LABEL, FORMAT_LABEL } from "../lib/constants.js";
  import StatusBadge from "./StatusBadge.svelte";

  let { book, onEdit, onBack, onDelete, onStatusChange } = $props();

  function nl2br(text) {
    if (!text) return "";
    return text;
  }
</script>

<div class="book-detail">
  <header class="bd-header">
    <StatusBadge status={book.status} />
    <h1 class="bd-title">{book.title}</h1>
    {#if book.format}
      <span class="bd-format">({FORMAT_LABEL[book.format]})</span>
    {/if}
  </header>

  <div class="bd-quick-status">
    <span class="bd-quick-status-label">ステータスをすぐに変える:</span>
    <div class="radio-group">
      {#each STATUSES as s}
        <label class="radio-option">
          <input type="radio"
                 name="quick_status_{book.id}"
                 value={s.key}
                 checked={book.status === s.key}
                 onchange={() => onStatusChange?.(s.key)} />
          <span>{s.label}</span>
        </label>
      {/each}
    </div>
  </div>

  <dl class="bd-fields">
    {#if book.author}
      <dt>著者</dt><dd>{book.author}</dd>
    {/if}
    {#if book.isbn}
      <dt>ISBN</dt><dd>{book.isbn}</dd>
    {/if}
    {#if book.why_wanted}
      <dt>なぜ読みたかったか</dt><dd>{nl2br(book.why_wanted)}</dd>
    {/if}
    {#if book.tags_text}
      <dt>タグ</dt><dd>{book.tags_text}</dd>
    {/if}
    {#if book.memo}
      <dt>メモ</dt><dd>{nl2br(book.memo)}</dd>
    {/if}
  </dl>
</div>

<div class="detail-actions">
  <button class="btn-link" onclick={onBack}>← 一覧に戻る</button>
  <button class="btn-secondary" onclick={onEdit}>編集</button>
</div>

<div class="danger-zone">
  <button class="btn-danger" onclick={() => { if (confirm("本当に削除しますか？")) onDelete?.(); }}>削除</button>
</div>

<style>
  .bd-fields dd { white-space: pre-wrap; }
</style>
