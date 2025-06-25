# 10. Metadata Editor

## Overview

Form-based interface for editing EPUB metadata with grouped fields, immediate mode editing, and proper validation for required fields.

## Requirements

- Form-based editing with grouped fields (Basic, Advanced, Accessibility)
- Immediate mode editing with blur event updates
- Dropdown selections for fixed layout and accessibility
- Required field validation (Title, Language, Identifier)

## Dependencies

- **#4 Workspace & OPF Manager** - for metadata structure and validation

## Technical Approach

- Grouped form layout with collapsible sections
- **Immediate persistence**: Changes saved to content.opf on every field update
- Real-time validation and saving on blur events
- Dropdown options for standardized metadata values
- Auto-generation features for identifiers and dates

## Data Persistence Strategy

### Immediate Persistence Design

**Decision**: Save metadata changes immediately to content.opf file on every field update, rather than keeping changes in memory until manual save.

**Rationale**:

- **Data safety**: Users create content over long periods, data loss risk is high
- **Web UX expectations**: Modern web forms auto-save, users expect persistence
- **Low performance cost**: content.opf files are small (2-10KB), minimal I/O overhead
- **Simplicity**: No dirty state management, no save buttons needed
- **EPUB characteristics**: Metadata changes are infrequent compared to content editing

**Performance Analysis**:

- **OPFS**: Very fast for small files, <1ms typical write time
- **IndexedDB**: Slightly slower but still acceptable, <10ms typical
- **File size**: content.opf rarely exceeds 10KB, negligible storage impact
- **Frequency**: Metadata editing is sporadic, not continuous like text editing

**Alternative considered**: In-memory editing with manual save was rejected due to high data loss risk and poor web UX.

## API Design

```typescript
interface MetadataEditor {
  // Data management with immediate persistence
  loadMetadata(workspaceId: string): Promise<EPUBMetadata>;
  updateField(workspaceId: string, field: string, value: string | string[]): Promise<void>;
  validateMetadata(metadata: EPUBMetadata): ValidationResult[];

  // Field operations with auto-save
  addCreator(workspaceId: string): Promise<void>;
  removeCreator(workspaceId: string, index: number): Promise<void>;
  addSubject(workspaceId: string): Promise<void>;
  removeSubject(workspaceId: string, index: number): Promise<void>;

  // Utilities
  generateIdentifier(): string;
  getCurrentDate(): string;
  getLanguageCodes(): LanguageOption[];

  // Performance monitoring
  getPerformanceMetrics(): PersistenceMetrics;
}

interface PersistenceMetrics {
  averageSaveTime: number;
  totalSaves: number;
  failedSaves: number;
  lastSaveTime: number;
}

// Workspace Manager integration
interface WorkspaceManager {
  updateMetadata(workspaceId: string, field: string, value: any): Promise<void>;
  updateMetadataField(workspaceId: string, field: string, value: any): Promise<void>;
  regenerateOPF(workspaceId: string): Promise<void>;
}

interface EPUBMetadata {
  // Required fields
  title: string;
  language: string;
  identifier: string;

  // Optional fields
  creator?: string[];
  contributor?: string[];
  publisher?: string;
  date?: string;
  description?: string;
  subject?: string[];
  rights?: string;
  source?: string;
  relation?: string;
  coverage?: string;
  type?: string;
  format?: string;

  // EPUB 3 accessibility
  accessMode?: string[];
  accessModeSufficient?: string[];
  accessibilityFeature?: string[];
  accessibilityHazard?: string[];
  accessibilitySummary?: string;
}

interface ValidationResult {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}
```

## Implementation Details

### Immediate Persistence Implementation

```typescript
class MetadataEditor {
  private workspaceManager: WorkspaceManager;
  private performanceMetrics: PersistenceMetrics = {
    averageSaveTime: 0,
    totalSaves: 0,
    failedSaves: 0,
    lastSaveTime: 0,
  };

  async updateField(workspaceId: string, field: string, value: string | string[]): Promise<void> {
    const startTime = performance.now();

    try {
      // Update in workspace manager (updates in-memory cache + persists to file)
      await this.workspaceManager.updateMetadataField(workspaceId, field, value);

      // Update performance metrics
      const duration = performance.now() - startTime;
      this.updateMetrics(duration, true);

      // Log slow operations
      if (duration > 100) {
        console.warn(`Slow metadata save: ${field} took ${duration}ms`);
      }
    } catch (error) {
      this.updateMetrics(performance.now() - startTime, false);
      console.error(`Failed to save metadata field ${field}:`, error);
      throw error;
    }
  }

  private updateMetrics(duration: number, success: boolean): void {
    this.performanceMetrics.totalSaves++;
    this.performanceMetrics.lastSaveTime = duration;

    if (success) {
      // Update rolling average
      const total =
        this.performanceMetrics.averageSaveTime * (this.performanceMetrics.totalSaves - 1);
      this.performanceMetrics.averageSaveTime =
        (total + duration) / this.performanceMetrics.totalSaves;
    } else {
      this.performanceMetrics.failedSaves++;
    }
  }
}
```

### Workspace Manager Integration

```typescript
class WorkspaceManager {
  private opfCache = new Map<string, OPFDocument>();

  async updateMetadataField(workspaceId: string, field: string, value: any): Promise<void> {
    // Get current OPF (from cache or load from file)
    const opf = await this.getWorkspaceOPF(workspaceId);

    // Update the specific field
    opf.metadata[field] = value;

    // Update cache
    this.opfCache.set(workspaceId, opf);

    // Immediately persist to content.opf file
    await this.saveOPF(workspaceId, opf);
  }

  private async saveOPF(workspaceId: string, opf: OPFDocument): Promise<void> {
    const xml = this.generateOPFXML(opf);
    await this.storage.writeTextFile(workspaceId, 'OEBPS/content.opf', xml);
  }
}
```

### Debounced Alternative (for rapid changes)

```typescript
// Optional: Use for rapid typing scenarios
const debouncedUpdateField = debounce(async (workspaceId: string, field: string, value: string) => {
  await metadataEditor.updateField(workspaceId, field, value);
}, 500); // 500ms delay

// Use in component for text inputs that might change rapidly
const handleFieldChange = (field: string, value: string) => {
  // Immediate UI update
  metadata[field] = value;

  // Debounced persistence
  debouncedUpdateField(workspaceId, field, value);
};
```

## Form Layout Structure

```svelte
<div class="metadata-editor">
  <div class="metadata-sidebar">
    <nav class="metadata-groups">
      {#each metadataGroups as group}
        <button
          class="group-button"
          class:active={activeGroup === group.id}
          on:click={() => setActiveGroup(group.id)}
        >
          {group.title}
          {#if hasErrors(group.id)}
            <span class="error-indicator">!</span>
          {/if}
        </button>
      {/each}
    </nav>
  </div>

  <form class="metadata-form" on:submit|preventDefault>
    {#if activeGroup === 'basic'}
      <BasicMetadataFields bind:metadata />
    {:else if activeGroup === 'advanced'}
      <AdvancedMetadataFields bind:metadata />
    {:else if activeGroup === 'accessibility'}
      <AccessibilityMetadataFields bind:metadata />
    {/if}
  </form>
</div>
```

## Basic Metadata Fields

```svelte
<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let metadata = {};
  export let workspaceId = '';
  export let metadataEditor = null;

  let saving = false;
  let saveStatus = {};

  const saveField = async (field, value) => {
    if (!metadataEditor || !workspaceId) return;

    saving = true;
    saveStatus[field] = 'saving';

    try {
      await metadataEditor.updateField(workspaceId, field, value);
      saveStatus[field] = 'saved';
      setTimeout(() => {
        saveStatus[field] = null;
      }, 2000);
    } catch (error) {
      saveStatus[field] = 'error';
      console.error(`Failed to save ${field}:`, error);
    } finally {
      saving = false;
    }
  };
</script>

<div class="field-group">
  <h3>Basic Information</h3>

  <div class="field">
    <label for="title">Title *</label>
    <div class="field-input-wrapper">
      <input
        id="title"
        type="text"
        bind:value={metadata.title}
        on:blur={() => saveField('title', metadata.title)}
        required
        class:error={getFieldError('title')}
        disabled={saving}
      />
      {#if saveStatus.title === 'saving'}
        <span class="save-indicator saving">💾</span>
      {:else if saveStatus.title === 'saved'}
        <span class="save-indicator saved">✅</span>
      {:else if saveStatus.title === 'error'}
        <span class="save-indicator error">❌</span>
      {/if}
    </div>
    {#if getFieldError('title')}
      <span class="field-error">{getFieldError('title')}</span>
    {/if}
  </div>

  <div class="field">
    <label for="language">Language *</label>
    <select
      id="language"
      bind:value={metadata.language}
      on:change={() => saveField('language', metadata.language)}
      required
    >
      <option value="">Select language...</option>
      {#each languageCodes as lang}
        <option value={lang.code}>{lang.name}</option>
      {/each}
    </select>
  </div>

  <div class="field">
    <label for="identifier">Identifier *</label>
    <div class="identifier-field">
      <input
        id="identifier"
        type="text"
        bind:value={metadata.identifier}
        on:blur={() => saveField('identifier', metadata.identifier)}
        required
      />
      <button type="button" on:click={generateNewIdentifier}>Generate</button>
    </div>
  </div>

  <div class="field-array">
    <label>Authors</label>
    {#each metadata.creator || [] as creator, index}
      <div class="array-item">
        <input
          type="text"
          bind:value={creator}
          on:blur={() => saveCreators()}
          placeholder="Author name"
        />
        <button type="button" on:click={() => removeCreator(index)}>Remove</button>
      </div>
    {/each}
    <button type="button" on:click={addCreator}>Add Author</button>
  </div>
</div>
```

## Advanced Metadata Fields

```svelte
<div class="field-group">
  <h3>Publication Details</h3>

  <div class="field">
    <label for="publisher">Publisher</label>
    <input
      id="publisher"
      type="text"
      bind:value={metadata.publisher}
      on:blur={() => saveField('publisher', metadata.publisher)}
    />
  </div>

  <div class="field">
    <label for="date">Publication Date</label>
    <input
      id="date"
      type="date"
      bind:value={metadata.date}
      on:blur={() => saveField('date', metadata.date)}
    />
  </div>

  <div class="field">
    <label for="description">Description</label>
    <textarea
      id="description"
      bind:value={metadata.description}
      on:blur={() => saveField('description', metadata.description)}
      rows="4"
    ></textarea>
  </div>

  <div class="field-array">
    <label>Subjects</label>
    {#each metadata.subject || [] as subject, index}
      <div class="array-item">
        <input
          type="text"
          bind:value={subject}
          on:blur={() => saveSubjects()}
          placeholder="Subject/keyword"
        />
        <button type="button" on:click={() => removeSubject(index)}>Remove</button>
      </div>
    {/each}
    <button type="button" on:click={addSubject}>Add Subject</button>
  </div>

  <div class="field">
    <label for="rights">Rights</label>
    <input
      id="rights"
      type="text"
      bind:value={metadata.rights}
      on:blur={() => saveField('rights', metadata.rights)}
      placeholder="Copyright information"
    />
  </div>
</div>
```

## Accessibility Metadata Fields

```svelte
<div class="field-group">
  <h3>Accessibility Information</h3>

  <div class="field">
    <label for="access-mode">Access Mode</label>
    <select
      id="access-mode"
      multiple
      bind:value={metadata.accessMode}
      on:change={() => saveField('accessMode', metadata.accessMode)}
    >
      <option value="textual">Textual</option>
      <option value="visual">Visual</option>
      <option value="auditory">Auditory</option>
      <option value="tactile">Tactile</option>
    </select>
  </div>

  <div class="field">
    <label for="accessibility-features">Accessibility Features</label>
    <select
      id="accessibility-features"
      multiple
      bind:value={metadata.accessibilityFeature}
      on:change={() => saveField('accessibilityFeature', metadata.accessibilityFeature)}
    >
      <option value="alternativeText">Alternative Text</option>
      <option value="audioDescription">Audio Description</option>
      <option value="captions">Captions</option>
      <option value="describedMath">Described Math</option>
      <option value="longDescription">Long Description</option>
      <option value="readingOrder">Reading Order</option>
      <option value="structuralNavigation">Structural Navigation</option>
    </select>
  </div>

  <div class="field">
    <label for="accessibility-hazards">Accessibility Hazards</label>
    <select
      id="accessibility-hazards"
      multiple
      bind:value={metadata.accessibilityHazard}
      on:change={() => saveField('accessibilityHazard', metadata.accessibilityHazard)}
    >
      <option value="flashing">Flashing</option>
      <option value="motionSimulation">Motion Simulation</option>
      <option value="sound">Sound</option>
      <option value="none">None</option>
    </select>
  </div>

  <div class="field">
    <label for="accessibility-summary">Accessibility Summary</label>
    <textarea
      id="accessibility-summary"
      bind:value={metadata.accessibilitySummary}
      on:blur={() => saveField('accessibilitySummary', metadata.accessibilitySummary)}
      rows="3"
      placeholder="Brief summary of accessibility features"
    ></textarea>
  </div>
</div>
```

## Validation Logic

```typescript
const validateMetadata = (metadata: EPUBMetadata): ValidationResult[] => {
  const errors: ValidationResult[] = [];

  // Required fields
  if (!metadata.title?.trim()) {
    errors.push({ field: 'title', message: 'Title is required', severity: 'error' });
  }

  if (!metadata.language?.trim()) {
    errors.push({ field: 'language', message: 'Language is required', severity: 'error' });
  } else if (!isValidLanguageCode(metadata.language)) {
    errors.push({ field: 'language', message: 'Invalid language code', severity: 'error' });
  }

  if (!metadata.identifier?.trim()) {
    errors.push({ field: 'identifier', message: 'Identifier is required', severity: 'error' });
  } else if (!isValidIdentifier(metadata.identifier)) {
    errors.push({ field: 'identifier', message: 'Invalid identifier format', severity: 'warning' });
  }

  // Date validation
  if (metadata.date && !isValidDate(metadata.date)) {
    errors.push({ field: 'date', message: 'Invalid date format', severity: 'error' });
  }

  return errors;
};
```

## Auto-generation Utilities

```typescript
const generateIdentifier = (): string => {
  return `urn:uuid:${crypto.randomUUID()}`;
};

const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
};

const getLanguageCodes = (): LanguageOption[] => [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  // ... more language codes
];
```

## Error Handling

- Required field validation
- Invalid date format handling
- Language code validation
- Identifier format validation
- Save operation failures
- Network connectivity issues

## Testing Considerations

### Validation Testing

- Test all required field validation
- Test array field operations (add/remove)
- Test dropdown selections
- Test identifier generation
- Test accessibility metadata handling

### Immediate Persistence Testing

- Test immediate save functionality on field blur
- Test save failure handling and error recovery
- Test concurrent field updates
- Test network interruption during save
- Test large metadata sets (stress testing)
- Verify content.opf file integrity after saves

### Performance Testing

- Measure save operation latency across storage backends
- Test with rapidly changing fields (typing simulation)
- Monitor memory usage with extended editing sessions
- Test performance metrics collection accuracy
- Verify no memory leaks in OPF cache

### Integration Testing

- Test workspace switching with unsaved changes
- Test metadata loading from existing EPUB files
- Test OPF regeneration with updated metadata
- Test cross-component metadata updates (manifest view, etc.)

### Error Recovery Testing

- Test behavior when storage quota exceeded
- Test recovery from corrupted content.opf files
- Test partial save failures (workspace exists but OPF write fails)
- Test workspace manager cache consistency after errors

## Implementation Notes

### Development Priorities

1. **Start with immediate persistence**: Implement the simple approach first
2. **Add performance monitoring**: Track save times and failures from day one
3. **Progressive enhancement**: Add debouncing only if performance issues arise
4. **Error handling**: Robust error recovery is critical for data safety

### Best Practices

- **Visual feedback**: Show save indicators (saving/saved/error) for user confidence
- **Error recovery**: Graceful handling of save failures with retry mechanisms
- **Performance monitoring**: Log slow operations (>100ms) for optimization
- **Cache management**: Ensure OPF cache consistency across workspace operations
- **Accessibility**: Test with screen readers, ensure save states are announced

### Optimization Options

- **Debouncing**: Available for rapid text input if needed (500ms recommended)
- **Batch updates**: Group multiple field changes if performance becomes issue
- **Background saves**: Consider web workers for large metadata sets

### Browser Considerations

- **OPFS performance**: Expect <1ms save times on modern browsers
- **IndexedDB fallback**: Expect <10ms save times, still very acceptable
- **Storage quotas**: Monitor and handle quota exceeded gracefully
- **Offline scenarios**: Consider service worker caching for offline editing
