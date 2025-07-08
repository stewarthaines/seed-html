<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import WorkspaceComponentsDemo from './WorkspaceComponentsDemo.svelte';

  const { Story } = defineMeta({
    title: 'Components/Workspace Management',
    component: WorkspaceComponentsDemo,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
# Workspace Management Components

Interactive demonstration of the workspace management UI components.

## Components Demonstrated

- **CurrentWorkspaceBar**: Shows active workspace with switch/close actions
- **WorkspaceActionBar**: Primary actions (Create New, Load EPUB, Import from Folder)
- **WorkspaceList**: Displays all workspaces with search and filtering
- **WorkspaceItem**: Individual workspace display with metadata and actions

## Features Demonstrated

- **Component Composition**: How components work together in the workspace view
- **Event Handling**: Inter-component communication using events
- **State Management**: Workspace selection and management
- **Error States**: Handling and displaying workspace errors
- **Responsive Design**: Mobile-friendly layout and interactions
- **Accessibility**: Keyboard navigation and screen reader support

## Usage Instructions

1. **View Different States**: Toggle between empty, populated, and loading states
2. **Test Interactions**: Click workspace items, action buttons, and navigation
3. **Search Functionality**: Use the search box to filter workspaces
4. **Error Handling**: View how components display error states
5. **Current Workspace**: See how the current workspace is highlighted

## Design System Integration

Components use the established design system:
- CSS design tokens for consistent styling
- Semantic HTML with proper ARIA labels
- 44px minimum touch targets for accessibility
- Focus management and keyboard navigation
- RTL layout support for international usage

## Mock Data

The demo uses realistic mock data representing various workspace states:
- Normal workspaces with different metadata
- Error workspaces with validation issues
- Different file counts and sizes
- Various languages and authors
- Recent vs older modification dates
          `
        }
      }
    }
  });
</script>

<Story name="Default">
  <WorkspaceComponentsDemo />
</Story>

<Story name="Empty State">
  <WorkspaceComponentsDemo showEmptyState={true} />
</Story>

<Story name="Loading State">
  <WorkspaceComponentsDemo showLoadingState={true} />
</Story>

<Story name="With Errors">
  <WorkspaceComponentsDemo showErrorStates={true} />
</Story>

<Story name="Mobile View">
  <div style="max-width: 375px; margin: 0 auto; border: 1px solid #ccc;">
    <WorkspaceComponentsDemo />
  </div>
</Story>