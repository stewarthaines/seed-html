<!--
  Place Maps panel (process/PLACE_MAPS.md, The panel). Lists the places the
  open chapter's records use — read from the neutral list family-history
  writes, so this plugin never reads those records — and for one of them:
  search the geocoder, pick the right match from small map previews, add the
  map to the book. Places the geocoder can't find can be placed by country
  and state, or by coordinates. A map that exists can be inserted at the
  cursor through the book's place_map_template.

  Writes: the map file (new ones through the host's add-media, a re-picked
  one in place) and the register. Never a chapter — inserts go through the
  host's `insert` message.
-->
<script lang="ts">
  import { activeChapterId, dirHandle, dirPath } from './store.js';
  import { t, translate } from './i18n.js';
  import { findOpfDir } from './opf.js';
  import { addMedia, insertText } from './host.js';
  import { readPlaceLists, readRegister, readTemplate, writeRegister, writeWorkspaceFile } from './workspace.js';
  import {
    emptyRegister,
    fillTemplate,
    mergePlaceLists,
    resolve,
    slugify,
    today,
    withEntry,
    registerHrefs,
    type PlaceEntry,
    type PlaceUse,
    type Register,
  } from './register.js';
  import { search, type Candidate } from './nominatim.js';
  import { countryAt, loadCountry, loadIndex, regionAt, type CountryData, type CountryIndexEntry } from './geo.js';
  import { renderMap } from './render.js';

  /** A map ready to add: what the register will say, and the drawn file. */
  interface Draft {
    entry: Omit<PlaceEntry, 'href'>;
    svg: string;
  }

  let opfDir = $state('');
  let register = $state<Register>(emptyRegister());
  let places = $state<PlaceUse[]>([]);
  let scope = $state<'chapter' | 'book'>('chapter');
  let selected = $state<string | null>(null);
  let query = $state('');
  let candidates = $state<Array<{ candidate: Candidate; draft: Draft | null }>>([]);
  let chosen = $state<Draft | null>(null);
  let manual = $state(false);
  let countries = $state<CountryIndexEntry[]>([]);
  let manualCountry = $state('');
  let manualRegion = $state('');
  let manualCoords = $state('');
  let manualData = $state<CountryData | null>(null);
  let aliasOf = $state('');
  let busy = $state(false);
  let status = $state('');

  const located = $derived(Object.keys(register.places));
  const usedTexts = $derived(new Set(places.map(place => place.text)));
  /** Register keys no chapter's places list mentions (book view only). */
  const unused = $derived(
    scope === 'book' ? located.filter(key => !usedTexts.has(key) && resolve(register, key)) : []
  );

  async function reload(): Promise<void> {
    const root = $dirHandle;
    if (!root) return;
    try {
      opfDir = await findOpfDir(root);
      register = await readRegister(root, $dirPath, opfDir);
      const lists = await readPlaceLists(root, scope === 'chapter' ? $activeChapterId : null);
      places = mergePlaceLists(lists);
    } catch (error) {
      status = translate('Could not read this book: {message}', { message: String(error) });
    }
  }

  $effect(() => {
    // Re-read when the book, the open chapter or the scope changes.
    void $dirHandle;
    void $activeChapterId;
    void scope;
    void reload();
  });

  function pick(text: string): void {
    selected = text;
    query = text;
    candidates = [];
    chosen = null;
    manual = false;
    aliasOf = '';
    status = '';
  }

  async function draftFor(name: string, point: [number, number] | null, country: CountryData, regionName: string | null, source: string): Promise<Draft> {
    const region = regionName ? (country.regions.find(r => r.name === regionName) ?? null) : null;
    const svg = renderMap({ outline: country.outline, region: region?.geometry ?? null, point, name });
    const entry: Omit<PlaceEntry, 'href'> = { name, source, country: country.a3 };
    if (point) {
      entry.lon = Math.round(point[0] * 10000) / 10000;
      entry.lat = Math.round(point[1] * 10000) / 10000;
    }
    if (region) entry.region = region.name;
    return { entry, svg };
  }

  async function runSearch(): Promise<void> {
    if (!query.trim()) return;
    busy = true;
    status = translate('Searching…');
    candidates = [];
    chosen = null;
    try {
      const found = await search(query.trim(), document.documentElement.lang);
      const rows: Array<{ candidate: Candidate; draft: Draft | null }> = [];
      for (const candidate of found) {
        const point: [number, number] = [candidate.lon, candidate.lat];
        const country = await countryAt(point, candidate.countryCode);
        const region = country ? regionAt(country, point) : null;
        const draft = country
          ? await draftFor(candidate.name, point, country, region?.name ?? null, `nominatim ${today()}`)
          : null;
        rows.push({ candidate, draft });
      }
      candidates = rows;
      status = rows.length ? '' : translate('No matches found.');
    } catch (error) {
      status = translate('Search failed: {message}', { message: String(error) });
    } finally {
      busy = false;
    }
  }

  async function openManual(): Promise<void> {
    manual = true;
    candidates = [];
    chosen = null;
    if (!countries.length) countries = await loadIndex();
  }

  async function updateManual(): Promise<void> {
    chosen = null;
    if (!manualCountry) {
      manualData = null;
      return;
    }
    manualData = await loadCountry(manualCountry);
    if (manualRegion && !manualData.regions.some(r => r.name === manualRegion)) manualRegion = '';
    const coords = manualCoords.split(/[\s,]+/).filter(Boolean).map(Number);
    const point: [number, number] | null =
      coords.length === 2 && coords.every(Number.isFinite) ? [coords[1], coords[0]] : null;
    let regionName = manualRegion || null;
    if (point && !regionName) regionName = regionAt(manualData, point)?.name ?? null;
    const first = (selected ?? '').split(',')[0].trim();
    const name = [point ? first : '', regionName ?? '', manualData.name]
      .filter((part, i, all) => part && all.indexOf(part) === i)
      .join(', ');
    chosen = await draftFor(name, point, manualData, regionName, `author ${today()}`);
  }

  async function addMap(): Promise<void> {
    const root = $dirHandle;
    if (!root || !selected || !chosen) return;
    busy = true;
    try {
      const existing = resolve(register, selected);
      const direct = register.places[selected];
      let href: string;
      if (existing && direct && !('alias' in direct)) {
        // Re-picked: rewrite the same file, so every reference stays good.
        href = existing.href;
        await writeWorkspaceFile(root, $dirPath, `${opfDir}/${href}`, chosen.svg);
      } else {
        href = await addMedia(`${slugify(selected)}.svg`, 'image/svg+xml', chosen.svg, 'maps');
      }
      register = withEntry(register, selected, { ...chosen.entry, href });
      await writeRegister(root, $dirPath, register);
      status = translate('Map added for {place}.', { place: selected });
      candidates = [];
      chosen = null;
      manual = false;
    } catch (error) {
      status = translate('Could not add the map: {message}', { message: String(error) });
    } finally {
      busy = false;
    }
  }

  async function saveAlias(): Promise<void> {
    const root = $dirHandle;
    if (!root || !selected || !aliasOf) return;
    register = withEntry(register, selected, { alias: aliasOf });
    await writeRegister(root, $dirPath, register);
    status = translate('{place} now shares the map of {other}.', { place: selected, other: aliasOf });
    aliasOf = '';
  }

  async function insert(text: string): Promise<void> {
    const root = $dirHandle;
    if (!root) return;
    insertText(fillTemplate(await readTemplate(root), text));
  }

  const mapsInBook = $derived(registerHrefs(register).size);
</script>

<div class="panel">
  <div class="row">
    <div class="scope" role="group" aria-label={$t('Places to show')}>
      <button type="button" class="btn btn-sm" aria-pressed={scope === 'chapter'} onclick={() => (scope = 'chapter')}>
        {$t('This chapter')}
      </button>
      <button type="button" class="btn btn-sm" aria-pressed={scope === 'book'} onclick={() => (scope = 'book')}>
        {$t('Whole book')}
      </button>
    </div>
    <span class="muted">{$t('{count} maps in the book', { count: mapsInBook })}</span>
  </div>

  {#if places.length === 0}
    <p class="muted">
      {$t('No places recorded here yet.')}
    </p>
  {:else}
    <ul class="places">
      {#each places as place (place.text)}
        {@const entry = resolve(register, place.text)}
        <li class:selected={selected === place.text}>
          <button type="button" class="place" aria-pressed={selected === place.text} onclick={() => pick(place.text)}>
            <span class="place-text">{place.text}</span>
            <span class="muted">{place.labels.join('; ')}</span>
          </button>
          <span class="state" class:done={!!entry}>{entry ? $t('Map') : $t('Not located')}</span>
          {#if entry}
            <button type="button" class="btn btn-sm" onclick={() => insert(place.text)}>{$t('Insert map')}</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if unused.length}
    <p class="muted">{$t('Maps no chapter uses: {places}', { places: unused.join('; ') })}</p>
  {/if}

  <form
    class="row search"
    onsubmit={event => {
      event.preventDefault();
      if (!selected) pick(query.trim());
      void runSearch();
    }}
  >
    <label class="visually-hidden" for="place-query">{$t('Place to search for')}</label>
    <input id="place-query" type="search" bind:value={query} placeholder={$t('Place name')} />
    <button type="submit" class="btn btn-sm" disabled={busy || !query.trim()}>{$t('Search')}</button>
    {#if selected}
      <button type="button" class="btn btn-sm" onclick={openManual}>{$t('Place it by hand')}</button>
    {/if}
  </form>

  {#if candidates.length}
    <ul class="candidates" aria-label={$t('Matches')}>
      {#each candidates as row, i (i)}
        <li>
          <button
            type="button"
            class="candidate"
            disabled={!row.draft}
            aria-pressed={chosen === row.draft}
            onclick={() => (chosen = row.draft)}
          >
            <span class="thumb" aria-hidden="true">{@html row.draft?.svg ?? ''}</span>
            <span>
              <span class="place-text">{row.candidate.name}</span>
              <span class="muted detail">{row.candidate.detail}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if manual}
    <div class="manual">
      <label>
        {$t('Country')}
        <select bind:value={manualCountry} onchange={updateManual}>
          <option value="">—</option>
          {#each countries as country (country.a3)}
            <option value={country.a3}>{country.name}</option>
          {/each}
        </select>
      </label>
      {#if manualData}
        <label>
          {$t('State or region')}
          <select bind:value={manualRegion} onchange={updateManual}>
            <option value="">—</option>
            {#each manualData.regions as region (region.name)}
              <option value={region.name}>{region.name}</option>
            {/each}
          </select>
        </label>
        <label>
          {$t('Coordinates (optional)')}
          <input type="text" bind:value={manualCoords} onchange={updateManual} placeholder="-37.56, 143.85" />
        </label>
      {/if}
    </div>
  {/if}

  {#if chosen && selected}
    <div class="preview">
      <span class="large">{@html chosen.svg}</span>
      <div>
        <p>{chosen.entry.name}</p>
        <button type="button" class="btn primary" disabled={busy} onclick={addMap}>
          {resolve(register, selected) ? $t('Replace map') : $t('Add map')}
        </button>
      </div>
    </div>
  {/if}

  {#if selected && located.some(key => key !== selected)}
    <div class="row">
      <label>
        {$t('Same place as')}
        <select bind:value={aliasOf}>
          <option value="">—</option>
          {#each located.filter(key => key !== selected) as key (key)}
            <option value={key}>{key}</option>
          {/each}
        </select>
      </label>
      <button type="button" class="btn btn-sm" disabled={!aliasOf} onclick={saveAlias}>{$t('Use that map')}</button>
    </div>
  {/if}

  {#if status}
    <p class="status" role="status">{status}</p>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .scope {
    display: inline-flex;
    gap: 0.25rem;
  }

  .scope [aria-pressed='true'],
  .candidate[aria-pressed='true'],
  .place[aria-pressed='true'] {
    outline: 2px solid var(--color-interactive-primary);
    outline-offset: -2px;
  }

  .muted {
    color: var(--color-text-secondary);
  }

  .places,
  .candidates {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  /* A chapter can name many places; the list scrolls rather than pushing the
     editor down the page. */
  .places {
    max-block-size: 14rem;
    overflow-y: auto;
  }

  .places li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .place,
  .candidate {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
    font: inherit;
    text-align: start;
  }

  .place {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
  }

  .place-text {
    display: block;
    font-weight: 600;
  }

  .detail {
    display: block;
    font-size: 0.75rem;
  }

  .state {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .state.done {
    color: var(--color-interactive-primary);
  }

  .thumb {
    flex: none;
    width: 3.5rem;
  }

  .search input {
    flex: 1;
    min-width: 10rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
    font: inherit;
  }

  .manual {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .manual label,
  .row label {
    display: inline-flex;
    flex-direction: column;
    gap: 0.125rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .manual input {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
    font: inherit;
  }

  .preview {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .preview .large {
    width: 9rem;
  }

  .preview p {
    margin: 0 0 var(--space-2);
  }

  .primary {
    background: var(--color-interactive-primary);
    border-color: var(--color-interactive-primary);
    color: var(--color-text-inverse);
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .status {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
