# EDITME.html User Guide

Welcome to EDITME.html, the browser-based EPUB editor that transforms your plain text into professionally formatted ebooks.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Using the Web Version](#using-the-web-version)
3. [Working Offline](#working-offline)
4. [Extracting from EPUBs](#extracting-from-epubs)
5. [Basic Workflow](#basic-workflow)
6. [Advanced Features](#advanced-features)
7. [Troubleshooting](#troubleshooting)

## Getting Started

EDITME.html works in modern web browsers without any installation. Choose your preferred method:

- **Quick Start**: Visit [web address coming soon] to begin editing immediately
- **Offline Use**: Download EDITME.html to work without internet
- **From EPUB**: Extract the editor from an Active EPUB file

### Browser Requirements

- **Chrome/Edge**: Version 119 or later
- **Firefox**: Version 119 or later  
- **Safari**: Version 17 or later

## Using the Web Version

### First Visit

1. Navigate to [web address coming soon]
2. The editor will load and initialize local storage
3. You can immediately:
   - Create a new EPUB project
   - Import an existing EPUB file
   - Continue previous work (auto-saved locally)

### Key Features

- **Auto-Save**: Your work is automatically saved to browser storage
- **No Account Required**: All data stays on your device
- **Offline Ready**: After first load, works without internet

### Privacy

- All editing happens in your browser
- No data is sent to servers
- Files remain on your device

## Working Offline

### Downloading EDITME.html

1. From the web version, select **File → Download Editor**
2. Save `EDITME.html` to your desired location
3. Double-click the file to open in your browser

### Offline Capabilities

When using the downloaded version:
- Full editing functionality
- All features work identically to web version
- Data persists between sessions
- No internet connection required

### File Access

For the best offline experience:
1. Save EDITME.html in your documents folder
2. Create a dedicated folder for your EPUB projects
3. Use the built-in file manager to organize work

## Extracting from EPUBs

Some EPUBs include EDITME.html for editing. To extract:

### Method 1: Using EDITME (Recommended)

1. Open any working copy of EDITME.html
2. Import the EPUB containing the editor
3. Navigate to the manifest view
4. Find and download `EDITME.html`

### Method 2: Manual Extraction

1. Rename the `.epub` file to `.zip`
2. Extract the ZIP file
3. Locate `OEBPS/EDITME.html`
4. Copy to your desired location

### Embedded Instructions

Active EPUBs should include a `README.txt` or similar file with specific extraction instructions for that publication.

## Basic Workflow

### Creating a New EPUB

1. **Start a New Project**
   - Click "New EPUB" or press `Ctrl/Cmd + N`
   - Enter basic metadata (title, author, language)

2. **Write Your Content**
   - Use the plain text editor
   - Write chapters in simple text format
   - The editor transforms text to XHTML automatically

3. **Preview Your Work**
   - Toggle preview pane with `Ctrl/Cmd + P`
   - Select different device sizes
   - Check formatting in real-time

4. **Export Your EPUB**
   - Click "Export" or press `Ctrl/Cmd + E`
   - Choose export options
   - Save the `.epub` file

### Importing Existing EPUBs

1. Click "Import" or drag-and-drop an EPUB file
2. The editor extracts and displays contents
3. Edit text sources if available
4. Or convert XHTML back to editable text

### Text Transformation

The editor uses a powerful transformation system:

```
Plain Text → Transform Scripts → Formatted XHTML → EPUB
```

Default transformations include:
- Paragraph detection
- Heading formatting
- List creation
- Emphasis and strong text
- Smart quotes

## Advanced Features

### Custom Transformations

1. **Access Transform Settings**
   - Go to Settings → Transforms
   - View available transform scripts

2. **Modify Transforms**
   - Edit existing scripts
   - Add custom processing rules
   - Test changes in preview

3. **Extension System**
   - Install transform extensions
   - Create your own extensions
   - Share with other users

### Multi-Language Support

1. **Change Interface Language**
   - Settings → Language
   - Choose from 7 languages
   - Interface updates immediately

2. **RTL Support**
   - Arabic and Hebrew automatically switch layout
   - Content direction adjusts appropriately

### Spine Management

1. **Reorder Chapters**
   - Drag and drop in spine sidebar
   - Use arrow keys for keyboard control
   - Changes save automatically

2. **Add/Remove Items**
   - Right-click for context menu
   - Use toolbar buttons
   - Keyboard shortcuts available

### Metadata Editing

1. **Basic Metadata**
   - Title, author, language
   - Publication date
   - ISBN/identifier

2. **Advanced Metadata**
   - Multiple authors/contributors
   - Series information
   - Custom properties

## Troubleshooting

### Storage Issues

**Problem**: "Storage quota exceeded" error
**Solution**: 
- Clear old projects from workspace manager
- Export completed EPUBs and remove from editor
- Check browser storage settings

### Import Failures

**Problem**: EPUB won't import
**Solution**:
- Verify file is not corrupted
- Check file size (very large EPUBs may fail)
- Try manual extraction method

### Transform Errors

**Problem**: Text not formatting correctly
**Solution**:
- Check transform script syntax
- Reset to default transforms
- Review error messages in console

### Browser Compatibility

**Problem**: Features not working
**Solution**:
- Update to latest browser version
- Check browser compatibility list
- Try different browser
- Disable browser extensions

### Data Recovery

Your work is saved in browser storage:
- **Chrome/Edge**: DevTools → Application → Storage
- **Firefox**: DevTools → Storage
- **Safari**: DevTools → Storage

To backup:
1. Export all EPUBs regularly
2. Use workspace export feature
3. Keep copies of custom transforms

## Tips and Best Practices

### Writing Tips

- Use consistent formatting in plain text
- Separate chapters with clear markers
- Let transforms handle formatting

### Performance

- Close unused projects
- Regular cleanup of workspace
- Modern browsers perform best

### Backup Strategy

1. Export EPUBs after major changes
2. Download transform scripts
3. Keep offline copy of editor
4. Document custom settings

## Getting Help

- **User Forum**: [coming soon]
- **Documentation**: Check other guides in project
- **Bug Reports**: [contact coming soon]

Remember: EDITME.html is freeware for personal use. Commercial use requires a license.