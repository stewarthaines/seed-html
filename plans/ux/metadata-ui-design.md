# Metadata Editor UI Design

## Overview

User experience design for the EPUB metadata editor, providing a form-based interface with grouped fields, immediate persistence, and comprehensive validation. The editor supports the full EPUB 3 metadata specification while presenting information in an author-friendly way.

## Field Organization

### Four-Group Structure

The metadata editor organizes fields into four logical groups based on author workflow and EPUB specification requirements:

1. **Basic Information** - Essential book details and rendition properties
2. **Advanced** - Extended descriptive metadata
3. **Publication Details** - EPUB-specific metadata and technical properties
4. **Accessibility** - EPUB 3 accessibility compliance metadata

## Group Details

### 1. Basic Information

**Purpose:** Essential book identification and core rendition settings

**Fields:**

- Title\* (required)
- Language\* (required, dropdown with common languages)
- Identifier\* (required, with generate button)
- Authors (array field with add/remove)
- Description (textarea)
- Rendition Layout (dropdown: reflowable/pre-paginated)
- Page Progression Direction (dropdown: default/ltr/rtl)
- Rendition Orientation (dropdown: auto/landscape/portrait)
- Rendition Spread (dropdown: auto/none/both)

**Rationale:** These are the fields authors need to set first and the rendition properties that affect how the book displays across devices.

### 2. Advanced

**Purpose:** Rich descriptive metadata for discovery and cataloging

**Fields:**

- Contributors (array field with add/remove)
- Subjects/Keywords (array field with add/remove)
- Publisher
- Publication Date (date picker)
- Rights/Copyright
- Source (original work reference)
- Type (dropdown: fiction/non-fiction/poetry/etc.)
- Coverage (geographic/temporal scope)
- Relation (related works)

**Rationale:** Extended metadata that helps with book discovery, library cataloging, and reader context but isn't essential for basic EPUB creation.

### 3. Publication Details

**Purpose:** EPUB-specific technical metadata and series information

**Fields:**

- Series Name
- Series Position (number)
- Collection Type (dropdown: series/set/etc.)
- EPUB Version (dropdown: 2.0/3.0/3.1/3.2)
- Unique Identifier Scheme (dropdown: UUID/ISBN/DOI/URL)
- Modified Date (auto-generated, display only)
- Primary Creator File-As (sorting form)
- Creator Roles (dropdown: author/editor/translator/etc.)

**Rationale:** Technical EPUB properties and enhanced metadata that publishers and advanced users need but casual authors can ignore.

### 4. Accessibility

**Purpose:** EPUB 3 accessibility compliance metadata

**Fields:**

- Access Mode (multi-select: textual/visual/auditory/tactile)
- Access Mode Sufficient (multi-select combinations)
- Accessibility Features (multi-select: alternativeText/captions/etc.)
- Accessibility Hazards (multi-select: flashing/motion/sound/none)
- Accessibility Summary (textarea)
- Accessibility Certification (dropdown: none/publisher/third-party)
- Accessibility Certifier (text field)

**Rationale:** Dedicated group for accessibility compliance, increasingly important for library adoption and legal requirements.

## UI Layout

### Tab-Based Navigation in Main Pane

The metadata editor uses a tab bar in the main pane header (`.pane-header` class) rather than sidebar navigation, differentiating it from the spine items interface design.

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─────────┬─────────┬─────────────┬─────────────┐            │ ← Pane header with tabs
│ │ Basic ○ │Advanced │Publication  │Accessibility│            │
│ └─────────┴─────────┴─────────────┴─────────────┘            │
│                                                             │
│   Form fields for active tab...                            │
│                                                             │
│   Title *                                              │
│   ├─────────────────────────────────────────────────┐      │
│   │ The Adventures of Tom Sawyer                    │      │
│   └─────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Tab States

- **Active tab:** Highlighted background, clear visual distinction
- **Tabs with errors:** Red indicator (!) or error count badge
- **Tabs with required fields:** Dot indicator (○) if required fields incomplete

### Form Layout Patterns

#### Text Fields with Error States

```
Title *
├─────────────────────────────────────────────────┐
│ The Adventures of Tom Sawyer                    │
└─────────────────────────────────────────────────┘
```

#### Dropdown Fields

```
Language *
├─────────────────────────┐
│ English             ▼   │
├─────────────────────────┤
│ English                 │
│ Spanish                 │
│ French                  │
│ German                  │
│ (More languages...)     │
└─────────────────────────┘
```

#### Array Fields (Authors, Subjects, etc.)

```
Authors
┌─────────────────────────────────────────┐
│ Mark Twain                        [×]   │
├─────────────────────────────────────────┤
│ [Empty field]                     [×]   │
└─────────────────────────────────────────┘
[+ Add Author]
```

#### Identifier Field with Generator

```
Identifier *
├─────────────────────────────────────┬─────────────┐
│ urn:uuid:123e4567-e89b-12d3-a456-  │ [Generate]  │
└─────────────────────────────────────┴─────────────┘
```

## Validation & Error Handling

### Visual Error States

#### Field-Level Validation

```
Title *                                    [❌]
├─────────────────────────────────────────┴─────┐
│                                               │ ← Empty required field
└───────────────────────────────────────────────┘
⚠️ Title is required
```

#### Group-Level Error Indicators

- Red exclamation mark (!) next to group name in sidebar
- Error count badge showing number of validation issues
- Required field indicators (\*) in red for missing fields

### Validation Timing

- **On blur:** Field validation triggers on focus loss
- **Real-time:** Required field indicators update immediately
- **On save:** Full validation runs before persistence
- **On group switch:** Current group validation before allowing navigation

## Save States & User Feedback

### Save Status Philosophy

- **Silent success:** No visual indicators when saves work correctly
- **Error-only feedback:** Only show indicators when something goes wrong
- **Simplified UX:** Reduce information overload for smooth operations

### Auto-Save Behavior

- **Immediate persistence:** All changes save on blur/change events
- **Silent operation:** No visual feedback for successful saves
- **Error indication:** Show ❌ indicator only when saves fail
- **Error recovery:** Retry failed saves with exponential backoff

## Responsive Design

### Desktop Layout (>1024px)

```
┌─────────────┬────────────────────────────────────────┐
│             │ ┌─────┬────────┬───────────┬──────────┐ │
│   Sidebar   │ │Basic│Advanced│Publication│Access... │ │ ← Tab bar in pane header
│             │ └─────┴────────┴───────────┴──────────┘ │
│   Other     │                                        │
│   Nav       │  Title *                               │
│   Items     │  ├─────────────────────────────────┐   │
│             │  │ The Adventures of Tom Sawyer    │   │
│             │  └─────────────────────────────────┘   │
│             │                                        │
│             │  Language *                            │
│             │  ├─────────────┐                      │
│             │  │ English   ▼ │                      │
│             │  └─────────────┘                      │
└─────────────┴────────────────────────────────────────┘
```

### Tablet Layout (768px-1024px)

- Tab bar remains in main pane header
- Form fields stack with adequate touch targets (44px minimum)
- Save indicators remain visible but may be smaller
- Tabs may scroll horizontally if needed

### Mobile Layout (<768px)

- Tab bar remains but may show abbreviated tab names
- Horizontal scrolling for tabs if necessary
- Full-width form fields
- Simplified save indicators
- One-handed operation considerations

## Accessibility Features

### Keyboard Navigation

- **Tab order:** Logical flow through groups and fields
- **Arrow keys:** Navigate between radio buttons and select options
- **Escape:** Close dropdowns and return focus to trigger
- **Enter:** Submit forms and activate buttons

### Screen Reader Support

- **Group landmarks:** Each section properly labeled
- **Field descriptions:** Help text associated with form controls
- **Error announcements:** Validation messages announced when they appear
- **Save status:** Changes in save state announced to screen readers
- **Required field indicators:** Properly associated with labels

### Visual Accessibility

- **High contrast:** Error states and save indicators meet WCAG AA
- **Focus indicators:** Clear visual focus for all interactive elements
- **Color independence:** Information not conveyed by color alone
- **Text scaling:** Interface remains usable at 200% zoom

## Advanced Features

### Bulk Operations

- **Import metadata:** From existing EPUB or external sources
- **Export metadata:** To various formats for reuse
- **Template saving:** Save common metadata sets as templates
- **Validation presets:** Quick validation against different standards

### Preview Integration

- **Live preview:** Changes immediately visible in metadata preview pane
- **OPF preview:** Raw XML view for technical users
- **Validation preview:** Real-time validation results
- **Format preview:** How metadata appears in reading systems

### Workflow Enhancements

- **Auto-completion:** Suggest values based on existing library
- **Field dependencies:** Show/hide fields based on other selections
- **Progress indicators:** Visual progress through required fields
- **Guided mode:** Step-by-step wizard for first-time users

## Error Recovery

### Save Failure Scenarios

1. **Storage full:** Warn user, suggest cleanup options
2. **Validation errors:** Highlight issues, prevent navigation until resolved
3. **Permission errors:** Clear error message with suggested actions

### Data Recovery

- **Auto-recovery:** Restore unsaved changes after browser crash
- **Version history:** Track changes for potential rollback
- **Conflict resolution:** Handle concurrent edits gracefully
- **Backup prompts:** Suggest manual backup for important works

## Performance Considerations

### Load Time Optimization

- **Progressive loading:** Show basic fields first, load advanced options asynchronously
- **Smart defaults:** Pre-populate common values to reduce user input
- **Caching:** Cache language lists and validation rules locally
- **Lazy validation:** Defer expensive validation until needed

### Memory Management

- **Efficient rendering:** Only render active group components
- **Cleanup:** Properly dispose of event listeners and timers
- **Debouncing:** Prevent excessive save operations during rapid input

## Component Architecture

### 1. Component Hierarchy

The metadata editor follows Svelte's idiomatic event-based communication pattern with centralized state management:

```
MetadataEditor (main container)
├── MetadataTabBar (tab navigation in pane header)
│   ├── MetadataTab (individual tab button)
│   └── TabErrorIndicator (validation state icons)
├── MetadataFormGroup (active form content)
│   ├── BasicInfoFields
│   ├── AdvancedFields
│   ├── PublicationDetailsFields
│   └── AccessibilityFields
└── Field Components (reusable)
    ├── TextMetadataField
    ├── SelectMetadataField
    ├── DateMetadataField
    └── TextareaMetadataField
```

### 2. Data Flow Pattern

**Central Coordination:**

```
MetadataManager → MetadataEditor → Form Groups → Individual Fields
                      ↑               ↑            ↑
                   Events only    Events only   Events only
```

**Svelte-Idiomatic Event Pattern:**

- **MetadataEditor**: Owns MetadataManager, loads all metadata on mount
- **Form Groups**: Receive metadata as props, emit change/save events
- **Field Components**: Receive values as props, emit user interaction events
- **No prop drilling**: Manager instance stays at top level only

### 3. Component Interfaces

#### MetadataEditor (Main Container)

```typescript
interface MetadataEditorProps {
  workspaceId: string;
  metadataManager: MetadataManager;
}

interface MetadataEditorEvents {
  // No external events - fully self-contained
}
```

**Responsibilities:**

- Load metadata on mount via `metadataManager.loadMetadata()`
- Handle all field updates via `metadataManager.updateField()`
- Manage tab switching with validation
- Coordinate error states across form groups

#### MetadataTabBar

```typescript
interface MetadataTabBarProps {
  activeTab: string;
  validationErrors: ValidationResult[];
  tabs: Array<{ id: string; label: string; errorCount: number }>;
}

interface MetadataTabBarEvents {
  tabClick: { tabId: string };
}
```

**Tab Switching Logic:**

```svelte
<script>
  const handleTabClick = async event => {
    const newTabId = event.detail.tabId;

    // Validate current tab before allowing switch
    const currentErrors = validateCurrentTab(activeTab, metadata);
    if (currentErrors.length > 0) {
      // Show validation errors, prevent tab switch
      showTabValidationErrors(currentErrors);
      return;
    }

    // Switch to new tab
    dispatch('tabClick', { tabId: newTabId });
  };
</script>
```

#### Form Group Components (BasicInfoFields, etc.)

```typescript
interface FormGroupProps {
  metadata: EPUBMetadata;
  validationErrors: ValidationResult[];
  saving: boolean;
}

interface FormGroupEvents {
  fieldChange: { field: string; value: string | string[] };
  fieldSave: { field: string; value: string | string[] };
  arrayAdd: { field: string };
  arrayRemove: { field: string; index: number };
}
```

**Array Field Management Example:**

```svelte
<!-- BasicInfoFields.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let metadata;

  const addAuthor = () => {
    dispatch('arrayAdd', { field: 'creator' });
  };

  const removeAuthor = index => {
    dispatch('arrayRemove', { field: 'creator', index });
  };

  const updateAuthor = (index, value) => {
    const newCreators = [...(metadata.creator || [])];
    newCreators[index] = value;
    dispatch('fieldChange', { field: 'creator', value: newCreators });
  };
</script>

<div class="field-array">
  <label>{$t('field.authors')}</label>
  {#each metadata.creator || [] as author, index}
    <div class="array-item">
      <TextMetadataField
        value={author}
        placeholder={$t('field.author.placeholder')}
        on:change={e => updateAuthor(index, e.detail.value)}
        on:blur={() => dispatch('fieldSave', { field: 'creator', value: metadata.creator })}
      />
      <button type="button" on:click={() => removeAuthor(index)}>
        {$t('action.remove')}
      </button>
    </div>
  {/each}
  <button type="button" on:click={addAuthor}>
    {$t('action.addAuthor')}
  </button>
</div>
```

#### Individual Field Components

```typescript
interface TextMetadataFieldProps {
  value: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

interface TextMetadataFieldEvents {
  change: { value: string };
  blur: { value: string };
  focus: { field: string };
}
```

**Reusable Field Component:**

```svelte
<!-- TextMetadataField.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let value = '';
  export let placeholder = '';
  export let required = false;
  export let disabled = false;
  export let error = '';

  const handleChange = event => {
    dispatch('change', { value: event.target.value });
  };

  const handleBlur = event => {
    dispatch('blur', { value: event.target.value });
  };
</script>

<input
  type="text"
  {value}
  {placeholder}
  {required}
  {disabled}
  class:error={!!error}
  on:input={handleChange}
  on:blur={handleBlur}
/>

{#if error}
  <span class="field-error" role="alert">{error}</span>
{/if}
```

### 4. State Management Patterns

#### Central Metadata Loading

```svelte
<!-- MetadataEditor.svelte -->
<script>
  import { onMount } from 'svelte';

  export let workspaceId;
  export let metadataManager;

  let metadata = {};
  let validationErrors = [];
  let activeTab = 'basic';
  let saving = false;

  onMount(async () => {
    try {
      metadata = await metadataManager.loadMetadata(workspaceId);
      validationErrors = metadataManager.validateMetadata(metadata);
    } catch (error) {
      console.error('Failed to load metadata:', error);
      // Handle error state
    }
  });
</script>
```

#### Event Handler Patterns

```svelte
<script>
  const handleFieldChange = event => {
    const { field, value } = event.detail;

    // Update local state immediately for UI responsiveness
    metadata = { ...metadata, [field]: value };

    // Update validation errors
    validationErrors = metadataManager.validateMetadata(metadata);
  };

  const handleFieldSave = async event => {
    const { field, value } = event.detail;

    try {
      saving = true;
      await metadataManager.updateField(workspaceId, field, value);
    } catch (error) {
      console.error(`Failed to save field ${field}:`, error);
      // Show error indicator
    } finally {
      saving = false;
    }
  };

  const handleArrayAdd = async event => {
    const { field } = event.detail;

    try {
      if (field === 'creator') {
        await metadataManager.addCreator(workspaceId);
      } else if (field === 'subject') {
        await metadataManager.addSubject(workspaceId);
      } else if (field === 'contributor') {
        await metadataManager.addContributor(workspaceId);
      }

      // Refresh metadata from manager
      metadata = await metadataManager.loadMetadata(workspaceId);
    } catch (error) {
      console.error(`Failed to add ${field}:`, error);
    }
  };
</script>
```

#### Tab Validation Logic

```svelte
<script>
  const validateCurrentTab = (tabId, metadata) => {
    const tabFields = getTabFields(tabId);
    return validationErrors.filter(error => tabFields.includes(error.field));
  };

  const getTabFields = tabId => {
    switch (tabId) {
      case 'basic':
        return ['title', 'language', 'identifier', 'creator'];
      case 'advanced':
        return ['publisher', 'date', 'description', 'subject', 'rights'];
      case 'publication':
        return ['series', 'seriesPosition', 'epubVersion'];
      case 'accessibility':
        return ['accessMode', 'accessibilityFeature', 'accessibilityHazard'];
      default:
        return [];
    }
  };

  const handleTabSwitch = async event => {
    const newTabId = event.detail.tabId;

    // Check for errors in current tab
    const currentTabErrors = validateCurrentTab(activeTab, metadata);
    if (currentTabErrors.length > 0) {
      // Focus first error field and show validation message
      focusFirstErrorField(currentTabErrors);
      showValidationAlert($t('validation.fixErrorsBeforeSwitching'));
      return;
    }

    // Switch tab
    activeTab = newTabId;
  };
</script>
```

### 5. Error Handling Patterns

#### Field-Level Error Display

```svelte
<script>
  const getFieldError = (fieldName, errors) => {
    const error = errors.find(err => err.field === fieldName);
    return error ? $t(`error.${error.message}`) : '';
  };
</script>

<!-- In form group components -->
{#each tabFields as field}
  <TextMetadataField
    value={metadata[field] || ''}
    error={getFieldError(field, validationErrors)}
    on:change={handleFieldChange}
    on:blur={handleFieldSave}
  />
{/each}
```

#### Tab Error Indicators

```svelte
<!-- MetadataTabBar.svelte -->
{#each tabs as tab}
  <button
    class="tab-button"
    class:active={activeTab === tab.id}
    class:has-errors={getTabErrorCount(tab.id) > 0}
    on:click={() => handleTabClick(tab.id)}
  >
    {$t(`metadata.tab.${tab.id}`)}
    {#if getTabErrorCount(tab.id) > 0}
      <span class="error-indicator" aria-label={$t('validation.hasErrors')}> ! </span>
    {/if}
  </button>
{/each}
```

This architecture provides clear separation of concerns, maintains Svelte's idiomatic patterns, and enables robust error handling while keeping components simple and testable.

## Internationalization

### Text Translations

Use the existing i18n infrastructure with `$t()` for all user-facing text. See `src/lib/i18n/README.md` for complete implementation patterns and conventions.

## Implementation Priority

### Phase 1: Core Functionality

1. Basic group with immediate persistence
2. Field validation and error display
3. Save status indicators
4. Keyboard accessibility

### Phase 2: Extended Metadata

1. Advanced and Publication Details groups
2. Array field operations (add/remove/reorder)
3. Dropdown options and auto-completion
4. Responsive design implementation

### Phase 3: Accessibility & Polish

1. Full accessibility compliance
2. Accessibility metadata group
3. Advanced error recovery
4. Performance optimizations

### Phase 4: Advanced Features

1. Preview integration
2. Bulk operations and templates
3. Guided mode for beginners
4. Advanced workflow enhancements
