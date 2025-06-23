# EPUB Packaging Storybook Demo Plan

## Basic Demo Overview
Create a simple Storybook demonstration for the EPUB Packaging feature showing successful packaging with a minimal valid EPUB structure.

## Demo Story: `EPUBPackager/BasicDemo`

### Mock Workspace Configuration
```
mimetype (application/epub+zip)
META-INF/
  container.xml (valid rootfile reference)
OEBPS/
  content.opf (basic metadata: title, author, language, identifier)
  chapter1.xhtml
  styles.css
```

### Demo Features
- Package button to trigger packaging
- Progress indicator showing packaging phases
- Display packaging results (success, filename, file count, sizes)
- Download button for generated EPUB
- Show extracted metadata

### Demo Component
```typescript
interface EPUBPackagingDemoProps {
  showProgress?: boolean;
  allowDownload?: boolean;
}
```

### Implementation Files
- **Story**: `src/stories/EPUBPackaging.stories.svelte`
- **Mock Data**: Inline mock workspace with minimal valid EPUB structure
- **Demo**: Uses real EPUBPackager with mocked FileStorageAPI

### Demo Flow
1. Display mock workspace info (file count, structure preview)
2. Package button triggers EPUBPackager.packageEPUB()
3. Show progress updates during packaging
4. Display results (success, generated filename, metrics)
5. Enable download of packaged EPUB blob