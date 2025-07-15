<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import EPUBPackagingDemo from './EPUBPackagingDemo.svelte';

  const { Story } = defineMeta({
    title: 'Backend/EPUB Packager',
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
          `,
        },
      },
    },
  });
</script>

<Story name="Basic Demo">
  <EPUBPackagingDemo showProgress={true} allowDownload={true} />
</Story>

<Story name="Without Progress">
  <EPUBPackagingDemo showProgress={false} allowDownload={true} />
</Story>

<Story name="Progress Only">
  <EPUBPackagingDemo showProgress={true} allowDownload={false} />
</Story>
