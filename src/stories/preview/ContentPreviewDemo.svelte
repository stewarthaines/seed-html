<script lang="ts">
  import ContentPreview from '../../lib/components/preview/ContentPreview.svelte';
  import { t } from '../../lib/i18n';
  import {
    navigationContent,
    chapterContent,
    complexContent,
    malformedContent,
  } from './sample-content';

  // Demo configuration props
  export let showControls: boolean = true;
  export let initialDevice:
    | 'responsive'
    | 'old-iphone'
    | 'recent-iphone'
    | 'large-iphone'
    | 'small-tablet'
    | 'medium-tablet'
    | 'large-tablet' = 'recent-iphone';
  export let contentType: 'navigation' | 'chapter' | 'complex' | 'empty' | 'malformed' =
    'navigation';
  export let showEmptyState: boolean = false;

  // Component state
  let deviceSize = initialDevice;
  let orientation: 'portrait' | 'landscape' = 'portrait';
  let fontSizeAdjustment = 0;
  let fontFamily: 'default' | 'serif' | 'sans-serif' | 'monospace' = 'default';

  // Sample content variations using raw imports
  const SAMPLE_CONTENT = {
    navigation: navigationContent,
    chapter: chapterContent,
    complex: complexContent,
    empty: '',
    malformed: malformedContent,
  };

  $: currentContent = showEmptyState ? SAMPLE_CONTENT.empty : SAMPLE_CONTENT[contentType];

  function resetDemo() {
    deviceSize = 'recent-iphone';
    orientation = 'portrait';
    fontSizeAdjustment = 0;
    fontFamily = 'default';
    contentType = 'navigation';
    showEmptyState = false;
  }

  function logStateChange(action: string, newValue: any) {
    console.log(`[ContentPreview Demo] ${action}: ${newValue}`, {
      deviceSize,
      orientation,
      fontSizeAdjustment,
      fontFamily,
      contentType,
      timestamp: new Date().toISOString(),
    });
  }

  $: if (deviceSize && showControls) {
    logStateChange('Device changed', deviceSize);
  }

  $: if (orientation && showControls) {
    logStateChange('Orientation changed', orientation);
  }

  $: if (fontSizeAdjustment !== undefined && showControls) {
    logStateChange('Font size adjusted', `${fontSizeAdjustment}px`);
  }

  $: if (fontFamily && showControls) {
    logStateChange('Font family changed', fontFamily);
  }

  $: if (contentType && showControls) {
    logStateChange('Content type changed', contentType);
  }
</script>

<div class="demo-container">
  {#if showControls}
    <div class="demo-controls">
      <h3>{$t('Demo Controls')}</h3>

      <div class="control-row">
        <label for="device-select">{$t('Device:')}</label>
        <select
          id="device-select"
          bind:value={deviceSize}
          on:change={() => logStateChange('Device selected', deviceSize)}
        >
          <option value="responsive">{$t('Responsive')}</option>
          <option value="old-iphone">{$t('iPhone SE (375×667)')}</option>
          <option value="recent-iphone">{$t('iPhone 13 (390×844)')}</option>
          <option value="large-iphone">{$t('iPhone 15 Pro Max (430×932)')}</option>
          <option value="small-tablet">{$t('iPad mini (744×1133)')}</option>
          <option value="medium-tablet">{$t('iPad Air (820×1180)')}</option>
          <option value="large-tablet">{$t('iPad Pro 13" (1024×1366)')}</option>
        </select>
      </div>

      {#if deviceSize !== 'responsive'}
        <div class="control-row">
          <label>{$t('Orientation:')}</label>
          <div class="button-group">
            <button
              type="button"
              class:active={orientation === 'portrait'}
              on:click={() => {
                orientation = 'portrait';
                logStateChange('Orientation toggled', 'portrait');
              }}
            >
              {$t('Portrait')}
            </button>
            <button
              type="button"
              class:active={orientation === 'landscape'}
              on:click={() => {
                orientation = 'landscape';
                logStateChange('Orientation toggled', 'landscape');
              }}
            >
              {$t('Landscape')}
            </button>
          </div>
        </div>

        <div class="control-row">
          <label>{$t('Font Size:')}</label>
          <div class="button-group">
            <button
              type="button"
              on:click={() => {
                fontSizeAdjustment--;
                logStateChange('Font size decreased', fontSizeAdjustment);
              }}
            >
              A-
            </button>
            <span class="font-size-display">{fontSizeAdjustment}px</span>
            <button
              type="button"
              on:click={() => {
                fontSizeAdjustment++;
                logStateChange('Font size increased', fontSizeAdjustment);
              }}
            >
              A+
            </button>
          </div>
        </div>

        <div class="control-row">
          <label for="font-family-select">{$t('Font Family:')}</label>
          <select
            id="font-family-select"
            bind:value={fontFamily}
            on:change={() => logStateChange('Font family selected', fontFamily)}
          >
            <option value="default">{$t('Default')}</option>
            <option value="serif">{$t('Serif')}</option>
            <option value="sans-serif">{$t('Sans-serif')}</option>
            <option value="monospace">{$t('Monospace')}</option>
          </select>
        </div>
      {/if}

      <div class="control-row">
        <label for="content-type-select">{$t('Content Type:')}</label>
        <select
          id="content-type-select"
          bind:value={contentType}
          on:change={() => logStateChange('Content type selected', contentType)}
        >
          <option value="navigation">{$t('Navigation (TOC)')}</option>
          <option value="chapter">{$t('Chapter Content')}</option>
          <option value="complex">{$t('Complex Interactive')}</option>
          <option value="malformed">{$t('Malformed XHTML')}</option>
        </select>
      </div>

      <div class="control-row">
        <div class="button-group">
          <button
            type="button"
            class:active={showEmptyState}
            on:click={() => {
              showEmptyState = !showEmptyState;
              logStateChange('Empty state toggled', showEmptyState);
            }}
          >
            {$t('Toggle Empty State')}
          </button>
          <button
            type="button"
            on:click={() => {
              resetDemo();
              logStateChange('Demo reset', 'all values');
            }}
          >
            {$t('Reset Demo')}
          </button>
        </div>
      </div>

      <div class="status-display">
        <strong>{$t('Current Settings:')}</strong>
        <div>
          <span>{$t('Device:')} {deviceSize}</span>
          {#if deviceSize !== 'responsive'}
            <span>• {$t('Orientation:')} {orientation}</span>
            <span
              >• {$t('Font:')}
              {fontFamily} ({fontSizeAdjustment > 0 ? '+' : ''}{fontSizeAdjustment}px)</span
            >
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <div class="preview-container">
    <ContentPreview
      content={currentContent}
      {deviceSize}
      {orientation}
      {fontSizeAdjustment}
      class="demo-preview"
    />
  </div>
</div>

<style>
  .demo-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 16px;
  }

  .demo-controls {
    background: var(--color-surface-secondary, #f8f9fa);
    padding: 16px;
    border-radius: 8px;
    border: 1px solid var(--color-border-subtle, #e9ecef);
  }

  .demo-controls h3 {
    margin: 0 0 16px 0;
    color: var(--color-text-primary, #212529);
    font-size: 16px;
    font-weight: 600;
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .control-row label {
    font-weight: 500;
    color: var(--color-text-secondary, #6c757d);
    min-width: 80px;
  }

  .button-group {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  button {
    padding: 6px 12px;
    border: 1px solid var(--color-border, #dee2e6);
    background: var(--color-surface, #ffffff);
    color: var(--color-text-primary, #212529);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    min-height: 44px;
  }

  button:hover {
    background: var(--color-surface-hover, #e9ecef);
    border-color: var(--color-border-hover, #adb5bd);
  }

  button.active {
    background: var(--color-primary, #007bff);
    color: var(--color-primary-contrast, #ffffff);
    border-color: var(--color-primary, #007bff);
  }

  select {
    padding: 6px 8px;
    border: 1px solid var(--color-border, #dee2e6);
    border-radius: 4px;
    background: var(--color-surface, #ffffff);
    color: var(--color-text-primary, #212529);
    font-size: 14px;
    min-height: 44px;
  }

  .font-size-display {
    padding: 6px 12px;
    background: var(--color-surface-secondary, #f8f9fa);
    border: 1px solid var(--color-border, #dee2e6);
    border-radius: 4px;
    font-weight: 500;
    min-width: 48px;
    text-align: center;
  }

  .status-display {
    margin-top: 16px;
    padding: 12px;
    background: var(--color-surface-tertiary, #e9ecef);
    border-radius: 6px;
    font-size: 14px;
  }

  .status-display div {
    margin-top: 4px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .status-display span {
    color: var(--color-text-secondary, #6c757d);
  }

  .preview-container {
    flex: 1;
    min-height: 400px;
    border: 1px solid var(--color-border, #dee2e6);
    border-radius: 8px;
    overflow: hidden;
  }

  :global(.demo-preview) {
    height: 100%;
  }

  @media (max-width: 768px) {
    .control-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .control-row label {
      min-width: auto;
    }

    .status-display div {
      flex-direction: column;
      gap: 4px;
    }
  }
</style>
