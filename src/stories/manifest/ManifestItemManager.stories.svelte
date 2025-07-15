<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ManifestItemManagerDemo from './ManifestItemManagerDemo.svelte';

  const { Story } = defineMeta({
    title: 'Components/Content/ManifestItemManager',
    component: ManifestItemManagerDemo,
    tags: ['autodocs'],
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component: `
# Manifest Item Manager Demo

Modal-based item creation and editing interface for EPUB manifest items. Supports both text file creation and binary file upload with comprehensive validation.

## Features Demonstrated

- **Dual Creation Modes**: Create text files or upload binary files
- **Form Validation**: Real-time validation with error highlighting
- **Smart Defaults**: Auto-generated IDs and media type detection
- **File Upload**: Drag-and-drop and file picker support with progress indication
- **Media Type Detection**: Automatic MIME type detection based on file extensions
- **Property Management**: EPUB-specific properties like 'nav', 'cover-image', etc.
- **Responsive Design**: Mobile-friendly modal with touch optimization

## Creation Workflows

- **Text File Creation**: Form-based creation with content input
- **File Upload**: Browser file picker with validation
- **Drag-and-Drop**: Visual drop zone with file validation
- **Batch Upload**: Multiple file selection and processing

## Validation Features

- Required field validation (ID, href, media type)
- Duplicate ID/href detection
- File size limits and format validation
- Real-time feedback with error styling
- Form submission prevention on validation errors

## Implementation Details

This item manager integrates with the ManifestManager API for:
- Duplicate detection across existing manifest items
- Media type detection using file extensions and content
- File size validation with configurable limits
- Progress tracking for large file uploads
- Error handling with user-friendly messages

The component follows accessibility best practices with proper ARIA labels, keyboard navigation, and screen reader support.
          `,
        },
      },
    },
    argTypes: {
      mode: {
        control: { type: 'select' },
        options: ['create-text', 'create-file', 'edit'],
        description: 'Creation or editing mode',
      },
      isOpen: {
        control: { type: 'boolean' },
        description: 'Whether the modal is open',
      },
      hasValidationErrors: {
        control: { type: 'boolean' },
        description: 'Show form with validation errors',
      },
      isLoading: {
        control: { type: 'boolean' },
        description: 'Show loading state during save operation',
      },
      uploadProgress: {
        control: { type: 'number', min: 0, max: 100 },
        description: 'File upload progress percentage',
      },
      existingItemId: {
        control: { type: 'text' },
        description: 'ID of item being edited (edit mode only)',
      },
      prefilledData: {
        control: { type: 'object' },
        description: 'Pre-filled form data for demonstration',
      },
    },
  });
</script>

<Story
  name="Create Text Form"
  args={{
    mode: 'create-text',
    isOpen: true,
    hasValidationErrors: false,
    isLoading: false,
    uploadProgress: 0,
    existingItemId: '',
    prefilledData: {},
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Text file creation form with empty fields. Shows the standard workflow for creating new XHTML/HTML content files with manual input.',
      },
    },
  }}
/>

<Story
  name="Create File Form"
  args={{
    mode: 'create-file',
    isOpen: true,
    hasValidationErrors: false,
    isLoading: false,
    uploadProgress: 0,
    existingItemId: '',
    prefilledData: {},
  }}
  parameters={{
    docs: {
      description: {
        story:
          'File upload interface with drag-and-drop zone. Demonstrates the file selection and upload workflow for binary content.',
      },
    },
  }}
/>

<Story
  name="Edit Form"
  args={{
    mode: 'edit',
    isOpen: true,
    hasValidationErrors: false,
    isLoading: false,
    uploadProgress: 0,
    existingItemId: 'chapter1',
    prefilledData: {
      id: 'chapter1',
      href: 'OEBPS/chapter1.xhtml',
      mediaType: 'application/xhtml+xml',
      properties: ['nav'],
    },
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Editing mode with pre-populated form fields. Shows how existing manifest items can be modified with validation.',
      },
    },
  }}
/>

<Story
  name="Validation Errors"
  args={{
    mode: 'create-text',
    isOpen: true,
    hasValidationErrors: true,
    isLoading: false,
    uploadProgress: 0,
    existingItemId: '',
    prefilledData: {
      id: '',
      href: '',
      mediaType: '',
    },
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Form with validation errors displayed. Shows error styling and messaging for required fields and format validation.',
      },
    },
  }}
/>

<Story
  name="Upload Progress"
  args={{
    mode: 'create-file',
    isOpen: true,
    hasValidationErrors: false,
    isLoading: true,
    uploadProgress: 65,
    existingItemId: '',
    prefilledData: {},
  }}
  parameters={{
    docs: {
      description: {
        story:
          'File upload in progress with progress bar. Demonstrates the upload feedback and loading states during file processing.',
      },
    },
  }}
/>

<Story
  name="Loading State"
  args={{
    mode: 'edit',
    isOpen: true,
    hasValidationErrors: false,
    isLoading: true,
    uploadProgress: 0,
    existingItemId: 'chapter2',
    prefilledData: {
      id: 'chapter2',
      href: 'OEBPS/chapter2.xhtml',
      mediaType: 'application/xhtml+xml',
    },
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Loading state during save operation. Shows disabled form controls and loading indicator while changes are being saved.',
      },
    },
  }}
/>

<Story
  name="Mobile View"
  args={{
    mode: 'create-text',
    isOpen: true,
    hasValidationErrors: false,
    isLoading: false,
    uploadProgress: 0,
    existingItemId: '',
    prefilledData: {},
  }}
  parameters={{
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story:
          'Mobile-responsive modal view with touch-optimized controls. Shows how the item manager adapts to smaller screens.',
      },
    },
  }}
/>

<Story
  name="Closed Modal"
  args={{
    mode: 'create-text',
    isOpen: false,
    hasValidationErrors: false,
    isLoading: false,
    uploadProgress: 0,
    existingItemId: '',
    prefilledData: {},
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Closed modal state showing the background context. Demonstrates the overlay and backdrop when the modal is not active.',
      },
    },
  }}
/>