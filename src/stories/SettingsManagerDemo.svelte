<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { DefaultSettingsManager } from '../lib/settings/settings-manager.js';
  import { FileStorageAPI } from '../lib/storage/index.js';
  import { ExtensionManager } from '../lib/extensions/index.js';
  import type {
    GlobalSettings,
    WorkspaceSettings,
    EPUBSettings,
    TransformOption,
  } from '../lib/settings/index.js';
  import { themeStore } from '../lib/stores/theme.js';
  import { currentLocale, documentDirection } from '../lib/i18n/index.js';
  import './settings-manager-demo.css';

  interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'action';
    message: string;
  }

  // Core instances
  let settingsManager: DefaultSettingsManager;
  let fileStorage: FileStorageAPI;
  let extensionManager: ExtensionManager;

  // State
  let logs: LogEntry[] = [];
  let isLoading = false;
  let currentWorkspace: string | null = null;
  let isInitialized = false;

  // Settings state
  let globalSettings: GlobalSettings | null = null;
  let workspaceSettings: WorkspaceSettings | null = null;
  let epubSettings: EPUBSettings | null = null;
  let availableTransforms: TransformOption[] = [];

  // Theme and locale subscriptions
  let currentTheme: string = 'system';
  let currentLoc: string = 'en';
  let currentDirection: string = 'ltr';

  // Reactive subscriptions
  const unsubscribeTheme = themeStore.subscribe(theme => {
    currentTheme = theme.current;
  });

  const unsubscribeLocale = currentLocale.subscribe(locale => {
    currentLoc = locale;
  });

  const unsubscribeDirection = documentDirection.subscribe(direction => {
    currentDirection = direction;
  });

  onMount(async () => {
    try {
      addLog('action', 'Initializing Settings Manager Demo...');

      // Initialize file storage
      fileStorage = FileStorageAPI.getInstance();
      await fileStorage.init();
      addLog('success', `File storage initialized with ${fileStorage.getBackendType()} backend`);

      // Initialize extension manager
      extensionManager = new ExtensionManager(fileStorage);
      addLog('success', 'Extension manager initialized');

      // Initialize settings manager
      settingsManager = new DefaultSettingsManager(fileStorage, extensionManager);
      addLog('success', 'Settings manager initialized');

      // Load initial settings
      await loadAllSettings();

      isInitialized = true;
      addLog('success', 'Demo initialization complete');
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  onDestroy(() => {
    unsubscribeTheme();
    unsubscribeLocale();
    unsubscribeDirection();
  });

  function addLog(type: LogEntry['type'], message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, { timestamp, type, message }];
  }

  function clearLogs() {
    logs = [];
  }

  async function loadAllSettings() {
    if (!settingsManager) return;

    try {
      // Load global settings
      globalSettings = settingsManager.loadGlobalSettings();
      addLog('info', 'Global settings loaded');

      // Load workspace settings if workspace exists
      if (currentWorkspace) {
        workspaceSettings = await settingsManager.loadWorkspaceSettings(currentWorkspace);
        epubSettings = await settingsManager.loadEPUBSettings(currentWorkspace);
        availableTransforms = await settingsManager.getAvailableTransforms(currentWorkspace);
        addLog('info', `Workspace settings loaded for ${currentWorkspace}`);
      }
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to load settings: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async function createWorkspace() {
    if (!fileStorage || isLoading) return;
    isLoading = true;
    addLog('action', 'Creating demo workspace...');

    try {
      const workspaceId = await fileStorage.createWorkspace();
      currentWorkspace = workspaceId;
      addLog('success', `Created workspace: ${workspaceId}`);

      // Load workspace-specific settings
      await loadAllSettings();
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to create workspace: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      isLoading = false;
    }
  }

  async function demonstrateGlobalSettings() {
    if (!settingsManager || isLoading) return;
    isLoading = true;
    addLog('action', 'Demonstrating global settings...');

    try {
      // Cycle through different themes
      const themes: GlobalSettings['theme'][] = ['light', 'dark', 'system'];
      const locales = ['en', 'de', 'he', 'ja'];
      const fontSizes = [12, 16, 20];

      for (let i = 0; i < 3; i++) {
        const newSettings: GlobalSettings = {
          theme: themes[i % themes.length],
          locale: locales[i % locales.length],
          editor_font_size: fontSizes[i % fontSizes.length],
        };

        settingsManager.saveGlobalSettings(newSettings);
        globalSettings = settingsManager.loadGlobalSettings();

        addLog(
          'success',
          `Applied global settings: theme=${newSettings.theme}, locale=${newSettings.locale}, fontSize=${newSettings.editor_font_size}px`
        );

        // Wait for theme/locale changes to take effect
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to demonstrate global settings: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      isLoading = false;
    }
  }

  async function demonstrateWorkspaceSettings() {
    if (!settingsManager || !currentWorkspace || isLoading) return;
    isLoading = true;
    addLog('action', 'Demonstrating workspace settings...');

    try {
      // Advanced mode settings
      const advancedSettings: WorkspaceSettings = {
        bust_cache: true,
        draft_id: 5,
        editor: {
          advanced_mode: true,
          preview_delay_ms: 1500,
        },
      };

      await settingsManager.saveWorkspaceSettings(currentWorkspace, advancedSettings);
      workspaceSettings = await settingsManager.loadWorkspaceSettings(currentWorkspace);
      addLog('success', 'Applied advanced workspace settings');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Minimal settings
      const minimalSettings: WorkspaceSettings = {
        bust_cache: false,
        draft_id: 0,
      };

      await settingsManager.saveWorkspaceSettings(currentWorkspace, minimalSettings);
      workspaceSettings = await settingsManager.loadWorkspaceSettings(currentWorkspace);
      addLog('success', 'Applied minimal workspace settings');
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to demonstrate workspace settings: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      isLoading = false;
    }
  }

  async function demonstrateEPUBSettings() {
    if (!settingsManager || !currentWorkspace || isLoading) return;
    isLoading = true;
    addLog('action', 'Demonstrating EPUB settings...');

    try {
      const epubSettingsDemo: EPUBSettings = {
        text_transform: 'SOURCE/scripts/transform.js',
        dom_transforms: [
          'SOURCE/extensions/markdown-it/transform.js',
          'SOURCE/extensions/highlight-js/highlight.min.js',
        ],
        spine_basename: 'chapter',
        cover: {
          template: 'elegant',
          background_color: '#f8f9fa',
          text_color: '#212529',
          font_family: 'sans-serif',
        },
      };

      await settingsManager.saveEPUBSettings(currentWorkspace, epubSettingsDemo);
      epubSettings = await settingsManager.loadEPUBSettings(currentWorkspace);
      addLog('success', 'Applied EPUB settings with multiple transforms');

      // Get available transforms
      availableTransforms = await settingsManager.getAvailableTransforms(currentWorkspace);
      addLog('info', `Found ${availableTransforms.length} available transform scripts`);
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to demonstrate EPUB settings: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      isLoading = false;
    }
  }

  async function demonstrateDraftMode() {
    if (!settingsManager || !currentWorkspace || isLoading) return;
    isLoading = true;
    addLog('action', 'Demonstrating draft mode workflow...');

    try {
      // Enable draft mode
      const draftSettings: WorkspaceSettings = {
        bust_cache: true,
        draft_id: 0,
        editor: {
          advanced_mode: true,
          preview_delay_ms: 750,
        },
      };

      await settingsManager.saveWorkspaceSettings(currentWorkspace, draftSettings);
      addLog('success', 'Enabled draft mode');

      // Increment draft ID multiple times
      for (let i = 0; i < 3; i++) {
        const newDraftId = await settingsManager.incrementDraftId(currentWorkspace);
        const draftTitle = settingsManager.generateDraftTitle('My EPUB Book', newDraftId);
        addLog('info', `Created draft ${newDraftId}: "${draftTitle}"`);

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Demonstrate title extraction
      const testTitle = 'Advanced JavaScript Guide 7';
      const extracted = settingsManager.extractDraftInfo(testTitle);
      addLog(
        'info',
        `Extracted from "${testTitle}": base="${extracted.baseTitle}", draftId=${extracted.draftId}`
      );

      // Reload workspace settings to show final state
      workspaceSettings = await settingsManager.loadWorkspaceSettings(currentWorkspace);
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to demonstrate draft mode: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      isLoading = false;
    }
  }

  async function demonstrateValidation() {
    if (!settingsManager || isLoading) return;
    isLoading = true;
    addLog('action', 'Demonstrating validation...');

    try {
      // Test invalid global settings
      const invalidGlobal = settingsManager.validateGlobalSettings({
        theme: 'purple' as any,
        locale: 'invalid-locale',
        editor_font_size: 100,
      });
      addLog('error', `Global validation errors: ${invalidGlobal.errors.join(', ')}`);

      // Test invalid workspace settings
      const invalidWorkspace = settingsManager.validateWorkspaceSettings({
        bust_cache: 'yes' as any,
        draft_id: -5,
        editor: {
          preview_delay_ms: 50,
          advanced_mode: 'true' as any,
        },
      });
      addLog('error', `Workspace validation errors: ${invalidWorkspace.errors.join(', ')}`);

      // Test invalid EPUB settings
      const invalidEPUB = settingsManager.validateEPUBSettings({
        text_transform: '../malicious.js',
        spine_basename: 'bad name!',
        cover: {
          template: '',
          background_color: 'red',
          text_color: '#xyz',
        },
      });
      addLog('error', `EPUB validation errors: ${invalidEPUB.errors.join(', ')}`);

      // Test valid settings
      const validGlobal = settingsManager.validateGlobalSettings({
        theme: 'dark',
        locale: 'en',
        editor_font_size: 14,
      });
      addLog('success', `Valid global settings: ${validGlobal.isValid ? 'PASSED' : 'FAILED'}`);
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to demonstrate validation: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      isLoading = false;
    }
  }

  async function resetDemo() {
    if (isLoading) return;
    isLoading = true;
    addLog('action', 'Resetting demo...');

    try {
      // Reset to default global settings
      if (settingsManager) {
        const defaults = settingsManager.getDefaultGlobalSettings();
        settingsManager.saveGlobalSettings(defaults);
        globalSettings = defaults;
      }

      // Clear workspace
      currentWorkspace = null;
      workspaceSettings = null;
      epubSettings = null;
      availableTransforms = [];

      addLog('success', 'Demo reset complete');
    } catch (error: unknown) {
      addLog(
        'error',
        `Failed to reset demo: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      isLoading = false;
    }
  }

  // Helper function to format JSON for display
  function formatJSON(obj: any): string {
    if (!obj) return 'null';
    return JSON.stringify(obj, null, 2);
  }
</script>

<div class="settings-demo">
  <div class="demo-header">
    <h1>🔧 Settings Manager Demo</h1>
    <p>Interactive demonstration of three-tier settings management with live browser integration</p>
  </div>

  <!-- Control Panel -->
  <div class="control-panel">
    <div class="control-section">
      <h3>🚀 Setup</h3>
      <div class="button-group">
        <button
          class="demo-button primary"
          on:click={createWorkspace}
          disabled={isLoading || !isInitialized}
        >
          Create Demo Workspace
        </button>
        <button
          class="demo-button"
          on:click={loadAllSettings}
          disabled={isLoading || !isInitialized}
        >
          Refresh Settings
        </button>
      </div>
    </div>

    <div class="control-section">
      <h3>🌍 Global Settings</h3>
      <div class="button-group">
        <button
          class="demo-button success"
          on:click={demonstrateGlobalSettings}
          disabled={isLoading || !isInitialized}
        >
          Demo Theme & Locale
        </button>
      </div>
    </div>

    <div class="control-section">
      <h3>📁 Workspace Settings</h3>
      <div class="button-group">
        <button
          class="demo-button success"
          on:click={demonstrateWorkspaceSettings}
          disabled={isLoading || !currentWorkspace}
        >
          Demo Editor Settings
        </button>
        <button
          class="demo-button warning"
          on:click={demonstrateDraftMode}
          disabled={isLoading || !currentWorkspace}
        >
          Demo Draft Mode
        </button>
      </div>
    </div>

    <div class="control-section">
      <h3>📖 EPUB Settings</h3>
      <div class="button-group">
        <button
          class="demo-button success"
          on:click={demonstrateEPUBSettings}
          disabled={isLoading || !currentWorkspace}
        >
          Demo Transform Scripts
        </button>
        <button
          class="demo-button warning"
          on:click={demonstrateValidation}
          disabled={isLoading || !isInitialized}
        >
          Demo Validation
        </button>
      </div>
    </div>

    <div class="control-section">
      <h3>🔄 Controls</h3>
      <div class="button-group">
        <button class="demo-button danger" on:click={resetDemo} disabled={isLoading}>
          Reset Demo
        </button>
      </div>
    </div>
  </div>

  <!-- Status Display -->
  <div class="status-display">
    <div class="status-card">
      <h4>🌍 Current State</h4>
      <div class="status-item">
        <span class="status-label">Theme:</span>
        <span class="status-value">{currentTheme}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Locale:</span>
        <span class="status-value">{currentLoc}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Direction:</span>
        <span class="status-value">{currentDirection}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Workspace:</span>
        <span class="status-value"
          >{currentWorkspace ? currentWorkspace.slice(0, 8) + '...' : 'None'}</span
        >
      </div>
    </div>

    <div class="status-card">
      <h4>⚙️ Settings Status</h4>
      <div class="status-item">
        <span class="status-label">Initialized:</span>
        <span class="status-value boolean-{isInitialized}">{isInitialized ? 'Yes' : 'No'}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Global Loaded:</span>
        <span class="status-value boolean-{!!globalSettings}">{globalSettings ? 'Yes' : 'No'}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Workspace Loaded:</span>
        <span class="status-value boolean-{!!workspaceSettings}"
          >{workspaceSettings ? 'Yes' : 'No'}</span
        >
      </div>
      <div class="status-item">
        <span class="status-label">EPUB Loaded:</span>
        <span class="status-value boolean-{!!epubSettings}">{epubSettings ? 'Yes' : 'No'}</span>
      </div>
    </div>

    <div class="status-card">
      <h4>🔧 Transform Info</h4>
      <div class="status-item">
        <span class="status-label">Available Scripts:</span>
        <span class="status-value">{availableTransforms.length}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Built-in Scripts:</span>
        <span class="status-value"
          >{availableTransforms.filter(t => t.extensionName === 'built-in').length}</span
        >
      </div>
      <div class="status-item">
        <span class="status-label">Extension Scripts:</span>
        <span class="status-value"
          >{availableTransforms.filter(t => t.extensionName !== 'built-in').length}</span
        >
      </div>
    </div>
  </div>

  <!-- Settings Preview -->
  <div class="settings-preview">
    <div class="settings-card">
      <h4>🌍 Global Settings</h4>
      <div class="settings-json">{formatJSON(globalSettings)}</div>
    </div>

    <div class="settings-card">
      <h4>📁 Workspace Settings</h4>
      <div class="settings-json">{formatJSON(workspaceSettings)}</div>
    </div>

    <div class="settings-card">
      <h4>📖 EPUB Settings</h4>
      <div class="settings-json">{formatJSON(epubSettings)}</div>
    </div>
  </div>

  <!-- Console Log -->
  <div class="console-container">
    <div class="console-header">
      <h4 class="console-title">Console Output</h4>
      <button class="console-clear" on:click={clearLogs}>Clear</button>
    </div>
    <div class="console-log">
      {#each logs as log}
        <div class="log-entry log-{log.type}">
          <span class="log-time">{log.timestamp}</span>
          <span class="log-type">{log.type}</span>
          <span class="log-message">{log.message}</span>
        </div>
      {/each}
      {#if logs.length === 0}
        <div class="log-entry log-info">
          <span class="log-time">--:--:--</span>
          <span class="log-type">INFO</span>
          <span class="log-message">Console ready. Click buttons above to start demo.</span>
        </div>
      {/if}
    </div>
  </div>
</div>
