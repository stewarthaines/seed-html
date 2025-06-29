# 17. Navigation Editor

## Brainstorming

A simple extension to the existing handling of spine items as plain text. The navigation item gets slightly different xhtml head (no custom css or javascript). When the textarea is empty, the app will autogenerate xhtml directly (without populating the plain text navigation source) based on chapter manifest items and h1 text (from parsing the spine items xhtml in turn). It is allowed for the user to enter plain text, and the usual text/dom transform scripts will be applied. The third option is for advanced users which turns something like this `:toc[Contents]{src="chapter*, appendix1, appendix2"}` into a plain text (maybe markdown, maybe asciidoc) representation that gets passed through the pipeline. This script is outside the scope of this feature, but to support it the app does need to provide a mechanism for passing the mapping of manifest ids into blob urls into the text transform pipeline.

This feature should leverage as much of the existing text pipeline and spine editor functionality as possible.

## Overview

Split-pane interface for editing EPUB navigation with raw markup editor and rendered preview, supporting both auto-generation and manual editing.

## Requirements

- Split-pane interface (raw markup editor + rendered preview)
- Auto-generation of Table of Contents from spine items
- Manual markdown editing capability
- Live preview updates

## Dependencies

- **#4 Workspace & OPF Manager** - for spine item data
- **#12 Transform Pipeline** - for content processing

## Technical Approach

- Split editor layout with source and preview panes
- Navigation document generation from spine metadata
- Real-time markdown to XHTML conversion
- TOC structure extraction and manipulation

## API Design

TBD

## Navigation Editor Component

TBD

## Auto-generation from Spine

```typescript
const generateNavigationFromSpine = async (workspaceId: string): Promise<NavigationDocument> => {
  try {
    // Get spine items
    const spineItems = await spineItemManager.loadSpineItems(workspaceId);

    // Extract headings from each spine item
    const navPoints: NavPoint[] = [];
    let pointId = 1;

    for (const spineItem of spineItems) {
      if (!spineItem.linear) continue; // Skip non-linear items

      // Create main nav point for chapter
      const chapterNavPoint: NavPoint = {
        id: `nav-${pointId++}`,
        label: getDisplayTitle(spineItem),
        href: spineItem.href,
        children: [],
        level: 1,
        order: navPoints.length,
      };

      // Extract headings if source file exists
      if (spineItem.hasSourceFile && includeAllHeadings) {
        const headings = await extractHeadingsFromSpineItem(workspaceId, spineItem);

        for (const heading of headings) {
          if (heading.level <= maxTocDepth && heading.level > 1) {
            const headingNavPoint: NavPoint = {
              id: `nav-${pointId++}`,
              label: heading.text,
              href: `${spineItem.href}#${heading.id || heading.anchor}`,
              children: [],
              level: heading.level,
              order: chapterNavPoint.children.length,
            };

            chapterNavPoint.children.push(headingNavPoint);
          }
        }
      }

      navPoints.push(chapterNavPoint);
    }

    return {
      type: 'auto',
      navPoints,
      lastModified: new Date(),
    };
  } catch (error) {
    throw new Error(`Failed to generate navigation: ${error.message}`);
  }
};

const extractHeadingsFromSpineItem = async (
  workspaceId: string,
  spineItem: SpineItemWithSource
): Promise<Heading[]> => {
  if (!spineItem.sourcePath) return [];

  try {
    // Read source content
    const sourceContent = await fileStorage.readFile(workspaceId, spineItem.sourcePath);
    const sourceText = new TextDecoder().decode(sourceContent);

    // Transform to get XHTML
    const transformResult = await transformPipeline.transformText(
      sourceText,
      workspaceId,
      spineItem.id
    );

    if (!transformResult.success || !transformResult.xhtmlDocument) {
      return [];
    }

    // Extract headings from transformed content
    const headings: Heading[] = [];
    const headingElements = transformResult.xhtmlDocument.querySelectorAll('h1');

    headingElements.forEach((element, index) => {
      const level = parseInt(element.tagName.charAt(1));
      const text = element.textContent?.trim() || '';
      const id = element.id || generateHeadingId(text, index);

      if (text) {
        headings.push({ level, text, id, anchor: id });
      }
    });

    return headings;
  } catch (error) {
    console.warn(`Failed to extract headings from ${spineItem.sourcePath}:`, error);
    return [];
  }
};
```

## Manual Editing Support

TBD

## XHTML Navigation Generation

```typescript
const generateNavigationXHTML = (navPoints: NavPoint[]): string => {
  const generateNavList = (points: NavPoint[]): string => {
    if (points.length === 0) return '';

    const listItems = points
      .map(point => {
        const link = point.href
          ? `<a href="${escapeHTML(point.href)}">${escapeHTML(point.label)}</a>`
          : escapeHTML(point.label);

        const children = point.children.length > 0 ? `\n${generateNavList(point.children)}` : '';

        return `    <li>${link}${children}</li>`;
      })
      .join('\n');

    return `  <ol>\n${listItems}\n  </ol>`;
  };

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Table of Contents</title>
  <style>
    nav ol {
      list-style-type: none;
      padding-left: 0;
    }
    nav ol ol {
      padding-left: 1.5em;
    }
    nav a {
      text-decoration: none;
      color: inherit;
    }
    nav a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
${generateNavList(navPoints)}
  </nav>
</body>
</html>`;
};
```

## Live Preview Updates

TBD

## Navigation Validation

```typescript
const validateNavigation = (navDoc: NavigationDocument): ValidationResult[] => {
  const errors: ValidationResult[] = [];

  // Check for empty navigation
  if (!navDoc.navPoints || navDoc.navPoints.length === 0) {
    errors.push({
      field: 'navigation',
      message: 'Navigation must contain at least one item',
      severity: 'warning',
    });
  }

  // Validate nav point structure
  const validateNavPoints = (points: NavPoint[], parentLevel = 0) => {
    points.forEach(point => {
      // Check required fields
      if (!point.label.trim()) {
        errors.push({
          field: 'navigation',
          message: `Navigation item missing label: ${point.id}`,
          severity: 'error',
        });
      }

      // Validate href if present
      if (point.href && !isValidHref(point.href)) {
        errors.push({
          field: 'navigation',
          message: `Invalid href: ${point.href}`,
          severity: 'warning',
        });
      }

      // Check level consistency
      if (point.level <= parentLevel) {
        errors.push({
          field: 'navigation',
          message: `Invalid nesting level for: ${point.label}`,
          severity: 'warning',
        });
      }

      // Recursively validate children
      if (point.children.length > 0) {
        validateNavPoints(point.children, point.level);
      }
    });
  };

  validateNavPoints(navDoc.navPoints);
  return errors;
};
```

## Testing Considerations

- Test auto-generation from spine items
- Test manual markdown editing
- Test live preview updates
- Test navigation structure validation

## Implementation Notes

- Start with auto-generation functionality
- Add manual editing incrementally
- Test with various spine structures
- Ensure accessibility compliance
