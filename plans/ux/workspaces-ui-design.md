# Workspace Management UI Design

## Overview

User experience design for EPUB workspace management, providing an intuitive interface for creating, opening, organizing, and managing EPUB projects. The workspace view serves as the primary entry point for users to start working with EPUBs and manage their project portfolio.

## Workflow Organization

### Core User Workflows

The workspace management interface supports four primary workflows based on user intent and project lifecycle:

1. **Minimal EPUB Creation** - Instantly create valid, packageable EPUB with defaults
2. **Project Opening** - Accessing existing workspaces and recent projects
3. **EPUB Import** - Loading existing EPUB files into the editor
4. **Project Management** - Organizing, renaming, deleting, and maintaining workspace portfolio

## UI Layout Patterns

### Main Workspace View Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Workspace Management                                         │ ← View header
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   [Current Workspace: "My Novel.epub" | Switch | Close]    │ ← Active workspace bar
│                                                             │
│   ┌─────────────────┬─────────────────┬─────────────────┐  │
│   │  ➕ Create New  │  📁 Open        │  📥 Import EPUB │  │ ← Primary actions
│   └─────────────────┴─────────────────┴─────────────────┘  │
│                                                             │
│   Workspaces (12 total)                                   │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ [Search workspaces...]                              │  │
│   │                                                     │  │
│   │ 📖 "The Adventures of..."    Mark Twain  2h ago  [🗑️] │  │ ← Most recent
│   │ 📖 "Technical Manual"        John Smith  1d ago  [🗑️] │  │
│   │ ⚠️ "Corrupted Project"       Unknown     3d ago  [🗑️] │  │ ← Error state
│   │ 📖 "Alice in Wonderland"     L. Carroll  3d ago  [🗑️] │  │
│   │ 📖 "Cooking Recipes"         Chef Anna   1w ago  [🗑️] │  │
│   │                                                     │  │
│   │ Single-click title opens workspace and navigates   │  │
│   │ Delete button uses browser confirm() dialog        │  │
│   └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Empty State (First Time User)

```
┌─────────────────────────────────────────────────────────────┐
│ Welcome to EDITME.html                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                        📚                                   │
│                                                             │
│               No workspaces yet                            │
│          Get started by creating your first EPUB          │
│                                                             │
│   ┌─────────────────┬─────────────────┬─────────────────┐  │
│   │  ➕ Create New  │  📁 Open        │  📥 Import EPUB │  │
│   │  Start fresh    │  Browse files   │  Convert existing│  │
│   └─────────────────┴─────────────────┴─────────────────┘  │
│                                                             │
│   Quick Start Tips:                                        │
│   • Create New: Start with a template or blank project    │
│   • Import EPUB: Convert existing .epub files to edit     │
│   • All your work is saved automatically                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Simplified Action Flow

**No Modal Dialogs** - Actions happen immediately and navigate to appropriate views:

```
┌─────────────────────────────────────────────────────────────┐
│ Workspace Management                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   [Current Workspace: "My Novel.epub" | Switch | Close]    │
│                                                             │
│   ┌─────────────────┬─────────────────┬─────────────────┐  │
│   │  ➕ Create New  │  📁 Load EPUB   │ 📂 From Folder │  │
│   │  Minimal EPUB   │  Import file    │ (Future)        │  │
│   └─────────────────┴─────────────────┴─────────────────┘  │
│                                                             │
│   Create New Action:                                       │
│   1. Creates "Untitled Book Project" with UUID             │
│   2. Sets author as "Unknown"                              │
│   3. Adds single chapter file                              │
│   4. Immediately navigates to Metadata view               │
│   → Result: Valid, packageable EPUB ready for editing     │
│                                                             │
│   Load EPUB Action:                                        │
│   1. Triggers browser file picker dialog                   │
│   2. User selects .epub file                               │
│   3. Automatic import and workspace creation               │
│   4. Immediately navigates to imported workspace           │
│   → Result: Existing EPUB ready to edit or package        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## State Management

### Loading States

**Initial Load**

- Show skeleton placeholders for workspace list
- Display "Loading workspaces..." message
- Animate loading indicators

**Workspace Creation**

- Disable form during creation
- Show "Creating workspace..." progress
- Clear form on success, show error on failure

**Workspace Operations**

- Show operation feedback (deleting, importing, etc.)
- Prevent concurrent operations with disabled states
- Provide clear success/failure messaging

### Error States

**Immediate Action Errors**

- Use browser alert() for failed EPUB imports, creation failures, delete errors
- Simple, direct feedback without additional UI complexity
- Clear error messages with actionable information

**Workspace Load Errors**

- Show problematic workspaces in list with error badge/indicator
- Allow users to see and attempt to recover corrupted workspaces
- Click on error workspace shows browser alert with specific error details
- No dedicated error UI areas - keep errors contextual and inline

**Storage Errors**

- Browser alert for storage quota exceeded
- Browser alert for permission/access failures
- No persistent error states in the UI

### Empty States

**No Workspaces**

- Welcoming first-time user experience
- Clear calls-to-action for getting started
- Educational content about EPUB creation

**No Search Results**

- "No workspaces match your search" messaging
- Suggest adjusting search terms
- Option to create new workspace with search term as title

**No Recent Workspaces**

- Show message when recent list is empty
- Encourage users to open existing workspaces
- Highlight most recently modified workspace

## User Interactions

### Workspace Selection Behavior

**Click to Open**

- Single click on workspace title immediately opens workspace and navigates away
- Enter key when workspace is focused opens selected workspace
- Delete button at end of each row with browser confirm() dialog
- No separate selection state - direct actions for accessibility

**Current Workspace Indicator**

- Clearly highlight currently active workspace in workspace list
- Show "Currently Open" badge or visual distinction in workspace bar
- Display current workspace title from EPUB metadata (not editable from this view)

**Navigation Behavior**

- Return to workspace view only by clicking "Workspace" in sidebar
- No automatic returns or navigation prompts
- Clear, explicit navigation model for predictable user experience

### Keyboard Navigation

**Tab Navigation**

- Logical tab order: action buttons → search → workspace list
- Arrow keys navigate within workspace list
- Enter activates buttons and opens workspaces
- Escape closes modals and cancels operations

**Keyboard Shortcuts**

- Ctrl+N / Cmd+N: Create new workspace
- Ctrl+O / Cmd+O: Open workspace browser
- Ctrl+I / Cmd+I: Import EPUB
- Ctrl+F / Cmd+F: Focus search box

### Touch Interactions

**Mobile-Friendly Gestures**

- Swipe left on workspace item reveals management actions
- Pull-to-refresh updates workspace list
- Long press shows context menu
- All touch targets meet 44px minimum requirement

## Validation & Error Handling

### Form Validation

**Required Field Validation**

- Title and Language are required for new workspaces
- Show validation on blur and before submission
- Clear, specific error messages for each field
- Prevent submission with incomplete required fields

**Duplicate Name Handling**

- Check for existing workspace titles
- Suggest variations: "My Novel (2)", "My Novel - Copy"
- Allow user to proceed with duplicate names if desired
- Warn about potential confusion with existing projects

**Character Limits**

- Title: 100 characters maximum
- Author: 50 characters maximum
- Show character count for longer fields
- Graceful truncation with ellipsis in display

### Import Validation

**EPUB File Validation**

- Verify file is valid EPUB format
- Check for required EPUB structure (mimetype, container.xml, OPF)
- Warn about unsupported EPUB features
- Provide detailed error messages for invalid files

**Size and Quota Limits**

- Check available storage before import
- Warn when approaching storage limits
- Suggest cleanup options for large imports
- Progress indication for large file imports

## Accessibility Features

### Screen Reader Support

**Semantic Structure**

- Proper heading hierarchy (h1 → h2 → h3)
- ARIA landmarks for main sections
- List markup for workspace collections
- Form labels properly associated with inputs

**Status Announcements**

- Announce workspace creation success/failure
- Communicate loading states to screen readers
- Status updates for long-running operations
- Error messages announced when they appear

**Navigation Aids**

- Skip links for keyboard users
- ARIA labels for icon-only buttons
- Descriptive button text and link purposes
- Form instruction text associated with inputs

### Keyboard Accessibility

**Focus Management**

- Visible focus indicators on all interactive elements
- Focus trapping in modal dialogs
- Logical focus order throughout interface
- Focus restoration when modals close

**Screen Magnification**

- Interface remains usable at 200% zoom
- Text doesn't overlap or get cut off
- All functionality accessible when magnified
- Horizontal scrolling minimized

### Color and Contrast

**High Contrast Support**

- WCAG AA contrast ratios for all text
- Color not sole indicator of state/meaning
- High contrast mode compatibility
- Focus indicators visible in all themes

## Component Architecture

### Component Hierarchy

```
WorkspaceView (main container)
├── WorkspaceHeader (view title and description)
├── ActiveWorkspaceBar (current workspace status)
├── WorkspaceActions (create/open/import buttons)
├── WorkspacesList (complete workspace library, sorted by modification time)
│   ├── WorkspaceSearchBox (filter workspaces)
│   ├── WorkspaceItem (individual workspace card)
│   └── WorkspaceContextMenu (management actions)
└── WorkspaceComponents
    ├── WorkspaceDeleteButton (delete with browser confirmation)
    └── FilePickerHandler (manages EPUB file import)
```

### Data Flow Pattern

**Central Coordination:**

```
WorkspaceManager → WorkspaceView → Child Components
                      ↑               ↑
                   Events only    Events only
```

**Svelte-Idiomatic Event Pattern:**

- **WorkspaceView**: Owns WorkspaceManager, loads all workspaces on mount
- **Child Components**: Receive workspace data as props, emit user action events
- **Modal Components**: Handle their own form state, emit completion events
- **No prop drilling**: Manager instance stays at WorkspaceView level only

### Component Interfaces

#### WorkspaceView (Main Container)

```typescript
interface WorkspaceViewProps {
  workspaceManager: WorkspaceManager;
}

interface WorkspaceViewEvents {
  workspaceSelected: { workspaceId: string };
  navigationRequested: { view: string; workspaceId?: string };
}
```

**Responsibilities:**

- Load workspace list on mount via `workspaceManager.listWorkspacesWithMetadata()`
- Handle all workspace operations via manager methods
- Manage modal state and coordination
- Track current workspace selection

#### WorkspaceItem

```typescript
interface WorkspaceItemProps {
  workspace: WorkspaceInfo;
  isCurrent: boolean;
  isSelected: boolean;
}

interface WorkspaceItemEvents {
  select: { workspaceId: string };
  open: { workspaceId: string };
  contextMenu: { workspaceId: string; x: number; y: number };
}
```

#### CreateWorkspaceModal

```typescript
interface CreateWorkspaceModalProps {
  isOpen: boolean;
  templates: WorkspaceTemplate[];
}

interface CreateWorkspaceModalEvents {
  create: { metadata: EPUBMetadata; template?: string };
  cancel: {};
}
```

### State Management Patterns

#### Central Workspace Loading

```svelte
<!-- WorkspaceView.svelte -->
<script>
  import { onMount } from 'svelte';

  export let workspaceManager;

  let workspaces = [];
  let currentWorkspaceId = null;
  let selectedWorkspaceId = null;
  let loading = true;
  let error = null;

  onMount(async () => {
    try {
      workspaces = await workspaceManager.listWorkspacesWithMetadata();
      // Load current workspace from localStorage or URL
      currentWorkspaceId = localStorage.getItem('currentWorkspace');
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });
</script>
```

#### Event Handler Patterns

```svelte
<script>
  const handleWorkspaceSelect = event => {
    const { workspaceId } = event.detail;
    selectedWorkspaceId = workspaceId;
  };

  const handleWorkspaceOpen = async event => {
    const { workspaceId } = event.detail;

    try {
      loading = true;
      currentWorkspaceId = workspaceId;
      localStorage.setItem('currentWorkspace', workspaceId);

      // Navigate to metadata or spine view
      dispatch('navigationRequested', {
        view: 'metadata',
        workspaceId,
      });
    } catch (error) {
      console.error('Failed to open workspace:', error);
      // Show error notification
    } finally {
      loading = false;
    }
  };

  const handleWorkspaceCreate = async event => {
    const { metadata, template } = event.detail;

    try {
      const workspaceId = await workspaceManager.createEPUBWorkspace(metadata);

      if (template) {
        await applyTemplate(workspaceId, template);
      }

      // Refresh workspace list
      workspaces = await workspaceManager.listWorkspacesWithMetadata();

      // Open the new workspace
      handleWorkspaceOpen({ detail: { workspaceId } });
    } catch (error) {
      console.error('Failed to create workspace:', error);
      // Show error in modal
    }
  };
</script>
```

## Responsive Design

### Desktop Layout (>1024px)

```
┌─────────────┬────────────────────────────────────────┐
│             │ Workspace Management                   │
│   Sidebar   │                                        │
│             │ [Current: My Novel | Switch | Close]   │
│   Other     │                                        │
│   Nav       │ [➕ Create] [📁 Open] [📥 Import]      │
│   Items     │                                        │
│             │ Recent Workspaces                      │
│             │ ┌────────────────────────────────────┐ │
│             │ │ 📖 The Adventures...               │ │
│             │ │ 📖 Technical Manual               │ │
│             │ └────────────────────────────────────┘ │
│             │                                        │
│             │ All Workspaces                         │
│             │ ┌────────────────────────────────────┐ │
│             │ │ [Search...]                        │ │
│             │ │ 📖 Alice in Wonderland            │ │
│             │ │ 📖 Cooking Recipes                │ │
│             │ └────────────────────────────────────┘ │
└─────────────┴────────────────────────────────────────┘
```

### Tablet Layout (768px-1024px)

- Action buttons remain in row layout
- Workspace cards may stack in single column
- Search box full-width above workspace list
- Touch targets enlarged to 44px minimum
- Workspace details may abbreviate on smaller cards

### Mobile Layout (<768px)

- Action buttons stack vertically for easier touch
- Single column workspace list with larger cards
- Swipe gestures reveal management actions
- Search box prominent and easily accessible
- Simplified workspace information display

## Advanced Features

### Workspace Templates

**Template System**

- Predefined project structures for common use cases
- Novel template: chapters, front matter, back matter
- Technical manual: sections, glossary, index structure
- Poetry collection: individual poems, table of contents
- User-created templates from existing projects

**Template Application**

- Create initial file structure based on template
- Pre-populate with placeholder content
- Set up initial spine ordering and navigation
- Apply template-specific CSS and styling

### Bulk Operations

**Multi-Select Actions**

- Checkbox selection for multiple workspaces
- Bulk delete with confirmation
- Export multiple workspaces as ZIP
- Batch operations with progress indication
- Select all/none functionality

**Import/Export Workflows**

- Drag-and-drop multiple EPUB files for batch import
- Export workspace as standard EPUB
- Backup/restore workspace collections
- Share workspace between devices/users

### Search and Filtering

**Workspace Search**

- Full-text search across workspace metadata
- Search by title, author, description, tags
- Search within workspace content (advanced)
- Recent search suggestions and history

**Filtering Options**

- Filter by creation date, modification date
- Filter by author, language, EPUB version
- Filter by file size, content type
- Custom filter combinations with saved presets

## Error Recovery

### Workspace Corruption Detection

**Automatic Detection**

- Validate workspace structure on load
- Check for missing required files (OPF, container.xml)
- Verify manifest/spine consistency
- Report specific corruption issues with repair suggestions

**Recovery Options**

- Automatic repair for common issues
- Manual intervention with guided repair steps
- Backup restoration from auto-saved versions
- Workspace export before attempting repairs

### Data Loss Prevention

**Auto-Save Protection**

- Continuous backup of workspace metadata
- Snapshot creation before destructive operations
- Version history for workspace recovery
- Cloud sync integration for data redundancy

**Conflict Resolution**

- Detect concurrent modifications in team environments
- Merge strategy for non-conflicting changes
- User choice for conflicting modifications
- Rollback capability for problematic changes

## Performance Considerations

### Large Workspace Collections

**Virtualized Lists**

- Render only visible workspace items
- Smooth scrolling for hundreds of workspaces
- Efficient search and filtering without lag
- Progressive loading for very large collections

**Workspace Metadata Caching**

- Cache workspace thumbnails and previews
- Efficient metadata storage and retrieval
- Background refresh of stale cache entries
- Smart cache invalidation strategies

### Memory Management

**Efficient Loading**

- Load workspace list metadata only (not full content)
- Lazy load workspace details on demand
- Proper cleanup of unused workspace data
- Memory-conscious image and asset handling

## Implementation Priority

### Phase 1: Core Functionality (Current)

1. ✅ Basic workspace list display with metadata
2. ✅ Current workspace indicator and switching
3. ✅ Placeholder action buttons (create/open/import)
4. 🔄 Integration with existing WorkspaceManager API

### Phase 2: Essential Operations

1. Functional workspace creation modal with form validation
2. Workspace opening and navigation integration
3. EPUB import workflow with progress indication
4. Recent workspaces tracking and display
5. Basic error handling and user feedback

### Phase 3: Enhanced Experience

1. Workspace search and filtering capabilities
2. Context menus for workspace management (rename/delete)
3. Responsive design for tablet and mobile
4. Accessibility compliance (keyboard nav, screen readers)
5. Empty state improvements and onboarding

### Phase 4: Advanced Features

1. Workspace templates and project wizards
2. Bulk operations and multi-select
3. Advanced import/export options
4. Performance optimizations for large collections
5. Backup/restore and data recovery features

## Integration Notes

- **Ready for navigation**: Uses existing NavigationStore for view switching
- **WorkspaceManager integration**: Leverages existing API for all operations
- **Metadata compatibility**: Feeds directly into MetadataEditor workflow
- **Spine management**: Connects to SpineItem management after workspace selection
- **File operations**: Uses existing FileStorage abstraction for browser compatibility

## Internationalization

### Text Translations

Use the existing i18n infrastructure with `$t()` for all user-facing text. Follow established patterns in `src/lib/i18n/` for translation keys and pluralization.

### Translation Key Examples

Following the existing codebase pattern where translation keys are the actual English strings:

```typescript
// Workspace management
$t('Workspace Management');
$t('No workspaces yet');
$t('Create New Workspace');
$t('Load EPUB');
$t('Open Existing');

// UI text
$t('Workspaces ({count} total)', { count: workspaces.length });
$t('Current Workspace');
$t('No workspace selected');
$t('Single-click to open workspace');

// Action buttons
$t('Create New');
$t('Load EPUB');
$t('Delete');
$t('Close');
$t('Switch');

// Status and error messages
$t('Creating workspace...');
$t('Loading workspaces...');
$t('You have unsaved workspace changes. Continue?');
$t('Delete "{title}"? This cannot be undone.', { title: workspace.title });
$t('Failed to create workspace: {error}', { error: error.message });
$t('Failed to import EPUB: {error}', { error: error.message });

// Empty states
$t('No workspaces yet');
$t('Get started by creating your first EPUB');
$t('All your work is saved automatically');

// Relative time displays
$t('2 hours ago');
$t('1 day ago');
$t('3 days ago');
$t('Last modified');
```

---

## Summary of Design Decisions

Based on user feedback, this workspace UI design prioritizes simplicity, accessibility, and direct action workflows:

### Key Design Principles

- **No modal dialogs** - All actions navigate directly or use browser native dialogs
- **Single workspace list** - One list sorted by modification time (most recent first)
- **Direct actions** - Single-click to open, browser confirm() for destructive actions
- **Minimal UI complexity** - No dedicated error areas, selection states, or form modals
- **Explicit navigation** - Return to workspace view only via sidebar "Workspace" click

### Core Workflows Defined

1. **Create New**: Instant creation of "Untitled Book Project" → navigate to metadata view
2. **Load EPUB**: File picker → automatic import → navigate to imported workspace
3. **Open Existing**: Single-click workspace title → navigate to workspace
4. **Delete Workspace**: Delete button → browser confirm() → refresh list
5. **Error Handling**: Browser alerts for action failures, inline error badges for problematic workspaces

### Accessibility Features

- No complex focus management (no modals)
- All interactive elements meet 44px touch targets
- Simple keyboard navigation with logical tab order
- Direct actions without multi-step workflows
- Clear visual hierarchy and semantic markup

This design creates a streamlined, accessible workspace management experience that gets users into their content quickly while maintaining the robustness needed for EPUB project management.

## Technical Implementation Design

### Svelte Component Architecture

Following the established pattern from `src/lib/metadata/`, the workspace interface will use a single-owner architecture with props down and events up:

#### Component Hierarchy

```
WorkspaceView.svelte (main container - owns WorkspaceManager)
├── CurrentWorkspaceBar.svelte (active workspace display)
├── WorkspaceActionBar.svelte (Create New, Load EPUB buttons)
└── WorkspaceList.svelte (workspace listing container)
    └── WorkspaceItem.svelte (individual workspace row with delete)
```

#### Component Responsibilities

**WorkspaceView.svelte** (Main Container)

```typescript
interface WorkspaceViewProps {
  workspaceManager: WorkspaceManager;
}

interface WorkspaceViewEvents {
  workspaceOpened: { workspaceId: string };
  navigationRequested: { view: string; workspaceId?: string };
}
```

**Responsibilities:**

- Owns WorkspaceManager instance and coordinates all workspace operations
- Loads workspace list on mount via `workspaceManager.listWorkspacesWithMetadata()`
- Handles workspace creation, deletion, and opening operations
- Manages navigation events and current workspace state
- Coordinates error handling with browser alerts

**CurrentWorkspaceBar.svelte**

```typescript
interface CurrentWorkspaceBarProps {
  currentWorkspace: WorkspaceInfo | null;
}

interface CurrentWorkspaceBarEvents {
  switchRequested: {};
  closeRequested: {};
}
```

**Responsibilities:**

- Displays active workspace information (title from EPUB metadata)
- Provides Switch and Close actions for current workspace
- Shows "no workspace" state when none selected

**WorkspaceActionBar.svelte**

```typescript
interface WorkspaceActionBarProps {
  isLoading: boolean;
}

interface WorkspaceActionBarEvents {
  createNewRequested: {};
  loadEpubRequested: {};
}
```

**Responsibilities:**

- Renders Create New and Load EPUB action buttons
- Handles disabled state during loading operations
- Emits action events for parent coordination

**WorkspaceList.svelte**

```typescript
interface WorkspaceListProps {
  workspaces: WorkspaceInfo[];
  currentWorkspaceId: string | null;
  isLoading: boolean;
}

interface WorkspaceListEvents {
  workspaceSelected: { workspaceId: string };
  workspaceDeleted: { workspaceId: string };
}
```

**Responsibilities:**

- Renders list of workspaces sorted by modification time
- Handles empty state display
- Manages loading state with skeleton placeholders
- Coordinates WorkspaceItem interactions

**WorkspaceItem.svelte**

```typescript
interface WorkspaceItemProps {
  workspace: WorkspaceInfo;
  isCurrent: boolean;
  hasError: boolean;
}

interface WorkspaceItemEvents {
  selected: { workspaceId: string };
  deleteRequested: { workspaceId: string };
}
```

**Responsibilities:**

- Displays individual workspace information (title, author, modified date)
- Handles click-to-open interaction
- Renders delete button with appropriate styling
- Shows error state with warning icon when workspace has issues
- Highlights current workspace with visual distinction

#### Data Flow Pattern

**Central Coordination (Following metadata pattern):**

```
WorkspaceManager → WorkspaceView → Child Components
                      ↑               ↑
                   Events only    Events only
```

**Event Handling Example:**

```svelte
<!-- WorkspaceView.svelte -->
<script>
  const handleCreateNew = async () => {
    try {
      const metadata = createMinimalEPUBMetadata();
      const workspaceId = await workspaceManager.createEPUBWorkspace(metadata);

      // Navigate to new workspace
      dispatch('navigationRequested', {
        view: 'metadata',
        workspaceId,
      });
    } catch (error) {
      alert(`Failed to create workspace: ${error.message}`);
    }
  };

  const handleWorkspaceDelete = async event => {
    const { workspaceId } = event.detail;
    const workspace = workspaces.find(w => w.id === workspaceId);

    if (confirm(`Delete "${workspace.title}"? This cannot be undone.`)) {
      try {
        await workspaceManager.deleteWorkspace(workspaceId);
        await refreshWorkspaceList();
      } catch (error) {
        alert(`Failed to delete workspace: ${error.message}`);
      }
    }
  };
</script>
```

### Storybook Story Coverage

#### Story Organization

Stories will be created for each component to demonstrate different states and interactions using mock data:

**WorkspaceView Stories**

- `Empty State` - No workspaces, first-time user experience
- `Populated State` - Multiple workspaces with variety of metadata
- `Loading State` - Skeleton placeholders while loading
- `Mixed State` - Normal and error workspaces combined
- `Current Workspace` - One workspace marked as currently active

**WorkspaceActionBar Stories**

- `Default State` - Normal action buttons
- `Loading State` - Disabled buttons during operations
- `Interactive Demo` - Create New adds mock workspace to list

**WorkspaceList Stories**

- `Empty List` - No workspaces message
- `Populated List` - Multiple workspace items
- `Loading List` - Skeleton loading state
- `Error Items` - Mix of normal and problematic workspaces

**WorkspaceItem Stories**

- `Normal Workspace` - Standard workspace display
- `Current Workspace` - Highlighted as currently active
- `Error Workspace` - Warning icon and error styling
- `Long Title` - Text truncation handling
- `Recent vs Old` - Different relative time displays

**CurrentWorkspaceBar Stories**

- `No Workspace` - Empty state display
- `Active Workspace` - Current workspace information
- `Long Title` - Text truncation in workspace bar

#### Mock Data Structure

```typescript
// Mock workspace data for stories
const mockWorkspaces: WorkspaceInfo[] = [
  {
    id: 'workspace-1',
    title: 'The Adventures of Tom Sawyer',
    author: 'Mark Twain',
    language: 'en',
    lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    fileCount: 15,
    totalSize: 2400000,
    epubVersion: '3.0',
  },
  {
    id: 'workspace-2',
    title: 'Technical Manual for Advanced Users',
    author: 'John Smith',
    language: 'en',
    lastModified: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    fileCount: 8,
    totalSize: 890000,
    epubVersion: '3.0',
  },
  {
    id: 'workspace-error',
    title: 'Corrupted Project',
    author: 'Unknown',
    language: 'en',
    lastModified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    fileCount: 0,
    totalSize: 0,
    epubVersion: 'unknown',
    hasError: true,
  },
];
```

#### Interactive Behavior in Stories

**Limited Functionality for Visual Demonstration:**

- `Create New` button adds a mock "Untitled Book Project" to the workspace list
- `Load EPUB` button opens browser file dialog but performs no import
- `Delete` buttons show browser confirm() dialog but don't actually remove items
- Workspace clicks log selection to Storybook actions panel
- All interactions provide visual feedback without full backend integration

#### Story Controls and Knobs

- **Workspace count** - Adjust number of mock workspaces
- **Loading state** - Toggle loading/loaded states
- **Current workspace** - Select which workspace is marked as current
- **Error states** - Toggle error conditions on specific workspaces
- **Long titles** - Test text truncation with extended titles

### Testing Strategy

#### Unit Testing Approach

Following the established metadata component testing pattern with lightweight, focused tests:

**Individual Component Tests:**

- **Props handling** - Verify components render correctly with different prop values
- **Event emission** - Test that user interactions emit expected events
- **Conditional rendering** - Verify components show/hide elements based on props
- **Error states** - Test error styling and messaging display

**WorkspaceView Integration Tests:**

- **WorkspaceManager integration** - Mock manager and verify method calls
- **Event coordination** - Test that child component events trigger correct parent actions
- **Error handling** - Verify browser alerts appear for failed operations
- **Navigation events** - Test that workspace operations trigger navigation requests

**Example Test Structure:**

```typescript
// WorkspaceItem.test.ts
describe('WorkspaceItem', () => {
  it('renders workspace information correctly', () => {
    const mockWorkspace = createMockWorkspace();
    const { getByText } = render(WorkspaceItem, { workspace: mockWorkspace });

    expect(getByText(mockWorkspace.title)).toBeInTheDocument();
    expect(getByText(mockWorkspace.author)).toBeInTheDocument();
  });

  it('emits selected event when clicked', async () => {
    const mockWorkspace = createMockWorkspace();
    const { component, getByRole } = render(WorkspaceItem, { workspace: mockWorkspace });

    const mockHandler = vi.fn();
    component.$on('selected', mockHandler);

    await fireEvent.click(getByRole('button'));
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { workspaceId: mockWorkspace.id },
      })
    );
  });
});
```

**Test Coverage Goals:**

- Component rendering with various prop combinations
- Event emission accuracy and payload structure
- Error state display and styling
- Loading state placeholder behavior
- Integration between parent and child components

**Testing Exclusions:**

- No accessibility testing at this phase
- No end-to-end workflow testing
- No actual WorkspaceManager functionality testing (covered in workspace module tests)
- No browser API testing (file dialogs, localStorage)
