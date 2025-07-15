<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ManifestPreviewDemo from './ManifestPreviewDemo.svelte';

  const { Story } = defineMeta({
    title: 'Components/Content/ManifestPreview',
    component: ManifestPreviewDemo,
    tags: ['autodocs'],
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component: `
# Manifest Preview Demo

Content preview component for displaying manifest item content with appropriate rendering based on media type. Supports text, image, audio, video, and binary content types.

## Features Demonstrated

- **Multi-format Support**: Text, images, audio, video, and binary files
- **Rich Text Preview**: Syntax-highlighted XHTML/HTML/CSS content
- **Media Playback**: Embedded audio and video players with controls
- **Image Display**: Responsive image preview with metadata
- **File Information**: Detailed metadata display for all content types
- **Error Handling**: Graceful fallbacks for unsupported or corrupted files
- **Download Support**: Download buttons for binary and large files

## Content Type Support

- **Text Files**: XHTML, HTML, CSS, JavaScript with syntax highlighting
- **Images**: JPEG, PNG, GIF, SVG with responsive display
- **Audio**: MP3, WAV, OGG with playback controls
- **Video**: MP4, WebM with embedded player
- **Binary**: Fonts, PDFs, ZIP files with download option

## Implementation Details

This preview component integrates with the ManifestManager for content loading and provides:
- Lazy loading for performance optimization
- Content caching to reduce repeated requests
- Accessibility features including ARIA labels
- Responsive design for mobile compatibility
- Error boundaries for robust content handling

The component follows the established design system with consistent spacing, typography, and color schemes.
          `,
        },
      },
    },
    argTypes: {
      contentType: {
        control: { type: 'select' },
        options: ['none', 'text', 'image', 'audio', 'video', 'binary'],
        description: 'Type of content to preview',
      },
      selectedItemId: {
        control: { type: 'text' },
        description: 'ID of the selected manifest item',
      },
      isLoading: {
        control: { type: 'boolean' },
        description: 'Show loading state while content loads',
      },
      hasError: {
        control: { type: 'boolean' },
        description: 'Show error state for failed content loading',
      },
      showMetadata: {
        control: { type: 'boolean' },
        description: 'Display detailed file metadata',
      },
      enableActions: {
        control: { type: 'boolean' },
        description: 'Show action buttons (edit, download, delete)',
      },
      contentSize: {
        control: { type: 'select' },
        options: ['small', 'medium', 'large'],
        description: 'Size of the content for testing',
      },
    },
  });
</script>

<Story
  name="No Selection"
  args={{
    contentType: 'none',
    selectedItemId: '',
    isLoading: false,
    hasError: false,
    showMetadata: true,
    enableActions: true,
    contentSize: 'medium',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Empty preview state when no item is selected. Shows placeholder message encouraging user to select an item from the manifest table.',
      },
    },
  }}
/>

<Story
  name="Text File Preview"
  args={{
    contentType: 'text',
    selectedItemId: 'chapter1',
    isLoading: false,
    hasError: false,
    showMetadata: true,
    enableActions: true,
    contentSize: 'medium',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'XHTML content preview with syntax highlighting. Shows formatted text content with proper indentation and color coding for markup elements.',
      },
    },
  }}
/>

<Story
  name="Image Preview"
  args={{
    contentType: 'image',
    selectedItemId: 'cover-image',
    isLoading: false,
    hasError: false,
    showMetadata: true,
    enableActions: true,
    contentSize: 'medium',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Image file preview with responsive display. Shows the image with appropriate scaling and metadata including dimensions and file size.',
      },
    },
  }}
/>

<Story
  name="Audio Preview"
  args={{
    contentType: 'audio',
    selectedItemId: 'audio-clip',
    isLoading: false,
    hasError: false,
    showMetadata: true,
    enableActions: true,
    contentSize: 'medium',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Audio file preview with playback controls. Displays audio player with standard controls and metadata including duration and bitrate.',
      },
    },
  }}
/>

<Story
  name="Video Preview"
  args={{
    contentType: 'video',
    selectedItemId: 'video-intro',
    isLoading: false,
    hasError: false,
    showMetadata: true,
    enableActions: true,
    contentSize: 'medium',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Video file preview with embedded player. Shows video content with playback controls and metadata including duration and resolution.',
      },
    },
  }}
/>

<Story
  name="Binary File Info"
  args={{
    contentType: 'binary',
    selectedItemId: 'font-regular',
    isLoading: false,
    hasError: false,
    showMetadata: true,
    enableActions: true,
    contentSize: 'medium',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Binary file information display for unsupported preview types. Shows file icon, metadata, and download option for fonts, PDFs, etc.',
      },
    },
  }}
/>

<Story
  name="Loading Preview"
  args={{
    contentType: 'text',
    selectedItemId: 'chapter2',
    isLoading: true,
    hasError: false,
    showMetadata: true,
    enableActions: true,
    contentSize: 'medium',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Loading state while content is being fetched. Displays skeleton placeholder with loading indicator and appropriate messaging.',
      },
    },
  }}
/>

<Story
  name="Error Preview"
  args={{
    contentType: 'text',
    selectedItemId: 'broken-file',
    isLoading: false,
    hasError: true,
    showMetadata: false,
    enableActions: false,
    contentSize: 'medium',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Error state when content loading fails. Shows error message with retry option and helpful troubleshooting information.',
      },
    },
  }}
/>

<Story
  name="Large Content"
  args={{
    contentType: 'text',
    selectedItemId: 'large-chapter',
    isLoading: false,
    hasError: false,
    showMetadata: true,
    enableActions: true,
    contentSize: 'large',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Preview of large content files with scrollable container. Demonstrates performance optimization and user experience for large text files.',
      },
    },
  }}
/>

<Story
  name="Mobile View"
  args={{
    contentType: 'image',
    selectedItemId: 'mobile-image',
    isLoading: false,
    hasError: false,
    showMetadata: true,
    enableActions: true,
    contentSize: 'medium',
  }}
  parameters={{
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story:
          'Mobile-responsive preview with touch-friendly controls. Shows how the preview component adapts to smaller screens.',
      },
    },
  }}
/>