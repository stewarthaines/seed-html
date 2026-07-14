/**
 * Transform Script Execution
 *
 * Synchronous, in-scope execution of the bundled text transform
 * (sample-content generation). This is NOT a security boundary: the wrapper
 * only shadows the names it lists, so anything else resolves up the real
 * scope chain. Untrusted (workspace-authored) transform scripts never run
 * here — they run in the sandboxed iframe TransformEngine
 * (src/lib/infrastructure/transform-engine.ts), which also owns timeout
 * handling. Because execution is synchronous on the main thread, a wall-clock
 * timeout is not possible in this executor.
 */

import { TransformError } from './transform-error.js';

export interface TransformContext {
  idref?: string;
}

export interface ExecutionOptions {
  globals?: Record<string, any>;
}

/**
 * Executes the trusted bundled transform script in a shadowed scope
 */
export class TransformExecutor {
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
    try {
      const globals = this.createScopedGlobals(options.globals);
      const result = this.executeFunctionInScope(
        scriptContent,
        'transformText',
        [plainText, context.idref],
        globals
      );

      if (typeof result !== 'string') {
        // A transform that forgets to return (or returns the wrong type) is a
        // script bug; fabricating "undefined"/"[object Object]" chapter content
        // would mask it.
        throw new Error(
          `transformText must return a string, got ${result === null ? 'null' : typeof result}`
        );
      }
      return result;
    } catch (error) {
      throw this.createTransformError(error, 'text', scriptName);
    }
  }

  /**
   * Globals visible to the script by parameter shadowing. Scope hygiene for
   * the trusted bundled script plus extension-injected libraries — not a
   * sandbox (unlisted names still reach the real globals).
   */
  private createScopedGlobals(extensionGlobals: Record<string, any> = {}): Record<string, any> {
    return {
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
      // Extension libraries
      ...extensionGlobals,
    };
  }

  /**
   * Execute a named function from the script in the shadowed scope
   */
  private executeFunctionInScope(
    scriptContent: string,
    functionName: string,
    args: any[],
    globals: Record<string, any>
  ): any {
    const globalNames = Object.keys(globals);
    const globalValues = Object.values(globals);

    const wrappedScript = `(function(${globalNames.join(', ')}) {
        ${scriptContent}

        if (typeof ${functionName} !== 'function') {
          throw new Error('Function ${functionName} is not defined or not a function');
        }

        return ${functionName};
      })`;

    const scriptFunction = new Function('return ' + wrappedScript)();
    const transformFunction = scriptFunction(...globalValues);

    return transformFunction(...args);
  }

  /**
   * Create appropriate TransformError from caught error
   */
  private createTransformError(error: any, stage: 'text', scriptName: string): TransformError {
    if (error instanceof TransformError) {
      return error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    // Best-effort line/column from the first stack frame. The coordinates are
    // offset by the wrapper preamble and engine-dependent — treat as a hint,
    // not a source position.
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
      stack,
    });
  }
}
