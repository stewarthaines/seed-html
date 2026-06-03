<script lang="ts">
  import type { S3Object } from '../types.js';
  import {
    summarizeReport,
    type ValidationReport,
  } from '../epub-validation.js';
  import FileName from './FileName.svelte';

  let {
    epubs,
    remoteObjects,
    epubValidationStatus,
    uploading,
    uploadProgress,
    uploadingEpubName,
    onUpload,
    onValidate,
    onViewReport,
    onDelete,
  }: {
    epubs: File[];
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
    onDelete: (epub: File) => void;
  } = $props();

  let confirmOverwrite: { [key: string]: boolean } = $state({});
  let deleteConfirm: string | null = $state(null);

  function wouldOverwrite(epub: File): boolean {
    return remoteObjects.some((o) => o.key === epub.name);
  }
</script>

{#if epubs.length === 0}
  <p class="empty-message">No EPUB files found in this directory</p>
{:else}
  <div class="epub-list">
    {#each epubs as epub (epub.name)}
      {@const overwrite = wouldOverwrite(epub)}
      {@const status = epubValidationStatus.get(epub.name)}
      {@const summary = status?.report ? summarizeReport(status.report) : null}
      <div class="epub-item">
        <div class="epub-info">
          <FileName name={epub.name} />
          <span class="epub-size">({(epub.size / 1024).toFixed(0)} KB)</span>
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
                Overwrite?
              </label>
            {/if}
            <button
              class="btn-secondary"
              onclick={() => onUpload(epub)}
              disabled={uploading ||
                (overwrite && !confirmOverwrite[epub.name])}
            >
              {overwrite ? 'Replace' : 'Upload'}
            </button>
            <div class="validation-section">
              {#if summary}
                <span
                  class="status-icon {summary.error > 0
                    ? 'status-invalid'
                    : 'status-valid'}"
                  title={summary.error > 0 ? 'Invalid EPUB' : 'Valid EPUB'}
                >
                  {summary.error > 0 ? '✕' : '✓'}
                </span>
                {#if summary.error === 0 && summary.warning === 0 && summary.info === 0}
                  <span class="vsummary-clean">No issues</span>
                {:else}
                  <span class="vsummary">
                    {#if summary.error > 0}
                      <span class="vchip error">
                        {summary.error} error{summary.error === 1 ? '' : 's'}
                      </span>
                    {/if}
                    {#if summary.warning > 0}
                      <span class="vchip warning">
                        {summary.warning} warning{summary.warning === 1
                          ? ''
                          : 's'}
                      </span>
                    {/if}
                    {#if summary.info > 0}
                      <span class="vchip info">{summary.info} info</span>
                    {/if}
                  </span>
                {/if}
              {:else}
                <span class="status-icon status-unknown" title="Not validated"
                  >–</span
                >
              {/if}

              {#if status?.report}
                <button
                  class="btn-secondary btn-sm"
                  onclick={() => onViewReport(epub)}
                  title="View validation report"
                >
                  Report
                </button>
              {:else}
                <button
                  class="btn-secondary btn-sm"
                  onclick={() => onValidate(epub)}
                  disabled={status?.isValidating || uploading}
                  title="Validate EPUB"
                >
                  {status?.isValidating ? 'Validating...' : 'Validate'}
                </button>
              {/if}
            </div>

            {#if deleteConfirm === epub.name}
              <div class="delete-confirm">
                <span>Confirm delete?</span>
                <button
                  class="btn-danger-small"
                  onclick={() => {
                    onDelete(epub);
                    deleteConfirm = null;
                  }}>Yes</button
                >
                <button
                  class="btn-cancel-small"
                  onclick={() => (deleteConfirm = null)}>No</button
                >
              </div>
            {:else}
              <button
                class="btn-danger-small"
                onclick={() => (deleteConfirm = epub.name)}>Delete</button
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
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .epub-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 12px;
    background: #f8f8f8;
    border-radius: 4px;
    gap: 8px 16px;
  }

  /* Takes the available width; when the row is too narrow for the actions, they
     wrap to the next line and the name (middle-ellipsised) gets the full width. */
  .epub-info {
    flex: 1 1 220px;
    min-width: 0;
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  .epub-size {
    font-size: 12px;
    color: #999;
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
    color: #2e7d32;
  }

  .status-invalid {
    color: #c62828;
  }

  .status-unknown {
    color: #999;
  }

  .vsummary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  .vsummary-clean {
    font-size: 12px;
    color: #2e7d32;
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
    background: #fdecea;
    color: #c62828;
  }

  .vchip.warning {
    background: #fff4e5;
    color: #e65100;
  }

  .vchip.info {
    background: #eceff1;
    color: #455a64;
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
    color: #666;
    min-width: 32px;
  }
</style>
