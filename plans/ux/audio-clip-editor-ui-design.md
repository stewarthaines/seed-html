# Audio Clip Editor UI/UX Design Document

## Overview & Objectives

The Audio Clip Editor provides precise audio timestamp selection and clip directive insertion within the spine item editor. This design integrates seamlessly into the existing two-pane editor layout, appearing as an optional panel above the textarea when audio files are available in the workspace.

### High-Level Description

The Audio Clip Editor consists of a toggleable interface integrated into the spine item editor:

1. **Toggle Control**: Button in the "Text Content" pane header (same row as dropdown)
2. **Audio Controls Panel**: Horizontal control row(s) appearing below the dropdown when toggled on
3. **Text Integration**: Manual loading from selected `:clip[]{}` directives in the textarea

### Core Functionality

The editor provides comprehensive audio clip creation and editing:

- **Audio File Selection**: Dropdown of workspace audio manifest items
- **Range Input**: Visual slider for approximate start time positioning
- **Precise Time Inputs**: Start time and duration with `h:mm:ss.dd` format
- **Calculated End Time**: Automatic end time display based on start + duration
- **Audio Playback**: Full clip playback and "last 2 seconds" preview
- **Text Integration**: Load existing clip directives from textarea selection
- **Directive Insertion**: Insert formatted clip directives at cursor position

### Current Implementation Status

**Completed:**

- ✅ AudioClipService API with comprehensive functionality
- ✅ Unit tests with full coverage (36 passing tests)
- ✅ Service integration patterns with dependency injection
- ✅ Spine item editor infrastructure

**To Be Implemented:**

- 🔲 AudioClipEditor Svelte component
- 🔲 Toggle control integration in Text Content pane
- 🔲 Audio controls layout with responsive wrapping
- 🔲 Bi-directional range slider synchronization
- 🔲 Text selection parsing and loading
- 🔲 Directive insertion at cursor position

## Key Design Questions

### 1. Integration & Positioning ✅ **RESOLVED**

**Decision:** Toggleable panel in the spine item editor Text Content pane.

**Implementation:**
- **Toggle Button**: Same row as "Text Content" dropdown
- **Audio Panel**: Appears as new row below dropdown when toggled on
- **Stable UI**: Once toggled on, stays visible (no focus-based hiding)
- **Above Textarea**: Panel positioned between dropdown and textarea

**Rationale:** Provides clear visual hierarchy and stable UI behavior while maintaining clean layout when not needed.

### 2. Activation Logic ✅ **RESOLVED**

**Decision:** Conditional visibility based on workspace audio files.

**Implementation:**
- **Toggle Button Visibility**: Only appears when workspace contains `media-type="audio/*"` items
- **Clean UI**: No toggle button when feature isn't usable
- **Automatic Detection**: Button appears/disappears as audio files are added/removed from workspace

**Rationale:** Keeps UI clean and only shows the feature when it's actually functional.

### 3. Layout Constraints & Responsive Design ✅ **RESOLVED**

**Decision:** Single row with natural CSS wrapping, all features included.

**Implementation:**
- **Primary Row**: Audio Select → Range Input → Start Time → Duration → End Time → Play → Play Last 2s
- **Wrapped Row**: Jog Controls → Load from Selection → Insert Button
- **Natural Wrapping**: CSS flexbox wrapping at smaller breakpoints
- **Consistent Behavior**: Same responsive behavior across all screen sizes
- **No Feature Hiding**: All controls treated equally, no artificial prioritization

**Rationale:** Provides full functionality while adapting naturally to available space without complex breakpoint logic.

### 4. Selection Workflow ✅ **RESOLVED**

**Decision:** Manual loading from selected clip directive text.

**Implementation:**
- **Detection**: Automatically detect when valid `:clip[]{}` directive is selected in textarea
- **Manual Trigger**: "Load from Selection" button to populate editor fields
- **No Auto-Load**: No automatic population to prevent accidental overwrites
- **User Control**: Users explicitly choose when to load from selection

**Rationale:** Prevents accidental overwriting of current work while providing convenient editing of existing directives.

### 5. Range Input Integration ✅ **RESOLVED**

**Decision:** Two-way synchronization between range slider and start time input.

**Implementation:**
- **Bidirectional Sync**: Range slider updates start time input and vice versa
- **True Alternates**: Both controls represent the same value with different interaction methods
- **Real-time Updates**: Changes in either control immediately reflect in the other
- **Visual Positioning**: Range slider provides approximate positioning, time input provides precision

**Rationale:** Makes range slider and time input complementary tools rather than competing interfaces.

### 6. Error Handling & Validation ✅ **RESOLVED**

**Decision:** On-blur and on-enter validation for time inputs.

**Implementation:**
- **Validation Triggers**: When user leaves field (blur) or presses Enter key
- **Invalid Input Handling**: Reset to last valid value if input is invalid
- **Non-Intrusive**: No real-time validation styling during typing
- **Format Enforcement**: Strict `h:mm:ss.dd` format validation
- **User Feedback**: Brief error indication before resetting to valid value

**Rationale:** Allows users to edit freely without intrusive validation while ensuring data integrity.

### 7. Button States & Loading Feedback ✅ **RESOLVED**

**Decision:** Context-aware button states with Play/Stop toggle behavior.

**Loading States:**
- **Audio-Dependent Buttons**: Play and Play Last 2s disabled during audio loading
- **Other Buttons**: Load from Selection and Insert remain active during audio loading
- **Selective Disabling**: Only disable buttons that actually depend on loaded audio

**Playing States:**
- **Play Button Toggle**: Play button becomes "Stop" button during playback
- **Single Button**: No separate stop button, Play/Stop toggle behavior
- **Play Last 2s**: Remains separate button, also becomes "Stop" when active

**Rationale:** Provides clear feedback about what actions are available while maintaining simple, intuitive controls.

### 8. Accessibility & Visual Design ✅ **RESOLVED**

**Decision:** Standard keyboard navigation with minimal, compact design.

**Accessibility:**
- **Tab Order**: Standard left-to-right tab navigation through all controls
- **Skip Disabled**: Tab navigation skips disabled buttons appropriately  
- **Screen Reader**: Proper ARIA labels and form associations
- **Touch Targets**: Minimum 44px touch targets for mobile accessibility

**Visual Design:**
- **Minimal Styling**: Clean inputs and buttons matching existing app design
- **Compact Layout**: Smaller controls to maximize space efficiency in limited pane
- **Design System**: Use existing CSS design tokens and utility classes
- **No Audio Theming**: Avoid audio-specific visual elements, maintain app consistency

**Rationale:** Maintains consistency with existing app design while ensuring accessibility standards are met in a space-efficient layout.

## Final Design Specification

### Toggle Control Integration

**Text Content Pane Header:**
- Toggle button appears next to "Text Content" dropdown
- Button label: "Audio Clip Editor" or audio icon
- Only visible when workspace contains audio files
- Toggles audio controls panel visibility
- Button state persists during session

### Audio Controls Panel Layout

**Primary Control Row:**
1. **Audio Select** - Dropdown of workspace audio files (manifest items with `media-type="audio/*"`)
2. **Range Input** - Slider for approximate start time positioning (0 to audio duration)
3. **Start Time** - Text input with `h:mm:ss.dd` format and validation
4. **Duration** - Text input with `h:mm:ss.dd` format and validation  
5. **End Time** - Calculated display (start + duration, read-only)
6. **Play** - Button that becomes "Stop" during playback
7. **Play Last 2s** - Button for end-of-clip preview, becomes "Stop" during playback

**Wrapped Control Row** (appears below at smaller breakpoints):
1. **Jog Controls** - Fine adjustment buttons: -1, -0.1, +0.1, +1 (seconds)
2. **Load from Selection** - Button to load values from selected `:clip[]{}` text
3. **Insert** - Primary action button to insert formatted directive at cursor

### Interaction Model

**Primary Workflow:**
1. User toggles audio editor on (if audio files exist)
2. Select audio file from dropdown
3. Use range slider or start time input for rough positioning
4. Fine-tune with time inputs or jog controls
5. Preview with Play or Play Last 2s buttons
6. Insert directive with Insert button

**Alternative Workflow:**
1. User selects existing `:clip[]{}` directive in textarea
2. Click "Load from Selection" to populate editor fields
3. Make adjustments to timing
4. Insert updated directive

**Text Integration:**
- **Selection Detection**: Detect when valid clip directive is selected in textarea
- **Manual Loading**: "Load from Selection" button enabled when valid selection exists
- **Cursor Insertion**: Insert button places formatted directive at current cursor position
- **Template Support**: Use workspace setting `audioClipTemplate` or default format

### State Management

**Loading States:**
- Audio file loading disables Play and Play Last 2s buttons
- Other controls remain active during loading
- Visual loading indicator (spinner or text) during audio file loading

**Playback States:**
- Play button shows "Stop" during playback
- Play Last 2s button shows "Stop" during its playback
- Audio stops automatically at clip end boundary
- Clicking Stop returns to clip start position

**Validation States:**
- Invalid time format in inputs resets to last valid value on blur/enter
- Jog controls respect audio duration boundaries
- Range slider maximum adjusts to loaded audio duration
- End time updates automatically when start or duration changes

### Responsive Behavior

**Breakpoint Strategy:**
- Single CSS flexbox container with natural wrapping
- Primary controls wrap to second row when space is insufficient
- All controls maintain minimum touch target sizes (44px)
- No JavaScript breakpoint detection required

**Control Priorities** (wrap order):
1. **Always Visible**: Audio Select, Start Time, Duration, Play, Insert
2. **Second Priority**: Range Input, End Time, Play Last 2s  
3. **Wrap First**: Jog Controls, Load from Selection

### Error Handling

**No Audio Files:**
- Toggle button hidden completely
- Clean UI with no disabled states

**Audio Loading Failure:**
- Error message displayed in panel
- Retry mechanism or file selection reset
- Non-blocking error (other controls remain functional)

**Invalid Time Input:**
- On blur/enter: validate and reset to last valid value if invalid
- Brief visual feedback before reset
- No intrusive real-time validation

**Playback Failure:**
- Error message displayed
- Reset to stopped state
- Allow retry without reloading audio

## Implementation Requirements

### Component Structure

**AudioClipEditor.svelte:**
- Main component with full control layout
- Service injection via props (AudioClipService, SettingsService, WorkspaceService)
- Reactive state management with Svelte 5 runes
- Two-way range slider and time input synchronization
- Text selection detection and parsing
- Cursor position tracking for insertion

**Integration Points:**
- **Text Content Pane**: Toggle button in header row
- **Textarea Integration**: Selection detection and cursor insertion
- **Workspace State**: Audio file enumeration and workspace settings
- **Service Architecture**: AudioClipService for all audio operations

### Service Integration

**AudioClipService Usage:**
- `getAvailableAudioFiles()` for audio file dropdown
- `loadAudioFile()` for blob URL creation
- `parseClipDirective()` for loading from selection
- `formatClipDirective()` for insertion formatting
- `setClipRange()`, `playClip()`, `playLastSeconds()` for playback control
- `parseTimeString()`, `formatTimeString()` for time format conversion

**Settings Integration:**
- `audioClipTemplate` workspace setting for directive format
- Template placeholders: `<href>`, `<begin>`, `<end>`, `<rate>`
- Default template fallback

### Accessibility Implementation

**Keyboard Navigation:**
- Standard tab order through all controls
- Enter key submits time input validation
- Space/Enter activates buttons
- Arrow keys operate range slider

**Screen Reader Support:**
- Form labels associated with inputs
- Button purposes clearly described
- Time format requirements communicated
- Loading and error states announced

**Visual Accessibility:**
- High contrast design system colors
- Focus indicators on all interactive elements
- Error states with color and text indicators
- Minimum touch target sizes maintained

### CSS Design Approach

**Design System Integration:**
- Use existing CSS custom properties and utility classes
- Match existing form input and button styling
- Consistent spacing and typography
- Responsive breakpoints align with app patterns

**Layout Strategy:**
- Flexbox with gap for consistent spacing
- Natural wrapping with order properties
- Compact sizing while maintaining accessibility
- Minimal additional CSS beyond design system

### Next Steps

1. Implement AudioClipEditor.svelte component structure
2. Add toggle button integration to Text Content pane header
3. Implement responsive control layout with wrapping
4. Add range slider and time input bidirectional synchronization
5. Implement text selection detection and parsing
6. Add cursor position tracking and directive insertion
7. Integrate with AudioClipService for all audio operations
8. Add loading states and error handling
9. Implement accessibility features and keyboard navigation
10. Test responsive behavior and cross-browser compatibility

---

This design provides a comprehensive, accessible, and space-efficient audio clip editing interface that integrates seamlessly with the existing spine item editor while maintaining the app's design consistency and usability standards.