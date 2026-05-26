<script>
  import { onMount } from "svelte";
  import BookList from "./components/BookList.svelte";
  import BookForm from "./components/BookForm.svelte";
  import BookDetail from "./components/BookDetail.svelte";
  import SignIn from "./components/SignIn.svelte";
  import AppHeader from "./components/AppHeader.svelte";
  import { books, loaded, loadAll, addBook, updateBook, discardBook, restoreBook, useDriveBackend } from "./lib/store.js";
  import { allTags, parseTags, sortByStatusPriority } from "./lib/book.js";
  import { accessToken, initAuth, signIn, signOut } from "./lib/auth.js";
  import { get } from "svelte/store";

  let view = $state("list"); // 'list' | 'new' | 'edit' | 'show'
  let selectedId = $state(null);
  let filterParams = $state({});

  let toastMessage = $state("");
  let toastVisible = $state(false);
  let toastTimer;

  let undoBookId = $state(null);
  let undoMessage = $state("");

  function showToast(msg) {
    toastMessage = msg;
    toastVisible = true;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastVisible = false; }, 1800);
  }

  let flashTimer;
  let flashMessage = $state("");
  let flashVisible = $state(false);

  function showFlash(msg) {
    flashMessage = msg;
    flashVisible = true;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flashVisible = false; }, 1800);
  }

  let authReady = $state(false);

  onMount(async () => {
    useDriveBackend();
    // initAuth() が以下を全部やってくれる:
    //  - キャッシュ済みアクセストークンが生きていれば復元
    //  - 期限切れ & 過去にサインイン済みなら GIS で無音(prompt:"")再取得
    await initAuth();
    authReady = true;
  });

  // When access token becomes available, load data from Drive
  $effect(() => {
    if ($accessToken) {
      loadAll();
    }
  });

  async function handleSignIn() {
    // signIn()はGISのポップアップで同意を取る。成功すると accessToken ストアが更新され、
    // 上の $effect が発火して loadAll() が走る。
    await signIn();
  }

  function handleSignOut() {
    signOut();
    books.set([]);
    loaded.set(false);
    view = "list";
    selectedId = null;
    filterParams = {};
  }

  const totalBooks = $derived($books.filter(b => !b.deleted_at).length);
  const tagList = $derived(allTags($books));

  const filteredBooks = $derived.by(() => {
    let list = $books.filter(b => !b.deleted_at);
    if (filterParams.status) list = list.filter(b => b.status === filterParams.status);
    if (filterParams.fmt) list = list.filter(b => b.format === filterParams.fmt);
    if (filterParams.tag) list = list.filter(b => parseTags(b.tags_text).includes(filterParams.tag));
    if (filterParams.missing === "tags") list = list.filter(b => !b.tags_text || b.tags_text.trim() === "");
    if (filterParams.missing === "format") list = list.filter(b => !b.format || b.format === "");
    if (filterParams.q) {
      const q = filterParams.q.toLowerCase();
      list = list.filter(b => (b.title || "").toLowerCase().includes(q));
    }
    return sortByStatusPriority(list);
  });

  const selectedBook = $derived($books.find(b => b.id === selectedId));

  function handleChangeFilter(params) {
    if (params.view === "new") { view = "new"; return; }
    const next = {};
    if (params.q !== undefined) next.q = params.q;
    if (params.status) next.status = params.status;
    if (params.fmt) next.fmt = params.fmt;
    if (params.tag) next.tag = params.tag;
    if (params.missing) next.missing = params.missing;
    filterParams = next;
  }

  function handleClearFilter() { filterParams = {}; }

  function goToList() {
    view = "list";
    selectedId = null;
  }

  async function handleCreate(data) {
    await addBook(data);
    goToList();
    showFlash("本を登録しました。");
  }

  async function handleUpdate(data) {
    if (!selectedId) return;
    await updateBook(selectedId, data);
    goToList();
    showFlash("本を更新しました。");
  }

  async function handleDelete() {
    if (!selectedId) return;
    const id = selectedId;
    await discardBook(id);
    undoBookId = id;
    undoMessage = "本を削除しました。";
    goToList();
  }

  async function handleUndo() {
    if (!undoBookId) return;
    await restoreBook(undoBookId);
    undoBookId = null;
    undoMessage = "";
    showFlash("削除を取り消しました。");
  }

  async function handleQuickStatus(newStatus) {
    if (!selectedId) return;
    await updateBook(selectedId, { status: newStatus });
    showToast("ステータスを変更しました。");
  }
</script>

<svelte:head>
  <title>{view === "new" ? "新規登録" : view === "edit" ? "編集" : selectedBook?.title || "積読管理"}</title>
</svelte:head>

{#if !authReady}
  <p style="text-align: center; margin-top: 4em; color: #888;">サインイン状態を確認中…</p>
{:else if !$accessToken}
  <SignIn onSignIn={handleSignIn} />
{:else}
  <AppHeader onSignOut={handleSignOut} onMessage={showFlash} />

  {#if flashVisible && !undoBookId}
    <p class="flash-notice">{flashMessage}</p>
  {/if}

  {#if !$loaded}
    <p style="text-align: center; color: #888;">Driveから読み込み中...</p>
  {:else if view === "list"}
    <BookList
      books={filteredBooks}
      params={filterParams}
      {totalBooks}
      allTagsList={tagList}
      onShow={(id) => { selectedId = id; view = "show"; }}
      onChangeFilter={handleChangeFilter}
      onClearFilter={handleClearFilter}
      onShowToast={showToast} />
  {:else if view === "new"}
    <h1>新規登録</h1>
    <BookForm onSubmit={handleCreate} onCancel={goToList} />
  {:else if view === "edit" && selectedBook}
    <h1>編集</h1>
    <BookForm book={selectedBook} onSubmit={handleUpdate} onCancel={() => { view = "show"; }} />
  {:else if view === "show" && selectedBook}
    <BookDetail
      book={selectedBook}
      onEdit={() => { view = "edit"; }}
      onBack={goToList}
      onDelete={handleDelete}
      onStatusChange={handleQuickStatus} />
  {/if}

  {#if undoBookId}
    <div class="undo-banner" role="status">
      <span>{undoMessage}</span>
      <button class="btn-undo" onclick={handleUndo}>元に戻す</button>
    </div>
  {/if}

  <div class="toast" class:toast-visible={toastVisible}>{toastMessage}</div>
{/if}
