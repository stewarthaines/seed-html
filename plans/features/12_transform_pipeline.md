# 12. Transform Pipeline

## Overview

Executes JavaScript transform scripts to convert plain text sources into XHTML spine items with proper error handling and sandboxing. Provides secure, extensible text and DOM transformations using user-defined scripts and 3rd party libraries.

## Requirements

### Functional Requirements

- **Script Execution**: Execute JavaScript transform functions in sandboxed context
- **Pipeline Flow**: Text transform first, then DOM transforms in sequence
- **Script Loading**: Load transform scripts from `SOURCE/scripts/` directory
- **Library Support**: Load 3rd party libraries from `SOURCE/extensions/` as globals
- **Settings Integration**: Configure pipeline via `SOURCE/settings.json`
- **Error Handling**: Comprehensive error capture with user-friendly messaging
- **XHTML Generation**: Template system for complete XHTML document creation

### Design Decisions

- **Script Location**: Transform scripts in `SOURCE/scripts/`, libraries in `SOURCE/extensions/`
- **Execution Order**: Always text transform first, then DOM transforms sequentially
- **Error Strategy**: Fail-fast - stop on first error with 2-second timeout
- **Function Pattern**: Top-level functions (transformText, transformDOM) in script files
- **Library Access**: 3rd party libraries loaded as globals in editor iframe
- **Context Support**: Manifest item context for advanced features (:toc directive)

### Performance Requirements

- **Timeout**: 2-second maximum execution time per transform
- **No Caching**: Re-evaluate transform functions each execution
- **Memory**: No specific limits, rely on browser constraints
- **Validation**: Runtime error handling only, no pre-validation

## Dependencies

- **#5 Blob URL Manager** - for loading extension libraries as globals
- **#23 SOURCE.zip** - for script and extension file management

## Technical Approach

### Directory Structure

```
SOURCE/
├── settings.json              # Pipeline configuration
├── scripts/                   # Transform scripts (app integration)
│   ├── markdown-transform.js  # Text transform implementation
│   ├── heading-ids.js         # DOM transform for navigation
│   └── custom-styling.js      # Additional DOM transforms
└── extensions/                # 3rd party libraries (loaded as globals)
    ├── markdown-it/
    │   ├── markdown-it.min.js  # Markdown processor library
    │   └── package.json
    └── abcjs/
        ├── abcjs-basic.min.js  # Music notation library
        └── package.json
```

### Settings Configuration

```json
{
  "transform_pipeline": {
    "text_transform": "markdown-transform.js",
    "dom_transforms": ["heading-ids.js", "custom-styling.js"]
  }
}
```

### Execution Flow

1. **Load Settings**: Parse `SOURCE/settings.json` for pipeline configuration
2. **Load Libraries**: Inject extension libraries as globals in iframe
3. **Text Transform**: Execute single text transform if configured
4. **DOM Transforms**: Execute DOM transforms sequentially in order
5. **Template Generation**: Create complete XHTML document with metadata
6. **Error Handling**: Stop on first failure with detailed error reporting

## API Design

```typescript
interface TransformPipeline {
  // Transform execution
  transformText(
    plainText: string,
    workspaceId: string,
    spineItemId: string
  ): Promise<TransformResult>;
  transformDom(
    xhtmlDocument: Document,
    workspaceId: string,
    spineItemId: string
  ): Promise<Document>;

  // Pipeline management
  loadTransformScripts(workspaceId: string): Promise<TransformScripts>;
  validateTransformScripts(scripts: TransformScripts): ValidationResult[];

  // Template management
  generateXHTMLTemplate(content: string, metadata: ChapterMetadata): string;
  parseXHTMLTemplate(template: string): { head: string; body: string };
}

interface TransformResult {
  success: boolean;
  transformedText?: string;
  xhtmlDocument?: Document;
  error?: TransformError;
  warnings?: string[];
}

interface TransformScripts {
  transformText?: string;
  transformDom?: string;
  extensions?: { [key: string]: string };
}

interface TransformError {
  stage: 'text' | 'dom' | 'template';
  message: string;
  line?: number;
  column?: number;
  stack?: string;
}

interface ChapterMetadata {
  title: string;
  language: string;
  stylesheets: string[];
  scripts: string[];
}
```

## Transform Text Implementation

```typescript
const executeTransformText = async (
  plainText: string,
  transformScript: string,
  workspaceId: string
): Promise<string> => {
  try {
    // Create sandboxed function
    const functionBody = `
      return (async function(plainText) {
        ${transformScript}
      })(arguments[0]);
    `;

    const transformFunction = new Function(functionBody);
    const result = await transformFunction(plainText);

    if (typeof result !== 'string') {
      throw new Error('Transform function must return a string');
    }

    return result;
  } catch (error) {
    throw new TransformError({
      stage: 'text',
      message: error.message,
      stack: error.stack,
    });
  }
};
```

## Transform DOM Implementation

```typescript
const executeTransformDom = async (
  xhtmlDocument: Document,
  transformScript: string,
  workspaceId: string
): Promise<Document> => {
  try {
    // Clone document to avoid modifying original
    const clonedDoc = xhtmlDocument.cloneNode(true) as Document;

    // Create sandboxed function with DOM access
    const functionBody = `
      return (async function(document) {
        ${transformScript}
        return document;
      })(arguments[0]);
    `;

    const transformFunction = new Function(functionBody);
    const result = await transformFunction(clonedDoc);

    if (!(result instanceof Document)) {
      throw new Error('Transform function must return a Document');
    }

    return result;
  } catch (error) {
    throw new TransformError({
      stage: 'dom',
      message: error.message,
      stack: error.stack,
    });
  }
};
```

## XHTML Template System

```typescript
const XHTML_TEMPLATE = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="{{language}}" lang="{{language}}">
<head>
  <meta charset="utf-8"/>
  <title>{{title}}</title>
  {{#stylesheets}}
  <link rel="stylesheet" type="text/css" href="{{href}}"/>
  {{/stylesheets}}
  {{#scripts}}
  <script type="text/javascript" src="{{src}}"></script>
  {{/scripts}}
</head>
<body>
{{content}}
</body>
</html>`;

const generateXHTMLDocument = (transformedContent: string, metadata: ChapterMetadata): string => {
  return XHTML_TEMPLATE.replace(/\{\{language\}\}/g, metadata.language)
    .replace(/\{\{title\}\}/g, escapeHTML(metadata.title))
    .replace(/\{\{content\}\}/g, transformedContent)
    .replace(/\{\{#stylesheets\}\}(.*?)\{\{\/stylesheets\}\}/gs, (match, template) => {
      return metadata.stylesheets.map(href => template.replace(/\{\{href\}\}/g, href)).join('\n  ');
    })
    .replace(/\{\{#scripts\}\}(.*?)\{\{\/scripts\}\}/gs, (match, template) => {
      return metadata.scripts.map(src => template.replace(/\{\{src\}\}/g, src)).join('\n  ');
    });
};
```

## Error Handling and Reporting

```typescript
class TransformError extends Error {
  stage: 'text' | 'dom' | 'template';
  line?: number;
  column?: number;

  constructor(details: {
    stage: string;
    message: string;
    line?: number;
    column?: number;
    stack?: string;
  }) {
    super(details.message);
    this.stage = details.stage as any;
    this.line = details.line;
    this.column = details.column;
    this.stack = details.stack;
  }

  toUserMessage(): string {
    const stageNames = {
      text: 'Text Transform',
      dom: 'DOM Transform',
      template: 'Template Generation',
    };

    let message = `Error in ${stageNames[this.stage]}: ${this.message}`;

    if (this.line) {
      message += ` (Line ${this.line}`;
      if (this.column) {
        message += `, Column ${this.column}`;
      }
      message += ')';
    }

    return message;
  }
}
```

## Script Loading and Validation

```typescript
const loadTransformScripts = async (workspaceId: string): Promise<TransformScripts> => {
  const scripts: TransformScripts = {};

  try {
    // Load transformText.js
    const transformTextPath = 'SOURCE/scripts/transformText.js';
    if (await fileExists(workspaceId, transformTextPath)) {
      scripts.transformText = await readFileAsText(workspaceId, transformTextPath);
    }

    // Load transformDom.js
    const transformDomPath = 'SOURCE/scripts/transformAbcjs.js';
    if (await fileExists(workspaceId, transformDomPath)) {
      scripts.transformDom = await readFileAsText(workspaceId, transformDomPath);
    }

    // Load extension scripts
    const extensionFiles = await listFiles(workspaceId, 'SOURCE/extensions/');
    for (const file of extensionFiles) {
      if (file.endsWith('.js')) {
        const name = file.replace('.js', '');
        scripts.extensions = scripts.extensions || {};
        scripts.extensions[name] = await readFileAsText(workspaceId, `SOURCE/extensions/${file}`);
      }
    }

    return scripts;
  } catch (error) {
    throw new Error(`Failed to load transform scripts: ${error.message}`);
  }
};
```

## Default Transform Scripts

```typescript
const DEFAULT_TRANSFORM_TEXT = `
// Default markdown transform using markdown-it
if (typeof window.markdownit === 'undefined') {
  throw new Error('markdown-it library not found. Please add markdown-it.min.js to SOURCE/extensions/');
}

const md = window.markdownit({
  html: true,
  xhtmlOut: true,
  breaks: false,
  linkify: true,
  typographer: true
});

return md.render(plainText);
`;

const DEFAULT_TRANSFORM_DOM = `
// Default DOM transform - add IDs to headings for navigation
const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

headings.forEach((heading, index) => {
  if (!heading.id) {
    const text = heading.textContent || '';
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || \`heading-\${index + 1}\`;
    
    heading.id = id;
  }
});

return document;
`;
```

## Safety and Sandboxing

```typescript
const createSandboxedFunction = (script: string, allowedGlobals: string[] = []) => {
  // Remove dangerous globals
  const dangerousGlobals = [
    'eval',
    'Function',
    'setTimeout',
    'setInterval',
    'fetch',
    'XMLHttpRequest',
  ];

  const sanitizedScript = `
    'use strict';
    ${dangerousGlobals.map(global => `const ${global} = undefined;`).join('\n')}
    
    ${script}
  `;

  return new Function('return (async function() { ' + sanitizedScript + ' })();');
};
```

## Testing Considerations

- Test with valid transform scripts
- Test error handling for malformed scripts
- Test security sandboxing
- Test with various markup formats
- Test DOM transformation accuracy
- Test template generation
- Test performance with large documents

## Performance Considerations

- Cache compiled transform functions
- Implement timeouts for long-running transforms
- Consider Web Workers for heavy processing
- Monitor memory usage during transforms

## Transform Function Examples

### Text Transform Script (SOURCE/scripts/markdown-transform.js)

```javascript
function transformText(plainText, context) {
  // Access global libraries loaded from SOURCE/extensions/
  if (typeof markdownit === 'undefined') {
    throw new Error('markdown-it library not available');
  }

  // Initialize markdown processor
  const md = markdownit({
    html: true,
    xhtmlOut: true,
    breaks: false,
    linkify: true,
  });

  // Handle :toc directive using context.manifestItems
  if (context.manifestItems) {
    plainText = plainText.replace(/:toc\[([^\]]+)\]\{src="([^"]+)"\}/g, (match, title, pattern) =>
      generateTOC(title, pattern, context.manifestItems)
    );
  }

  return md.render(plainText);
}

function generateTOC(title, pattern, manifestItems) {
  // Build table of contents from manifest items
  return `<h2>${title}</h2><ul>...</ul>`;
}
```

### DOM Transform Script (SOURCE/scripts/heading-ids.js)

```javascript
function transformDOM(document) {
  // Add IDs to headings for navigation
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

  headings.forEach((heading, index) => {
    if (!heading.id) {
      const text = heading.textContent || '';
      const id =
        text
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/^-|-$/g, '') || `heading-${index + 1}`;

      heading.id = id;
    }
  });

  return document;
}
```

## Implementation Plan

### Phase 1: Core Pipeline Implementation

1. **Create TransformPipeline class** in `src/lib/transform/`
   - `transform-pipeline.ts` - Main pipeline execution
   - `transform-manager.ts` - Script loading and settings
   - `transform-error.ts` - Error handling and messaging
   - `xhtml-template.ts` - XHTML document generation
   - `types.ts` - TypeScript interfaces
   - `index.ts` - Clean exports

2. **Implement core methods**:
   - `executeTransformPipeline()` - Full pipeline execution
   - `transformText()` - Text transform execution with context
   - `transformDOM()` - Sequential DOM transform execution
   - `generateXHTMLDocument()` - Complete document creation

3. **Add script management**:
   - `loadTransformScripts()` - Load scripts from SOURCE/scripts/
   - `loadTransformSettings()` - Parse SOURCE/settings.json
   - `validateTransformScript()` - Basic script validation

### Phase 2: Integration & Security

1. **Blob URL Manager Integration**:
   - Load extension libraries from SOURCE/extensions/
   - Inject libraries as globals in transform execution context
   - Manage library lifecycle and cleanup

2. **Sandboxing Implementation**:
   - Remove dangerous globals (eval, Function, setTimeout, etc.)
   - 2-second timeout enforcement
   - Error capture and user-friendly messaging

3. **Context Provider**:
   - Manifest item to blob URL mapping for :toc directive
   - Workspace and spine item identification
   - Settings access for advanced transforms

### Phase 3: Error Handling & Testing

1. **Comprehensive Error Handling**:
   - TransformError class with stage identification
   - User-friendly error messages
   - Technical error details for debugging
   - Graceful degradation strategies

2. **Unit Test Implementation**:
   - Mock File Storage API and Blob URL Manager
   - Test transform execution with various scripts
   - Error scenario testing (timeouts, syntax errors, runtime failures)
   - Integration tests with SOURCE.zip functionality

## Ready for Implementation

✅ **Complete API Documentation**: `src/lib/transform/API.md` with comprehensive method specifications
✅ **Technical Specifications Clarified**: All execution flow, security, and integration details defined
✅ **Function Contracts Established**: Transform function signatures and context requirements
✅ **Error Handling Strategy**: Complete error classification and user experience flows
✅ **Integration Patterns**: Clear integration with SOURCE.zip, Blob URL Manager, and Navigation Editor
✅ **Security Considerations**: Sandboxing approach and library loading strategy
✅ **Performance Requirements**: Timeout, caching, and execution constraints

**Next Steps**: Implement TransformPipeline class following the documented API contract and integration patterns.
