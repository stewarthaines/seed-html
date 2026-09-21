<script lang="ts">
  let {
    title,
    coverUrl,
    size = 'shelf',
  }: {
    title: string;
    coverUrl: string | null;
    /** 'shelf' fills its container at full width; 'thumb' is a fixed small box (e.g. inside a dialog). */
    size?: 'shelf' | 'thumb';
  } = $props();
</script>

<div class="book-cover" class:shelf={size === 'shelf'} class:thumb={size === 'thumb'}>
  {#if coverUrl}
    <img src={coverUrl} alt="" class="book-cover-image" />
  {:else}
    <div class="book-cover-placeholder">
      <span class="book-cover-title">{title}</span>
    </div>
  {/if}
</div>

<style>
  .book-cover {
    aspect-ratio: 2 / 3;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .book-cover.shelf {
    inline-size: 100%;
    box-shadow: var(--shadow-md);
  }

  .book-cover.thumb {
    inline-size: 44px;
    flex-shrink: 0;
  }

  .book-cover-image {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  .book-cover-placeholder {
    inline-size: 100%;
    block-size: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    box-sizing: border-box;
  }

  .book-cover-title {
    padding: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    text-align: center;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
  }
</style>
