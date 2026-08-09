<!--
  Photo Regions panel: pick an image the book already manifests, drag boxes
  over the faces, name who each one is, and insert the resulting `photos:`
  block at the editor cursor.

  Geometry is kept in percent of the image's own box, so what you draw at panel
  size still describes the full-size image. The plugin only ever READS the
  workspace (the OPF and the image bytes); the source edit goes through the
  host's `insert` message, so nothing here can write over a chapter.
-->
<script lang="ts">
  import { dirHandle } from './store.js';
  import { t, translate } from './i18n.js';
  import { readManifest, readFile } from './opf.js';
  import { toYaml } from './regions.js';
  import type { ImageManifestItem, Region } from './types.js';

  let images = $state<ImageManifestItem[]>([]);
  let chapterIds = $state<string[]>([]);
  let selectedHref = $state('');
  let imageUrl = $state('');
  let regions = $state<Region[]>([]);
  let includeHeader = $state(true);
  let status = $state('');
  let lastRow = $state('');
  let nextKey = 1;

  let canvasEl: HTMLDivElement | undefined = $state();
  let draft = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const selectedImage = $derived(images.find(image => image.href === selectedHref));
  const namedCount = $derived(regions.filter(region => region.person.trim()).length);
  const yaml = $derived(
    selectedHref ? toYaml(selectedHref, regions, includeHeader) : ''
  );

  // Read the OPF once the host hands us the workspace.
  $effect(() => {
    const root = $dirHandle;
    if (!root) return;
    let cancelled = false;
    readManifest(root)
      .then(manifest => {
        if (cancelled) return;
        images = manifest.images;
        chapterIds = manifest.chapterIds;
        if (!selectedHref && manifest.images.length === 1) {
          selectedHref = manifest.images[0].href;
        }
      })
      .catch(error => {
        if (!cancelled) status = translate('Could not read the manifest: {error}', {
          error: String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  });

  // Load the chosen image's bytes into an object URL, and revoke the old one.
  $effect(() => {
    const root = $dirHandle;
    const image = selectedImage;
    if (!root || !image) {
      imageUrl = '';
      return;
    }
    let url = '';
    let cancelled = false;
    readFile(root, image.storagePath)
      .then(file => {
        if (cancelled) return;
        url = URL.createObjectURL(file);
        imageUrl = url;
      })
      .catch(error => {
        if (!cancelled) status = translate('Could not read the image: {error}', {
          error: String(error),
        });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  });

  /** Pointer position as a percentage of the image box, clamped to it. */
  function percentAt(event: PointerEvent): { x: number; y: number } {
    const rect = canvasEl!.getBoundingClientRect();
    const clamp = (value: number) => Math.min(100, Math.max(0, value));
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100),
    };
  }

  function startDraw(event: PointerEvent) {
    if (!imageUrl || event.button !== 0) return;
    const { x, y } = percentAt(event);
    draft = { x0: x, y0: y, x1: x, y1: y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveDraw(event: PointerEvent) {
    if (!draft) return;
    const { x, y } = percentAt(event);
    draft = { ...draft, x1: x, y1: y };
  }

  function endDraw(event: PointerEvent) {
    if (!draft) return;
    const box = {
      x: Math.min(draft.x0, draft.x1),
      y: Math.min(draft.y0, draft.y1),
      w: Math.abs(draft.x1 - draft.x0),
      h: Math.abs(draft.y1 - draft.y0),
    };
    draft = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    // A click rather than a drag: too small to be a face.
    if (box.w < 1 || box.h < 1) return;
    regions.push({ key: nextKey++, person: '', row: lastRow, ...box });
  }

  function removeRegion(key: number) {
    regions = regions.filter(region => region.key !== key);
  }

  function onRowInput(region: Region) {
    lastRow = region.row;
  }

  function insert() {
    if (!yaml) return;
    window.parent.postMessage({ type: 'insert', content: yaml }, window.origin);
    status = translate('Inserted {count} region(s) at the cursor', { count: namedCount });
  }

  function clearAll() {
    regions = [];
    draft = null;
  }
</script>

<div class="panel">
  <div class="row">
    <label class="field">
      <span class="label">{$t('Photo')}</span>
      <select bind:value={selectedHref}>
        <option value="">{$t('Choose an image…')}</option>
        {#each images as image (image.href)}
          <option value={image.href}>{image.href}</option>
        {/each}
      </select>
    </label>
  </div>

  {#if imageUrl}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="canvas"
      bind:this={canvasEl}
      role="application"
      aria-label={$t('Photo region editor')}
      onpointerdown={startDraw}
      onpointermove={moveDraw}
      onpointerup={endDraw}
      onpointercancel={() => (draft = null)}
    >
      <img src={imageUrl} alt="" draggable="false" />
      {#each regions as region, index (region.key)}
        <div
          class="region"
          style="left:{region.x}%; top:{region.y}%; width:{region.w}%; height:{region.h}%"
        >
          <span class="tag">{index + 1}</span>
        </div>
      {/each}
      {#if draft}
        <div
          class="region draft"
          style="left:{Math.min(draft.x0, draft.x1)}%; top:{Math.min(draft.y0, draft.y1)}%;
                 width:{Math.abs(draft.x1 - draft.x0)}%; height:{Math.abs(draft.y1 - draft.y0)}%"
        ></div>
      {/if}
    </div>
  {/if}

  {#if regions.length > 0}
    <ul class="regions">
      {#each regions as region, index (region.key)}
        <li>
          <span class="tag">{index + 1}</span>
          <input
            type="text"
            class="person"
            list="chapter-ids"
            placeholder={$t('person id or name')}
            bind:value={region.person}
          />
          <input
            type="text"
            class="rowname"
            placeholder={$t('row')}
            bind:value={region.row}
            oninput={() => onRowInput(region)}
          />
          <button
            type="button"
            class="remove"
            title={$t('Remove')}
            aria-label={$t('Remove')}
            onclick={() => removeRegion(region.key)}>×</button
          >
        </li>
      {/each}
    </ul>

    <datalist id="chapter-ids">
      {#each chapterIds as id (id)}
        <option value={id}></option>
      {/each}
    </datalist>

    <div class="footer">
      <label class="check">
        <input type="checkbox" bind:checked={includeHeader} />
        {$t('Include the photos: line')}
      </label>
      <div class="actions">
        <button type="button" onclick={clearAll}>{$t('Clear')}</button>
        <button type="button" class="primary" disabled={namedCount === 0} onclick={insert}>
          {$t('Insert')}
        </button>
      </div>
    </div>
  {/if}

  {#if status}
    <p class="status">{status}</p>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px;
  }

  .row {
    display: flex;
    gap: 10px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1 1 auto;
    min-width: 0;
  }

  .label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  select,
  input[type='text'] {
    width: 100%;
    box-sizing: border-box;
    padding: 5px 7px;
    font: inherit;
    color: var(--color-text-primary);
    background: var(--color-surface-primary);
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
  }

  /* The drawing surface: shrink-wraps the image so the percentage-positioned
     boxes line up with it at any panel width. */
  .canvas {
    position: relative;
    display: inline-block;
    max-width: 100%;
    align-self: flex-start;
    line-height: 0;
    touch-action: none;
    cursor: crosshair;
  }

  .canvas img {
    display: block;
    max-width: 100%;
    height: auto;
    user-select: none;
  }

  .region {
    position: absolute;
    border: 2px solid var(--color-accent, #518bb5);
    background: rgba(81, 139, 181, 0.15);
    pointer-events: none;
  }

  .region.draft {
    border-style: dashed;
  }

  .tag {
    display: inline-block;
    min-width: 1.4em;
    padding: 0 0.3em;
    font-size: 11px;
    line-height: 1.5;
    text-align: center;
    color: #fff;
    background: var(--color-accent, #518bb5);
    border-radius: 3px;
  }

  .regions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .regions li {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .regions .person {
    flex: 2 1 0;
  }

  .regions .rowname {
    flex: 1 1 0;
  }

  .remove {
    flex: 0 0 auto;
    padding: 3px 8px;
    font-size: 14px;
    line-height: 1;
    color: var(--color-text-secondary);
    background: none;
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .actions button {
    padding: 5px 12px;
    font: inherit;
    color: var(--color-text-primary);
    background: var(--color-surface-primary);
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
  }

  .actions button.primary {
    color: #fff;
    background: var(--color-accent, #518bb5);
    border-color: transparent;
  }

  .actions button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .status {
    margin: 0;
    font-size: 12px;
    color: var(--color-text-secondary);
  }
</style>
