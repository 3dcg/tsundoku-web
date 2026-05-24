<script>
  import { FORMAT_LABEL } from "../lib/constants.js";
  let { book, onShow } = $props();

  function truncate(str, len) {
    if (!str) return "";
    return str.length > len ? str.slice(0, len) + "..." : str;
  }
</script>

<div class="book-card" data-book-id={book.id}>
  <span class="bc-drag-handle" aria-hidden="true">⋮⋮</span>

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
