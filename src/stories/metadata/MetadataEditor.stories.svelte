<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import MetadataEditorDemo from './MetadataEditorDemo.svelte';

  const { Story } = defineMeta({
    title: 'Components/Metadata/MetadataEditor',
    component: MetadataEditorDemo,
    tags: ['autodocs'],
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component: `
# Metadata Editor Demo

Complete metadata editor with tab navigation, form validation, and auto-save functionality. Uses real backend integration for authentic UX testing.

## Features Demonstrated

- **Tab Navigation**: Switch between Basic Info, Advanced, Publication Details, and Accessibility tabs
- **Form Validation**: Real-time validation with error indicators preventing tab switches with errors
- **Auto-save**: Silent background saving when fields lose focus
- **Array Management**: Add/remove authors, subjects, and contributors
- **Internationalization**: Fully translated interface supporting 7 languages
- **Real Backend**: Uses WorkspaceManager and MetadataManager for authentic data persistence

## Backend Status

- ✅ **Real WorkspaceManager**: Full EPUB workspace integration
- ✅ **Real MetadataManager**: Actual metadata validation and persistence  
- ✅ **Real FileStorageAPI**: OPFS/IndexedDB backend with quota monitoring

## Usage Instructions

1. **Initialize**: Demo automatically creates a workspace with sample metadata
2. **Navigate Tabs**: Click tabs to explore different metadata groups
3. **Edit Fields**: Change any field values to see real-time validation
4. **Array Fields**: Use + buttons to add authors/subjects, × to remove
5. **Generate ID**: Click "Generate" next to Identifier for a new UUID
6. **Error Testing**: Try clearing required fields to see validation in action

## Implementation Details

This metadata editor follows the established UX design patterns with:
- Event-based Svelte architecture avoiding prop drilling
- Tab validation preventing switches with errors
- Accessible ARIA labels and keyboard navigation
- RTL language support with logical CSS properties
- Error-only feedback (no save indicators for cleaner UX)

The implementation integrates with the complete metadata management system including validation, caching, and real file persistence.
          `,
        },
      },
    },
  });
</script>

<Story
  name="Metadata Editor Demo"
  parameters={{
    docs: {
      description: {
        story:
          'Interactive metadata editor using real backend integration. Demonstrates tab navigation, form validation, auto-save functionality, and error handling with authentic data persistence.',
      },
    },
  }}
/>
