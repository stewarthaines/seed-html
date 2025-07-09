<!--
  Settings Manager Demo Story
  
  Demonstrates comprehensive settings management across three tiers:
  - Global Settings (localStorage with theme/i18n integration)
  - Workspace Settings (file-based with draft mode)
  - EPUB Settings (transform management and validation)
-->

<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import SettingsManagerDemo from './SettingsManagerDemo.svelte';

  const { Story } = defineMeta({
    title: 'Backend/Settings Manager',
    component: SettingsManagerDemo,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
# Settings Manager Demo

Interactive demonstration of the EPUB editor's comprehensive settings management system.

## Three-Tier Settings Architecture

### 🌍 Global Settings (localStorage)
- **Theme Management**: Light, dark, and system preference with live switching
- **Internationalization**: 7 languages with RTL support (Arabic, Hebrew)
- **Editor Preferences**: Font size and global interface settings
- **Integration**: Real-time theme store and i18n system updates

### 📁 Workspace Settings (File-Based)
- **Project Configuration**: Workspace-specific editor settings
- **Draft Mode**: Cache busting with incremental draft IDs
- **Editor Preferences**: Preview delays and advanced mode toggles
- **Persistence**: Stored in .workspace-metadata.json files

### 📖 EPUB Settings (Book-Specific)
- **Transform Scripts**: Text and DOM transformation pipeline configuration
- **Content Management**: Spine basename and file organization
- **Cover Design**: Template selection and styling options
- **Portability**: Travel with EPUB files in SOURCE/settings.json

## Features Demonstrated

### **Settings Operations**
- Load/save operations across all three tiers
- Default settings generation and validation
- Error handling with graceful fallbacks
- Real browser integration (no mocks)

### **Draft Mode Workflow**
- Draft ID incrementation and title generation
- Title parsing and information extraction
- Workspace-specific draft tracking
- Cache busting for development workflows

### **Transform Management**
- Built-in script discovery from SOURCE/scripts/
- Extension-based transform discovery
- Path validation and security checks
- Script resolution with existence verification

### **Validation System**
- Comprehensive input validation for all setting types
- Type checking and constraint enforcement
- Error reporting with detailed messages
- Edge case handling (null, undefined, invalid types)

### **Browser Integration**
- **Theme System**: Live theme switching with CSS custom properties
- **Internationalization**: Locale switching with direction changes
- **File Storage**: Real OPFS/IndexedDB integration
- **Extension System**: Dynamic script discovery

## Usage Instructions

1. **Initialize Demo**: Click "Create Demo Workspace" to set up isolated testing environment
2. **Explore Settings**: Use category buttons to demonstrate each settings tier
3. **Test Integration**: Watch live theme/locale changes in the interface
4. **Validate Input**: Use validation demo to see error handling
5. **Monitor Operations**: View detailed logging in the console output
6. **Reset State**: Use reset button for clean repeated testing

## Technical Implementation

- **Real APIs**: Uses actual SettingsManager, FileStorageAPI, and ExtensionManager
- **Browser Storage**: Demonstrates OPFS with IndexedDB fallback
- **Live Updates**: Reactive UI updates from settings changes
- **Error Handling**: Comprehensive error recovery and user feedback
- **Performance**: Efficient caching and batched operations

## Demo Scenarios

### **Basic Settings Tour**
Cycles through all three settings types showing load/save operations and default values.

### **Theme Integration**
Demonstrates live theme switching with settings persistence and CSS integration.

### **Locale Switching** 
Shows internationalization with RTL language support and direction changes.

### **Draft Mode Workflow**
Complete draft creation, incrementation, and title management cycle.

### **Validation Demo**
Comprehensive validation testing with error reporting and recovery.

This demo provides both interactive exploration and automated testing scenarios for comprehensive documentation and validation of the settings management system.
          `,
        },
      },
    },
  });
</script>

<!-- Basic interactive demo for manual exploration -->
<Story name="Interactive Demo">
  <SettingsManagerDemo />
</Story>

<!-- Automated demo with comprehensive workflow -->
<Story
  name="Complete Workflow Demo"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');

    const canvas = within(canvasElement);
    const user = userEvent.setup();

    try {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create workspace
      const createWorkspaceBtn = canvas.getByText('Create Demo Workspace');
      await user.click(createWorkspaceBtn);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Demo global settings (theme/locale switching)
      const globalSettingsBtn = canvas.getByText('Demo Theme & Locale');
      await user.click(globalSettingsBtn);
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Demo workspace settings
      const workspaceSettingsBtn = canvas.getByText('Demo Editor Settings');
      await user.click(workspaceSettingsBtn);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Demo EPUB settings
      const epubSettingsBtn = canvas.getByText('Demo Transform Scripts');
      await user.click(epubSettingsBtn);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Demo draft mode
      const draftModeBtn = canvas.getByText('Demo Draft Mode');
      await user.click(draftModeBtn);
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Demo validation
      const validationBtn = canvas.getByText('Demo Validation');
      await user.click(validationBtn);
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.log('Settings Manager demo play function failed:', error);
      // Continue to show current state
    }
  }}
>
  <SettingsManagerDemo />
</Story>

<!-- Theme integration focused demo -->
<Story
  name="Theme Integration Demo"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');

    const canvas = within(canvasElement);
    const user = userEvent.setup();

    try {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Focus on theme switching demonstration
      const globalSettingsBtn = canvas.getByText('Demo Theme & Locale');
      await user.click(globalSettingsBtn);
      
      // Allow full theme cycle to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      console.log('Theme integration demo failed:', error);
    }
  }}
>
  <SettingsManagerDemo />
</Story>

<!-- Validation focused demo -->
<Story
  name="Validation Demo"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');

    const canvas = within(canvasElement);
    const user = userEvent.setup();

    try {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Demonstrate validation system
      const validationBtn = canvas.getByText('Demo Validation');
      await user.click(validationBtn);
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error) {
      console.log('Validation demo failed:', error);
    }
  }}
>
  <SettingsManagerDemo />
</Story>

<!-- Draft mode workflow demo -->
<Story
  name="Draft Mode Demo"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');

    const canvas = within(canvasElement);
    const user = userEvent.setup();

    try {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create workspace first
      const createWorkspaceBtn = canvas.getByText('Create Demo Workspace');
      await user.click(createWorkspaceBtn);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Demonstrate draft mode workflow
      const draftModeBtn = canvas.getByText('Demo Draft Mode');
      await user.click(draftModeBtn);
      await new Promise(resolve => setTimeout(resolve, 4000));

    } catch (error) {
      console.log('Draft mode demo failed:', error);
    }
  }}
>
  <SettingsManagerDemo />
</Story>

<style>
  /* Override app.css body overflow: hidden for Storybook scrolling */
  :global(body) {
    overflow: auto !important;
  }
</style>
