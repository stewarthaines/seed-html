<script lang="ts">
  import type { S3Object } from '../types.js';
  import {
    summarizeReport,
    type ValidationReport,
  } from '../epub-validation.js';
  import FileName from './FileName.svelte';
  import { formatFileSize } from '../format.js';
  import { t } from '../i18n.js';

  let {
    epubs,
    meta,
    activeFilenames,
    remoteObjects,
    epubValidationStatus,
    uploading,
    uploadProgress,
    uploadingEpubName,
    onUpload,
    onValidate,
    onViewReport,
    onDownload,
    onDelete,
  }: {
    epubs: File[];
    meta: Map<string, { title?: string; authors?: string[]; thumbnailUrl?: string }>;
    activeFilenames: Set<string>;
    remoteObjects: S3Object[];
    epubValidationStatus: Map<
      string,
      {
        isValid: boolean | null;
        isValidating: boolean;
        report: ValidationReport | null;
      }
    >;
    uploading: boolean;
    uploadProgress: number | null;
    uploadingEpubName: string | null;
    onUpload: (epub: File) => void;
    onValidate: (epub: File) => void;
    onViewReport: (epub: File) => void;
    onDownload: (epub: File) => void;
    onDelete: (epub: File) => void;
  } = $props();

  let confirmOverwrite: { [key: string]: boolean } = $state({});
  let deleteConfirm: string | null = $state(null);

  function wouldOverwrite(epub: File): boolean {
    return remoteObjects.some((o) => o.key === epub.name);
  }
</script>

{#if epubs.length === 0}
  <p class="empty-message">{$t('No EPUB files found in this directory')}</p>
{:else}
  <div class="epub-list">
    {#each epubs as epub (epub.name)}
      {@const overwrite = wouldOverwrite(epub)}
      {@const status = epubValidationStatus.get(epub.name)}
      {@const summary = status?.report ? summarizeReport(status.report) : null}
      {@const m = meta.get(epub.name)}
      <div class="epub-item" class:current={activeFilenames.has(epub.name)}>
        {#if m?.thumbnailUrl}
          <img
            src={m.thumbnailUrl}
            alt=""
            class="epub-cover"
            aria-hidden="true"
            onerror={(e) =>
              ((e.currentTarget as HTMLImageElement).style.display = 'none')}
          />
        {/if}
        <div class="epub-info">
          <!-- Show the packaged filename (it carries the package date in its tail),
               not the book title — otherwise same-titled builds from different days
               are indistinguishable in the list. -->
          <FileName name={epub.name} />
          <span class="epub-size">{formatFileSize(epub.size)}</span>
        </div>
        <div class="epub-actions">
          {#if uploadProgress !== null && uploadingEpubName === epub.name}
            <div class="progress-wrap">
              <progress value={uploadProgress} max={100}></progress>
              <span class="progress-label">{uploadProgress}%</span>
            </div>
          {:else}
            {#if overwrite}
              <label class="checkbox">
                <input
                  type="checkbox"
                  bind:checked={confirmOverwrite[epub.name]}
                />
                {$t('Overwrite?')}
              </label>
            {/if}
            <button
              class="btn btn-secondary"
              onclick={() => onUpload(epub)}
              disabled={uploading ||
                (overwrite && !confirmOverwrite[epub.name])}
            >
              {overwrite ? $t('Replace') : $t('Upload')}
            </button>
            <button
              class="btn btn-secondary"
              onclick={() => onDownload(epub)}
              title={$t('Download EPUB to disk')}
            >
              {$t('Download')}
            </button>
            <div class="validation-section">
              {#if summary}
                <span
                  class="status-icon {summary.error > 0
                    ? 'status-invalid'
                    : 'status-valid'}"
                  title={summary.error > 0
                    ? $t('Invalid EPUB')
                    : $t('Valid EPUB')}
                >
                  {summary.error > 0 ? '✕' : '✓'}
                </span>
                {#if summary.error === 0 && summary.warning === 0 && summary.info === 0}
                  <span class="vsummary-clean">{$t('No issues')}</span>
                {:else}
                  <span class="vsummary">
                    {#if summary.error > 0}
                      <span class="vchip error">
                        {summary.error === 1
                          ? $t('{n} error', { n: summary.error })
                          : $t('{n} errors', { n: summary.error })}
                      </span>
                    {/if}
                    {#if summary.warning > 0}
                      <span class="vchip warning">
                        {summary.warning === 1
                          ? $t('{n} warning', { n: summary.warning })
                          : $t('{n} warnings', { n: summary.warning })}
                      </span>
                    {/if}
                    {#if summary.info > 0}
                      <span class="vchip info"
                        >{$t('{n} info', { n: summary.info })}</span
                      >
                    {/if}
                  </span>
                {/if}
              {:else}
                <span
                  class="status-icon status-unknown"
                  title={$t('Not validated')}>–</span
                >
              {/if}

              {#if status?.report}
                <button
                  class="btn btn-secondary btn-sm"
                  onclick={() => onViewReport(epub)}
                  title={$t('View validation report')}
                >
                  {$t('Report')}
                </button>
              {:else}
                <button
                  class="btn btn-secondary btn-sm"
                  onclick={() => onValidate(epub)}
                  disabled={status?.isValidating || uploading}
                  title={$t('Validate EPUB')}
                >
                  {status?.isValidating ? $t('Validating...') : $t('Validate')}
                </button>
              {/if}
            </div>

            {#if deleteConfirm === epub.name}
              <div class="delete-confirm">
                <span>{$t('Confirm delete?')}</span>
                <button
                  class="btn btn-danger btn-sm"
                  onclick={() => {
                    onDelete(epub);
                    deleteConfirm = null;
                  }}>{$t('Yes')}</button
                >
                <button
                  class="btn btn-secondary btn-sm"
                  onclick={() => (deleteConfirm = null)}>{$t('No')}</button
                >
              </div>
            {:else}
              <button
                class="btn btn-danger btn-sm"
                onclick={() => (deleteConfirm = epub.name)}
                >{$t('Delete')}</button
              >
            {/if}
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .epub-list {
    /* Fill the remaining pane height and scroll internally rather than letting
       the flex parent shrink/clip the list. */
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .epub-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 12px;
    background: var(--color-surface-secondary);
    border-radius: 4px;
    gap: 8px 16px;
  }

  /* The currently-open project. */
  .epub-item.current {
    outline: 2px solid var(--color-button-primary-bg);
    outline-offset: -2px;
  }

  .epub-cover {
    flex-shrink: 0;
    width: 32px;
    height: 48px;
    object-fit: cover;
    border-radius: 3px;
  }

  /* Takes the available width; when the row is too narrow for the actions, they
     wrap to the next line and the name (middle-ellipsised) gets the full width. */
  .epub-info {
    flex: 1 1 220px;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    align-items: baseline;
  }

  .epub-size {
    font-size: 12px;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }

  .epub-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }

  .checkbox {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    cursor: pointer;
  }

  .checkbox input {
    margin: 0;
    width: auto;
  }

  .validation-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .delete-confirm {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
  }

  .status-icon {
    font-size: 16px;
    font-weight: bold;
    min-width: 20px;
    text-align: center;
  }

  .status-valid {
    color: var(--color-success-text);
  }

  .status-invalid {
    color: var(--color-error-text);
  }

  .status-unknown {
    color: var(--color-text-tertiary);
  }

  .vsummary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  .vsummary-clean {
    font-size: 12px;
    color: var(--color-success-text);
  }

  .vchip {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }

  .vchip.error {
    background: var(--color-error-bg);
    color: var(--color-error-text);
  }

  .vchip.warning {
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
  }

  .vchip.info {
    background: var(--color-surface-secondary);
    color: var(--color-text-secondary);
  }

  .progress-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  progress {
    width: 120px;
    height: 8px;
  }

  .progress-label {
    font-size: 12px;
    color: var(--color-text-secondary);
    min-width: 32px;
  }
</style>
