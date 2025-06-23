<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import EPUBPackagingDemo from './EPUBPackagingDemo.svelte';

  const { Story } = defineMeta({
    title: 'Features/EPUB Packaging',
    component: EPUBPackagingDemo,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
# EPUB Packaging Demo

This demo showcases the EPUB Packaging feature (Feature 03) which creates valid EPUB ZIP files from workspace content.

## Key Features Demonstrated

- **EPUB Structure Validation**: Reads container.xml to find OPF rootfile path
- **Metadata Extraction**: Parses OPF files for title, author, language, identifier
- **ZIP Creation**: Creates EPUB-compliant ZIP with proper mimetype handling
- **Compression Optimization**: Different compression methods based on file types
- **Progress Tracking**: Real-time updates during packaging process
- **Download Functionality**: Direct download of generated EPUB files

## Demo Workspace

The demo uses a minimal but complete EPUB structure:
- \`mimetype\` - EPUB media type declaration
- \`META-INF/container.xml\` - Points to OPF file location
- \`OEBPS/content.opf\` - Package metadata and manifest
- \`OEBPS/chapter1.xhtml\` - Sample chapter content
- \`OEBPS/styles.css\` - Basic styling

## How to Use

1. Click "Package EPUB" to start the packaging process
2. Watch the progress indicator as files are processed
3. View the packaging results including file count and compression ratio
4. Click "Download EPUB" to download the generated file

The generated EPUB can be opened in any standard EPUB reader.
          `
        }
      }
    },
    argTypes: {
      showProgress: {
        control: 'boolean',
        description: 'Show progress indicator during packaging'
      },
      allowDownload: {
        control: 'boolean',
        description: 'Enable download button for generated EPUB'
      }
    }
  });
</script>

<!-- Basic Demo Story -->
<Story 
  name="Basic Demo"
  args={{
    showProgress: true,
    allowDownload: true
  }}
  parameters={{
    docs: {
      description: {
        story: `
### Basic EPUB Packaging Demo

This story demonstrates the core EPUB packaging workflow with a simple but complete EPUB structure.

**Features shown:**
- Workspace file listing with MIME types
- Real-time progress tracking during packaging
- Packaging results with compression statistics
- Direct download functionality

**Try it:** Click the "Package EPUB" button to see the packaging process in action. The progress indicator will show each phase of the operation, and you can download the resulting EPUB file.
        `
      }
    }
  }}
>
  <EPUBPackagingDemo showProgress={true} allowDownload={true} />
</Story>

<!-- Without Progress Demo -->
<Story 
  name="Without Progress"
  args={{
    showProgress: false,
    allowDownload: true
  }}
  parameters={{
    docs: {
      description: {
        story: `
### Packaging Without Progress Display

This variant shows the same packaging functionality but without the progress indicator, demonstrating how the feature works when progress tracking is disabled.
        `
      }
    }
  }}
>
  <EPUBPackagingDemo showProgress={false} allowDownload={true} />
</Story>

<!-- Progress Only Demo -->
<Story 
  name="Progress Only"
  args={{
    showProgress: true,
    allowDownload: false
  }}
  parameters={{
    docs: {
      description: {
        story: `
### Progress Tracking Only

This variant focuses on the progress tracking capabilities, showing detailed information about the packaging process without the download functionality.
        `
      }
    }
  }}
>
  <EPUBPackagingDemo showProgress={true} allowDownload={false} />
</Story>