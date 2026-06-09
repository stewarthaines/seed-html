<script lang="ts">
  import type {
    SettingsService,
    WorkspaceSettings,
    EPUBSettings,
    TransformOption,
  } from '../../services/settings/settings.service.js';
  import type { ExtensionInfo } from '../../extensions/types.js';

  import type { ExtensionManager } from '../../extensions/extension-manager.js';
  import type { TransformEngine } from '../../infrastructure/transform-engine.js';
  import ExtensionItem from '../../components/extensions/ExtensionItem.svelte';
  import PaneHeader from '../../components/layout/PaneHeader.svelte';
  import {
    addTransform,
    removeTransformAt,
    moveTransform,
    transformLabel,
    transformGroup,
    basename,
  } from '../../settings/dom-transforms.js';
  import { CaretUp, CaretDown, X } from 'phosphor-svelte';
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { t, currentLocale, setLocale } from '../../i18n';
  import { LOCALE_CONFIGS } from '../../i18n/locale-config.js';
  import { themeStore } from '../../stores/theme.js';
  import type { PluginManifestEntry } from '../../plugins/contract';
  import type { ExtensionCatalogEntry } from '../../extensions/extension-catalog';

  interface Props {
    settingsService: SettingsService;
    extensionManager: ExtensionManager;
    transformEngine: TransformEngine;
    workspaceId: string | null;
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
    onSettingsChanged?: () => void;
  }

  const {
    settingsService,
    extensionManager,
    transformEngine,
    workspaceId,
    availablePlugins = [],
    enabledPluginIds = [],
    availableExtensions = [],
    onTogglePlugin,
    onExtensionAssets,
    readOnly = false,
    onSettingsChanged,
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

  // Handle advanced mode toggle
  async function handleAdvancedModeChange(event: Event): Promise<void> {
    if (!workspaceId || !workspaceSettings || readOnly) return;

    const target = event.target as HTMLInputElement;
    const newAdvancedMode = target.checked;

    // Optimistic update
    const updatedSettings: WorkspaceSettings = {
      ...workspaceSettings,
      editor: {
        preview_delay_ms: workspaceSettings.editor?.preview_delay_ms ?? 500,
        advanced_mode: newAdvancedMode,
      },
    };

    workspaceSettings = updatedSettings;

    try {
      await settingsService.saveWorkspaceSettings(workspaceId, updatedSettings);
      // Notify parent that settings have changed
      onSettingsChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : $t('Failed to save settings');
      // Revert optimistic update
      workspaceSettings = {
        ...workspaceSettings,
        editor: {
          preview_delay_ms: workspaceSettings.editor?.preview_delay_ms ?? 500,
          advanced_mode: !newAdvancedMode,
        },
      };
    }
  }

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

  // Handle audio clip template change
  async function handleAudioTemplateChange(event: Event): Promise<void> {
    if (!workspaceId || !epubSettings) return;

    const target = event.target as HTMLInputElement;
    const newTemplate = target.value;

    // Validate template
    const validation = settingsService.validateEPUBSettings({ audio_clip_template: newTemplate });
    if (!validation.isValid) {
      error = validation.errors[0] || 'Invalid template format';
      return;
    }

    // Optimistic update
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
      // Revert optimistic update
      epubSettings = {
        ...epubSettings,
        audio_clip_template: epubSettings.audio_clip_template,
      };
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

  // Derived states
  const isAdvancedMode = $derived(workspaceSettings?.editor?.advanced_mode ?? false);
  // Extension ids already imported into the current project (dir name === id).
  const installedExtensionIds = $derived(new Set(extensions.map(e => e.name)));

  // Split the catalog by kind: text-format extensions (they provide a text
  // transform — a markup language like djot/markdown) are a different choice
  // from library/DOM ones, so they're grouped and listed first. Within-group
  // order stays as the catalog order.
  const textFormatExtensions = $derived(
    availableExtensions.filter(e => e.textTransforms.length > 0)
  );
  const libraryExtensions = $derived(
    availableExtensions.filter(e => e.textTransforms.length === 0)
  );
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
  const locales = Object.values(LOCALE_CONFIGS);

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
</script>

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
            <section>
              <h3>{$t('General')}</h3>
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
            </section>

            {#if availablePlugins.length > 0}
              <section class="plugins-settings">
                <h3>{$t('Plugins')}</h3>
                <p class="setting-description plugins-intro">
                  {$t('Optional features available when the app is served over HTTP.')}
                </p>
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
              </section>
            {/if}

            {#if availableExtensions.length > 0}
              <section class="extensions-catalog">
                <h3>{$t('Available Extensions')}</h3>
                <p class="setting-description">
                  {$t(
                    'Add a library and its suggested DOM transform to the current project; then enable the transform under Project Settings.'
                  )}
                </p>
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
                      disabled={installed ||
                        !workspaceId ||
                        readOnly ||
                        importingExtensionId !== null}
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

                {#if textFormatExtensions.length > 0}
                  <h4 class="catalog-subhead">{$t('Text formats')}</h4>
                  {#each textFormatExtensions as ext (ext.id)}
                    {@render catalogItem(ext)}
                  {/each}
                {/if}
                {#if libraryExtensions.length > 0}
                  <h4 class="catalog-subhead">{$t('Libraries')}</h4>
                  {#each libraryExtensions as ext (ext.id)}
                    {@render catalogItem(ext)}
                  {/each}
                {/if}
              </section>
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
              <section class="workspace-settings">
                <h3>{$t('Editor')}</h3>

                <div class="setting-group">
                  <label class="setting-label">
                    <input
                      type="checkbox"
                      checked={isAdvancedMode}
                      onchange={handleAdvancedModeChange}
                      disabled={loading || readOnly}
                    />
                    <span class="setting-text">{$t('Advanced Mode')}</span>
                  </label>
                  <p class="setting-description">
                    {$t(
                      'Enable advanced editing features and additional controls for power users.'
                    )}
                  </p>
                </div>
              </section>

              <!-- EPUB Settings -->
              {#if canEditEPUBSettings && isAdvancedMode}
                <section class="epub-settings">
                  <h3>{$t('EPUB Settings')}</h3>

                  <div class="setting-group">
                    <label for="filename-template" class="setting-label-text">
                      {$t('Packaged Filename')}
                    </label>
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
                      Template for the exported .epub filename. Use placeholders: &lt;title&gt;,
                      &lt;author&gt;, &lt;date&gt;. Empty placeholders (e.g. no author) collapse
                      cleanly.
                    </p>
                  </div>

                  <div class="setting-group">
                    <label for="audio-clip-template" class="setting-label-text">
                      {$t('Audio Clip Template')}
                    </label>
                    <input
                      id="audio-clip-template"
                      type="text"
                      class="template-input"
                      value={epubSettings?.audio_clip_template || ''}
                      placeholder=":clip[label]&#123;src=href begin=begin end=end&#125;"
                      onblur={handleAudioTemplateChange}
                      disabled={epubLoading}
                    />
                    <p class="setting-description">
                      Template for inserting audio clip directives. Use placeholders: &lt;href&gt;,
                      &lt;begin&gt;, &lt;end&gt;, &lt;label&gt;, &lt;rate&gt;
                    </p>
                  </div>

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
                      {$t(
                        'The single plain-text → XHTML step. Pick a project script or one supplied by an extension.'
                      )}
                    </p>
                  </div>

                  <div class="setting-group">
                    <span class="setting-label-text">{$t('DOM Transforms')}</span>
                    <p class="setting-description">
                      {$t(
                        'Scripts run top-to-bottom over the generated DOM, each applied to the previous one’s output.'
                      )}
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
                                class="icon-btn"
                                onclick={() => moveDomTransform(i, -1)}
                                disabled={i === 0 || epubLoading}
                                aria-label={$t('Move up')}
                                title={$t('Move up')}
                              >
                                <CaretUp size={14} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                class="icon-btn"
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
                                class="icon-btn"
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
                </section>
              {/if}

              <!-- Extension Management -->
              <section class="extensions-settings">
                <h3>{$t('Extensions')}</h3>

                <!-- Import Extension -->
                <div class="extension-import" class:disabled={!isAdvancedMode}>
                  <label for="extension-file">
                    {$t('Import JavaScript Extension')}: {$t(
                      'Please copy license text into the License field below to comply with open source requirements.'
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
              </section>
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

  section {
    border: 1px solid var(--color-border-default);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.05rem;
    font-weight: 500;
    color: var(--color-text-primary);
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
  .catalog-subhead {
    margin: var(--space-4) 0 var(--space-1) 0;
    padding-bottom: var(--space-1);
    border-bottom: 1px solid var(--color-border-subtle);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
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

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-surface-primary);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .icon-btn:not(:disabled):hover {
    border-color: var(--color-border-hover);
    background: var(--color-surface-hover);
    color: var(--color-text-primary);
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
