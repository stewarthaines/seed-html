# 12. Transform Pipeline

## Overview

Executes transformText.js and transformDom.js as dynamic functions to convert plain text sources into XHTML spine items with proper error handling.

## Requirements

- Execute transformText.js as dynamic function
- Execute transformDom.js for post-processing
- Error handling and user notification
- XHTML template generation with proper structure

## Dependencies

- **#5 Blob URL Manager** - for loading transform scripts

## Technical Approach

- Dynamic function execution in sandboxed context
- Pipeline architecture for chained transformations
- Error capture and user-friendly reporting
- XHTML template system with variable substitution

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
    const transformTextPath = 'EDITME/scripts/transformText.js';
    if (await fileExists(workspaceId, transformTextPath)) {
      scripts.transformText = await readFileAsText(workspaceId, transformTextPath);
    }

    // Load transformDom.js
    const transformDomPath = 'EDITME/scripts/transformDom.js';
    if (await fileExists(workspaceId, transformDomPath)) {
      scripts.transformDom = await readFileAsText(workspaceId, transformDomPath);
    }

    // Load extension scripts
    const extensionFiles = await listFiles(workspaceId, 'EDITME/ext/');
    for (const file of extensionFiles) {
      if (file.endsWith('.js')) {
        const name = file.replace('.js', '');
        scripts.extensions = scripts.extensions || {};
        scripts.extensions[name] = await readFileAsText(workspaceId, `EDITME/ext/${file}`);
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
  throw new Error('markdown-it library not found. Please add markdown-it.min.js to EDITME/ext/');
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

## Implementation Notes

- Start with basic function execution
- Add error handling incrementally
- Implement sandboxing carefully for security
- Test with real-world transform scripts
- Consider supporting multiple markup formats
