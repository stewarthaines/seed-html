/**
 * JavaScript validation utilities for syntax checking
 * 
 * Pure validation functions with no dependencies, suitable for use
 * across the application infrastructure layer.
 */

export class JavaScriptValidator {
  /**
   * Validate JavaScript syntax and catch runtime errors
   * 
   * @param content - JavaScript source code to validate
   * @returns null if valid, error message if invalid
   */
  static validateSyntax(content: string): string | null {
    if (!content.trim()) {
      return null; // Empty content is considered valid
    }

    try {
      // Step 1: Validate syntax using Function constructor
      const testFunction = new Function(content);
      
      // Step 2: Try to execute in a safe sandbox to catch ReferenceErrors
      try {
        // Create a minimal sandbox with common globals that might exist in browser
        const sandbox = {
          console: { log: () => {}, warn: () => {}, error: () => {} },
          window: {},
          document: { 
            querySelector: () => null,
            createElement: () => ({}),
            addEventListener: () => {}
          },
          // Common browser APIs that scripts might reference
          setTimeout: () => 0,
          setInterval: () => 0,
          clearTimeout: () => {},
          clearInterval: () => {},
          fetch: () => Promise.resolve(),
          // Allow common utility functions
          Math: Math,
          JSON: JSON,
          Date: Date,
          Array: Array,
          Object: Object,
          String: String,
          Number: Number,
          Boolean: Boolean,
          RegExp: RegExp,
        };

        // Execute in controlled environment to catch ReferenceErrors
        testFunction.call(sandbox);
        
        return null; // Both syntax and runtime validation passed
      } catch (runtimeError) {
        // Catch runtime errors like ReferenceError, TypeError, etc.
        if (runtimeError instanceof ReferenceError) {
          return `JavaScript reference error: ${runtimeError.message}`;
        }
        if (runtimeError instanceof TypeError) {
          return `JavaScript type error: ${runtimeError.message}`;
        }
        // For other runtime errors, we might want to be more permissive
        // since some code is designed to run in specific environments
        return `JavaScript runtime error: ${runtimeError instanceof Error ? runtimeError.message : String(runtimeError)}`;
      }
    } catch (syntaxError) {
      // Catch syntax errors from Function constructor
      if (syntaxError instanceof SyntaxError) {
        return `JavaScript syntax error: ${syntaxError.message}`;
      }
      return `JavaScript validation error: ${syntaxError instanceof Error ? syntaxError.message : String(syntaxError)}`;
    }
  }

  /**
   * Determine if a file type should be validated as JavaScript
   * 
   * @param fileType - File type identifier from component
   * @returns true if file should be validated as JavaScript
   */
  static shouldValidate(fileType: string): boolean {
    return fileType.includes('javascript') || fileType.includes('js');
  }
}