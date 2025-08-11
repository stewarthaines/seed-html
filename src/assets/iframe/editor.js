/**
 * Transform Script Execution Engine
 *
 * Provides sandboxed execution of text and DOM transform scripts
 * with timeout protection and comprehensive error handling.
 *
 * This script runs inside the iframe and communicates with the parent
 * window via postMessage for security and isolation.
 */

/**
 * Transform execution environment with sandboxing and error handling
 */
class TransformExecutionEngine {
  constructor() {
    this.textTransformScript = '';
    this.domTransformScripts = [];
    this.loadedExtensionScripts = [];
    this.debugMode = false;
    this.messageHandlers = new Map();

    this.init();
  }

  /**
   * Initialize the execution environment
   */
  init() {
    this.setupMessageHandling();
    this.setupErrorHandling();
    this.signalReady();
  }

  /**
   * Set up message handling from parent window
   */
  setupMessageHandling() {
    window.addEventListener('message', event => {
      this.handleParentMessage(event.data);
    });

    // Register message handlers
    this.messageHandlers.set('SET_TRANSFORM_SCRIPTS', this.setTransformScripts.bind(this));
    this.messageHandlers.set('SET_EXTENSION_SCRIPTS', this.setExtensionScripts.bind(this));
    this.messageHandlers.set('EXECUTE_TRANSFORM', this.executeTransform.bind(this));
    this.messageHandlers.set('SET_DEBUG_MODE', this.setDebugMode.bind(this));
    this.messageHandlers.set('PING', this.handlePing.bind(this));
  }

  /**
   * Set up global error handling
   */
  setupErrorHandling() {
    window.addEventListener('error', event => {
      console.error('Global error in transform iframe:', event.error);
      this.notifyParent('GLOBAL_ERROR', {
        message: event.error?.message || 'Unknown global error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    });

    window.addEventListener('unhandledrejection', event => {
      console.error('Unhandled promise rejection in transform iframe:', event.reason);
      this.notifyParent('UNHANDLED_REJECTION', {
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
      });
    });
  }

  /**
   * Signal ready state to parent window
   */
  signalReady() {
    this.updateStatus('Transform execution environment ready', 'success');
    this.notifyParent('IFRAME_READY');

    if (this.debugMode) {
      this.debugLog('TransformExecutionEngine initialized');
    }
  }

  /**
   * Handle incoming messages from parent window
   */
  handleParentMessage(message) {
    if (!message || typeof message !== 'object') {
      return;
    }

    const { type, payload, messageId } = message;

    if (this.debugMode) {
      this.debugLog(`Received message: ${type}`, payload);
    }

    try {
      const handler = this.messageHandlers.get(type);
      if (handler) {
        handler(payload, messageId);
      } else {
        console.warn('Unknown message type received:', type);
        this.respondToParent(messageId, {
          success: false,
          error: { stage: 'communication', message: `Unknown message type: ${type}` },
        });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.respondToParent(messageId, {
        success: false,
        error: {
          stage: 'communication',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }
  }

  /**
   * Set transform scripts content
   */
  setTransformScripts(scripts, messageId) {
    try {
      this.textTransformScript = scripts.textTransform || '';
      this.domTransformScripts = scripts.domTransforms || [];

      const textScriptLength = this.textTransformScript.length;
      const domScriptCount = this.domTransformScripts.length;

      this.updateStatus(
        `Loaded text transform (${textScriptLength} chars) and ${domScriptCount} DOM transforms`,
        'success'
      );

      if (this.debugMode) {
        this.debugLog('Transform scripts updated', {
          textTransform: textScriptLength > 0,
          domTransformCount: domScriptCount,
        });
      }

      this.respondToParent(messageId, { success: true });
    } catch (error) {
      this.respondToParent(messageId, {
        success: false,
        error: {
          stage: 'script-loading',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Load extension scripts dynamically into iframe context
   */
  async setExtensionScripts(scripts, messageId) {
    try {
      // Clear any previously loaded extension scripts
      this.clearLoadedExtensions();
      
      const scriptCount = scripts.length;
      this.updateStatus(`Loading ${scriptCount} extension scripts...`, 'info');

      // Load each script sequentially to avoid race conditions
      for (const script of scripts) {
        await this.loadExtensionScript(script.name, script.blobUrl);
      }

      this.updateStatus(`Successfully loaded ${scriptCount} extension libraries`, 'success');

      if (this.debugMode) {
        this.debugLog('Extension scripts loaded', {
          scriptCount,
          scripts: scripts.map(s => s.name)
        });
      }

      this.respondToParent(messageId, { success: true });
    } catch (error) {
      this.updateStatus(`Failed to load extension scripts: ${error.message}`, 'error');
      this.respondToParent(messageId, {
        success: false,
        error: {
          stage: 'extension-loading',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Load a single extension script
   */
  async loadExtensionScript(name, blobUrl) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = blobUrl;
      
      // Set ID for easy identification in browser inspector
      // Convert name to valid HTML ID (replace invalid characters)
      const scriptId = `extension-${name.replace(/[^a-zA-Z0-9-_]/g, '-')}`;
      script.id = scriptId;
      
      script.onload = () => {
        if (this.debugMode) {
          this.debugLog(`Loaded extension script: ${name} (id: ${scriptId})`);
        }
        // Clean up blob URL after loading
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      script.onerror = (error) => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error(`Failed to load extension script ${name}: ${error}`));
      };
      
      // Add script to head to execute
      document.head.appendChild(script);
      
      // Store reference for cleanup
      if (!this.loadedExtensionScripts) {
        this.loadedExtensionScripts = [];
      }
      this.loadedExtensionScripts.push(script);
    });
  }

  /**
   * Clear previously loaded extension scripts
   */
  clearLoadedExtensions() {
    if (this.loadedExtensionScripts) {
      for (const script of this.loadedExtensionScripts) {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }
      this.loadedExtensionScripts = [];
    }
  }


  /**
   * Execute the complete transform pipeline
   */
  async executeTransform(request, messageId) {
    const { plainText, timeout = 3000 } = request;
    const startTime = performance.now();

    try {
      this.updateStatus('Executing transform pipeline...', 'info');

      if (this.debugMode) {
        this.debugLog('Starting transform execution', {
          plainTextLength: plainText.length,
          timeout,
          hasTextTransform: this.textTransformScript.length > 0,
          domTransformCount: this.domTransformScripts.length,
        });
      }

      // Step 1: Execute text transform
      let html = plainText;
      if (this.textTransformScript.trim()) {
        html = await this.executeTextTransformWithTimeout(plainText, timeout);

        if (this.debugMode) {
          this.debugLog('Text transform completed', {
            inputLength: plainText.length,
            outputLength: html.length,
          });
        }
      }

      // Step 2: Execute DOM transforms in sequence
      if (this.domTransformScripts.length > 0) {
        html = await this.executeDOMTransformsWithTimeout(html, timeout);

        if (this.debugMode) {
          this.debugLog('DOM transforms completed', {
            transformCount: this.domTransformScripts.length,
            finalLength: html.length,
          });
        }
      }

      const executionTime = performance.now() - startTime;
      this.updateStatus(`Transform completed in ${executionTime.toFixed(2)}ms`, 'success');

      this.respondToParent(messageId, {
        success: true,
        html,
        executionTime: Math.round(executionTime),
      });
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.updateStatus(
        `Transform failed: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );

      if (this.debugMode) {
        this.debugLog('Transform execution failed', {
          error: error instanceof Error ? error.message : String(error),
          stage: error && typeof error === 'object' && 'stage' in error ? error.stage : 'unknown',
          executionTime: Math.round(executionTime),
        });
      }

      this.respondToParent(messageId, {
        success: false,
        error: {
          stage:
            (error && typeof error === 'object' && 'stage' in error ? error.stage : null) ||
            'execution',
          message: error instanceof Error ? error.message : String(error),
          line: error && typeof error === 'object' && 'line' in error ? error.line : undefined,
          column:
            error && typeof error === 'object' && 'column' in error ? error.column : undefined,
          stack: error instanceof Error ? error.stack : undefined,
        },
        executionTime: Math.round(executionTime),
      });
    }
  }

  /**
   * Execute text transform with timeout protection
   * @param {any} plainText
   * @param {any} timeout
   */
  executeTextTransformWithTimeout(plainText, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Text transform execution timed out after ${timeout}ms`);
        error.stage = 'text-timeout';
        reject(error);
      }, timeout);

      try {
        const result = this.executeTextTransformSync(plainText);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error) error.stage = 'text';
        reject(this.enhanceError(error));
      }
    });
  }

  /**
   * Execute text transform synchronously
   * @param {any} plainText
   */
  executeTextTransformSync(plainText) {
    // Create sandboxed execution environment
    const globals = this.createSafeExecutionEnvironment();
    const globalNames = Object.keys(globals);
    const globalValues = Object.values(globals);

    // Wrap script in function with restricted globals
    const wrappedScript = `(function(${globalNames.join(', ')}) {
      ${this.textTransformScript}

      if (typeof transformText !== 'function') {
        throw new Error('transformText function is not defined in script');
      }

      return transformText;
    })`;

    // Execute wrapped script to get transform function
    const scriptFunction = new Function('return ' + wrappedScript)();
    const transformFunction = scriptFunction(...globalValues);

    // Execute transform with input text
    const result = transformFunction(plainText);

    // Ensure result is a string
    return typeof result === 'string' ? result : String(result);
  }

  /**
   * Execute DOM transforms with timeout protection
   * @param {any} html
   * @param {any} timeout
   */
  executeDOMTransformsWithTimeout(html, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`DOM transform execution timed out after ${timeout}ms`);
        error.stage = 'dom-timeout';
        reject(error);
      }, timeout);

      try {
        const result = this.executeDOMTransformsSync(html);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error) error.stage = 'dom';
        reject(this.enhanceError(error));
      }
    });
  }

  /**
   * Execute DOM transforms synchronously
   * @param {any} html
   */
  executeDOMTransformsSync(html) {
    // Parse HTML to DOM document
    const parser = new DOMParser();
    let document = parser.parseFromString(
      `<!DOCTYPE html><html><head></head><body>${html}</body></html>`,
      'text/html'
    );

    // Execute each DOM transform in sequence
    for (let i = 0; i < this.domTransformScripts.length; i++) {
      try {
        document = this.executeSingleDOMTransform(document, this.domTransformScripts[i], i);
      } catch (error) {
        if (error instanceof Error) error.stage = `dom-transform-${i}`;
        throw error;
      }
    }

    // Return transformed HTML content with XHTML compliance
    const serializer = new XMLSerializer();
    const fullBodySerialization = serializer.serializeToString(document.body);
    // Remove the opening and closing body tags to get just the content
    return fullBodySerialization.replace(/^<body[^>]*>|<\/body>$/g, '');
  }

  /**
   * Execute a single DOM transform script
   * @param {any} document
   * @param {any} script
   * @param {any} index
   */
  executeSingleDOMTransform(document, script, index) {
    // Create sandboxed execution environment
    const globals = this.createSafeExecutionEnvironment();
    const globalNames = Object.keys(globals);
    const globalValues = Object.values(globals);

    // Wrap script in function with restricted globals
    const wrappedScript = `(function(${globalNames.join(', ')}) {
      ${script}

      if (typeof transformDOM !== 'function') {
        throw new Error('transformDOM function is not defined in script ${index}');
      }

      return transformDOM;
    })`;

    // Execute wrapped script to get transform function
    const scriptFunction = new Function('return ' + wrappedScript)();
    const transformFunction = scriptFunction(...globalValues);

    // Execute transform with document
    const result = transformFunction(document);

    // Ensure result is a Document, return original if not
    return result instanceof Document ? result : document;
  }

  /**
   * Create safe execution environment with restricted globals
   */
  createSafeExecutionEnvironment() {
    // Start with safe browser APIs
    const safeGlobals = {
      // Safe JavaScript built-ins
      console,
      JSON,
      Math,
      Date,
      RegExp,
      String,
      Number,
      Boolean,
      Array,
      Object,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,

      // Safe DOM APIs (document is special-cased for transforms)
      document: typeof document !== 'undefined' ? document : undefined,
      DOMParser: typeof DOMParser !== 'undefined' ? DOMParser : undefined,

      // Extension libraries are available as native window globals after dynamic loading
    };

    // Explicitly remove dangerous globals that could break sandbox
    const dangerousGlobals = [
      'eval',
      'Function',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'requestAnimationFrame',
      'XMLHttpRequest',
      'fetch',
      'WebSocket',
      'EventSource',
      'import',
      'require',
      'process',
      'global',
      'globalThis',
      'window',
      'self',
      'parent',
      'top',
      'frames',
      'location',
      'history',
      'navigator',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'Worker',
      'SharedWorker',
    ];

    dangerousGlobals.forEach(dangerous => {
      delete safeGlobals[dangerous];
    });

    return safeGlobals;
  }

  /**
   * Enhance error object with additional context
   */
  enhanceError(error) {
    const enhanced = {
      message: error && error.message ? error.message : 'Unknown error',
      stage: error && error.stage ? error.stage : 'unknown',
      stack: error && error.stack ? error.stack : undefined,
    };

    // Try to extract line/column information from stack trace
    if (error && error.stack) {
      const lineMatch = error.stack.match(/at.*:(\d+):(\d+)/);
      if (lineMatch) {
        enhanced.line = parseInt(lineMatch[1], 10);
        enhanced.column = parseInt(lineMatch[2], 10);
      }
    }

    return enhanced;
  }

  /**
   * Set debug mode
   * @param {any} enabled
   * @param {any} messageId
   */
  setDebugMode(enabled, messageId) {
    this.debugMode = Boolean(enabled);
    this.updateStatus(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`, 'info');
    this.respondToParent(messageId, { success: true, debugMode: this.debugMode });
  }

  /**
   * Handle ping message for connectivity testing
   * @param {any} payload
   * @param {any} messageId
   */
  handlePing(payload, messageId) {
    const timestamp = Date.now();
    this.respondToParent(messageId, {
      success: true,
      pong: true,
      timestamp,
      payload,
    });
  }

  /**
   * Update status display in iframe
   * @param {any} message
   * @param {string} type
   */
  updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `transform-status visible ${type}`;
    }

    if (this.debugMode) {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Send notification to parent window (no response expected)
   * @param {any} type
   * @param {any} payload
   */
  notifyParent(type, payload = {}) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, payload }, '*');
    }
  }

  /**
   * Respond to parent window message
   * @param {any} messageId
   * @param {any} result
   */
  respondToParent(messageId, result) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'TRANSFORM_RESULT',
          messageId,
          payload: {
            result: result,
          },
        },
        '*'
      );
    }
  }

  /**
   * Debug logging utility
   * @param {any} message
   * @param {any} data
   */
  debugLog(message, data = null) {
    if (this.debugMode) {
      const timestamp = new Date().toISOString();
      console.log(`[DEBUG ${timestamp}] ${message}`, data || '');
    }
  }
}

// Initialize the transform execution engine when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new TransformExecutionEngine();
  });
} else {
  new TransformExecutionEngine();
}
