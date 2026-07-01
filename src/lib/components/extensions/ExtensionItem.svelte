<script lang="ts">
  import type { ExtensionInfo } from '../../extensions/types.js';
  import type { ExtensionManager } from '../../extensions/extension-manager.js';
  import { t } from '../../i18n';

  interface Props {
    extension: ExtensionInfo;
    workspaceId: string;
    isAdvancedMode: boolean;
    extensionManager: ExtensionManager;
    onRemove: () => void;
  }

  const { extension, workspaceId, isAdvancedMode, extensionManager, onRemove }: Props = $props();

  // State
  let showLicense = $state(false);
  let licenseText = $state('');
  let isLoading = $state(false);
  // Inline delete-confirm: Remove swaps to a "Confirm delete?" + Yes/No prompt.
  let confirming = $state(false);

  // Derived state for license preview (first line)
  const licensePreview = $derived.by(() => {
    if (!licenseText || !licenseText.trim()) return '';
    const firstLine = licenseText.split('\n')[0].trim();
    return firstLine.length > 60 ? firstLine.substring(0, 57) + '...' : firstLine;
  });

  // Debounced save function
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // Load license text when component mounts or extension changes
  $effect(() => {
    if (workspaceId && extension.name) {
      loadLicenseText();
    }
  });

  async function loadLicenseText(): Promise<void> {
    try {
      isLoading = true;
      licenseText = await extensionManager.getExtensionLicense(workspaceId, extension.name);
    } catch (error) {
      console.error('Failed to load license text:', error);
      licenseText = '';
    } finally {
      isLoading = false;
    }
  }

  function toggleLicense(): void {
    showLicense = !showLicense;
  }

  function handleLicenseChange(): void {
    if (!isAdvancedMode) return;

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Set new debounced save
    saveTimeout = setTimeout(() => {
      saveLicenseText();
    }, 500);
  }

  async function saveLicenseText(): Promise<void> {
    try {
      await extensionManager.saveExtensionLicense(workspaceId, extension.name, licenseText);
    } catch (error) {
      console.error('Failed to save license text:', error);
    }
  }

  // Cleanup timeout on unmount
  $effect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  });
</script>

<li class="extension-item">
  <div class="extension-header">
    <span class="extension-name">{extension.name}</span>
    <div class="extension-actions">
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        onclick={toggleLicense}
        disabled={isLoading}
      >
        {$t('License')}
      </button>
      {#if confirming}
        <span class="delete-confirm">
          <span class="delete-confirm-label">{$t('Confirm delete?')}</span>
          <button
            type="button"
            class="btn btn-danger btn-sm"
            onclick={() => {
              onRemove();
              confirming = false;
            }}
          >
            {$t('Yes')}
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick={() => (confirming = false)}
          >
            {$t('No')}
          </button>
        </span>
      {:else}
        <button
          type="button"
          class="btn btn-danger btn-sm"
          onclick={() => (confirming = true)}
          disabled={!isAdvancedMode}
        >
          {$t('Remove')}
        </button>
      {/if}
    </div>
  </div>

  {#if licensePreview}
    <div class="license-preview">
      <span class="license-preview-text">{licensePreview}</span>
    </div>
  {/if}

  {#if showLicense}
    <div class="license-section">
      <textarea
        class="license-textarea"
        placeholder={$t('Paste {name} license text here', { name: extension.name })}
        readonly={!isAdvancedMode}
        bind:value={licenseText}
        oninput={handleLicenseChange}
        disabled={isLoading}
      ></textarea>
    </div>
  {/if}
</li>

<style>
  .extension-item {
    border: 1px solid var(--color-border-default);
    border-radius: 0.25rem;
    margin-bottom: 0.5rem;
    background: var(--color-bg-primary);
    overflow: hidden;
  }

  .extension-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
  }

  .extension-name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .extension-actions {
    display: flex;
    gap: 0.5rem;
  }

  .delete-confirm {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
  }

  .license-preview {
    padding: 0.5rem 0.75rem 0 0.75rem;
    border-bottom: 1px solid var(--color-border-subtle, #e9ecef);
  }

  .license-preview-text {
    font-size: 0.75rem;
    color: var(--color-text-tertiary, #6c757d);
    font-style: italic;
    line-height: 1.3;
  }

  .license-section {
    border-top: 1px solid var(--color-border-default);
    padding: 0.75rem;
    background: var(--color-bg-secondary, #f8f9fa);
  }

  .license-textarea {
    width: 100%;
    min-height: 120px;
    padding: 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: 0.25rem;
    font-family: var(--font-mono, monospace);
    font-size: 0.875rem;
    line-height: 1.4;
    resize: vertical;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .license-textarea:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
    border-color: var(--color-focus);
  }

  .license-textarea:read-only {
    background: var(--color-bg-tertiary, #f1f3f4);
    cursor: not-allowed;
  }

  .license-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .extension-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .extension-actions {
      align-self: stretch;
      justify-content: flex-end;
    }
  }
</style>
