<!--
  Editor Pane Component

  Left pane of the spine editor providing stacked editor panes with file dropdowns
  for editing different file types (text, CSS, JavaScript, transform scripts).

  Features:
  - Single/dual pane mode with toggle button
  - File dropdown selection for each pane
  - Metadata editor with chapter configuration
  - Transform status and error display
  - Manual preview update trigger
-->

<script lang="ts">
  import type { TransformError } from '$lib/types/spine-editor.js';
  import type { TextEditorStore } from '$lib/stores/index.js';
  import type { ContentService } from '$lib/services/content/content.service.js';
  import type { AudioClipService } from '$lib/audio/audio-clip.service.js';
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '$lib/services/workspace/workspace.service.js';
  import type { SettingsService } from '$lib/services/settings/settings.service.js';
  import AudioClipEditor from '$lib/components/audio/AudioClipEditor.svelte';
  import GeneratorPanel from '$lib/components/spine/GeneratorPanel.svelte';
  import LineNumberGutter from '$lib/components/spine/LineNumberGutter.svelte';
  import type { GeneratorRunner } from '$lib/generators/generator-store.js';
  import { isRtlLanguage } from '$lib/epub/language-direction.js';
  import { primaryLanguage } from '$lib/epub/opf-utils.js';
  import { t } from '$lib/i18n';
  import { RowsIcon, SquareIcon, ArrowUUpLeft } from 'phosphor-svelte';
  import { onMount } from 'svelte';
  import { FileStorageAPI } from '$lib/storage/index.js';
  import { BASE_PREFIX } from '$lib/track-changes/base-snapshot.js';
  import { diffSegments, applySelectedHunks } from '$lib/track-changes/hunks.js';

  // Props using Svelte 5 runes syntax
  let {
    transformError = null,
    transformWarnings = [],
    availableFiles1 = [],
    availableFiles2 = [],
    advancedMode = false,
    editorMode = 'single',
    pane1SelectedFile = '',
    pane2SelectedFile = '',
    pane1Error = $bindable(),
    pane2Error = $bindable(),
    pane1FileStore = null,
    pane2FileStore = null,
    contentService,
    onPaneToggle,
    onFileSelect,
    onContentChange: _onContentChange,
    onPreviewClick: _onPreviewClick = null,
    // Audio clip editor integration props
    workspace = null,
    audioClipService = null,
    workspaceService = null,
    settingsService = null,
    chapterTitle = '',
    chapterTitlePlaceholder = '',
    onChapterTitleChange,
    generatorRunner = null,
  }: {
    transformError?: TransformError | null;
    transformWarnings?: string[];
    availableFiles1?: Array<{
      value: string;
      label: string;
      path: string;
      type: 'text' | 'css' | 'javascript' | 'transform' | 'preview-head' | 'generator';
    }>;
    availableFiles2?: Array<{
      value: string;
      label: string;
      path: string;
      type: 'text' | 'css' | 'javascript' | 'transform' | 'preview-head' | 'generator';
    }>;
    /** Basic mode hides JavaScript/transform entries from the file dropdowns —
        JS isn't exposed as editable there. */
    advancedMode?: boolean;
    editorMode?: 'single' | 'dual';
    pane1SelectedFile?: string;
    pane2SelectedFile?: string;
    pane1Error?: string | null;
    pane2Error?: string | null;
    pane1FileStore?: TextEditorStore | null;
    pane2FileStore?: TextEditorStore | null;
    contentService: ContentService;
    onPaneToggle?: () => void;
    onFileSelect?: (pane: 1 | 2, filePath: string, fileType: string) => void;
    onContentChange?: (pane: 1 | 2, content: string) => void;
    onPreviewClick?:
      | ((detail: { text: string; documentPosition: number; elementType: string }) => void)
      | null;
    // Audio clip editor integration props
    workspace?: WorkspaceState | null;
    audioClipService?: AudioClipService | null;
    workspaceService?: WorkspaceService | null;
    settingsService?: SettingsService | null;
    /** Authored chapter title (the spine item's content-document <title>). */
    chapterTitle?: string;
    /** Placeholder shown when no title is set — the spine item id it falls back to. */
    chapterTitlePlaceholder?: string;
    onChapterTitleChange?: (title: string) => void;
    /** Available generators + how to run them; null/empty hides the Generators control. */
    generatorRunner?: GeneratorRunner | null;
  } = $props();

  // Basic mode hides JavaScript, transform-script, generator and preview-head
  // entries, so power-user surfaces aren't offered as editable; text and CSS stay.
  const isEditableInBasicMode = (type: string) =>
    type === 'text' || type === 'css';
  const visibleFiles1 = $derived(
    advancedMode ? availableFiles1 : availableFiles1.filter(f => isEditableInBasicMode(f.type))
  );
  const visibleFiles2 = $derived(
    advancedMode ? availableFiles2 : availableFiles2.filter(f => isEditableInBasicMode(f.type))
  );

  // Group the file-picker entries under <optgroup> headers (mirrors the preview
  // pane's device dropdown). The chapter plain text is shown as a bare leading
  // option; everything else buckets by kind. Only non-empty groups render.
  type FileEntry = { value: string; label: string; path: string; type: string };
  const FILE_GROUP_ORDER = ['reading-system', 'build', 'generator', 'preview'] as const;
  const fileGroupOf = (type: string): (typeof FILE_GROUP_ORDER)[number] | null => {
    switch (type) {
      case 'css':
      case 'javascript':
        return 'reading-system';
      case 'transform':
        return 'build';
      case 'generator':
        return 'generator';
      case 'preview-head':
        return 'preview';
      default:
        return null; // 'text' — rendered as a bare option, not grouped
    }
  };
  const fileGroupLabel = (key: string): string => {
    switch (key) {
      case 'reading-system':
        // i18n: Dropdown group for CSS/JS files loaded by the e-reader
        return $t('Reading System');
      case 'build':
        // i18n: Dropdown group for build-time transform scripts (not shipped)
        return $t('Build scripts');
      case 'generator':
        // i18n: Dropdown group for on-demand content generator scripts
        return $t('Generators');
      case 'preview':
        // i18n: Dropdown group for the preview-only head fragment
        return $t('Preview');
      default:
        return key;
    }
  };
  const textFilesOf = (files: FileEntry[]) => files.filter(f => f.type === 'text');
  const fileGroupsOf = (files: FileEntry[]) =>
    FILE_GROUP_ORDER.map(key => ({
      key,
      files: files.filter(f => fileGroupOf(f.type) === key),
    })).filter(g => g.files.length > 0);

  /**
   * Toggle between single and dual pane mode
   */
  function togglePaneMode(): void {
    onPaneToggle?.();
  }

  /**
   * Toggle audio clip editor visibility
   */
  function toggleAudioEditor(): void {
    audioEditorVisible = !audioEditorVisible;
  }

  /**
   * Toggle the generators panel visibility
   */
  function toggleGeneratorPanel(): void {
    generatorPanelVisible = !generatorPanelVisible;
  }

  /**
   * Handle textarea selection change for audio editor
   */
  function handleTextareaSelection(pane: 1 | 2): void {
    const textarea = pane === 1 ? pane1Textarea : pane2Textarea;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start !== end) {
      textareaSelection = { start, end };
    } else {
      textareaSelection = null;
    }
  }

  /**
   * Insert clip directive at current cursor position
   */
  function insertClipDirective(clipText: string): void {
    const textarea = textContentPane === 1 ? pane1Textarea : pane2Textarea;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;

    // Insert the clip directive at cursor position
    const newValue = currentValue.slice(0, start) + clipText + currentValue.slice(end);
    textarea.value = newValue;

    // Update cursor position after insertion
    const newCursorPos = start + clipText.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);

    // Trigger input event to update store
    const inputEvent = new Event('input', { bubbles: true });
    textarea.dispatchEvent(inputEvent);

    // Focus back to textarea
    textarea.focus();
  }

  /**
   * Handle file selection change
   */
  function handleFileSelect(pane: 1 | 2, event: Event): void {
    const target = event.target as HTMLSelectElement;

    // Use the appropriate available files array for each pane
    const availableFiles = pane === 1 ? availableFiles1 : availableFiles2;
    const selectedFile = availableFiles.find(f => f.value === target.value);

    if (selectedFile) {
      onFileSelect?.(pane, selectedFile.path, selectedFile.type);
    }
  }

  /**
   * Handle pane 1 content input with validation-first logic
   */
  function handlePane1Input(event: Event): void {
    const content = (event.target as HTMLTextAreaElement).value;

    if (!pane1FileStore) {
      console.warn('🚫 No file store available for input in pane 1');
      return;
    }

    // Validation-first: validate before persistence
    const validationError = contentService.validateFileContent(content, pane1SelectedFile);

    if (validationError) {
      pane1Error = validationError;
      // Block persistence - store keeps last valid content
      return;
    } else {
      pane1Error = null;
    }

    // Only persist valid content (or non-validated content)
    pane1FileStore.updateContent(content);
  }

  /**
   * Handle pane 2 content input with validation-first logic
   */
  function handlePane2Input(event: Event): void {
    const content = (event.target as HTMLTextAreaElement).value;

    if (!pane2FileStore) {
      console.warn('🚫 No file store available for input in pane 2');
      return;
    }

    // Validation-first: validate before persistence
    const validationError = contentService.validateFileContent(content, pane2SelectedFile);

    if (validationError) {
      pane2Error = validationError;
      // Block persistence - store keeps last valid content
      return;
    } else {
      pane2Error = null;
    }

    // Only persist valid content (or non-validated content)
    pane2FileStore.updateContent(content);
  }

  /**
   * Get syntax highlighting class for textarea
   */
  function getSyntaxClass(fileType: string): string {
    if (fileType.includes('css')) return 'syntax-css';
    if (fileType.includes('javascript') || fileType.includes('js')) return 'syntax-js';
    if (fileType.includes('transform') || fileType.includes('generator')) return 'syntax-js';
    return 'syntax-text';
  }

  // Right-to-left book → edit prose right-to-left. Prose surfaces (the chapter text
  // and title) follow the book's language; code/style files always stay LTR.
  const bookIsRtl = $derived(isRtlLanguage(primaryLanguage(workspace?.opf?.metadata)));

  /**
   * Editing direction for a pane: prose ('text') follows the book; everything
   * else (css/js/transform/generator) stays left-to-right.
   */
  function paneDir(fileType: string): 'rtl' | 'ltr' {
    return fileType === 'text' ? (bookIsRtl ? 'rtl' : 'ltr') : 'ltr';
  }

  /**
   * Get appropriate placeholder text
   */
  function getPlaceholder(fileType: string): string {
    if (fileType === 'text') {
      return 'Enter your chapter content here...\n\nThis will be transformed to XHTML using your configured text transform script.';
    }
    if (fileType.includes('css')) {
      return '/* Stylesheet content */\n\nbody {\n  /* Your styles here */\n}';
    }
    if (fileType.includes('javascript') || fileType.includes('js') || fileType === 'generator') {
      return '// JavaScript content\n\n(function() {\n  // Your code here\n})();';
    }
    if (fileType.includes('transform')) {
      return '// Transform script\n\nfunction transform(input) {\n  // Your transform logic here\n  return input;\n}';
    }
    if (fileType === 'preview-head') {
      return '<!-- Preview-only <head> additions. Injected into the preview, never the\n     packaged EPUB. Use inline <style>/<script> to surface hidden markup. -->\n<style>\n  /* e.g. flag language-switch spans for a quick visual check: */\n  [lang] { outline: 1px dashed red; }\n</style>';
    }
    return '';
  }

  // Textarea references for navigation
  let pane1Textarea: HTMLTextAreaElement | undefined = $state();
  let pane2Textarea: HTMLTextAreaElement | undefined = $state();

  // Code panes (non-prose) get a line-number gutter and no soft-wrap; prose ('text')
  // keeps wrapping and shows no gutter.
  const pane1IsCode = $derived(pane1SelectedFile !== 'text');
  const pane2IsCode = $derived(pane2SelectedFile !== 'text');
  const pane1Content = $derived(pane1FileStore ? ($pane1FileStore?.content ?? '') : '');
  const pane2Content = $derived(pane2FileStore ? ($pane2FileStore?.content ?? '') : '');
  const pane1LineCount = $derived(pane1IsCode ? pane1Content.split('\n').length : 1);
  const pane2LineCount = $derived(pane2IsCode ? pane2Content.split('\n').length : 1);

  // Track-changes "Changes" toggle: when a base snapshot exists for the selected
  // file, show an inline diff (base vs current) instead of the textarea. Per pane.
  const TRACKABLE_TYPES = new Set(['text', 'css', 'javascript']);
  const selectedFile1 = $derived(availableFiles1.find(f => f.value === pane1SelectedFile) ?? null);
  const selectedFile2 = $derived(availableFiles2.find(f => f.value === pane2SelectedFile) ?? null);
  // Base content if a snapshot exists for the pane's file, else null (no button).
  let base1 = $state<string | null>(null);
  let base2 = $state<string | null>(null);
  let showDiff1 = $state(false);
  let showDiff2 = $state(false);

  // Live current content per pane, and the base→current segments (with a revert
  // patch) shown in the Changes view. The "Changes" button only shows when the
  // current content actually differs from the saved base.
  const cur1 = $derived(pane1FileStore ? ($pane1FileStore?.content ?? '') : '');
  const cur2 = $derived(pane2FileStore ? ($pane2FileStore?.content ?? '') : '');
  const hasDiff1 = $derived(base1 !== null && cur1 !== base1);
  const hasDiff2 = $derived(base2 !== null && cur2 !== base2);
  const diff1 = $derived(showDiff1 && hasDiff1 ? diffSegments(base1 ?? '', cur1) : null);
  const diff2 = $derived(showDiff2 && hasDiff2 ? diffSegments(base2 ?? '', cur2) : null);

  // When a pane has no remaining changes (e.g. after reverting the last one), drop
  // out of the diff view — otherwise the next keystroke (which re-creates a diff)
  // would snap the pane back from the textarea into the Changes view.
  $effect(() => {
    if (!hasDiff1) showDiff1 = false;
  });
  $effect(() => {
    if (!hasDiff2) showDiff2 = false;
  });

  // Revert one change region back to the saved base, leaving other edits intact.
  function revert(pane: 1 | 2, index: number) {
    const store = pane === 1 ? pane1FileStore : pane2FileStore;
    const base = pane === 1 ? base1 : base2;
    if (!store || base === null) return;
    const cur = pane === 1 ? cur1 : cur2;
    const { revertPatch } = diffSegments(base, cur);
    const next = applySelectedHunks(
      cur,
      revertPatch,
      revertPatch.hunks.map((_, i) => i === index)
    );
    store.updateContent(next);
  }

  async function loadBase(file: { path: string; type: string } | null): Promise<string | null> {
    if (!workspace || !file || !TRACKABLE_TYPES.has(file.type)) return null;
    const storage = FileStorageAPI.getInstance();
    const basePath = BASE_PREFIX + file.path;
    try {
      if (!(await storage.fileExists(workspace.id, basePath))) return null;
      return await storage.readTextFile(workspace.id, basePath);
    } catch {
      return null;
    }
  }

  // Reload the base (and reset the diff view) whenever the pane's file changes.
  $effect(() => {
    const file = selectedFile1;
    showDiff1 = false;
    let cancelled = false;
    void loadBase(file).then(content => {
      if (!cancelled) base1 = content;
    });
    return () => {
      cancelled = true;
    };
  });
  $effect(() => {
    const file = selectedFile2;
    showDiff2 = false;
    let cancelled = false;
    void loadBase(file).then(content => {
      if (!cancelled) base2 = content;
    });
    return () => {
      cancelled = true;
    };
  });

  // A base is created lazily on the first real edit; refresh the affected pane so
  // its "Changes" button appears without needing to reselect the file.
  onMount(() => {
    const handler = (event: Event) => {
      const path = (event as CustomEvent<{ path?: string }>).detail?.path;
      if (!path) return;
      if (selectedFile1?.path === path) void loadBase(selectedFile1).then(c => (base1 = c));
      if (selectedFile2?.path === path) void loadBase(selectedFile2).then(c => (base2 = c));
    };
    window.addEventListener('seed:base-captured', handler);
    return () => window.removeEventListener('seed:base-captured', handler);
  });

  // Audio clip editor state
  let audioEditorVisible = $state<boolean>(false);
  let textareaSelection = $state<{ start: number; end: number } | null>(null);

  // Generators panel state
  let generatorPanelVisible = $state<boolean>(false);
  let hasGenerators = $derived(!!generatorRunner && generatorRunner.generators.length > 0);
  // A text source pane is active (so inserting at the caret makes sense).
  let textPaneActive = $derived(
    (pane1SelectedFile === 'text' && editorMode === 'single') ||
      (editorMode === 'dual' && (pane1SelectedFile === 'text' || pane2SelectedFile === 'text'))
  );

  // Check if workspace has audio files (derived reactive)
  let hasAudioFiles = $derived(
    (() => {
      if (!workspace?.opf?.manifest) return false;
      return workspace.opf.manifest.some(
        item => item.mediaType && item.mediaType.startsWith('audio/')
      );
    })()
  );

  // Determine which pane has text content
  let textContentPane = $derived(
    (() => {
      if (pane1SelectedFile === 'text') return 1;
      if (pane2SelectedFile === 'text') return 2;
      return null;
    })()
  );

  // Text content for audio editor (bindable)
  let textContent = $derived.by(() => {
    const pane = textContentPane;
    if (pane === 1) return pane1FileStore ? $pane1FileStore?.content || '' : '';
    if (pane === 2) return pane2FileStore ? $pane2FileStore?.content || '' : '';
    return '';
  });

  /**
   * Normalize text for better matching by removing/standardizing punctuation and whitespace
   */
  function normalizeText(text: string): string {
    // Use character code approach for apostrophe normalization
    let result = text.trim();

    // Convert curly quotes to straight quotes using character codes
    result = result
      .split('')
      .map(char => {
        const code = char.charCodeAt(0);
        if (code === 8217 || code === 8216) {
          // ' and ' (apostrophes)
          return "'";
        }
        if (code === 8221 || code === 8220) {
          // " and " (double quotes)
          return '"';
        }
        return char;
      })
      .join('');

    // Normalize other quote variants
    result = result.replace(/[""„‚]/g, '"');

    // Normalize whitespace
    result = result.replace(/\s+/g, ' ');

    return result;
  }

  /**
   * Find and select text in the editor based on preview click
   */
  function findAndSelectText(detail: {
    text: string;
    documentPosition: number;
    elementType: string;
  }): void {
    // Try both panes to find content
    let textarea: HTMLTextAreaElement | null = null;
    let content = '';

    // Check pane 1 first
    if (pane1FileStore && pane1SelectedFile && pane1Textarea && $pane1FileStore?.content) {
      textarea = pane1Textarea;
      content = $pane1FileStore.content;
    }
    // Then check pane 2
    else if (pane2FileStore && pane2SelectedFile && pane2Textarea && $pane2FileStore?.content) {
      textarea = pane2Textarea;
      content = $pane2FileStore.content;
    }

    if (!textarea || !content) return;

    const contentLower = content.toLowerCase();

    // Try the snippet, then progressively shorter windows (the preview's edge
    // words can be altered by the transform — entities, smart quotes). Longest
    // (most specific) first; the first candidate found wins.
    for (const candidate of buildSearchCandidates(detail.text)) {
      const index = findNearestIndex(
        contentLower,
        candidate.toLowerCase(),
        detail.documentPosition
      );
      if (index !== -1) {
        selectTextRange(textarea, index, index + candidate.length);
        return;
      }
    }

    // No good match found - fail silently rather than select wrong text
  }

  /**
   * Candidate search strings for a clicked snippet, longest/most-specific first:
   * the normalized snippet, the raw text, then progressively shorter word windows
   * anchored at each end (down to 2 words). Deduped; only >= 3 chars.
   */
  function buildSearchCandidates(text: string): string[] {
    const normalized = normalizeText(text);
    const words = normalized.split(' ').filter(Boolean);
    const out: string[] = [];
    const add = (s: string) => {
      const v = s.trim();
      if (v.length >= 3 && !out.includes(v)) out.push(v);
    };

    add(normalized);
    add(text.trim());
    for (let len = words.length - 1; len >= 2; len--) {
      add(words.slice(0, len).join(' ')); // drop trailing word(s)
      add(words.slice(words.length - len).join(' ')); // drop leading word(s)
    }
    return out;
  }

  /**
   * Index of `needle` in `haystack`, preferring the occurrence nearest `hint`
   * (a rough source-position estimate) when there is more than one. -1 if absent.
   */
  function findNearestIndex(haystack: string, needle: string, hint: number): number {
    if (needle.length < 3) return -1;
    let index = haystack.indexOf(needle);
    if (index === -1) return -1;

    let best = index;
    const target = Math.max(0, Math.min(hint || 0, haystack.length));
    let bestDistance = Math.abs(index - target);
    while ((index = haystack.indexOf(needle, index + 1)) !== -1) {
      const distance = Math.abs(index - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    return best;
  }

  /**
   * Select text range in textarea and scroll to it
   */
  function selectTextRange(textarea: HTMLTextAreaElement, start: number, end: number): void {
    // Focus the textarea
    textarea.focus();

    // Set selection
    textarea.setSelectionRange(start, end);

    // Scroll to the selection
    const lines = textarea.value.substring(0, start).split('\n');
    const targetLine = lines.length - 1;
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const scrollTop = targetLine * lineHeight;

    // Scroll to make the selection visible
    textarea.scrollTop = Math.max(0, scrollTop - textarea.clientHeight / 2);
  }

  // Export the findAndSelectText function for parent component access
  export { findAndSelectText };
</script>

<!-- Grouped <option>s for a file picker: the chapter plain text as a bare
     leading option, then one <optgroup> per non-empty kind. -->
{#snippet fileOptions(files: FileEntry[])}
  {#each textFilesOf(files) as file}
    <option value={file.value}>{file.label}</option>
  {/each}
  {#each fileGroupsOf(files) as group}
    <optgroup label={fileGroupLabel(group.key)}>
      {#each group.files as file}
        <option value={file.value}>{file.label}</option>
      {/each}
    </optgroup>
  {/each}
{/snippet}

<!-- Pane 1's file picker. Lives in the header row in single-pane mode; moves
     into pane 1's own header in dual mode (next to its editor). -->
{#snippet pane1FileSelector()}
  <select
    class="file-selector"
    value={pane1SelectedFile}
    onchange={e => handleFileSelect(1, e)}
    aria-label={$t('Select file for pane 1')}
  >
    {@render fileOptions(visibleFiles1)}
  </select>
{/snippet}

<!-- Track-changes diff toggle for a pane, shown only when the file has a base snapshot. -->
{#snippet changesToggle(pane: 1 | 2)}
  {#if pane === 1 ? hasDiff1 : hasDiff2}
    <button
      type="button"
      class="changes-toggle-btn"
      class:active={pane === 1 ? showDiff1 : showDiff2}
      onclick={() => (pane === 1 ? (showDiff1 = !showDiff1) : (showDiff2 = !showDiff2))}
      title={$t('Show your changes against the saved version')}
    >
      {$t('Changes')}
    </button>
  {/if}
{/snippet}

<!-- Base→current diff with a per-change revert button (right edge of each change). -->
{#snippet revertableDiff(segments: import('$lib/track-changes/hunks.js').DiffSegment[], pane: 1 | 2)}
  <div class="diff-view">
    {#each segments as seg, si (si)}
      {#if seg.type === 'context'}
        {#each seg.lines as line, li (li)}
          <div class="diff-line diff-context">
            <span class="diff-sign" aria-hidden="true"> </span><span class="diff-text"
              >{line || ' '}</span
            >
          </div>
        {/each}
      {:else}
        <div class="change-region">
          <div class="change-lines">
            {#each seg.removed as line, li (li)}
              <div class="diff-line diff-remove">
                <span class="diff-sign" aria-hidden="true">-</span><span class="diff-text"
                  >{line || ' '}</span
                >
              </div>
            {/each}
            {#each seg.added as line, li (li)}
              <div class="diff-line diff-add">
                <span class="diff-sign" aria-hidden="true">+</span><span class="diff-text"
                  >{line || ' '}</span
                >
              </div>
            {/each}
          </div>
          <button
            type="button"
            class="revert-btn"
            title={$t('Revert this change')}
            aria-label={$t('Revert this change')}
            onclick={() => revert(pane, seg.index)}
          >
            <ArrowUUpLeft size={16} aria-hidden="true" />
          </button>
        </div>
      {/if}
    {/each}
  </div>
{/snippet}

<!-- The chapter title belongs to the chapter, not a pane, so it stays in the
     header row in both single and dual mode. -->
{#snippet chapterTitleInput()}
  <input
    type="text"
    class="chapter-title-input"
    value={chapterTitle}
    placeholder={chapterTitlePlaceholder}
    onchange={e => onChapterTitleChange?.((e.currentTarget as HTMLInputElement).value)}
    dir={bookIsRtl ? 'rtl' : 'ltr'}
    aria-label={$t('Chapter title')}
    title={$t('Chapter title — used in the content document <title>; defaults to the spine id')}
  />
{/snippet}

{#snippet pane1Audio()}
  {#if pane1SelectedFile === 'text' && audioEditorVisible && hasAudioFiles && audioClipService && workspace && settingsService && workspaceService}
    <div class="audio-editor-panel">
      <AudioClipEditor
        {workspace}
        {audioClipService}
        {workspaceService}
        {settingsService}
        {textContent}
        {textareaSelection}
        onInsertClip={insertClipDirective}
      />
    </div>
  {/if}
{/snippet}

<div class="editor-pane-container">
  <!-- Single header row: pane toggle, pane-1 file picker + chapter title
       (single-pane mode), audio toggle, and the transform status. -->
  <div class="editor-header">
    <div class="editor-controls">
      <button
        type="button"
        class="btn btn-icon"
        onclick={togglePaneMode}
        title={editorMode === 'single' ? $t('Add second editor pane') : $t('Switch to single pane')}
      >
        <span class="toggle-icon" aria-hidden="true">
          {#if editorMode === 'single'}
            <RowsIcon size={16} />
          {:else}
            <SquareIcon size={16} />
          {/if}
        </span>
      </button>

      {#if editorMode === 'single'}
        {@render pane1FileSelector()}
      {/if}
      {@render chapterTitleInput()}

      {#if ((pane1SelectedFile === 'text' && editorMode === 'single') || (editorMode === 'dual' && (pane1SelectedFile === 'text' || pane2SelectedFile === 'text'))) && hasAudioFiles && audioClipService && workspace}
        <button
          type="button"
          class="audio-toggle-btn"
          class:active={audioEditorVisible}
          onclick={toggleAudioEditor}
          title={audioEditorVisible ? $t('Hide Audio Clip Editor') : $t('Show Audio Clip Editor')}
          aria-label={audioEditorVisible
            ? $t('Hide Audio Clip Editor')
            : $t('Show Audio Clip Editor')}
        >
          {$t('Audio Clip Editor')}
        </button>
      {/if}

      {#if textPaneActive && hasGenerators}
        <button
          type="button"
          class="generator-toggle-btn"
          class:active={generatorPanelVisible}
          onclick={toggleGeneratorPanel}
          title={generatorPanelVisible ? $t('Hide Generators') : $t('Show Generators')}
          aria-label={generatorPanelVisible ? $t('Hide Generators') : $t('Show Generators')}
        >
          {$t('Generators')}
        </button>
      {/if}

      {#if editorMode === 'single'}
        {@render changesToggle(1)}
      {/if}
    </div>
  </div>

  {#if generatorPanelVisible && generatorRunner && hasGenerators && textPaneActive}
    <div class="generator-editor-panel">
      <GeneratorPanel runner={generatorRunner} onInsert={insertClipDirective} />
    </div>
  {/if}

  <!-- Stacked editor panes -->
  <div class="editor-content">
    <div class="editor-panes" class:dual-mode={editorMode === 'dual'}>
      <!-- Pane 2 (top when in dual mode) -->
      {#if editorMode === 'dual'}
        <div class="editor-pane pane-2">
          <div class="pane-header">
            <div class="pane-header-content">
              <select
                class="file-selector"
                value={pane2SelectedFile}
                onchange={e => handleFileSelect(2, e)}
                aria-label={$t('Select file for pane 2')}
              >
                {@render fileOptions(visibleFiles2)}
              </select>
              {@render changesToggle(2)}
            </div>

            {#if pane2SelectedFile === 'text' && audioEditorVisible && hasAudioFiles && audioClipService && workspace && settingsService && workspaceService}
              <div class="audio-editor-panel">
                <AudioClipEditor
                  {workspace}
                  {audioClipService}
                  {workspaceService}
                  {settingsService}
                  {textContent}
                  {textareaSelection}
                  onInsertClip={insertClipDirective}
                />
              </div>
            {/if}
          </div>

          <div class="textarea-container" style="--gutter-digits: {String(pane2LineCount).length}">
            {#if diff2}
              {@render revertableDiff(diff2.segments, 2)}
            {:else}
              {#if pane2IsCode}
                <LineNumberGutter lineCount={pane2LineCount} target={pane2Textarea} />
              {/if}
              <textarea
                bind:this={pane2Textarea}
                class="content-textarea {getSyntaxClass(pane2SelectedFile)}"
                class:has-error={pane2Error}
                class:with-gutter={pane2IsCode}
                value={pane2FileStore ? $pane2FileStore?.content || '' : ''}
                placeholder={getPlaceholder(pane2SelectedFile)}
                oninput={handlePane2Input}
                onselect={() => pane2SelectedFile === 'text' && handleTextareaSelection(2)}
                onmouseup={() => pane2SelectedFile === 'text' && handleTextareaSelection(2)}
                onkeyup={() => pane2SelectedFile === 'text' && handleTextareaSelection(2)}
                spellcheck={pane2SelectedFile === 'text'}
                autocomplete="off"
                autocapitalize="off"
                aria-label={$t('Pane 2 content')}
                dir={paneDir(pane2SelectedFile)}
              ></textarea>
            {/if}
            {#if pane2Error}
              <div class="pane-error-overlay">
                <span class="error-icon" aria-hidden="true">⚠️</span>
                <span class="error-message">{pane2Error}</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Pane 1 (always visible, bottom when in dual mode) -->
      <div class="editor-pane pane-1">
        {#if editorMode === 'dual'}
          <!-- In dual mode pane 1 gets its own header (controls aren't in the
               top row, which is shared with pane 2). -->
          <div class="pane-header">
            <div class="pane-header-content">
              {@render pane1FileSelector()}
              {@render changesToggle(1)}
            </div>
            {@render pane1Audio()}
          </div>
        {:else}
          {@render pane1Audio()}
        {/if}

        <div class="textarea-container" style="--gutter-digits: {String(pane1LineCount).length}">
          {#if diff1}
            {@render revertableDiff(diff1.segments, 1)}
          {:else}
            {#if pane1IsCode}
              <LineNumberGutter lineCount={pane1LineCount} target={pane1Textarea} />
            {/if}
            <textarea
              bind:this={pane1Textarea}
              class="content-textarea {getSyntaxClass(pane1SelectedFile)}"
              class:has-error={pane1Error}
              class:with-gutter={pane1IsCode}
              value={pane1FileStore ? $pane1FileStore?.content || '' : ''}
              placeholder={getPlaceholder(pane1SelectedFile)}
              oninput={handlePane1Input}
              onselect={() => pane1SelectedFile === 'text' && handleTextareaSelection(1)}
              onmouseup={() => pane1SelectedFile === 'text' && handleTextareaSelection(1)}
              onkeyup={() => pane1SelectedFile === 'text' && handleTextareaSelection(1)}
              spellcheck={pane1SelectedFile === 'text'}
              autocomplete="off"
              autocapitalize="off"
              aria-label={$t('Pane 1 content')}
              dir={paneDir(pane1SelectedFile)}
            ></textarea>
          {/if}
          {#if pane1Error}
            <div class="pane-error-overlay">
              <span class="error-icon" aria-hidden="true">⚠️</span>
              <span class="error-message">{pane1Error}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Global error display (suppress for pane-specific syntax errors) -->
  {#if transformError && transformError.stage !== 'syntax-validation'}
    <div class="error-display">
      <div class="error-header">
        <span class="error-icon" aria-hidden="true">🚨</span>
        <strong>{$t('Transform Error ({stage})', { stage: transformError.stage })}</strong>
      </div>
      <div class="error-message">{transformError.message}</div>
      {#if transformError.stack}
        <details class="error-stack">
          <summary>{$t('Stack Trace')}</summary>
          <pre>{transformError.stack}</pre>
        </details>
      {/if}
    </div>
  {/if}

  <!-- Warnings display -->
  {#if transformWarnings.length > 0}
    <div class="warnings-display">
      <div class="warnings-header">
        <span class="warning-icon" aria-hidden="true">⚠️</span>
        <strong>{$t('{count} Warnings', { count: transformWarnings.length })}</strong>
      </div>
      <ul class="warnings-list">
        {#each transformWarnings as warning}
          <li>{warning}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .editor-pane-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-secondary);
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    /* Match the sidebar header height + grey (see PaneHeader) so all top bars align. */
    min-height: var(--touch-target-min);
    padding: 0 var(--space-3);
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-bg-tertiary);
    box-sizing: border-box;
  }

  .editor-controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    /* Grow so the file picker + chapter title fill the row and the status
       indicator sits at the far right. */
    flex: 1;
    min-width: 0;
  }

  .toggle-icon {
    display: inline-flex;
    align-items: center;
  }

  .editor-content {
    flex: 1;
    overflow: hidden;
  }

  .editor-panes {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .editor-pane {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0; /* Allow flex shrinking */
  }

  .editor-panes.dual-mode .editor-pane {
    /* Equal height distribution in dual mode */
    flex: 1;
  }

  .pane-2 {
    border-bottom: 1px solid var(--color-border-default);
  }

  .pane-header {
    /* Match the surrounding header greys (see .editor-header). */
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border-default);
  }

  .pane-header-content {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-2);
  }

  .file-selector {
    flex: 1 1 7rem;
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .chapter-title-input {
    flex: 2 1 10rem;
    min-width: 0;
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
  }

  .file-selector:focus {
    outline: none;
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 0 var(--focus-ring-width) var(--color-focus);
  }

  .audio-toggle-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    white-space: nowrap;
  }

  .audio-toggle-btn:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent-primary);
  }

  .audio-toggle-btn:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  .audio-toggle-btn.active {
    background: var(--color-accent-primary);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent-primary);
  }

  /* Track-changes "Changes" toggle — shares the toolbar button look, pinned right. */
  .changes-toggle-btn {
    margin-inline-start: auto;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    white-space: nowrap;
  }

  .changes-toggle-btn:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent-primary);
  }

  .changes-toggle-btn.active {
    background: var(--color-accent-primary);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent-primary);
  }

  .diff-view {
    block-size: 100%;
    overflow: auto;
    background-color: var(--color-surface-primary);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .diff-line {
    display: flex;
    gap: var(--space-2);
    padding-inline: var(--space-2);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .diff-sign {
    flex-shrink: 0;
    inline-size: 1ch;
    color: var(--color-text-tertiary);
    user-select: none;
  }

  .diff-text {
    flex: 1;
  }

  .diff-context {
    color: var(--color-text-secondary);
  }

  .diff-add {
    background-color: var(--color-success-bg, rgb(0 128 0 / 0.12));
    color: var(--color-success-text, inherit);
  }

  .diff-remove {
    background-color: var(--color-error-bg, rgb(200 0 0 / 0.12));
    color: var(--color-error-text, inherit);
  }

  /* A change region: its diff lines, with a revert button pinned to the right. */
  .change-region {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .change-lines {
    flex: 1;
    min-inline-size: 0;
  }

  .revert-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-block: 2px;
    margin-inline-end: var(--space-2);
    padding: var(--space-1);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .revert-btn:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent-primary);
    color: var(--color-text-primary);
  }

  .audio-editor-panel {
    border-top: 1px solid var(--color-border-default);
  }

  /* The Generators toggle shares the toolbar button look; the panel itself
     (GeneratorPanel) carries its own, fresher styling. */
  .generator-toggle-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    white-space: nowrap;
  }

  .generator-toggle-btn:hover {
    color: var(--color-on-accent);
    background: var(--color-hover-accent);
    border-color: var(--color-accent-primary);
  }

  .generator-toggle-btn:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  .generator-toggle-btn.active {
    background: var(--color-accent-primary);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent-primary);
  }

  .generator-editor-panel {
    padding: var(--space-3);
    border-top: 1px solid var(--color-border-default);
    background: var(--color-bg-primary);
  }

  .textarea-container {
    flex: 1;
    overflow: hidden;
    position: relative; /* For absolute positioning of error overlay */
  }

  .content-textarea {
    width: 100%;
    height: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-top-width: 0;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    resize: none;
    outline-offset: -2px;
  }

  /* Code panes: don't soft-wrap (one line = one row, so the gutter stays aligned;
     long lines scroll horizontally) and pad the text clear of the line-number gutter. */
  .content-textarea.with-gutter {
    white-space: pre;
    overflow: auto;
    padding-left: calc(var(--gutter-digits, 2) * 1ch + 2 * var(--space-2) + var(--space-3));
  }

  /* Focus ring on the pane (not the textarea): an overlay above the line-number gutter
     so the ring surrounds the whole pane — gutter included — instead of being clipped
     by the opaque gutter on the left. */
  .textarea-container::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    box-shadow: inset 0 0 0 var(--focus-ring-width) var(--color-accent);
    opacity: 0;
  }
  .textarea-container:focus-within::after {
    opacity: 1;
  }

  .content-textarea.has-error {
    border-color: var(--color-error-border);
  }
  .textarea-container:has(.content-textarea.has-error):focus-within::after {
    box-shadow: inset 0 0 0 var(--focus-ring-width) var(--color-error-border);
  }

  .pane-error-overlay {
    position: absolute;
    bottom: var(--space-3);
    left: var(--space-3);
    right: var(--space-3);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-error-bg);
    border: 1px solid var(--color-error-border);
    border-radius: var(--radius-sm);
    color: var(--color-error-text);
    font-size: var(--text-sm);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 10;
  }

  .pane-error-overlay .error-icon {
    font-size: var(--text-base);
    flex-shrink: 0;
  }

  .pane-error-overlay .error-message {
    flex: 1;
    font-family: var(--font-mono);
  }

  .error-display,
  .warnings-display {
    margin: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-md);
  }

  .error-display {
    background: var(--color-error-bg);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }

  .warnings-display {
    background: var(--color-warning-bg);
    border: 1px solid var(--color-warning-border);
    color: var(--color-warning-text);
  }

  .error-header,
  .warnings-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .error-message {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .error-stack {
    margin-top: var(--space-2);
  }

  .error-stack pre {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    overflow-x: auto;
    margin: var(--space-1) 0 0;
  }

  .warnings-list {
    margin: 0;
    padding-left: var(--space-4);
    font-size: var(--text-sm);
  }

  .warnings-list li {
    margin-bottom: var(--space-1);
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .pane-toggle-btn {
      transition: none;
    }
  }
</style>
