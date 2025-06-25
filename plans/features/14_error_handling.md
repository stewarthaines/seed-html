# 14. Error Handling

## Overview

Comprehensive error detection, reporting, and recovery system for transform failures and other application errors with user-friendly messaging.

## Requirements

- Transform failure detection
- Informative error messages in preview iframe
- Graceful degradation when transforms fail
- User-friendly error reporting

## Dependencies

- **#5 Blob URL Manager** - for error page blob creation

## Technical Approach

- Centralized error handling system
- Error categorization and severity levels
- User-friendly error messages with recovery suggestions
- Fallback rendering for preview failures

## API Design

```typescript
interface ErrorHandler {
  // Error reporting
  reportError(error: AppError): void;
  reportTransformError(error: TransformError, context: ErrorContext): void;

  // Error recovery
  attemptRecovery(error: AppError): Promise<boolean>;
  suggestRecoveryActions(error: AppError): RecoveryAction[];

  // Error display
  displayErrorInPreview(error: TransformError, targetIframe: HTMLIFrameElement): void;
  showErrorNotification(error: AppError): void;

  // Error logging
  logError(error: AppError): void;
  getErrorHistory(): AppError[];
  clearErrorHistory(): void;
}

interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: string;
  timestamp: Date;
  context?: ErrorContext;
  stack?: string;
  recovered?: boolean;
}

type ErrorType =
  | 'transform-text'
  | 'transform-dom'
  | 'file-storage'
  | 'epub-parsing'
  | 'network'
  | 'validation'
  | 'ui'
  | 'unknown';

type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

interface ErrorContext {
  workspaceId?: string;
  spineItemId?: string;
  filePath?: string;
  operation?: string;
  userAction?: string;
}

interface RecoveryAction {
  label: string;
  action: () => Promise<void>;
  description?: string;
}
```

## Error Display Components

```svelte
<!-- ErrorPreview.svelte -->
<div class="error-preview">
  <div class="error-header">
    <Icon name="alert-circle" class="error-icon" />
    <h2>Transform Error</h2>
  </div>

  <div class="error-content">
    <div class="error-summary">
      <strong>{getErrorTitle(error)}</strong>
      <p>{error.message}</p>
    </div>

    {#if error.details}
      <details class="error-details">
        <summary>Technical Details</summary>
        <pre>{error.details}</pre>
      </details>
    {/if}

    {#if error.suggestions}
      <div class="error-suggestions">
        <h3>Suggested Solutions:</h3>
        <ul>
          {#each error.suggestions as suggestion}
            <li>{suggestion}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="error-actions">
      <button on:click={retryTransform} class="primary"> Retry Transform </button>
      <button on:click={showRawContent}> Show Raw Content </button>
      <button on:click={resetToDefault}> Reset Transform Scripts </button>
    </div>
  </div>
</div>

<style>
  .error-preview {
    padding: 2rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    max-width: 600px;
    margin: 2rem auto;
    border-radius: 8px;
    border: 2px solid var(--error-color);
  }

  .error-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    color: var(--error-color);
  }

  .error-icon {
    font-size: 1.5rem;
  }

  .error-details {
    margin: 1rem 0;
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: 4px;
  }

  .error-details pre {
    font-size: 0.875rem;
    overflow-x: auto;
  }

  .error-suggestions {
    margin: 1rem 0;
    padding: 1rem;
    background: var(--bg-tertiary);
    border-radius: 4px;
  }

  .error-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }
</style>
```

## Transform Error Detection

```typescript
const executeTransformWithErrorHandling = async (
  plainText: string,
  workspaceId: string,
  spineItemId: string
): Promise<TransformResult> => {
  try {
    // Load transform scripts
    const scripts = await loadTransformScripts(workspaceId);

    if (!scripts.transformText) {
      throw new TransformError({
        stage: 'text',
        message: 'No transform script found',
        suggestions: [
          'Create a transformText.js file in EDITME/scripts/',
          'Use the default markdown transform',
          'Check that your EPUB includes transform scripts',
        ],
      });
    }

    // Execute text transform
    let transformedText: string;
    try {
      transformedText = await executeTransformText(plainText, scripts.transformText, workspaceId);
    } catch (error) {
      throw new TransformError({
        stage: 'text',
        message: `Transform script error: ${error.message}`,
        details: error.stack,
        line: extractLineNumber(error.stack),
        suggestions: [
          'Check your transformText.js syntax',
          'Ensure all required libraries are loaded',
          'Test your transform script with simple input',
        ],
      });
    }

    // Generate XHTML document
    let xhtmlDoc: Document;
    try {
      const xhtmlString = generateXHTMLTemplate(transformedText, {
        title: getSpineItemTitle(spineItemId),
        language: await getWorkspaceLanguage(workspaceId),
        stylesheets: await getWorkspaceStylesheets(workspaceId),
        scripts: await getWorkspaceScripts(workspaceId),
      });

      xhtmlDoc = new DOMParser().parseFromString(xhtmlString, 'application/xml');

      if (xhtmlDoc.documentElement.tagName === 'parsererror') {
        throw new Error('Invalid XHTML generated');
      }
    } catch (error) {
      throw new TransformError({
        stage: 'template',
        message: `XHTML generation failed: ${error.message}`,
        suggestions: [
          'Check that transform output is valid HTML',
          'Ensure special characters are properly escaped',
          'Verify template syntax',
        ],
      });
    }

    // Execute DOM transform if available
    if (scripts.transformDom) {
      try {
        xhtmlDoc = await executeTransformDom(xhtmlDoc, scripts.transformDom, workspaceId);
      } catch (error) {
        throw new TransformError({
          stage: 'dom',
          message: `DOM transform error: ${error.message}`,
          details: error.stack,
          suggestions: [
            'Check your transformDom.js syntax',
            'Ensure DOM modifications are valid',
            'Test DOM transform with simple documents',
          ],
        });
      }
    }

    return {
      success: true,
      transformedText,
      xhtmlDocument: xhtmlDoc,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof TransformError
          ? error
          : new TransformError({
              stage: 'unknown',
              message: error.message,
              details: error.stack,
            }),
    };
  }
};
```

## Error Page Generation

```typescript
const generateErrorPage = (error: TransformError): string => {
  const errorPageHTML = `
    <!DOCTYPE html>
    <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <title>Transform Error</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 2rem;
          background: #f8f9fa;
          color: #212529;
        }
        
        .error-container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          border-left: 4px solid #dc3545;
        }
        
        .error-icon {
          font-size: 3rem;
          color: #dc3545;
          margin-bottom: 1rem;
        }
        
        .error-title {
          color: #dc3545;
          margin: 0 0 1rem 0;
        }
        
        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 1rem;
          border-radius: 4px;
          margin: 1rem 0;
        }
        
        .error-details {
          background: #f1f3f4;
          padding: 1rem;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.875rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        
        .suggestions {
          background: #d1ecf1;
          color: #0c5460;
          padding: 1rem;
          border-radius: 4px;
          margin: 1rem 0;
        }
        
        .suggestions ul {
          margin: 0.5rem 0 0 0;
          padding-left: 1.5rem;
        }
        
        .retry-button {
          background: #007bff;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
        }
        
        .retry-button:hover {
          background: #0056b3;
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <div class="error-icon">⚠️</div>
        <h1 class="error-title">${getErrorTitle(error)}</h1>
        
        <div class="error-message">
          <strong>${error.message}</strong>
          ${error.line ? `<br><small>Line ${error.line}${error.column ? `, Column ${error.column}` : ''}</small>` : ''}
        </div>
        
        ${
          error.details
            ? `
          <details>
            <summary>Technical Details</summary>
            <div class="error-details">${escapeHTML(error.details)}</div>
          </details>
        `
            : ''
        }
        
        ${
          error.suggestions
            ? `
          <div class="suggestions">
            <strong>Suggested Solutions:</strong>
            <ul>
              ${error.suggestions.map(s => `<li>${escapeHTML(s)}</li>`).join('')}
            </ul>
          </div>
        `
            : ''
        }
        
        <button class="retry-button" onclick="window.parent.postMessage({type: 'retry-transform'}, '*')">
          Retry Transform
        </button>
      </div>
    </body>
    </html>
  `;

  return errorPageHTML;
};
```

## Error Recovery Strategies

```typescript
const attemptErrorRecovery = async (error: TransformError): Promise<boolean> => {
  switch (error.stage) {
    case 'text':
      // Try with default markdown transform
      if (error.message.includes('not found') || error.message.includes('undefined')) {
        return await useDefaultTransform('markdown');
      }
      break;

    case 'dom':
      // Skip DOM transform and use text-only result
      return await skipDomTransform();

    case 'template':
      // Use simplified template
      return await useSimpleTemplate();

    default:
      return false;
  }

  return false;
};

const getRecoveryActions = (error: TransformError): RecoveryAction[] => {
  const actions: RecoveryAction[] = [];

  // Always available
  actions.push({
    label: 'Retry Transform',
    action: () => retryTransform(),
    description: 'Attempt the transformation again',
  });

  actions.push({
    label: 'Show Raw Content',
    action: () => showRawContent(),
    description: 'Display the plain text content without transformation',
  });

  // Stage-specific actions
  switch (error.stage) {
    case 'text':
      actions.push({
        label: 'Use Default Markdown',
        action: () => useDefaultTransform('markdown'),
        description: 'Replace transform script with default markdown processor',
      });
      break;

    case 'dom':
      actions.push({
        label: 'Skip DOM Transform',
        action: () => skipDomTransform(),
        description: 'Use text transform result without DOM processing',
      });
      break;
  }

  actions.push({
    label: 'Reset Transform Scripts',
    action: () => resetTransformScripts(),
    description: 'Restore default transform scripts',
  });

  return actions;
};
```

## Error Notification System

```svelte
<!-- ErrorNotification.svelte -->
<div class="error-notifications">
  {#each $errorStore.notifications as notification (notification.id)}
    <div
      class="notification"
      class:error={notification.severity === 'error'}
      class:warning={notification.severity === 'warning'}
      class:info={notification.severity === 'info'}
      in:fly={{ y: -50, duration: 300 }}
      out:fade={{ duration: 200 }}
    >
      <Icon name={getNotificationIcon(notification.severity)} />
      <div class="notification-content">
        <div class="notification-title">{notification.title}</div>
        <div class="notification-message">{notification.message}</div>
      </div>
      <button class="notification-close" on:click={() => dismissNotification(notification.id)}>
        ×
      </button>
    </div>
  {/each}
</div>
```

## Error Analytics

```typescript
const trackError = (error: AppError) => {
  // Log to console for development
  console.error('App Error:', error);

  // Store in error history
  errorHistory.push(error);

  // Keep only last 100 errors
  if (errorHistory.length > 100) {
    errorHistory.shift();
  }

  // Send to analytics (if enabled)
  if (analyticsEnabled) {
    analytics.track('error', {
      type: error.type,
      severity: error.severity,
      stage: error.context?.operation,
      recovered: error.recovered,
    });
  }
};
```

## Testing Considerations

- Test error detection accuracy
- Test error message clarity
- Test recovery action effectiveness
- Test error boundary functionality
- Test notification system
- Test with various error scenarios

## Implementation Notes

- Start with basic error detection
- Add recovery mechanisms incrementally
- Test error messages with real users
- Ensure accessibility of error displays
- Consider offline error handling
