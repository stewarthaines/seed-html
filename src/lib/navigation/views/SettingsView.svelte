<script lang="ts">
  import type {
    SettingsService,
    WorkspaceSettings,
    EPUBSettings,
    PrintSettings,
    PreviewSettings,
    PreviewType,
    TransformOption,
  } from '../../services/settings/settings.service.js';
  import { DEFAULT_PREVIEW } from '../../services/settings/settings.service.js';
  import type { WorkspaceState } from '../../services/workspace/workspace.service.js';
  import type { ResolvedChange } from '../../track-changes/types.js';
  import type { ExtensionInfo } from '../../extensions/types.js';

  import type { ExtensionManager } from '../../extensions/extension-manager.js';
  import type { TransformEngine } from '../../infrastructure/transform-engine.js';
  import ExtensionItem from '../../components/extensions/ExtensionItem.svelte';
  import GeneratorSettings from '../../components/settings/GeneratorSettings.svelte';
  import TrackChangesPanel from '../../components/settings/TrackChangesPanel.svelte';
  import SettingsSection from '../../components/settings/SettingsSection.svelte';
  import PaneHeader from '../../components/layout/PaneHeader.svelte';
  import {
    addTransform,
    removeTransformAt,
    removeTransformsForExtension,
    moveTransform,
    transformLabel,
    transformGroup,
    basename,
    extensionOf,
  } from '../../settings/dom-transforms.js';
  import { CaretUp, CaretDown, CaretRight, X } from 'phosphor-svelte';
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { t, currentLocale, setLocale, availableLocales } from '../../i18n';
  import { LOCALE_CONFIGS } from '../../i18n/locale-config.js';
  import { themeStore } from '../../stores/theme.js';
  import { advancedMode } from '../../stores/advanced-mode.js';
  import { MARGIN_MM } from '../../pdf/pdf-export.js';
  import { FileStorageAPI } from '../../storage/index.js';
  import {
    canFetchSelfHtml,
    fetchSelfHtml,
    hasSeedHtml,
    storeSeedHtml,
    removeSeedHtml,
  } from '../../epub/seed-html.js';
  import type { PluginManifestEntry } from '../../plugins/contract';
  import type { ExtensionCatalogEntry } from '../../extensions/extension-catalog';

  interface Props {
    settingsService: SettingsService;
    extensionManager: ExtensionManager;
    transformEngine: TransformEngine;
    workspaceId: string | null;
    /** Current workspace (for the Track Changes patchset generator). */
    workspace?: WorkspaceState | null;
    /** Plugins discovered in plugins/manifest.json (empty unless served over HTTP). */
    availablePlugins?: PluginManifestEntry[];
    /** Ids the user has enabled (global). */
    enabledPluginIds?: string[];
    /** Extensions catalog from extensions/manifest.json (empty unless served over HTTP). */
    availableExtensions?: ExtensionCatalogEntry[];
    onTogglePlugin?: (id: string, enabled: boolean) => void;
    /**
     * Register EPUB assets an imported extension wrote to OEBPS/ (e.g. a CSS theme)
     * in the manifest and re-link them into chapters. Owned by App (needs the
     * workspace + transform engine); a no-op when SettingsView is used standalone.
     */
    onExtensionAssets?: (assets: Array<{ target: string; media?: string }>) => Promise<void>;
    /** Read-only EPUB: advanced mode is locked and extensions can't be added. */
    readOnly?: boolean;
    /** Whether any project exists — the app-level Advanced mode toggle only shows
        once the project list is populated (create a project first, then opt in). */
    hasProjects?: boolean;
    onSettingsChanged?: () => void;
    /** Apply accepted track-changes patchset items to the current project. */
    onApplyPatchset?: (resolved: ResolvedChange[]) => Promise<void>;
  }

  const {
    settingsService,
    extensionManager,
    transformEngine,
    workspaceId,
    workspace = null,
    availablePlugins = [],
    enabledPluginIds = [],
    availableExtensions = [],
    onTogglePlugin,
    onExtensionAssets,
    readOnly = false,
    hasProjects = false,
    onSettingsChanged,
    onApplyPatchset,
  }: Props = $props();

  // State management
  let workspaceSettings = $state<WorkspaceSettings | null>(null);
  let epubSettings = $state<EPUBSettings | null>(null);
  let availableTransforms = $state<TransformOption[]>([]);
  let availableTextTransforms = $state<TransformOption[]>([]);
  let loading = $state(false);
  let epubLoading = $state(false);
  let error = $state<string | null>(null);

  // Extension management state
  let extensions = $state<ExtensionInfo[]>([]);
  let extensionsLoading = $state(false);

  // Load settings when workspaceId changes
  $effect(() => {
    if (!workspaceId || !settingsService) return;

    const loadSettings = async () => {
      loading = true;
      error = null;

      try {
        workspaceSettings = await settingsService.loadWorkspaceSettings(workspaceId);
      } catch (err) {
        error = err instanceof Error ? err.message : $t('Failed to load settings');
        workspaceSettings = settingsService.getDefaultWorkspaceSettings();
      } finally {
        loading = false;
      }
    };

    const loadEPUBSettings = async () => {
      epubLoading = true;

      try {
        epubSettings = await settingsService.loadEPUBSettings(workspaceId);
      } catch (err) {
        console.error('Failed to load EPUB settings:', err);
        epubSettings = settingsService.getDefaultEPUBSettings();
      } finally {
        epubLoading = false;
      }
    };

    const loadAvailableTransforms = async () => {
      try {
        availableTransforms = await settingsService.getAvailableTransforms(workspaceId);
        availableTextTransforms = await settingsService.getAvailableTextTransforms(workspaceId);
      } catch (err) {
        console.error('Failed to load available transforms:', err);
        availableTransforms = [];
        availableTextTransforms = [];
      }
    };

    // Actually call the functions
    loadSettings();
    loadEPUBSettings();
    loadAvailableTransforms();
  });

  // Load extensions when workspaceId changes
  $effect(() => {
    if (!workspaceId) return;

    const loadExtensions = async () => {
      extensionsLoading = true;
      try {
        extensions = await extensionManager.listWorkspaceExtensions(workspaceId);
      } catch (err) {
        console.error('Failed to load extensions:', err);
        extensions = [];
      } finally {
        extensionsLoading = false;
      }
    };

    loadExtensions();
  });

  // Handle extension import
  async function handleExtensionImport(event: Event): Promise<void> {
    // Check advanced mode first
    if (!isAdvancedMode) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !workspaceId) return;

    try {
      const detectedName = extensionManager.detectExtensionName(file.name);
      await extensionManager.importExtension(workspaceId, file, detectedName);

      // Reload extensions list
      extensions = await extensionManager.listWorkspaceExtensions(workspaceId);

      // Reload extensions in transform engine
      await transformEngine.setWorkspaceExtensions(workspaceId);

      // Clear file input
      input.value = '';
    } catch (err) {
      console.error('Failed to import extension:', err);
      error = err instanceof Error ? err.message : $t('Failed to import extension');
    }
  }

  // Handle packaged-filename template change
  async function handleFilenameTemplateChange(event: Event): Promise<void> {
    if (!workspaceId || !epubSettings) return;

    const target = event.target as HTMLInputElement;
    const newTemplate = target.value;

    const validation = settingsService.validateEPUBSettings({ filename_template: newTemplate });
    if (!validation.isValid) {
      error = validation.errors[0] || 'Invalid filename template';
      return;
    }

    const updatedSettings: EPUBSettings = {
      ...epubSettings,
      filename_template: newTemplate,
    };

    epubSettings = updatedSettings;

    try {
      await settingsService.saveEPUBSettings(workspaceId, updatedSettings);
      onSettingsChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : $t('Failed to save EPUB settings');
      // Revert optimistic update
      epubSettings = {
        ...epubSettings,
        filename_template: epubSettings.filename_template,
      };
    }
  }

  // Persist the audio clip directive template (validated: must keep the <href>,
  // <begin>, <end> placeholders; cleared → the built-in default applies).
  async function handleAudioClipTemplateChange(event: Event): Promise<void> {
    if (!workspaceId || !epubSettings) return;

    const target = event.target as HTMLInputElement;
    const newTemplate = target.value.trim();

    const validation = settingsService.validateEPUBSettings({ audio_clip_template: newTemplate });
    if (!validation.isValid) {
      error = validation.errors[0] || $t('Invalid audio clip template');
      return;
    }

    const previous = epubSettings.audio_clip_template;
    const updatedSettings: EPUBSettings = {
      ...epubSettings,
      audio_clip_template: newTemplate,
    };
    epubSettings = updatedSettings;

    try {
      await settingsService.saveEPUBSettings(workspaceId, updatedSettings);
      onSettingsChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : $t('Failed to save EPUB settings');
      epubSettings = { ...epubSettings, audio_clip_template: previous };
    }
  }

  // Persist a drop-to-insert media template (image/video). Validated (<href>
  // required); cleared → the built-in default applies.
  async function handleMediaTemplateChange(
    key: 'image_template' | 'video_template',
    event: Event
  ): Promise<void> {
    if (!workspaceId || !epubSettings) return;

    const newTemplate = (event.target as HTMLInputElement).value.trim();
    const validation = settingsService.validateEPUBSettings({ [key]: newTemplate });
    if (!validation.isValid) {
      error = validation.errors[0] || $t('Invalid media template');
      return;
    }

    const previous = epubSettings[key];
    const updatedSettings: EPUBSettings = { ...epubSettings, [key]: newTemplate };
    epubSettings = updatedSettings;

    try {
      await settingsService.saveEPUBSettings(workspaceId, updatedSettings);
      onSettingsChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : $t('Failed to save EPUB settings');
      epubSettings = { ...epubSettings, [key]: previous };
    }
  }

  // --- Print settings ----------------------------------------------------------
  // Minimal page geometry exposed to novices (drives the PDF export + print
  // preview; still overridable by the book's own @page CSS). HTTP-only, like the
  // Paged.js pipeline it feeds.
  const isHttp = typeof location !== 'undefined' && location.protocol !== 'file:';
  const DEFAULT_PRINT: PrintSettings = {
    page_size: 'A4',
    margin: 'normal',
    page_numbers: true,
    running_header: false,
    cover_page: true,
  };
  // Human-readable label → CSS `@page size` token. Limited to sizes that are also
  // in Firefox's built-in "Save to PDF" paper list (it ignores @page size and only
  // offers a fixed set), so the chosen size is selectable there too. Notably that
  // list's A-series stops at A5 — A6 isn't offered in Firefox, so it's excluded.
  const PAGE_SIZE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'A4', label: 'A4' },
    { value: 'A5', label: 'A5' },
    { value: 'B5', label: 'B5' },
    { value: 'letter', label: 'US Letter' },
    { value: 'legal', label: 'US Legal' },
  ];

  // Advanced mode: free-form `size` / `margin` strings passed through verbatim to
  // Paged.js. Stored beside the presets (never replacing them) so switching back to
  // a preset round-trips; a non-empty custom value flips its select to "Custom".
  const customSizeActive = $derived(!!epubSettings?.print?.custom_size);
  const customMarginActive = $derived(!!epubSettings?.print?.custom_margin);

  // Picking "Custom…" seeds the field with the current preset's equivalent CSS
  // value, so the export is unchanged until the author edits it. Picking a preset
  // (or clearing the field) drops the custom value.
  function handlePageSizeChange(value: string): void {
    if (value === 'custom') {
      void updatePrint({
        custom_size: epubSettings?.print?.page_size ?? DEFAULT_PRINT.page_size,
      });
    } else {
      void updatePrint({ page_size: value, custom_size: undefined });
    }
  }

  function handleMarginChange(value: string): void {
    if (value === 'custom') {
      const preset = epubSettings?.print?.margin ?? DEFAULT_PRINT.margin;
      void updatePrint({ custom_margin: `${MARGIN_MM[preset] ?? MARGIN_MM.normal}mm` });
    } else {
      void updatePrint({
        margin: value as PrintSettings['margin'],
        custom_margin: undefined,
      });
    }
  }

  // Persist a print-settings change (optimistic save + revert). Resolves defaults
  // so a partial change always writes a fully-populated print object.
  async function updatePrint(partial: Partial<PrintSettings>): Promise<void> {
    if (!workspaceId || !epubSettings) return;
    const previous = epubSettings.print;
    const updatedSettings: EPUBSettings = {
      ...epubSettings,
      print: { ...DEFAULT_PRINT, ...epubSettings.print, ...partial },
    };
    epubSettings = updatedSettings;
    try {
      await settingsService.saveEPUBSettings(workspaceId, updatedSettings);
      onSettingsChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : $t('Failed to save EPUB settings');
      epubSettings = { ...epubSettings, print: previous };
    }
  }

  // --- Preview settings --------------------------------------------------------
  // Authoring-time preview behaviour (preview pane only; never the packaged EPUB):
  // per-type live auto-update, and per-type injection of the project's
  // preview/head.xml fragment (edited via the spine editor's file dropdown).
  const PREVIEW_TYPES: ReadonlyArray<{ key: PreviewType }> = [
    { key: 'responsive' },
    { key: 'device' },
    { key: 'pdf' },
  ];

  // Translated label for a preview type. Uses literal $t(...) per branch so the
  // i18n extractor can see the strings — a dynamic $t(variable) wouldn't be picked
  // up (and 'Device' has no other literal usage to fall back on).
  function previewTypeLabel(key: PreviewType): string {
    switch (key) {
      case 'responsive':
        return $t('Responsive');
      case 'device':
        return $t('Device');
      case 'pdf':
        return $t('PDF');
    }
  }

  // Toggle one per-type preview flag (optimistic save + revert), resolving defaults
  // so a change always writes a fully-populated preview object.
  async function setPreviewFlag(
    field: 'autoUpdate' | 'includeHead',
    key: PreviewType,
    value: boolean
  ): Promise<void> {
    if (!workspaceId || !epubSettings) return;
    const previous = epubSettings.preview;
    const base = epubSettings.preview ?? DEFAULT_PREVIEW;
    const next: PreviewSettings = {
      head: base.head,
      autoUpdate: { ...base.autoUpdate },
      includeHead: { ...base.includeHead },
    };
    next[field][key] = value;
    const updatedSettings: EPUBSettings = { ...epubSettings, preview: next };
    epubSettings = updatedSettings;
    try {
      await settingsService.saveEPUBSettings(workspaceId, updatedSettings);
      onSettingsChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : $t('Failed to save EPUB settings');
      epubSettings = { ...epubSettings, preview: previous };
    }
  }

  // ── Embedding the editor (SEED.html) into the package ──────────────────────
  const fileStorage = FileStorageAPI.getInstance();
  let seedHtmlPresent = $state(false);
  let seedHtmlBusy = $state(false);
  let seedHtmlInput = $state<HTMLInputElement | null>(null);

  // Track whether the editor build is already stored in this workspace.
  $effect(() => {
    if (!workspaceId) {
      seedHtmlPresent = false;
      return;
    }
    const id = workspaceId;
    hasSeedHtml(fileStorage, id)
      .then(present => {
        if (workspaceId === id) seedHtmlPresent = present;
      })
      .catch(() => {});
  });

  // Persist the include flag (optimistic save + revert), mirroring updatePrint.
  async function setSeedHtmlIncluded(value: boolean): Promise<void> {
    if (!workspaceId || !epubSettings) return;
    const previous = epubSettings.include_seed_html_in_package;
    const updatedSettings: EPUBSettings = {
      ...epubSettings,
      include_seed_html_in_package: value,
    };
    epubSettings = updatedSettings;
    try {
      await settingsService.saveEPUBSettings(workspaceId, updatedSettings);
      onSettingsChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : $t('Failed to save EPUB settings');
      epubSettings = { ...epubSettings, include_seed_html_in_package: previous };
    }
  }

  // Toggle: on http(s), capture the running page automatically; offline (file://),
  // fetch is blocked, so leave the flag on and let the user load the file. Off
  // removes the stored copy.
  async function toggleSeedHtml(checked: boolean): Promise<void> {
    if (!workspaceId || seedHtmlBusy) return;
    seedHtmlBusy = true;
    try {
      if (checked) {
        await setSeedHtmlIncluded(true);
        if (!seedHtmlPresent && canFetchSelfHtml()) {
          try {
            await storeSeedHtml(fileStorage, workspaceId, await fetchSelfHtml());
            seedHtmlPresent = true;
          } catch (err) {
            // Leave the flag on; the user can still load the file manually.
            error = err instanceof Error ? err.message : $t('Could not capture the editor');
          }
        }
      } else {
        await setSeedHtmlIncluded(false);
        try {
          await removeSeedHtml(fileStorage, workspaceId);
        } catch {
          // best-effort
        }
        seedHtmlPresent = false;
      }
    } finally {
      seedHtmlBusy = false;
    }
  }

  // Manual fallback: store a user-picked SEED.html (used offline, where the page
  // can't fetch its own bytes).
  async function onSeedHtmlFile(event: Event): Promise<void> {
    if (!workspaceId) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    seedHtmlBusy = true;
    try {
      await storeSeedHtml(fileStorage, workspaceId, await file.arrayBuffer());
      seedHtmlPresent = true;
      if (!(epubSettings?.include_seed_html_in_package ?? false)) {
        await setSeedHtmlIncluded(true);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : $t('Failed to save EPUB settings');
    } finally {
      seedHtmlBusy = false;
    }
  }

  // Persist a new dom_transforms order/membership (optimistic save + revert).
  async function persistDomTransforms(next: string[]): Promise<void> {
    if (!workspaceId || !epubSettings) return;

    const validation = settingsService.validateEPUBSettings({ dom_transforms: next });
    if (!validation.isValid) {
      error = validation.errors[0] || 'Invalid DOM transform list';
      return;
    }

    const previous = epubSettings.dom_transforms;
    const updatedSettings: EPUBSettings = { ...epubSettings, dom_transforms: next };
    epubSettings = updatedSettings;

    try {
      await settingsService.saveEPUBSettings(workspaceId, updatedSettings);
      onSettingsChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : $t('Failed to save EPUB settings');
      epubSettings = { ...epubSettings, dom_transforms: previous };
    }
  }

  function addDomTransform(path: string): void {
    if (!epubSettings || !path) return;
    persistDomTransforms(addTransform(epubSettings.dom_transforms, path));
  }

  function removeDomTransform(index: number): void {
    if (!epubSettings) return;
    persistDomTransforms(removeTransformAt(epubSettings.dom_transforms, index));
  }

  function moveDomTransform(index: number, dir: -1 | 1): void {
    if (!epubSettings) return;
    persistDomTransforms(moveTransform(epubSettings.dom_transforms, index, dir));
  }

  // Persist the single text_transform (optimistic save + revert).
  async function persistTextTransform(path: string): Promise<void> {
    if (!workspaceId || !epubSettings || !path) return;

    const validation = settingsService.validateEPUBSettings({ text_transform: path });
    if (!validation.isValid) {
      error = validation.errors[0] || 'Invalid text transform';
      return;
    }

    const previous = epubSettings.text_transform;
    const updatedSettings: EPUBSettings = { ...epubSettings, text_transform: path };
    epubSettings = updatedSettings;

    try {
      await settingsService.saveEPUBSettings(workspaceId, updatedSettings);
      onSettingsChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : $t('Failed to save EPUB settings');
      epubSettings = { ...epubSettings, text_transform: previous };
    }
  }

  // Handle extension removal
  async function handleExtensionRemoval(extensionName: string): Promise<void> {
    if (!workspaceId) return;

    try {
      await extensionManager.deleteWorkspaceExtension(workspaceId, extensionName);

      // Prune the removed extension's transforms from settings.json — otherwise the
      // stale dom_transforms entry lingers and the spine editor's file dropdown lists
      // it as a ghost file (re-creating it empty when selected).
      const dom = epubSettings?.dom_transforms;
      if (dom) {
        const nextDom = removeTransformsForExtension(dom, extensionName);
        if (nextDom.length !== dom.length) await persistDomTransforms(nextDom);
      }
      // If the removed extension's text transform was adopted, fall back to the default.
      if (epubSettings && extensionOf(epubSettings.text_transform) === extensionName) {
        await persistTextTransform(settingsService.getDefaultEPUBSettings().text_transform);
      }

      // Reload extensions list
      extensions = await extensionManager.listWorkspaceExtensions(workspaceId);

      // Reload extensions in transform engine
      await transformEngine.setWorkspaceExtensions(workspaceId);
    } catch (err) {
      console.error('Failed to remove extension:', err);
      error = err instanceof Error ? err.message : $t('Failed to remove extension');
    }
  }

  // Import a catalog extension into the current project, then refresh the
  // installed list, the iframe libs, and the available-transforms picker.
  let importingExtensionId = $state<string | null>(null);
  async function handleAddCatalogExtension(entry: ExtensionCatalogEntry): Promise<void> {
    if (!workspaceId || readOnly) return;
    importingExtensionId = entry.id;
    try {
      const assets = await extensionManager.importCatalogExtension(workspaceId, entry);
      await transformEngine.setWorkspaceExtensions(workspaceId);
      extensions = await extensionManager.listWorkspaceExtensions(workspaceId);
      availableTransforms = await settingsService.getAvailableTransforms(workspaceId);
      availableTextTransforms = await settingsService.getAvailableTextTransforms(workspaceId);

      // Register any EPUB assets (e.g. a CSS theme) in the manifest and re-link
      // them into existing chapters — owned by App (needs the workspace + engine).
      if (assets.length > 0) {
        await onExtensionAssets?.(assets);
      }

      // Auto-enable the extension's DOM transforms — installing an extension
      // should wire up its transforms, not leave the user to enable each by hand.
      // Appended (deduped) after the project's existing list; order is preserved.
      if (entry.domTransforms.length > 0 && epubSettings) {
        const next = entry.domTransforms.reduce(
          (list, file) => addTransform(list, `SOURCE/extensions/${entry.id}/${file}`),
          epubSettings.dom_transforms
        );
        if (next !== epubSettings.dom_transforms) {
          await persistDomTransforms(next);
        }
      }

      // Auto-adopt the extension's text transform when the project's is still the
      // untouched default — the typical "install one text extension" flow.
      const defaultText = settingsService.getDefaultEPUBSettings().text_transform;
      if (entry.textTransforms.length > 0 && epubSettings?.text_transform === defaultText) {
        await persistTextTransform(`SOURCE/extensions/${entry.id}/${entry.textTransforms[0]}`);
      } else {
        onSettingsChanged?.();
      }
    } catch (err) {
      console.error('Failed to add extension:', err);
      error = err instanceof Error ? err.message : $t('Failed to add extension');
    } finally {
      importingExtensionId = null;
    }
  }

  // Derived states. Advanced mode is a single app-level preference (the global
  // store), no longer per-workspace.
  const isAdvancedMode = $derived(advancedMode.current);
  // Extension ids already imported into the current project (dir name === id).
  const installedExtensionIds = $derived(new Set(extensions.map(e => e.name)));

  // Split the catalog by kind: text-format extensions provide a text transform
  // (a markup language like djot/markdown) — a different choice from the content
  // transforms (DOM transforms / generators). Within-group order stays as the
  // catalog order.
  const textFormatExtensions = $derived(
    availableExtensions.filter(e => e.textTransforms.length > 0)
  );
  const contentTransforms = $derived(
    availableExtensions.filter(e => e.textTransforms.length === 0)
  );

  // Content transforms are further grouped by their editorial `category` (from
  // extension.json); this array owns only the display order + labels. Anything
  // uncategorised falls into a trailing "Other" group.
  const CONTENT_CATEGORY_ORDER = ['typesetting', 'chapter-content', 'code-blocks', 'accessibility'];
  const contentCategoryGroups = $derived.by(() => {
    const labels: Record<string, string> = {
      typesetting: $t('Typesetting'),
      'chapter-content': $t('Chapter content generation'),
      'code-blocks': $t('Code block processing'),
      accessibility: $t('Accessibility features'),
    };
    const known = new Set(CONTENT_CATEGORY_ORDER);
    const groups = CONTENT_CATEGORY_ORDER.map(key => ({
      key,
      label: labels[key],
      items: contentTransforms.filter(e => e.category === key),
    })).filter(g => g.items.length > 0);
    const other = contentTransforms.filter(e => !e.category || !known.has(e.category));
    if (other.length > 0) groups.push({ key: 'other', label: $t('Other'), items: other });
    return groups;
  });

  // Per-category collapse state for the Content transforms section (independent
  // collapse, like the manifest table's group headings). Default: all expanded.
  let collapsedCategories = $state(new Set<string>());
  function toggleCategory(key: string): void {
    const next = new Set(collapsedCategories);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    collapsedCategories = next;
  }

  const canEditSettings = $derived(workspaceId !== null && workspaceSettings !== null);
  const canEditEPUBSettings = $derived(workspaceId !== null && epubSettings !== null);

  // Transforms offered by the "Add" picker, grouped by extension. Excludes the
  // text transform (never a DOM transform) and anything already in the list.
  // Matching is by path AND basename, since a default settings path can differ
  // from the actual discovered file path for the same script.
  const addableTransformGroups = $derived.by(() => {
    const listed = epubSettings?.dom_transforms ?? [];
    const usedPaths = new Set(listed);
    const usedNames = new Set(listed.map(basename));
    // Exclude every known text transform (the active text_transform, the default
    // transformText.js, and any extension's text transforms) — they're never DOM
    // transforms. Match by path AND basename (a default settings path can differ
    // from the discovered file path for the same script).
    const textPaths = new Set(availableTextTransforms.map(t => t.path));
    const textNames = new Set(availableTextTransforms.map(t => t.fileName));
    if (epubSettings?.text_transform) {
      textPaths.add(epubSettings.text_transform);
      textNames.add(basename(epubSettings.text_transform));
    }

    const groups = new Map<string, TransformOption[]>();
    for (const t of availableTransforms) {
      if (textPaths.has(t.path) || textNames.has(t.fileName)) continue; // text transform
      if (usedPaths.has(t.path) || usedNames.has(t.fileName)) continue; // already listed
      const group = transformGroup(t.path);
      const list = groups.get(group) ?? [];
      list.push(t);
      groups.set(group, list);
    }
    return [...groups.entries()].map(([group, options]) => ({ group, options }));
  });

  // Text-transform picker options grouped by extension, always including the
  // current value (so a custom/unknown text_transform path still shows).
  const textTransformGroups = $derived.by(() => {
    const options = [...availableTextTransforms];
    const current = epubSettings?.text_transform;
    if (current && !options.some(o => o.path === current)) {
      options.push({
        path: current,
        extensionName: 'Project scripts',
        fileName: basename(current),
      });
    }
    const groups = new Map<string, TransformOption[]>();
    for (const t of options) {
      const list = groups.get(t.extensionName) ?? [];
      list.push(t);
      groups.set(t.extensionName, list);
    }
    return [...groups.entries()].map(([group, opts]) => ({ group, options: opts }));
  });

  // App settings: theme (light/dark/system) and locale, backed by the global stores
  // the app already uses (the sidebar quick-toggle shares the theme store).
  const themeChoice = $derived($themeStore.isSystem ? 'system' : $themeStore.current);
  // The picker offers what the catalog sources can actually supply (embedded
  // bundle, storage cache, http manifest) — reactive, since remote availability
  // can land after init.
  const locales = $derived($availableLocales);

  function handleThemeChange(value: string): void {
    if (value === 'system') {
      themeStore.useSystemPreference();
    } else if (value === 'light' || value === 'dark') {
      themeStore.setTheme(value);
    }
  }

  async function handleLocaleChange(event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value;
    try {
      await setLocale(value);
    } catch (err) {
      error = err instanceof Error ? err.message : $t('Failed to change language');
    }
  }

  // --- Section summaries (shown in each collapsed disclosure header) ------------
  const themeSummaryLabel = $derived(
    themeChoice === 'light' ? $t('Light') : themeChoice === 'dark' ? $t('Dark') : $t('System')
  );
  const generalSummary = $derived(
    `${$t('Theme')}: ${themeSummaryLabel} · ${$t('Language')}: ${
      LOCALE_CONFIGS[$currentLocale]?.name ?? $currentLocale
    } · ${$t('Mode')}: ${isAdvancedMode ? $t('Advanced') : $t('Basic')}`
  );
  const pluginsSummary = $derived.by(() => {
    const names = availablePlugins.filter(p => enabledPluginIds.includes(p.id)).map(p => p.name);
    return names.length ? names.join(', ') : $t('None');
  });
  const textFormatsSummary = $derived($t('{n} available', { n: textFormatExtensions.length }));
  const contentTransformsSummary = $derived($t('{n} available', { n: contentTransforms.length }));
  const printSummary = $derived.by(() => {
    const p = epubSettings?.print ?? DEFAULT_PRINT;
    const size =
      p.custom_size || (PAGE_SIZE_OPTIONS.find(o => o.value === p.page_size)?.label ?? p.page_size);
    const margin =
      p.custom_margin ||
      (p.margin === 'narrow' ? $t('Narrow') : p.margin === 'wide' ? $t('Wide') : $t('Normal'));
    return `${size} · ${margin}`;
  });
  const epubSummary = $derived.by(() => {
    const tt = epubSettings?.text_transform ? transformLabel(epubSettings.text_transform).name : '';
    const n = epubSettings?.dom_transforms?.length ?? 0;
    const domLabel = n === 1 ? $t('{n} DOM transform', { n }) : $t('{n} DOM transforms', { n });
    return tt ? `${tt} · ${domLabel}` : domLabel;
  });
  const extensionsSummary = $derived($t('{n} installed', { n: extensions.length }));
  const previewSummary = $derived.by(() => {
    const au = epubSettings?.preview?.autoUpdate ?? DEFAULT_PREVIEW.autoUpdate;
    const n = PREVIEW_TYPES.filter(pt => au[pt.key]).length;
    return $t('{n}/3 auto-update', { n });
  });

  // Which section starts open in each pane (the first present one). Captured once —
  // a plain const, so it isn't reactively re-applied and yanked open later.
  const projectFirstOpen: 'print' | 'editor' = isHttp ? 'print' : 'editor';
</script>

{#snippet catalogItem(ext: ExtensionCatalogEntry)}
  {@const installed = installedExtensionIds.has(ext.id)}
  <div class="catalog-item">
    <div class="catalog-item-info">
      <span class="catalog-item-name">{ext.name}</span>
      {#if ext.description}
        <span class="catalog-item-desc">{ext.description}</span>
      {/if}
    </div>
    <button
      type="button"
      class="btn btn-secondary"
      onclick={() => handleAddCatalogExtension(ext)}
      disabled={installed || !workspaceId || readOnly || importingExtensionId !== null}
      title={readOnly
        ? $t("This EPUB is read-only, so extensions can't be added.")
        : !workspaceId
          ? $t('Open a project to add extensions')
          : undefined}
    >
      {installed
        ? $t('Added')
        : importingExtensionId === ext.id
          ? $t('Adding…')
          : $t('Add to project')}
    </button>
  </div>
{/snippet}

<div class="settings-view">
  {#if error}
    <div class="error-message" role="alert">
      <strong>{$t('Error')}:</strong>
      {error}
    </div>
  {/if}

  <!-- Shares the editor's pane key so the split proportion is one global value. -->
  <div class="settings-panes-wrap">
    <PaneGroup direction="horizontal" autoSaveId="editme-content-panes">
      <!-- App settings: global, usable without a project. -->
      <Pane defaultSize={50} minSize={25}>
        <div class="settings-pane">
          <PaneHeader>
            <span class="pane-title">{$t('App Settings')}</span>
          </PaneHeader>
          <div class="settings-pane-body">
            <SettingsSection
              title={$t('General')}
              summary={generalSummary}
              name="app-settings"
              persistKey="settings-app-general"
              open
            >
              <div class="setting-group">
                <label for="theme-select" class="setting-label-text">{$t('Theme')}</label>
                <select
                  id="theme-select"
                  class="setting-select"
                  value={themeChoice}
                  onchange={event => handleThemeChange((event.target as HTMLSelectElement).value)}
                >
                  <option value="light">{$t('Light')}</option>
                  <option value="dark">{$t('Dark')}</option>
                  <option value="system">{$t('System')}</option>
                </select>
              </div>

              <div class="setting-group">
                <label for="language-select" class="setting-label-text">{$t('Language')}</label>
                <select
                  id="language-select"
                  class="setting-select"
                  value={$currentLocale}
                  onchange={handleLocaleChange}
                >
                  {#each locales as loc (loc.code)}
                    <option value={loc.code}>{loc.name}</option>
                  {/each}
                </select>
              </div>

              <!-- Advanced mode: an app-wide preference, shown once at least one
                   project exists (create a project first, then opt in). -->
              {#if hasProjects}
                <div class="setting-group">
                  <label class="setting-label">
                    <input
                      type="checkbox"
                      checked={advancedMode.current}
                      onchange={e =>
                        (advancedMode.current = (e.currentTarget as HTMLInputElement).checked)}
                    />
                    <span class="setting-text">{$t('Advanced mode')}</span>
                  </label>
                </div>
              {/if}
            </SettingsSection>

            {#if isAdvancedMode && availablePlugins.length > 0}
              <SettingsSection
                title={$t('Plugins')}
                summary={pluginsSummary}
                name="app-settings"
                persistKey="settings-app-plugins"
              >
                {#each availablePlugins as plugin (plugin.id)}
                  <div class="setting-group">
                    <label class="setting-label">
                      <input
                        type="checkbox"
                        checked={enabledPluginIds.includes(plugin.id)}
                        onchange={event =>
                          onTogglePlugin?.(plugin.id, (event.target as HTMLInputElement).checked)}
                      />
                      <span class="setting-text">{plugin.name}</span>
                    </label>
                  </div>
                {/each}
              </SettingsSection>
            {/if}

            {#if isAdvancedMode && textFormatExtensions.length > 0}
              <SettingsSection
                title={$t('Text formats')}
                summary={textFormatsSummary}
                name="app-settings"
                persistKey="settings-app-text-formats"
              >
                <p class="setting-description">
                  {$t('Adopt a markup language for the current project.')}
                </p>
                {#each textFormatExtensions as ext (ext.id)}
                  {@render catalogItem(ext)}
                {/each}
              </SettingsSection>
            {/if}

            {#if isAdvancedMode && contentTransforms.length > 0}
              <SettingsSection
                title={$t('Content transforms')}
                summary={contentTransformsSummary}
                name="app-settings"
                persistKey="settings-app-content-transforms"
              >
                <p class="setting-description">
                  {$t('Add to the current project, then enable under Project Settings.')}
                </p>

                {#each contentCategoryGroups as group (group.key)}
                  {@const collapsed = collapsedCategories.has(group.key)}
                  <button
                    type="button"
                    class="ct-group-toggle"
                    aria-expanded={!collapsed}
                    onclick={() => toggleCategory(group.key)}
                  >
                    <span class="ct-disclosure" aria-hidden="true"><CaretRight size={14} /></span>
                    <span class="ct-group-label">{group.label}</span>
                  </button>
                  {#if !collapsed}
                    {#each group.items as ext (ext.id)}
                      {@render catalogItem(ext)}
                    {/each}
                  {/if}
                {/each}
              </SettingsSection>
            {/if}
          </div>
        </div>
      </Pane>

      <PaneResizer />

      <!-- Project settings: require an open project. -->
      <Pane defaultSize={50} minSize={20}>
        <div class="settings-pane">
          <PaneHeader>
            <span class="pane-title">{$t('Project Settings')}</span>
          </PaneHeader>
          <div class="settings-pane-body">
            {#if canEditSettings}
              <!-- Print settings: minimal page geometry for the PDF export / print
                   preview. HTTP-only (gated on the Paged.js pipeline's availability)
                   and shown to all users (not just advanced). -->
              {#if isHttp && canEditEPUBSettings}
                <SettingsSection
                  title={$t('PDF')}
                  summary={printSummary}
                  name="project-settings"
                  persistKey="settings-project-pdf"
                  open={projectFirstOpen === 'print'}
                >
                  <div class="setting-group">
                    <label for="print-page-size" class="setting-label-text">
                      {$t('Page size')}
                    </label>
                    <select
                      id="print-page-size"
                      class="setting-select"
                      value={customSizeActive
                        ? 'custom'
                        : (epubSettings?.print?.page_size ?? DEFAULT_PRINT.page_size)}
                      onchange={e =>
                        handlePageSizeChange((e.currentTarget as HTMLSelectElement).value)}
                      disabled={epubLoading}
                    >
                      {#each PAGE_SIZE_OPTIONS as opt (opt.value)}
                        <option value={opt.value}>{opt.label}</option>
                      {/each}
                      {#if isAdvancedMode || customSizeActive}
                        <option value="custom">{$t('Custom…')}</option>
                      {/if}
                    </select>
                    {#if customSizeActive}
                      <!-- i18n-ignore: literal CSS value, not prose -->
                      <input
                        id="print-page-size-custom"
                        type="text"
                        class="template-input"
                        aria-label={$t('Custom page size')}
                        value={epubSettings?.print?.custom_size ?? ''}
                        placeholder="140mm 216mm"
                        onchange={e =>
                          updatePrint({
                            custom_size:
                              (e.currentTarget as HTMLInputElement).value.trim() || undefined,
                          })}
                        disabled={epubLoading}
                      />
                      <p class="setting-description">
                        <!-- i18n-ignore: literal CSS examples, not prose -->
                        {$t('CSS @page size, e.g. "140mm 216mm" or "A4 landscape".')}
                      </p>
                    {/if}
                  </div>

                  <div class="setting-group">
                    <label for="print-margin" class="setting-label-text">
                      {$t('Margin')}
                    </label>
                    <select
                      id="print-margin"
                      class="setting-select"
                      value={customMarginActive
                        ? 'custom'
                        : (epubSettings?.print?.margin ?? DEFAULT_PRINT.margin)}
                      onchange={e =>
                        handleMarginChange((e.currentTarget as HTMLSelectElement).value)}
                      disabled={epubLoading}
                    >
                      <option value="narrow">{$t('Narrow')}</option>
                      <option value="normal">{$t('Normal')}</option>
                      <option value="wide">{$t('Wide')}</option>
                      {#if isAdvancedMode || customMarginActive}
                        <option value="custom">{$t('Custom…')}</option>
                      {/if}
                    </select>
                    {#if customMarginActive}
                      <!-- i18n-ignore: literal CSS value, not prose -->
                      <input
                        id="print-margin-custom"
                        type="text"
                        class="template-input"
                        aria-label={$t('Custom margin')}
                        value={epubSettings?.print?.custom_margin ?? ''}
                        placeholder="20mm 15mm 25mm 15mm"
                        onchange={e =>
                          updatePrint({
                            custom_margin:
                              (e.currentTarget as HTMLInputElement).value.trim() || undefined,
                          })}
                        disabled={epubLoading}
                      />
                      <p class="setting-description">
                        <!-- i18n-ignore: literal CSS example, not prose -->
                        {$t('CSS margin, e.g. "20mm 15mm 25mm 15mm".')}
                      </p>
                    {/if}
                  </div>

                  <div class="setting-group">
                    <label class="setting-label">
                      <input
                        type="checkbox"
                        checked={epubSettings?.print?.page_numbers ?? DEFAULT_PRINT.page_numbers}
                        onchange={e =>
                          updatePrint({
                            page_numbers: (e.currentTarget as HTMLInputElement).checked,
                          })}
                        disabled={epubLoading}
                      />
                      <span class="setting-text">{$t('Include page numbers')}</span>
                    </label>
                  </div>

                  <div class="setting-group">
                    <label class="setting-label">
                      <input
                        type="checkbox"
                        checked={epubSettings?.print?.running_header ??
                          DEFAULT_PRINT.running_header}
                        onchange={e =>
                          updatePrint({
                            running_header: (e.currentTarget as HTMLInputElement).checked,
                          })}
                        disabled={epubLoading}
                      />
                      <span class="setting-text">{$t('Running header')}</span>
                    </label>
                    <p class="setting-description">
                      {$t('The chapter title at the top of each page.')}
                    </p>
                  </div>

                  <div class="setting-group">
                    <label class="setting-label">
                      <input
                        type="checkbox"
                        checked={epubSettings?.print?.cover_page ?? DEFAULT_PRINT.cover_page}
                        onchange={e =>
                          updatePrint({
                            cover_page: (e.currentTarget as HTMLInputElement).checked,
                          })}
                        disabled={epubLoading}
                      />
                      <span class="setting-text">{$t('Include cover page')}</span>
                    </label>
                  </div>
                </SettingsSection>
              {/if}

              <!-- EPUB Settings -->
              {#if canEditEPUBSettings && isAdvancedMode}
                <SettingsSection
                  title={$t('EPUB Settings')}
                  summary={epubSummary}
                  name="project-settings"
                  persistKey="settings-project-epub"
                >
                  <div class="setting-group">
                    <label class="setting-label">
                      <input
                        type="checkbox"
                        checked={epubSettings?.include_seed_html_in_package ?? false}
                        onchange={e =>
                          toggleSeedHtml((e.currentTarget as HTMLInputElement).checked)}
                        disabled={epubLoading || seedHtmlBusy}
                      />
                      <span class="setting-text">{$t('Add SEED.html to package')}</span>
                    </label>
                    <p class="setting-description">
                      {$t('Embed the editor in the EPUB so the book can be reopened and edited.')}
                    </p>
                    {#if (epubSettings?.include_seed_html_in_package ?? false) && !seedHtmlPresent}
                      <div class="seed-html-load">
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          onclick={() => seedHtmlInput?.click()}
                          disabled={seedHtmlBusy}
                        >
                          {seedHtmlBusy ? $t('Loading…') : $t('Load SEED.html…')}
                        </button>
                        <span class="setting-description">
                          {$t('Choose the SEED.html file to embed.')}
                        </span>
                        <input
                          bind:this={seedHtmlInput}
                          type="file"
                          accept=".html,text/html"
                          style="display: none"
                          onchange={onSeedHtmlFile}
                        />
                      </div>
                    {/if}
                  </div>

                  <div class="setting-group">
                    <label for="filename-template" class="setting-label-text">
                      {$t('Packaged Filename')}
                    </label>
                    <!-- i18n-ignore: literal token/format pattern, not prose -->
                    <input
                      id="filename-template"
                      type="text"
                      class="template-input"
                      value={epubSettings?.filename_template || ''}
                      placeholder="&lt;title&gt; - &lt;author&gt; - &lt;date&gt;"
                      onblur={handleFilenameTemplateChange}
                      disabled={epubLoading}
                    />
                    <p class="setting-description">
                      {$t('Placeholders: <title>, <author>, <date>.')}
                    </p>
                  </div>

                  <div class="setting-group">
                    <label for="audio-clip-template" class="setting-label-text">
                      {$t('Audio Clip Directive')}
                    </label>
                    <!-- i18n-ignore: literal directive template, not prose -->
                    <input
                      id="audio-clip-template"
                      type="text"
                      class="template-input"
                      value={epubSettings?.audio_clip_template || ''}
                      placeholder=":clip[&lt;label&gt;]{'{'}src=&lt;href&gt; begin=&lt;begin&gt; end=&lt;end&gt;{'}'}"
                      onblur={handleAudioClipTemplateChange}
                      disabled={epubLoading}
                    />
                    <p class="setting-description">
                      {$t(
                        'Placeholders: <href>, <begin>, <end> required; <label>, <rate> optional.'
                      )}
                    </p>
                  </div>

                  <div class="setting-group">
                    <label for="image-template" class="setting-label-text">
                      {$t('Image Insertion')}
                    </label>
                    <!-- i18n-ignore: literal template, not prose -->
                    <input
                      id="image-template"
                      type="text"
                      class="template-input"
                      value={epubSettings?.image_template || ''}
                      placeholder="![&lt;alt&gt;](&lt;href&gt;)"
                      onblur={e => handleMediaTemplateChange('image_template', e)}
                      disabled={epubLoading}
                    />
                    <p class="setting-description">
                      {$t('Placeholders: <href>, <alt>.')}
                    </p>
                  </div>

                  <div class="setting-group">
                    <label for="video-template" class="setting-label-text">
                      {$t('Video Insertion')}
                    </label>
                    <!-- i18n-ignore: literal template, not prose -->
                    <input
                      id="video-template"
                      type="text"
                      class="template-input"
                      value={epubSettings?.video_template || ''}
                      placeholder="&lt;video src=&quot;&lt;href&gt;&quot; controls=&quot;controls&quot;&gt;&lt;/video&gt;"
                      onblur={e => handleMediaTemplateChange('video_template', e)}
                      disabled={epubLoading}
                    />
                    <p class="setting-description">
                      {$t('Placeholder: <href>.')}
                    </p>
                  </div>

                  <!-- The transform pipeline (text + DOM). Wrapped as one unit;
                       also the clip target for the manual's EPUB-settings shot. -->
                  <div class="transform-pipeline-settings">
                    <div class="setting-group">
                      <label for="text-transform" class="setting-label-text">
                        {$t('Text Transform')}
                      </label>
                      <select
                        id="text-transform"
                        class="setting-select"
                        value={epubSettings?.text_transform ?? ''}
                        onchange={e =>
                          persistTextTransform((e.currentTarget as HTMLSelectElement).value)}
                        disabled={epubLoading}
                      >
                        {#each textTransformGroups as grp (grp.group)}
                          <optgroup label={grp.group}>
                            {#each grp.options as opt (opt.path)}
                              <option value={opt.path}>{opt.fileName}</option>
                            {/each}
                          </optgroup>
                        {/each}
                      </select>
                      <p class="setting-description">
                        {$t('The plain text → XHTML step.')}
                      </p>
                    </div>

                    <div class="setting-group">
                      <span class="setting-label-text">{$t('DOM Transforms')}</span>
                      <p class="setting-description">
                        {$t('Run top-to-bottom over the generated DOM.')}
                      </p>

                      {#if (epubSettings?.dom_transforms?.length ?? 0) === 0}
                        <p class="setting-description">{$t('No DOM transforms configured.')}</p>
                      {:else}
                        <ul class="dom-transform-list">
                          {#each epubSettings?.dom_transforms ?? [] as path, i (path)}
                            {@const label = transformLabel(path)}
                            <li class="dom-transform-row">
                              <span class="dom-transform-name" title={path}>
                                {label.name}
                                {#if label.group}
                                  <span class="dom-transform-group">({label.group})</span>
                                {/if}
                              </span>
                              <div class="dom-transform-actions">
                                <button
                                  type="button"
                                  class="btn btn-icon"
                                  onclick={() => moveDomTransform(i, -1)}
                                  disabled={i === 0 || epubLoading}
                                  aria-label={$t('Move up')}
                                  title={$t('Move up')}
                                >
                                  <CaretUp size={14} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  class="btn btn-icon"
                                  onclick={() => moveDomTransform(i, 1)}
                                  disabled={i === (epubSettings?.dom_transforms.length ?? 0) - 1 ||
                                    epubLoading}
                                  aria-label={$t('Move down')}
                                  title={$t('Move down')}
                                >
                                  <CaretDown size={14} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  class="btn btn-icon"
                                  onclick={() => removeDomTransform(i)}
                                  disabled={epubLoading}
                                  aria-label={$t('Remove')}
                                  title={$t('Remove')}
                                >
                                  <X size={14} aria-hidden="true" />
                                </button>
                              </div>
                            </li>
                          {/each}
                        </ul>
                      {/if}

                      {#if addableTransformGroups.length > 0}
                        <select
                          class="setting-select"
                          aria-label={$t('Add a DOM transform')}
                          disabled={epubLoading}
                          onchange={e => {
                            const sel = e.currentTarget as HTMLSelectElement;
                            const value = sel.value;
                            sel.value = '';
                            if (value) addDomTransform(value);
                          }}
                        >
                          <option value="" disabled selected>{$t('Add a DOM transform…')}</option>
                          {#each addableTransformGroups as grp (grp.group)}
                            <optgroup label={grp.group}>
                              {#each grp.options as opt (opt.path)}
                                <option value={opt.path}>{opt.fileName}</option>
                              {/each}
                            </optgroup>
                          {/each}
                        </select>
                      {/if}
                    </div>
                  </div>
                </SettingsSection>
              {/if}

              <!-- Preview -->
              {#if canEditEPUBSettings && isAdvancedMode}
                <SettingsSection
                  title={$t('Preview')}
                  summary={previewSummary}
                  name="project-settings"
                  persistKey="settings-project-preview"
                >
                  <div class="setting-group">
                    <span class="setting-label-text">{$t('Auto Update')}</span>
                    <p class="setting-description">
                      {$t('Re-render the preview live as you edit.')}
                    </p>
                    {#each PREVIEW_TYPES as pt (pt.key)}
                      <label class="setting-label">
                        <input
                          type="checkbox"
                          checked={epubSettings?.preview?.autoUpdate?.[pt.key] ??
                            DEFAULT_PREVIEW.autoUpdate[pt.key]}
                          onchange={e =>
                            setPreviewFlag(
                              'autoUpdate',
                              pt.key,
                              (e.currentTarget as HTMLInputElement).checked
                            )}
                          disabled={epubLoading}
                        />
                        <span class="setting-text">{previewTypeLabel(pt.key)}</span>
                      </label>
                    {/each}
                  </div>

                  <div class="setting-group">
                    <span class="setting-label-text">{$t('Include preview head')}</span>
                    <p class="setting-description">
                      {$t(
                        'Inject preview/head.xml into the preview, per preview type. Never exported.'
                      )}
                    </p>
                    {#each PREVIEW_TYPES as pt (pt.key)}
                      <label class="setting-label">
                        <input
                          type="checkbox"
                          checked={epubSettings?.preview?.includeHead?.[pt.key] ??
                            DEFAULT_PREVIEW.includeHead[pt.key]}
                          onchange={e =>
                            setPreviewFlag(
                              'includeHead',
                              pt.key,
                              (e.currentTarget as HTMLInputElement).checked
                            )}
                          disabled={epubLoading}
                        />
                        <span class="setting-text">{previewTypeLabel(pt.key)}</span>
                      </label>
                    {/each}
                  </div>
                </SettingsSection>
              {/if}

              <!-- Track changes (review mode) -->
              {#if canEditEPUBSettings && isAdvancedMode}
                <TrackChangesPanel
                  {workspaceId}
                  {workspace}
                  {settingsService}
                  enabled={epubSettings?.track_changes ?? false}
                  onChanged={onSettingsChanged}
                  onApply={onApplyPatchset}
                />
              {/if}

              {#if isAdvancedMode}
                <!-- Extension Management -->
                <SettingsSection
                  title={$t('Extensions')}
                  summary={extensionsSummary}
                  name="project-settings"
                  persistKey="settings-project-extensions"
                >
                  <!-- Import Extension -->
                  <div class="extension-import" class:disabled={!isAdvancedMode}>
                    <label for="extension-file">
                      {$t('Import JavaScript Extension')}: {$t(
                        "Copy the library's license text into the License field below."
                      )}
                    </label>
                    <input
                      id="extension-file"
                      type="file"
                      accept=".js"
                      onchange={handleExtensionImport}
                      disabled={extensionsLoading}
                    />
                    {#if !isAdvancedMode}
                      <p class="advanced-mode-note">
                        {$t('Advanced Mode required for extension management')}
                      </p>
                    {/if}
                  </div>

                  <!-- Extensions List -->
                  {#if extensionsLoading}
                    <p>{$t('Loading extensions...')}</p>
                  {:else if extensions.length === 0}
                    <p>{$t('No extensions installed.')}</p>
                  {:else}
                    <ul class="extensions-list">
                      {#each extensions as extension}
                        {#if workspaceId}
                          <ExtensionItem
                            {extension}
                            {workspaceId}
                            {isAdvancedMode}
                            {extensionManager}
                            onRemove={() => handleExtensionRemoval(extension.name)}
                          />
                        {/if}
                      {/each}
                    </ul>
                  {/if}
                </SettingsSection>

                <!-- Generator Management -->
                {#if workspaceId}
                  <GeneratorSettings
                    {workspaceId}
                    {isAdvancedMode}
                    group="project-settings"
                    onChanged={() => onSettingsChanged?.()}
                  />
                {/if}
              {/if}
            {:else if loading}
              <p class="loading-message">{$t('Loading settings…')}</p>
            {:else}
              <p class="no-workspace-message">{$t('Open a project to configure its settings.')}</p>
            {/if}
          </div>
        </div>
      </Pane>
    </PaneGroup>
  </div>
</div>

<style>
  .settings-view {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  .settings-panes-wrap {
    flex: 1;
    min-height: 0;
  }

  .settings-pane {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .settings-pane-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .pane-title {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .no-workspace-message,
  .loading-message {
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .error-message {
    background: var(--color-error-bg);
    color: var(--color-error-text);
    padding: 0.75rem;
    border-radius: 0.25rem;
    border: 1px solid var(--color-border-error);
    margin: 1rem;
  }

  .setting-group {
    margin-bottom: 1rem;
  }

  .setting-label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    cursor: pointer;
  }

  .setting-label input[type='checkbox'] {
    margin-top: 0.125rem;
    cursor: pointer;
  }

  .setting-text {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .setting-description {
    margin: 0.5rem 0 0 1.75rem;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  /* Manual "Load SEED.html…" fallback row (offline, where fetch is blocked). */
  .seed-html-load {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: var(--space-2) 0 0 1.75rem;
  }

  .seed-html-load .setting-description {
    margin: 0;
  }

  .setting-label-text {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .setting-select {
    width: 100%;
    max-width: 320px;
    padding: 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: 0.25rem;
    background: var(--color-input-bg);
    color: var(--color-text-primary);
    font-size: 0.875rem;
  }

  .setting-select:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
  }

  .template-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: 0.25rem;
    font-family: var(--font-mono, 'Monaco', 'Menlo', 'Ubuntu Mono', monospace);
    font-size: 0.875rem;
    background: var(--color-input-bg);
    color: var(--color-text-primary);
  }

  .template-input:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
  }

  .template-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--color-surface-disabled);
  }

  /* Available-extensions catalog: group subheadings (Text formats / Libraries) */
  /* Content-transform sub-group headers — mirrors the manifest table's collapsible
     group headings (ManifestTable .group-heading / .group-toggle). */
  .ct-group-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-secondary);
    border: none;
    border-top: 1px solid var(--color-border-default);
    border-bottom: 1px solid var(--color-border-strong);
    cursor: pointer;
    text-align: start;
    color: inherit;
  }

  .ct-group-toggle:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .ct-disclosure {
    display: inline-flex;
    align-items: center;
    color: var(--color-text-secondary);
    transition: transform 0.15s ease;
  }

  .ct-group-toggle[aria-expanded='true'] .ct-disclosure {
    transform: rotate(90deg);
  }

  .ct-group-label {
    font-size: 0.8125rem;
    line-height: 1;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
  }

  /* Available-extensions catalog rows */
  .catalog-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-top: 1px solid var(--color-border-default);
  }

  .catalog-item-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .catalog-item-name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .catalog-item-desc {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  /* DOM transform list (ordered pipeline editor) */
  .dom-transform-list {
    list-style: none;
    margin: 0 0 0.5rem 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .dom-transform-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-surface-primary);
  }

  .dom-transform-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }

  .dom-transform-group {
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }

  .dom-transform-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .extension-import {
    margin-bottom: 1.5rem;
  }

  .extension-import label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .extension-import input[type='file'] {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .extension-import input[type='file']:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .extension-import.disabled {
    /* No opacity dimming — it drags the note text below AA contrast in dark mode.
       The italic muted note + pointer-events convey the disabled state. */
    pointer-events: none;
  }

  .advanced-mode-note {
    font-size: var(--text-sm);
    color: var(--color-text-tertiary);
    font-style: italic;
    margin-top: var(--space-2);
    margin-bottom: 0;
  }

  .extensions-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  /* Focus styles for accessibility */
  .setting-label:focus-within .setting-text {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  input[type='checkbox']:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
</style>
