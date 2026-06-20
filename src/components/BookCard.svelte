<script>
  import { FORMAT_LABEL } from "../lib/constants.js";
  import { fetchCover } from "../lib/cover.js";
  let { book, onShow } = $props();

  function truncate(str, len) {
    if (!str) return "";
    return str.length > len ? str.slice(0, len) + "..." : str;
  }

  // Look up the cover whenever title/author changes.
  let coverUrl = $state(null);
  $effect(() => {
    const { title, author } = book;
    coverUrl = null;
    let cancelled = false;
    fetchCover(title, author).then(url => {
      if (!cancelled) coverUrl = url;
    });
    return () => { cancelled = true; };
  });
</script>

<div class="book-card" data-book-id={book.id}>
  <div class="bc-drag-handle" aria-label="ドラッグして並び替え">⋮⋮</div>

  <div class="bc-cover" class:has-image={coverUrl}>
    {#if coverUrl}
      <img src={coverUrl} alt="" loading="lazy" />
    {:else}
      <span class="bc-cover-fallback" aria-hidden="true">📖</span>
    {/if}
  </div>

  <div class="bc-body">
    <a class="bc-title" href="#book/{book.id}" onclick={(e) => { e.preventDefault(); onShow?.(book.id); }}>
      {book.title}
    </a>

    {#if book.author}
      <div class="bc-author">{book.author}</div>
    {/if}

    {#if book.format || book.tags_text}
      <div class="bc-meta">
        {#if book.format}<span class="bc-format">{FORMAT_LABEL[book.format]}</span>{/if}
        {#if book.tags_text}<span class="bc-tags">{book.tags_text}</span>{/if}
      </div>
    {/if}

    {#if book.why_wanted}
      <div class="bc-why">{truncate(book.why_wanted, 50)}</div>
    {/if}
  </div>
</div>
