<script>
  import { FORMAT_LABEL } from "../lib/constants.js";
  import { fetchCover } from "../lib/cover.js";
  import { amazonCover, ndlThumbnail } from "../lib/isbn.js";
  let { book, onShow } = $props();

  function truncate(str, len) {
    if (!str) return "";
    return str.length > len ? str.slice(0, len) + "..." : str;
  }

  // Cover candidates tried in order; advance to the next on load error / dud.
  // By ISBN: 1) Amazon 2) NDL thumbnail. Then Google Books (by title/author).
  let candidates = $state([]);
  let idx = $state(0);
  const coverUrl = $derived(candidates[idx] ?? null);

  $effect(() => {
    const { title, author, isbn } = book;
    idx = 0;
    candidates = isbn ? [amazonCover(isbn), ndlThumbnail(isbn)].filter(Boolean) : [];
    let cancelled = false;
    fetchCover(title, author).then(url => {
      if (!cancelled && url) candidates = [...candidates, url];
    });
    return () => { cancelled = true; };
  });

  function next() {
    idx += 1; // fall through to the next candidate (or placeholder when exhausted)
  }
  function onCoverLoad(e) {
    // Amazon returns a 1×1 placeholder gif for unknown ISBNs — treat as missing.
    if (e.currentTarget.naturalWidth <= 1) next();
  }
</script>

<div class="book-card" data-book-id={book.id}>
  <div class="bc-drag-handle" aria-label="ドラッグして並び替え">⋮⋮</div>

  <div class="bc-cover" class:has-image={coverUrl}>
    {#if coverUrl}
      <img src={coverUrl} alt="" loading="lazy" onerror={next} onload={onCoverLoad} />
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
