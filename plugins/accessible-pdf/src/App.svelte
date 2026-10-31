<!--
  The Make a PDF card, plugin version: asks the host for the book laid out and
  measured, writes the tagged PDF and offers it to save. A font the book
  doesn't carry stops it, since the PDF can only embed the book's own files.
-->
<script lang="ts">
  import { t, translate } from './i18n.js';
  import { describeBook } from './host.js';
  import { writePdf } from './write-pdf.js';

  type Status =
    | { state: 'idle' }
    | { state: 'laying-out' }
    | { state: 'writing' }
    | { state: 'missing-fonts'; fonts: string[] }
    | { state: 'failed'; message: string }
    | {
        state: 'done';
        url: string;
        filename: string;
        problems: string[];
        overflowPages: number[];
        skippedChapterIds: string[];
      };

  let status = $state<Status>({ state: 'idle' });
  let busy = $derived(status.state === 'laying-out' || status.state === 'writing');

  async function makePdf() {
    if (status.state === 'done') URL.revokeObjectURL(status.url);
    status = { state: 'laying-out' };
    try {
      const book = await describeBook();
      if (book.missingFonts.length > 0) {
        status = { state: 'missing-fonts', fonts: book.missingFonts };
        return;
      }
      status = { state: 'writing' };
      const pdf = await writePdf(
        book.description,
        { fonts: book.fonts, images: book.images },
        { author: book.author }
      );
      const blob = new Blob([pdf as BlobPart], { type: 'application/pdf' });
      status = {
        state: 'done',
        url: URL.createObjectURL(blob),
        filename: pdfFilename(book.description.title, book.author),
        problems: book.description.problems,
        overflowPages: book.description.overflowPages,
        skippedChapterIds: book.skippedChapterIds,
      };
    } catch (error) {
      status = { state: 'failed', message: error instanceof Error ? error.message : String(error) };
    }
  }

  function pdfFilename(title: string, author?: string): string {
    const name = [title || translate('Book'), author].filter(Boolean).join(' - ');
    return `${name.replace(/[\\/:*?"<>|]+/g, '').trim()}.pdf`;
  }

  /** A family list as the author wrote it, first name only: `"Times New Roman"`. */
  function familyName(family: string): string {
    return family.split(',')[0].trim().replace(/^["']|["']$/g, '');
  }
</script>

<article class="card">
  <h3>{$t('Make a PDF')}</h3>
  <p>{$t('Accessible: tagged for screen readers, with bookmarks and the book’s own fonts.')}</p>

  {#if status.state === 'missing-fonts'}
    <p class="note error" role="alert">
      {$t('The PDF needs the font files of these fonts in the book: {fonts}', {
        fonts: status.fonts.map(familyName).join(', '),
      })}
    </p>
  {:else if status.state === 'failed'}
    <p class="note error" role="alert">
      {$t('PDF export failed: {message}', { message: status.message })}
    </p>
  {:else if status.state === 'done'}
    {#if status.skippedChapterIds.length > 0}
      <p class="note warning">
        {$t('PDF is missing unreadable chapters: {chapters}', {
          chapters: status.skippedChapterIds.join(', '),
        })}
      </p>
    {/if}
    {#if status.overflowPages.length > 0}
      <p class="note warning">
        {$t('Some text runs off the edge of pages {pages}, in the preview too, so readers can’t see it.', {
          pages: status.overflowPages.join(', '),
        })}
      </p>
    {/if}
    {#if status.problems.length > 0}
      <p class="note warning">
        {$t('Not in this PDF yet: {items}', { items: status.problems.join(', ') })}
      </p>
    {/if}
  {/if}

  <div class="card-actions" aria-live="polite">
    {#if status.state === 'done'}
      <a class="btn btn-primary" href={status.url} download={status.filename}>
        {$t('Download PDF')}
      </a>
    {/if}
    <button type="button" class="btn btn-secondary" onclick={makePdf} disabled={busy}>
      {#if status.state === 'laying-out'}
        {$t('Laying out the book…')}
      {:else if status.state === 'writing'}
        {$t('Writing the PDF…')}
      {:else if status.state === 'done'}
        {$t('Make it again')}
      {:else}
        {$t('Generate PDF')}
      {/if}
    </button>
  </div>
</article>

<style>
  /* Mirrors the core's Share cards (PublishView.svelte). */
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-block-size: 170px;
    box-sizing: border-box;
    padding: 1.25rem 1.25rem 1rem;
    border: 1px solid var(--color-border-default);
    border-radius: 0.125rem;
    background: var(--color-surface-primary);
  }

  h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  p {
    margin: 0;
  }

  .note {
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
  }

  .note.error {
    color: var(--color-error-text);
  }

  .note.warning {
    color: var(--color-warning-text);
  }

  .card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-block-start: auto;
  }
</style>
