<script>
  import { onMount } from "svelte";
  import Sortable from "sortablejs";
  import BookCard from "./BookCard.svelte";
  import StatusBadge from "./StatusBadge.svelte";
  import { STATUSES, STATUS_LABEL, FORMATS, FORMAT_LABEL } from "../lib/constants.js";
  import { reorderWithin } from "../lib/store.js";

  let { books, params, onShow, onChangeFilter, onClearFilter, allTagsList = [], totalBooks = 0, onShowToast } = $props();

  const filterParts = $derived.by(() => {
    const parts = [];
    if (params.status) parts.push(STATUS_LABEL[params.status]);
    if (params.fmt) parts.push(FORMAT_LABEL[params.fmt]);
    if (params.tag) parts.push(`タグ「${params.tag}」`);
    if (params.missing === "tags") parts.push("タグ未設定");
    if (params.missing === "format") parts.push("形式未設定");
    if (params.q) parts.push(`検索「${params.q}」`);
    return parts;
  });

  const hasFilter = $derived(filterParts.length > 0);

  // Group books by status
  const groups = $derived.by(() => {
    const grouped = {};
    for (const b of books) {
      if (!grouped[b.status]) grouped[b.status] = [];
      grouped[b.status].push(b);
    }
    // Return in status priority order
    return STATUSES.map(s => ({ status: s.key, label: s.label, items: grouped[s.key] || [] }))
      .filter(g => g.items.length > 0);
  });

  let sortableRefs = $state({});

  function setupSortable(node, statusKey) {
    const instance = Sortable.create(node, {
      animation: 150,
      ghostClass: "drag-ghost",
      // Only the explicit handle starts a drag — the rest of the card stays
      // tappable for navigation, and the card itself doesn't intercept scroll.
      handle: ".bc-drag-handle",
      touchStartThreshold: 5,
      onEnd: async () => {
        const ids = Array.from(node.querySelectorAll("[data-book-id]")).map(el => el.dataset.bookId);
        await reorderWithin(statusKey, ids);
        onShowToast?.("並び順を保存しました");
      },
    });
    return {
      destroy() { instance.destroy(); }
    };
  }

  let searchInput = $state(params.q || "");
  function submitSearch(e) {
    e.preventDefault();
    onChangeFilter?.({ ...params, q: searchInput });
  }
</script>

<div class="page-header">
  <h1>
    積読一覧
    {#if hasFilter}
      <span class="page-header-filter">・ {filterParts.join(" ・ ")}</span>
    {/if}
    <span class="page-header-count">({books.length}冊)</span>
  </h1>
  <a href="#new" class="btn-primary" onclick={(e) => { e.preventDefault(); onChangeFilter?.({ view: 'new' }); }}>+ 新しい本を登録</a>
</div>

{#if totalBooks > 0}
  <form class="filter-form" onsubmit={submitSearch}>
    <input type="text" bind:value={searchInput} placeholder="タイトル検索" />
    <button type="submit">検索</button>
  </form>

  <nav class="filter-nav">
    <div>
      <span class="fn-label">ステータス:</span>
      <a class="filter-pill" class:active={!hasFilter} href="#" onclick={(e) => { e.preventDefault(); onClearFilter?.(); }}>すべて</a>
      {#each STATUSES as s}
        <a class="filter-pill" class:active={params.status === s.key} href="#"
           onclick={(e) => { e.preventDefault(); onChangeFilter?.({ status: s.key }); }}>{s.label}</a>
      {/each}
    </div>
    <div>
      <span class="fn-label">形式:</span>
      {#each FORMATS as f}
        <a class="filter-pill" class:active={params.fmt === f.key} href="#"
           onclick={(e) => { e.preventDefault(); onChangeFilter?.({ fmt: f.key }); }}>{f.label}</a>
      {/each}
      <a class="filter-pill" class:active={params.missing === 'format'} href="#"
         onclick={(e) => { e.preventDefault(); onChangeFilter?.({ missing: 'format' }); }}>形式未設定</a>
    </div>
    {#if allTagsList.length > 0}
      <div>
        <span class="fn-label">タグ:</span>
        {#each allTagsList as tag}
          <a class="filter-pill" class:active={params.tag === tag} href="#"
             onclick={(e) => { e.preventDefault(); onChangeFilter?.({ tag }); }}>{tag}</a>
        {/each}
        <a class="filter-pill" class:active={params.missing === 'tags'} href="#"
           onclick={(e) => { e.preventDefault(); onChangeFilter?.({ missing: 'tags' }); }}>タグ未設定</a>
      </div>
    {/if}
    {#if hasFilter}
      <div>
        <button class="btn-link" onclick={() => onClearFilter?.()}>× 絞り込みをクリア</button>
      </div>
    {/if}
  </nav>
{/if}

{#if books.length === 0}
  <div class="empty-state">
    {#if totalBooks === 0}
      <h2>まだ積読が登録されていません</h2>
      <p>気になる本を最初の1冊として登録しましょう。</p>
      <a href="#new" class="btn-primary btn-large"
         onclick={(e) => { e.preventDefault(); onChangeFilter?.({ view: 'new' }); }}>+ 最初の本を登録</a>
    {:else}
      <p>条件に合う本がありません。</p>
      <button class="btn-link" onclick={() => onClearFilter?.()}>絞り込みをクリア</button>
    {/if}
  </div>
{:else}
  <p class="drag-hint">↕ カードをドラッグで並び替え</p>
  {#each groups as group (group.status)}
    <section class="status-section">
      <h2 class="status-section-title">
        <StatusBadge status={group.status} />
        <span class="status-section-count">{group.items.length}冊</span>
      </h2>
      <div class="book-grid" use:setupSortable={group.status}>
        {#each group.items as book (book.id)}
          <BookCard {book} {onShow} />
        {/each}
      </div>
    </section>
  {/each}
{/if}
