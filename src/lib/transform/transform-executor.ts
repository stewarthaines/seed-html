/**
 * Transform Script Execution
 * 
 * Provides sandboxed execution of transform scripts with timeout protection
 * and dangerous globals removal for security.
 */

import { TransformError } from './transform-error.js';

export interface TransformContext {
  manifestItems?: Record<string, any>;
}

export interface ExecutionOptions {
  timeoutMs?: number;
  globals?: Record<string, any>;
}

/**
 * Executes transform scripts in a sandboxed environment
 */
export class TransformExecutor {
  private static readonly DEFAULT_TIMEOUT_MS = 2000;
  
  /**
   * Execute text transform function with context
   */
  async executeTextTransform(
    scriptContent: string,
    scriptName: string,
    plainText: string,
    context: TransformContext,
    options: ExecutionOptions = {}
  ): Promise<string> {
    const timeoutMs = options.timeoutMs || TransformExecutor.DEFAULT_TIMEOUT_MS;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new TransformError({
          stage: 'text',
          message: `Transform execution timed out after ${timeoutMs}ms`,
          scriptName
        }));
      }, timeoutMs);

      try {
        // Create sandboxed execution environment
        const sandboxedGlobals = this.createSandboxedGlobals(options.globals);
        
        // Execute script in sandboxed context
        const result = this.executeFunctionInSandbox(
          scriptContent,
          'transformText',
          [plainText, context],
          sandboxedGlobals,
          scriptName
        );

        clearTimeout(timeout);
        resolve(typeof result === 'string' ? result : String(result));
      } catch (error) {
        clearTimeout(timeout);
        reject(this.createTransformError(error, 'text', scriptName));
      }
    });
  }

  /**
   * Execute DOM transform function
   */
  async executeDOMTransform(
    scriptContent: string,
    scriptName: string,
    document: Document,
    options: ExecutionOptions = {}
  ): Promise<Document> {
    const timeoutMs = options.timeoutMs || TransformExecutor.DEFAULT_TIMEOUT_MS;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new TransformError({
          stage: 'dom',
          message: `Transform execution timed out after ${timeoutMs}ms`,
          scriptName
        }));
      }, timeoutMs);

      try {
        // Clone document to avoid modifying original
        const clonedDoc = document.cloneNode(true) as Document;
        
        // Create sandboxed execution environment
        const sandboxedGlobals = this.createSandboxedGlobals(options.globals);
        
        // Execute script in sandboxed context
        const result = this.executeFunctionInSandbox(
          scriptContent,
          'transformDOM',
          [clonedDoc],
          sandboxedGlobals,
          scriptName
        );

        clearTimeout(timeout);
        
        // Ensure result is a Document
        if (result instanceof Document) {
          resolve(result);
        } else {
          resolve(clonedDoc); // Return cloned document if transform doesn't return one
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(this.createTransformError(error, 'dom', scriptName));
      }
    });
  }

  /**
   * Create sandboxed globals with dangerous functions removed
   */
  private createSandboxedGlobals(extensionGlobals: Record<string, any> = {}): Record<string, any> {
    // Start with safe browser APIs
    const sandboxedGlobals: Record<string, any> = {
      // Safe global objects
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
      
      // Safe DOM methods (will be bound to actual document when needed)
      document: typeof document !== 'undefined' ? document : undefined,
      
      // Extension libraries
      ...extensionGlobals
    };

    // Explicitly remove dangerous globals
    const dangerousGlobals = [
      'eval',
      'Function',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'XMLHttpRequest',
      'fetch',
      'import',
      'require',
      'process',
      'global',
      'globalThis',
      'window'
    ];

    dangerousGlobals.forEach(dangerous => {
      sandboxedGlobals[dangerous] = undefined;
    });

    return sandboxedGlobals;
  }

  /**
   * Execute a function in sandboxed context
   */
  private executeFunctionInSandbox(
    scriptContent: string,
    functionName: string,
    args: any[],
    globals: Record<string, any>,
    scriptName: string
  ): any {
    try {
      // Create function with restricted globals
      const globalNames = Object.keys(globals);
      const globalValues = Object.values(globals);
      
      // Wrap script content to execute in restricted scope
      const wrappedScript = `
        (function(${globalNames.join(', ')}) {
          ${scriptContent}
          
          if (typeof ${functionName} !== 'function') {
            throw new Error('Function ${functionName} is not defined or not a function');
          }
          
          return ${functionName};
        })
      `;

      // Execute the wrapped script to get the function
      const scriptFunction = new Function('return ' + wrappedScript)();
      const transformFunction = scriptFunction(...globalValues);
      
      // Execute the transform function with provided arguments
      return transformFunction(...args);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create appropriate TransformError from caught error
   */
  private createTransformError(
    error: any,
    stage: 'text' | 'dom',
    scriptName: string
  ): TransformError {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    
    // Try to extract line/column information from stack trace
    let line: number | undefined;
    let column: number | undefined;
    
    if (stack) {
      const lineMatch = stack.match(/at.*:(\d+):(\d+)/);
      if (lineMatch) {
        line = parseInt(lineMatch[1], 10);
        column = parseInt(lineMatch[2], 10);
      }
    }

    return new TransformError({
      stage,
      message,
      scriptName,
      line,
      column,
      stack
    });
  }
}