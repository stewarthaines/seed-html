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

    // Brokered file-access requests awaiting a BROKER_RESPONSE from the parent.
    this.brokerPending = new Map();
    this.brokerRequestId = 0;

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

    // Response to a file-access request this iframe sent to the parent.
    if (type === 'BROKER_RESPONSE') {
      this.resolveBrokerResponse(message);
      return;
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
          scripts: scripts.map(s => s.name),
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
      script.onerror = error => {
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
   * Send a file-access request to the parent and await its BROKER_RESPONSE. The
   * parent performs (and scopes) the actual I/O; this just bridges the sandbox.
   */
  callBroker(op, args) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.brokerRequestId;
      this.brokerPending.set(requestId, { resolve, reject });
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'BROKER_REQUEST', requestId, op, args }, '*');
      } else {
        this.brokerPending.delete(requestId);
        reject(new Error('File access is unavailable (no parent window)'));
      }
    });
  }

  /** Resolve/reject the promise for a returning BROKER_RESPONSE. */
  resolveBrokerResponse(message) {
    const pending = this.brokerPending.get(message.requestId);
    if (!pending) return;
    this.brokerPending.delete(message.requestId);
    if (message.ok) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error(message.error || 'File access failed'));
    }
  }

  /**
   * Build the `ctx` object passed as the third argument to transform functions.
   * Data fields (idref, basePath, manifest) come from the parent; the methods are
   * async capabilities brokered through the parent (see callBroker).
   */
  createTransformContext(transformCtx) {
    const data = transformCtx || {};
    return {
      idref: data.idref,
      basePath: data.basePath || '',
      manifest: Array.isArray(data.manifest) ? data.manifest : [],
      // Read a manifest item (declared in the OPF) as decoded UTF-8 text.
      readManifestText: href => this.callBroker('readManifestText', { href }),
      // Read a manifest item as a data: URL (for binary assets like images).
      readManifestDataURL: href => this.callBroker('readManifestDataURL', { href }),
      // Read a file from the project's SOURCE/ tree as text.
      readSourceText: path => this.callBroker('readSourceText', { path }),
      // Persist text under SOURCE/data/ (the only writable area).
      writeSourceText: (path, text) => this.callBroker('writeSourceText', { path, text }),
    };
  }

  /**
   * Execute the complete transform pipeline
   */
  async executeTransform(request, messageId) {
    const { plainText, timeout = 3000, idref, transformCtx } = request;
    const ctx = this.createTransformContext(transformCtx);
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
        html = await this.executeTextTransformWithTimeout(plainText, timeout, idref, ctx);

        if (this.debugMode) {
          this.debugLog('Text transform completed', {
            inputLength: plainText.length,
            outputLength: html.length,
          });
        }
      }

      // Step 2: Execute DOM transforms in sequence
      if (this.domTransformScripts.length > 0) {
        html = await this.executeDOMTransformsWithTimeout(html, timeout, idref, ctx);

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
        console.error('Transform execution failed', {
          error: error instanceof Error ? error.message : String(error),
          stage: error && typeof error === 'object' && 'stage' in error ? error.stage : 'unknown',
          executionTime: Math.round(executionTime),
        });
      }

      this.respondToParent(messageId, {
        success: false,
        error,
        executionTime: Math.round(executionTime),
      });
    }
  }

  /**
   * Execute text transform with timeout protection
   * @param {any} plainText
   * @param {any} timeout
   * @param {any} idref
   */
  executeTextTransformWithTimeout(plainText, timeout, idref, ctx) {
    // The transform may now be async (e.g. awaiting brokered file reads), so race
    // its promise against the timeout. A timed-out transform keeps running but its
    // result is discarded — there's no way to abort a Promise.
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        const error = new Error(`Text transform execution timed out after ${timeout}ms`);
        error.stage = 'text-timeout';
        reject(error);
      }, timeout);

      Promise.resolve()
        .then(() => this.executeTextTransform(plainText, idref, ctx))
        .then(result => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          if (error instanceof Error && !error.stage) error.stage = 'text';
          reject(this.enhanceError(error));
        });
    });
  }

  /**
   * Execute text transform (may be async when the script awaits ctx file access).
   * @param {any} plainText
   * @param {any} idref
   * @param {any} ctx
   */
  async executeTextTransform(plainText, idref, ctx) {
    // No text transform loaded yet (e.g. scripts still being read on first
    // load) — pass the input through unchanged rather than throwing on a
    // missing transformText function.
    if (!this.textTransformScript || !this.textTransformScript.trim()) {
      return plainText;
    }

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

    // Execute transform with input text, idref and the file-access ctx
    const result = await transformFunction(plainText, idref, ctx);

    // Ensure result is a string
    return typeof result === 'string' ? result : String(result);
  }

  /**
   * Execute DOM transforms with timeout protection
   * @param {any} html
   * @param {any} timeout
   * @param {any} idref
   */
  executeDOMTransformsWithTimeout(html, timeout, idref, ctx) {
    // Async-aware race (see executeTextTransformWithTimeout for the rationale).
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        const error = new Error(`DOM transform execution timed out after ${timeout}ms`);
        error.stage = 'dom-timeout';
        reject(error);
      }, timeout);

      Promise.resolve()
        .then(() => this.executeDOMTransforms(html, idref, ctx))
        .then(result => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          if (error instanceof Error && !error.stage) error.stage = 'dom';
          reject(this.enhanceError(error));
        });
    });
  }

  /**
   * Execute DOM transforms (may be async when scripts await ctx file access),
   * using direct live DOM when layout is needed.
   * @param {any} html
   * @param {any} idref
   * @param {any} ctx
   */
  async executeDOMTransforms(html, idref, ctx) {
    // Check if any transform scripts need layout calculations
    const needsLayout = this.checkIfLayoutNeeded();

    if (this.debugMode) {
      this.debugLog(`DOM transform mode decision: needsLayout=${needsLayout}`, {
        scriptCount: this.domTransformScripts.length,
        scriptsWithLayout: this.domTransformScripts.filter(script =>
          script.includes('getElementLayout')
        ).length,
      });
    }

    if (needsLayout) {
      // Use live DOM approach for layout-dependent transforms
      return await this.executeDOMTransformsWithLiveDOM(html, idref, ctx);
    } else {
      // Use standard parsed document approach for simple transforms
      return await this.executeDOMTransformsWithParsedDOM(html, idref, ctx);
    }
  }

  /**
   * Check if transform scripts need layout calculations
   */
  checkIfLayoutNeeded() {
    // Simple heuristic: check if any scripts mention getElementLayout
    return this.domTransformScripts.some(script => script.includes('getElementLayout'));
  }

  /**
   * Execute DOM transforms using live DOM for layout calculations
   */
  async executeDOMTransformsWithLiveDOM(html, idref, ctx) {
    const tempContainer = this.createLiveDOMContainer();

    try {
      // Put content directly in live DOM
      tempContainer.innerHTML = html;

      if (this.debugMode) {
        this.debugLog('Live DOM container created:', {
          innerHTML: tempContainer.innerHTML.substring(0, 200) + '...',
          elementCount: tempContainer.querySelectorAll('*').length,
          containerWidth: tempContainer.offsetWidth,
          containerHeight: tempContainer.offsetHeight,
          firstElementInfo: tempContainer.firstElementChild
            ? {
                tagName: tempContainer.firstElementChild.tagName,
                offsetWidth: tempContainer.firstElementChild.offsetWidth,
                offsetHeight: tempContainer.firstElementChild.offsetHeight,
                textContent: tempContainer.firstElementChild.textContent?.substring(0, 50),
              }
            : 'no first element',
        });
      }

      // Execute transforms on live DOM elements
      for (let i = 0; i < this.domTransformScripts.length; i++) {
        try {
          // Pass the live container as a document-like object
          const mockDocument = this.createMockDocument(tempContainer);
          await this.executeSingleDOMTransform(mockDocument, this.domTransformScripts[i], i, idref, ctx);
        } catch (error) {
          if (error instanceof Error) error.stage = `dom-transform-${i}`;
          throw error;
        }
      }

      // Return the transformed HTML from live DOM (including body element and attributes)
      // Create a body element with the container's attributes and content
      const serializer = new XMLSerializer();
      const bodyElement = document.createElement('body');

      // Copy all attributes from container to body
      for (let i = 0; i < tempContainer.attributes.length; i++) {
        const attr = tempContainer.attributes[i];
        bodyElement.setAttribute(attr.name, attr.value);
      }
      bodyElement.innerHTML = tempContainer.innerHTML;

      return serializer.serializeToString(bodyElement);
    } finally {
      this.cleanupTempAttachment(tempContainer);
    }
  }

  /**
   * Execute DOM transforms using parsed DOM (traditional approach)
   */
  async executeDOMTransformsWithParsedDOM(html, idref, ctx) {
    // Parse HTML to DOM document
    const parser = new DOMParser();
    let document = parser.parseFromString(
      `<!DOCTYPE html><html><head></head><body>${html}</body></html>`,
      'text/html'
    );

    // Execute each DOM transform in sequence
    for (let i = 0; i < this.domTransformScripts.length; i++) {
      try {
        document = await this.executeSingleDOMTransform(
          document,
          this.domTransformScripts[i],
          i,
          idref,
          ctx
        );
      } catch (error) {
        if (error instanceof Error) error.stage = `dom-transform-${i}`;
        throw error;
      }
    }

    // Return transformed HTML content with XHTML compliance (including body element and attributes)
    const serializer = new XMLSerializer();
    const fullBodySerialization = serializer.serializeToString(document.body);
    return fullBodySerialization;
  }

  /**
   * Create a live DOM container for layout calculations
   */
  createLiveDOMContainer() {
    const container = document.createElement('div');
    container.id = 'transform-live-container';

    // Set styles via JavaScript properties instead of CSS strings
    // This works better in iframe environments
    const style = container.style;
    style.position = 'fixed';
    style.top = '0px';
    style.left = '0px';
    style.width = '800px';
    style.minHeight = '600px';
    style.visibility = 'hidden';
    style.pointerEvents = 'none';
    style.fontFamily = 'Georgia, serif';
    style.fontSize = '16px';
    style.lineHeight = '1.6';
    style.color = 'black';
    style.backgroundColor = 'white';
    style.display = 'block';
    style.boxSizing = 'border-box';
    style.padding = '20px';

    document.body.appendChild(container);

    // Force layout calculation by accessing offsetWidth immediately
    const forceLayout1 = container.offsetWidth;

    // Try a different approach if that didn't work - temporarily make visible
    if (forceLayout1 === 0) {
      style.visibility = 'visible';
      style.opacity = '0';
      const forceLayout2 = container.offsetWidth;
      style.visibility = 'hidden';
      style.opacity = '1';

      if (this.debugMode) {
        this.debugLog('Container had zero width, tried visibility workaround', {
          beforeWorkaround: forceLayout1,
          afterWorkaround: forceLayout2,
        });
      }
    }

    if (this.debugMode) {
      this.debugLog('Created live DOM container for layout calculations', {
        offsetWidth: container.offsetWidth,
        offsetHeight: container.offsetHeight,
        clientWidth: container.clientWidth,
        clientHeight: container.clientHeight,
        computedWidth: window.getComputedStyle(container).width,
        computedDisplay: window.getComputedStyle(container).display,
        parentElement: container.parentElement ? container.parentElement.tagName : 'none',
        documentBody: document.body ? 'exists' : 'missing',
      });
    }

    return container;
  }

  /**
   * Create a mock document object that uses the live container as its body
   */
  createMockDocument(container) {
    return {
      body: container,
      querySelector: selector => container.querySelector(selector),
      querySelectorAll: selector => container.querySelectorAll(selector),
      createElement: tagName => document.createElement(tagName),
      // Add other document methods as needed
    };
  }

  /**
   * Clean up temporary DOM container
   */
  cleanupTempAttachment(container) {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);

      if (this.debugMode) {
        this.debugLog('Cleaned up temporary DOM container');
      }
    }
  }

  /**
   * Execute a single DOM transform script
   * @param {any} document
   * @param {any} script
   * @param {any} index
   * @param {any} idref
   */
  async executeSingleDOMTransform(document, script, index, idref, ctx) {
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

    // Execute transform with document, idref and the file-access ctx (may be async)
    const result = await transformFunction(document, idref, ctx);

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

      // Layout calculation utilities for attached DOM elements
      getElementLayout: this.createLayoutUtility(),

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
   * Create layout calculation utility for transform scripts
   */
  createLayoutUtility() {
    return element => {
      // Check if this is a real DOM element in the browser
      if (!element || !element.getBoundingClientRect) {
        if (this.debugMode) {
          this.debugLog('Layout requested for non-live element, returning defaults');
        }
        return {
          width: 0,
          height: 0,
          offsetWidth: 0,
          offsetHeight: 0,
          clientWidth: 0,
          clientHeight: 0,
          scrollWidth: 0,
          scrollHeight: 0,
          isAttached: false,
        };
      }

      // Element is live DOM - calculate real layout information
      const computedStyle = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      const layout = {
        // Dimensions from getBoundingClientRect (actual rendered size)
        width: rect.width,
        height: rect.height,

        // Element properties (includes padding/border/scrollbars)
        offsetWidth: element.offsetWidth,
        offsetHeight: element.offsetHeight,

        // Client dimensions (content + padding, excludes scrollbars/border)
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,

        // Scroll dimensions (total content size)
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,

        // Computed styles (useful for layout calculations)
        marginLeft: parseInt(computedStyle.marginLeft, 10) || 0,
        marginRight: parseInt(computedStyle.marginRight, 10) || 0,
        marginTop: parseInt(computedStyle.marginTop, 10) || 0,
        marginBottom: parseInt(computedStyle.marginBottom, 10) || 0,

        paddingLeft: parseInt(computedStyle.paddingLeft, 10) || 0,
        paddingRight: parseInt(computedStyle.paddingRight, 10) || 0,
        paddingTop: parseInt(computedStyle.paddingTop, 10) || 0,
        paddingBottom: parseInt(computedStyle.paddingBottom, 10) || 0,

        borderLeftWidth: parseInt(computedStyle.borderLeftWidth, 10) || 0,
        borderRightWidth: parseInt(computedStyle.borderRightWidth, 10) || 0,
        borderTopWidth: parseInt(computedStyle.borderTopWidth, 10) || 0,
        borderBottomWidth: parseInt(computedStyle.borderBottomWidth, 10) || 0,

        // Position information
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,

        // Attachment status
        isAttached: true,
      };

      if (this.debugMode) {
        this.debugLog('Layout calculated for live DOM element', {
          tagName: element.tagName,
          width: layout.width,
          height: layout.height,
          isAttached: layout.isAttached,
        });
      }

      return layout;
    };
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
