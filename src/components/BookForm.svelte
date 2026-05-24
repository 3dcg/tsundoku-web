<script>
  import { STATUSES, FORMATS, STATUS_LABEL, FORMAT_LABEL } from "../lib/constants.js";
  import { allTags } from "../lib/book.js";
  import { books } from "../lib/store.js";
  import { validateBook } from "../lib/book.js";

  let { book, onSubmit, onCancel } = $props();

  let title = $state(book?.title || "");
  let author = $state(book?.author || "");
  let why_wanted = $state(book?.why_wanted || "");
  let format = $state(book?.format || "");
  let status = $state(book?.status || "unread");
  let tags_text = $state(book?.tags_text || "");
  let memo = $state(book?.memo || "");
  let errors = $state([]);

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

  function handleSubmit(e) {
    e.preventDefault();
    const data = { title, author, why_wanted, format, status, tags_text, memo };
    errors = validateBook(data);
    if (errors.length > 0) return;
    onSubmit?.(data);
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
      <label for="title">タイトル <span class="required-mark">必須</span></label>
      <input id="title" type="text" bind:value={title} required />
      <p class="hint">本のタイトル。後で検索しやすいようにそのまま入力するのがおすすめ</p>
    </div>
    <div class="field">
      <label for="author">著者</label>
      <input id="author" type="text" bind:value={author} />
      <p class="hint">著者名。複数いる場合はカンマ区切りでもOK</p>
    </div>
    <div class="field">
      <label>形式</label>
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
    <div class="field">
      <label>ステータス</label>
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
    <button type="button" class="btn-link" onclick={onCancel}>戻る</button>
    <button type="submit" class="btn-primary">{book ? "更新する" : "登録する"}</button>
  </div>
</form>
