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
  import { untrack } from 'svelte';
  import { activeChapterId, dirHandle, dirPath } from './store.js';
  import { t, translate } from './i18n.js';
  import { readManifest, readFile, imagesInChapter } from './opf.js';
  import { toYaml } from './regions.js';
  import { emptyStore, loadRegions, saveRegions, toSaved } from './library.js';
  import type { ImageManifestItem, Region, RegionStore } from './types.js';

  let images = $state<ImageManifestItem[]>([]);
  let chapterIds = $state<string[]>([]);
  let chapterHrefs = $state<Record<string, string>>({});
  let opfDir = $state('');
  /** Manifest hrefs this chapter renders; null = unknown (not rendered yet). */
  let usedHrefs = $state<Set<string> | null>(null);
  let selectedHref = $state('');
  let imageUrl = $state('');
  let regions = $state<Region[]>([]);
  let includeHeader = $state(true);
  let status = $state('');
  let lastRow = $state('');
  let nextKey = 1;
  /** Roughly a badge's height in percent of the photo — the default offset. */
  const BADGE_CLEARANCE = 6;
  /** The saved region library, keyed by image href. */
  let store = $state<RegionStore>(emptyStore());
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  let canvasEl: HTMLDivElement | undefined = $state();
  let draft = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  /** In-flight badge drag: which region, and where in the badge it was grabbed. */
  let badgeDrag = $state<{ key: number; dx: number; dy: number } | null>(null);

  // The panel is for the chapter in the editor, so offer the images that
  // chapter actually renders. Before its first render there is nothing to read,
  // so fall back to the whole manifest rather than an empty list.
  const offered = $derived(
    usedHrefs ? images.filter(image => usedHrefs.has(image.href)) : images
  );
  /**
   * Region key → the number the reader will see. Mirrors toYaml exactly — rows
   * in the order first drawn, entries left to right within a row — so the
   * badge in the tool is the badge in the book. Only named regions are
   * numbered, because only they are emitted.
   */
  const numbering = $derived.by(() => {
    const rows = new Map<string, Region[]>();
    for (const region of regions) {
      if (!region.person.trim()) continue;
      const row = region.row.trim() || 'Pictured';
      const group = rows.get(row);
      if (group) group.push(region);
      else rows.set(row, [region]);
    }
    const numbers = new Map<number, number>();
    let next = 1;
    for (const group of rows.values()) {
      for (const region of [...group].sort((a, b) => a.x - b.x)) {
        numbers.set(region.key, next++);
      }
    }
    return numbers;
  });

  /** Just above the region's top-left, flipped below when it would fall off. */
  function badgeAt(region: Region): { x: number; y: number } {
    if (region.badge) return region.badge;
    const above = region.y - BADGE_CLEARANCE;
    return { x: region.x, y: above >= 0 ? above : region.y + region.h + 1 };
  }

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
    Promise.all([readManifest(root), loadRegions(root)])
      .then(([manifest, saved]) => {
        if (cancelled) return;
        store = saved;
        images = manifest.images;
        chapterIds = manifest.chapterIds;
        chapterHrefs = manifest.chapterHrefs;
        opfDir = manifest.opfDir;
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

  // Which of them this chapter renders — from its generated XHTML, since the
  // transforms decide what a chapter contains.
  $effect(() => {
    const root = $dirHandle;
    const id = $activeChapterId;
    const href = id ? chapterHrefs[id] : undefined;
    if (!root || !href) {
      usedHrefs = null;
      return;
    }
    let cancelled = false;
    imagesInChapter(root, href, opfDir)
      .then(used => {
        if (!cancelled) usedHrefs = used;
      })
      .catch(() => {
        if (!cancelled) usedHrefs = null;
      });
    return () => {
      cancelled = true;
    };
  });

  // Keep the selection valid: pick the only offered image, or drop a choice
  // that this chapter doesn't render.
  $effect(() => {
    const list = offered;
    if (list.length === 1) selectedHref = list[0].href;
    else if (selectedHref && !list.some(image => image.href === selectedHref)) selectedHref = '';
  });

  // Restore the boxes previously drawn on this image, so a revision starts from
  // the saved work rather than a blank photo.
  //
  // `store` is read UNTRACKED deliberately: persisting rewrites it, and a
  // tracked read would re-enter here on every save, rebuild the list with fresh
  // keys, and tear down the input being typed into. The library is loaded
  // before any image can be chosen, so keying this on the selection alone still
  // restores at the right moment.
  $effect(() => {
    const href = selectedHref;
    const saved = href ? untrack(() => store.files[href] ?? []) : [];
    regions = saved.map(region => ({ ...region, key: nextKey++ }));
    draft = null;
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
    persist();
  }

  /** Write the library (fire-and-forget; failures surface in the status row). */
  function persist(): void {
    const root = $dirHandle;
    if (!root || !selectedHref) return;
    store = {
      ...store,
      files: { ...store.files, [selectedHref]: toSaved(regions) },
    };
    saveRegions(root, $dirPath, store).catch((error: unknown) => {
      status = translate('Could not save the regions: {error}', { error: String(error) });
    });
  }

  /** Text edits save on a short delay rather than per keystroke. */
  function persistSoon(): void {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 600);
  }

  function startBadgeDrag(event: PointerEvent, region: Region) {
    // Don't let the canvas read this as the start of a new box.
    event.stopPropagation();
    event.preventDefault();
    const at = badgeAt(region);
    const here = percentAt(event);
    badgeDrag = { key: region.key, dx: here.x - at.x, dy: here.y - at.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function moveBadge(event: PointerEvent, region: Region) {
    if (!badgeDrag || badgeDrag.key !== region.key) return;
    event.stopPropagation();
    const here = percentAt(event);
    region.badge = {
      x: Math.min(100, Math.max(0, here.x - badgeDrag.dx)),
      y: Math.min(100, Math.max(0, here.y - badgeDrag.dy)),
    };
  }

  function endBadgeDrag(event: PointerEvent) {
    if (!badgeDrag) return;
    event.stopPropagation();
    badgeDrag = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    persist();
  }

  /** Back to the computed default. */
  function resetBadge(region: Region) {
    region.badge = undefined;
    persist();
  }

  /** Arrow keys nudge a focused badge — the one part of the canvas that does
   *  not need a pointer. */
  function nudgeBadge(event: KeyboardEvent, region: Region) {
    const step = event.shiftKey ? 2 : 0.5;
    const from = badgeAt(region);
    let { x, y } = from;
    if (event.key === 'ArrowLeft') x -= step;
    else if (event.key === 'ArrowRight') x += step;
    else if (event.key === 'ArrowUp') y -= step;
    else if (event.key === 'ArrowDown') y += step;
    else return;
    event.preventDefault();
    region.badge = { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
    persistSoon();
  }

  function removeRegion(key: number) {
    regions = regions.filter(region => region.key !== key);
    persist();
  }

  function onRowInput(region: Region) {
    lastRow = region.row;
    persistSoon();
  }

  function insert() {
    if (!yaml) return;
    window.parent.postMessage({ type: 'insert', content: yaml }, window.origin);
    status = translate('Inserted {count} region(s) at the cursor', { count: namedCount });
  }

  function clearAll() {
    regions = [];
    draft = null;
    persist();
  }
</script>

<div class="panel">
  <div class="row">
    <label class="field">
      <span class="label">{$t('Photo')}</span>
      <select bind:value={selectedHref}>
        <option value="">{$t('Choose an image…')}</option>
        {#each offered as image (image.href)}
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
      {#each regions as region (region.key)}
        <div
          class="region"
          style="left:{region.x}%; top:{region.y}%; width:{region.w}%; height:{region.h}%"
        ></div>
      {/each}
      <!-- Badges are drawn here, as the book will draw them, because placement
           can only be judged against the photo — a number pinned to a corner
           lands on a face as often as not. Drag to move, double-click to reset,
           arrows to nudge once focused. -->
      {#each regions as region (region.key)}
        {#if numbering.has(region.key)}
          <button
            type="button"
            class="badge"
            class:dragging={badgeDrag?.key === region.key}
            style="left:{badgeAt(region).x}%; top:{badgeAt(region).y}%"
            title={$t('Drag to move, double-click to reset')}
            onpointerdown={event => startBadgeDrag(event, region)}
            onpointermove={event => moveBadge(event, region)}
            onpointerup={endBadgeDrag}
            onpointercancel={endBadgeDrag}
            ondblclick={() => resetBadge(region)}
            onkeydown={event => nudgeBadge(event, region)}>{numbering.get(region.key)}</button
          >
        {/if}
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
      {#each regions as region (region.key)}
        <li>
          <span class="tag" class:unnumbered={!numbering.has(region.key)}
            >{numbering.get(region.key) ?? '–'}</span
          >
          <input
            type="text"
            class="person"
            list="chapter-ids"
            placeholder={$t('person id or name')}
            bind:value={region.person}
            oninput={persistSoon}
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
    border: 2px solid var(--color-interactive-primary);
    background: var(--color-region-fill);
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
    color: var(--color-text-inverse);
    background: var(--color-interactive-primary);
    border-radius: 3px;
  }

  /* Not yet named, so not yet numbered — nothing to emit for it. */
  .tag.unnumbered {
    color: var(--color-text-secondary);
    background: var(--color-button-secondary-bg);
  }

  /* Matching the book: a badge has to stay legible over an arbitrary
     photograph, so its tokens are fixed rather than themed (see styles.css). */
  .badge {
    position: absolute;
    min-width: 1.5em;
    padding: 0 0.25em;
    font: inherit;
    font-size: 11px;
    line-height: 1.5;
    text-align: center;
    color: var(--color-badge-ink);
    background: var(--color-badge-paper);
    border: 1px solid var(--color-badge-ink);
    border-radius: 3px;
    cursor: grab;
    touch-action: none;
  }

  .badge.dragging {
    cursor: grabbing;
  }

  .badge:focus-visible {
    outline: 2px solid var(--color-interactive-primary);
    outline-offset: 1px;
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
    color: var(--color-text-inverse);
    background: var(--color-interactive-primary);
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
