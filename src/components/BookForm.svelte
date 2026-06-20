<script>
  import { STATUSES, FORMATS, STATUS_LABEL, FORMAT_LABEL } from "../lib/constants.js";
  import { allTags } from "../lib/book.js";
  import { books } from "../lib/store.js";
  import { validateBook } from "../lib/book.js";
  import { fetchBookByIsbn, isValidIsbn } from "../lib/isbn.js";

  let { book, onSubmit, onCancel } = $props();

  let isbn = $state(book?.isbn || "");
  let title = $state(book?.title || "");
  let author = $state(book?.author || "");
  let isbnLoading = $state(false);
  let isbnMsg = $state("");

  async function lookupIsbn() {
    if (isbnLoading) return;
    if (!isValidIsbn(isbn)) {
      isbnMsg = "ISBNは10桁または13桁で入力してください";
      return;
    }
    isbnLoading = true;
    isbnMsg = "";
    try {
      const info = await fetchBookByIsbn(isbn);
      if (!info) {
        isbnMsg = "この ISBN の書誌が見つかりませんでした";
        return;
      }
      if (info.title) title = info.title;
      if (info.author) author = info.author;
      isbn = info.isbn;
      isbnMsg = `取得しました: ${info.title}`;
    } catch (e) {
      isbnMsg = "取得に失敗しました（通信エラー）";
    } finally {
      isbnLoading = false;
    }
  }
  let why_wanted = $state(book?.why_wanted || "");
  let format = $state(book?.format || "");
  let status = $state(book?.status || "unread");
  let tags_text = $state(book?.tags_text || "");
  let memo = $state(book?.memo || "");
  let errors = $state([]);
  let submitting = $state(false);

  const existingTags = $derived(allTags($books));

  function currentTagList() {
    return (tags_text || "")
      .split(/[,、]/)
      .map(s => s.trim())
      .filter(s => s);
  }

  function toggleTag(tag) {
    const list = currentTagList();
    const idx = list.indexOf(tag);
    if (idx === -1) list.push(tag);
    else list.splice(idx, 1);
    tags_text = list.join(", ");
  }

  function isTagActive(tag) {
    return currentTagList().includes(tag);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    const data = { isbn, title, author, why_wanted, format, status, tags_text, memo };
    errors = validateBook(data);
    if (errors.length > 0) return;
    submitting = true;
    try {
      await onSubmit?.(data);
    } catch (err) {
      submitting = false;
      throw err;
    }
  }
</script>

<form class="book-form" onsubmit={handleSubmit}>
  {#if errors.length > 0}
    <div class="form-errors">
      <h2>{errors.length}件のエラーがあります:</h2>
      <ul>{#each errors as e}<li>{e}</li>{/each}</ul>
    </div>
  {/if}

  <fieldset>
    <legend>基本情報</legend>
    <div class="field">
      <label for="isbn">ISBN</label>
      <div class="isbn-row">
        <input id="isbn" type="text" inputmode="numeric" bind:value={isbn}
               placeholder="978…" />
        <button type="button" class="btn-secondary" onclick={lookupIsbn} disabled={isbnLoading}>
          {isbnLoading ? "取得中…" : "書誌を取得"}
        </button>
      </div>
      {#if isbnMsg}<p class="hint isbn-msg">{isbnMsg}</p>{/if}
      <p class="hint">裏表紙のISBNを入れて「書誌を取得」すると、タイトル・著者を自動入力します（openBD）</p>
    </div>
    <div class="field">
      <label for="title">タイトル <span class="required-mark">必須</span></label>
      <input id="title" type="text" bind:value={title} required />
      <p class="hint">本のタイトル。後で検索しやすいようにそのまま入力するのがおすすめ</p>
    </div>
    <div class="field">
      <label for="author">著者</label>
      <input id="author" type="text" bind:value={author} />
      <p class="hint">著者名。複数いる場合はカンマ区切りでもOK</p>
    </div>
    <div class="field" role="group" aria-labelledby="format-label">
      <span id="format-label" class="field-label">形式</span>
      <div class="radio-group">
        {#each FORMATS as f}
          <label class="radio-option">
            <input type="radio" name="format" value={f.key} bind:group={format} />
            <span>{f.label}</span>
          </label>
        {/each}
      </div>
      <p class="hint">紙の本かKindleか</p>
    </div>
  </fieldset>

  <fieldset>
    <legend>なぜ読みたかったか</legend>
    <div class="field">
      <textarea rows="4" bind:value={why_wanted}></textarea>
      <p class="hint">「面白そう」「○○の話題で出てきた」「友人のおすすめ」など、後で読みたい理由を思い出せる程度のメモ</p>
    </div>
  </fieldset>

  <fieldset>
    <legend>整理</legend>
    <div class="field">
      <label for="tags">タグ</label>
      <input id="tags" type="text" bind:value={tags_text} />
      {#if existingTags.length > 0}
        <div class="tag-chips">
          {#each existingTags as tag}
            <button type="button"
                    class="tag-chip"
                    class:active={isTagActive(tag)}
                    onclick={() => toggleTag(tag)}>{tag}</button>
          {/each}
        </div>
      {/if}
      <p class="hint">カンマ区切りで自由に。例: プログラミング, キャリア, 思考</p>
    </div>
    <div class="field" role="group" aria-labelledby="status-label">
      <span id="status-label" class="field-label">ステータス</span>
      <div class="radio-group">
        {#each STATUSES as s}
          <label class="radio-option">
            <input type="radio" name="status" value={s.key} bind:group={status} />
            <span>{s.label}</span>
          </label>
        {/each}
      </div>
      <p class="hint">登録時は「未読」のまま、後で更新できる</p>
    </div>
  </fieldset>

  <fieldset>
    <legend>メモ</legend>
    <div class="field">
      <textarea rows="5" bind:value={memo}></textarea>
      <p class="hint">読書中・読了後の気付きなど。あとからゆっくり書ける</p>
    </div>
  </fieldset>

  <div class="form-actions">
    <button type="button" class="btn-link" onclick={onCancel} disabled={submitting}>戻る</button>
    <button type="submit" class="btn-primary" disabled={submitting}>
      {submitting ? "保存中…" : book ? "更新する" : "登録する"}
    </button>
  </div>
</form>
