import { describe, it, expect } from 'vitest';
import { TransformError } from '../transform-error.js';

describe('TransformError', () => {
  describe('constructor()', () => {
    it('should create error with all details', () => {
      const details = {
        stage: 'text' as const,
        message: 'Transform failed',
        scriptName: 'markdown-transform.js',
        line: 42,
        column: 15,
        stack: 'Error: Transform failed\n    at transformText (markdown-transform.js:42:15)',
      };

      const error = new TransformError(details);

      expect(error.stage).toBe('text');
      expect(error.message).toBe('Transform failed');
      expect(error.scriptName).toBe('markdown-transform.js');
      expect(error.line).toBe(42);
      expect(error.column).toBe(15);
      expect(error.stack).toContain('Transform failed');
    });

    it('should create error with minimal details', () => {
      const details = {
        stage: 'dom' as const,
        message: 'DOM manipulation failed',
      };

      const error = new TransformError(details);

      expect(error.stage).toBe('dom');
      expect(error.message).toBe('DOM manipulation failed');
      expect(error.scriptName).toBeUndefined();
      expect(error.line).toBeUndefined();
      expect(error.column).toBeUndefined();
    });

    it('should handle loading stage errors', () => {
      const details = {
        stage: 'loading' as const,
        message: 'Script not found',
        scriptName: 'missing-script.js',
      };

      const error = new TransformError(details);

      expect(error.stage).toBe('loading');
      expect(error.scriptName).toBe('missing-script.js');
    });

    it('should handle template stage errors', () => {
      const details = {
        stage: 'template' as const,
        message: 'Invalid template metadata',
      };

      const error = new TransformError(details);

      expect(error.stage).toBe('template');
      expect(error.message).toBe('Invalid template metadata');
    });
  });

  describe('toUserMessage()', () => {
    it('should format text transform error message', () => {
      const error = new TransformError({
        stage: 'text',
        message: 'markdown-it library not found',
        scriptName: 'markdown-transform.js',
        line: 10,
        column: 5,
      });

      const userMessage = error.toUserMessage();

      expect(userMessage).toContain('Text Transform');
      expect(userMessage).toContain('markdown-it library not found');
      expect(userMessage).toContain('markdown-transform.js');
      expect(userMessage).toContain('Line 10');
      expect(userMessage).toContain('Column 5');
    });

    it('should format DOM transform error message', () => {
      const error = new TransformError({
        stage: 'dom',
        message: 'Cannot read property of undefined',
        scriptName: 'heading-ids.js',
        line: 25,
      });

      const userMessage = error.toUserMessage();

      expect(userMessage).toContain('DOM Transform');
      expect(userMessage).toContain('Cannot read property of undefined');
      expect(userMessage).toContain('heading-ids.js');
      expect(userMessage).toContain('Line 25');
      expect(userMessage).not.toContain('Column');
    });

    it('should format loading error message', () => {
      const error = new TransformError({
        stage: 'loading',
        message: 'File not found',
        scriptName: 'nonexistent-script.js',
      });

      const userMessage = error.toUserMessage();

      expect(userMessage).toContain('Script Loading');
      expect(userMessage).toContain('File not found');
      expect(userMessage).toContain('nonexistent-script.js');
      expect(userMessage).not.toContain('Line');
    });

    it('should format template error message', () => {
      const error = new TransformError({
        stage: 'template',
        message: 'Invalid metadata structure',
      });

      const userMessage = error.toUserMessage();

      expect(userMessage).toContain('Template Generation');
      expect(userMessage).toContain('Invalid metadata structure');
      expect(userMessage).not.toContain('Line');
    });

    it('should handle error without script name', () => {
      const error = new TransformError({
        stage: 'text',
        message: 'Generic transform error',
      });

      const userMessage = error.toUserMessage();

      expect(userMessage).toContain('Text Transform');
      expect(userMessage).toContain('Generic transform error');
      expect(userMessage).not.toContain('Script:');
    });

    it('should handle error without location info', () => {
      const error = new TransformError({
        stage: 'dom',
        message: 'Runtime error',
        scriptName: 'transform.js',
      });

      const userMessage = error.toUserMessage();

      expect(userMessage).toContain('DOM Transform');
      expect(userMessage).toContain('Runtime error');
      expect(userMessage).toContain('transform.js');
      expect(userMessage).not.toContain('Line');
      expect(userMessage).not.toContain('Column');
    });

    it('should handle timeout errors specially', () => {
      const error = new TransformError({
        stage: 'text',
        message: 'Transform execution timed out after 2000ms',
        scriptName: 'slow-transform.js',
      });

      const userMessage = error.toUserMessage();

      expect(userMessage).toContain('Text Transform');
      expect(userMessage).toContain('timed out');
      expect(userMessage).toContain('slow-transform.js');
    });

    it('should format syntax errors clearly', () => {
      const error = new TransformError({
        stage: 'loading',
        message: "Unexpected token '}'",
        scriptName: 'broken-script.js',
        line: 15,
        column: 3,
      });

      const userMessage = error.toUserMessage();

      expect(userMessage).toContain('Script Loading');
      expect(userMessage).toContain('Unexpected token');
      expect(userMessage).toContain('broken-script.js');
      expect(userMessage).toContain('Line 15');
      expect(userMessage).toContain('Column 3');
    });
  });

  describe('getErrorDetails()', () => {
    it('should return complete error details', () => {
      const originalDetails = {
        stage: 'text' as const,
        message: 'Detailed error message',
        scriptName: 'test-script.js',
        line: 100,
        column: 25,
        stack: 'Error stack trace here',
      };

      const error = new TransformError(originalDetails);
      const details = error.getErrorDetails();

      expect(details.stage).toBe('text');
      expect(details.message).toBe('Detailed error message');
      expect(details.scriptName).toBe('test-script.js');
      expect(details.line).toBe(100);
      expect(details.column).toBe(25);
      expect(details.stack).toBe('Error stack trace here');
      expect(details.userMessage).toContain('Text Transform');
    });

    it('should handle minimal error details', () => {
      const error = new TransformError({
        stage: 'template',
        message: 'Template error',
      });

      const details = error.getErrorDetails();

      expect(details.stage).toBe('template');
      expect(details.message).toBe('Template error');
      expect(details.scriptName).toBeUndefined();
      expect(details.line).toBeUndefined();
      expect(details.column).toBeUndefined();
      expect(details.stack).toBeUndefined();
      expect(details.userMessage).toContain('Template Generation');
    });

    it('should include generated user message', () => {
      const error = new TransformError({
        stage: 'dom',
        message: 'DOM error',
        scriptName: 'dom-script.js',
        line: 50,
      });

      const details = error.getErrorDetails();

      expect(details.userMessage).toBe(error.toUserMessage());
      expect(details.userMessage).toContain('DOM Transform');
      expect(details.userMessage).toContain('DOM error');
    });
  });

  describe('Error inheritance', () => {
    it('should be instanceof Error', () => {
      const error = new TransformError({
        stage: 'text',
        message: 'Test error',
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TransformError);
    });

    it('should have correct name property', () => {
      const error = new TransformError({
        stage: 'text',
        message: 'Test error',
      });

      expect(error.name).toBe('TransformError');
    });

    it('should work with try-catch blocks', () => {
      let caughtError: any;

      try {
        throw new TransformError({
          stage: 'text',
          message: 'Test throw',
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(TransformError);
      expect(caughtError.stage).toBe('text');
      expect(caughtError.message).toBe('Test throw');
    });

    it('should work with Promise rejections', async () => {
      const promise = Promise.reject(
        new TransformError({
          stage: 'dom',
          message: 'Async error',
        })
      );

      await expect(promise).rejects.toThrow(TransformError);
      await expect(promise).rejects.toHaveProperty('stage', 'dom');
    });
  });

  describe('Stage-specific behavior', () => {
    it('should handle all valid stages', () => {
      const stages = ['text', 'dom', 'template', 'loading'] as const;

      stages.forEach(stage => {
        const error = new TransformError({
          stage,
          message: `Error in ${stage} stage`,
        });

        expect(error.stage).toBe(stage);
        expect(error.toUserMessage()).toContain(
          stage === 'text'
            ? 'Text Transform'
            : stage === 'dom'
              ? 'DOM Transform'
              : stage === 'template'
                ? 'Template Generation'
                : 'Script Loading'
        );
      });
    });

    it('should format stage names consistently', () => {
      const stageNameMapping = {
        text: 'Text Transform',
        dom: 'DOM Transform',
        template: 'Template Generation',
        loading: 'Script Loading',
      };

      Object.entries(stageNameMapping).forEach(([stage, expectedName]) => {
        const error = new TransformError({
          stage: stage as any,
          message: 'Test message',
        });

        expect(error.toUserMessage()).toContain(expectedName);
      });
    });
  });

  describe('Error message formatting edge cases', () => {
    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(1000);
      const error = new TransformError({
        stage: 'text',
        message: longMessage,
      });

      const userMessage = error.toUserMessage();
      expect(userMessage).toContain(longMessage);
      expect(userMessage).toContain('Text Transform');
    });

    it('should handle error messages with special characters', () => {
      const specialMessage = 'Error with "quotes" & <tags> and émojis 🔥';
      const error = new TransformError({
        stage: 'text',
        message: specialMessage,
      });

      const userMessage = error.toUserMessage();
      expect(userMessage).toContain(specialMessage);
    });

    it('should handle error messages with newlines', () => {
      const multilineMessage = 'First line\nSecond line\nThird line';
      const error = new TransformError({
        stage: 'text',
        message: multilineMessage,
      });

      const userMessage = error.toUserMessage();
      expect(userMessage).toContain(multilineMessage);
    });

    it('should handle empty error message', () => {
      const error = new TransformError({
        stage: 'text',
        message: '',
      });

      const userMessage = error.toUserMessage();
      expect(userMessage).toContain('Text Transform');
      expect(userMessage.length).toBeGreaterThan(0);
    });

    it('should handle very large line and column numbers', () => {
      const error = new TransformError({
        stage: 'text',
        message: 'Error at extreme position',
        line: 999999,
        column: 888888,
      });

      const userMessage = error.toUserMessage();
      expect(userMessage).toContain('Line 999999');
      expect(userMessage).toContain('Column 888888');
    });

    it('should handle zero line and column numbers', () => {
      const error = new TransformError({
        stage: 'text',
        message: 'Error at start',
        line: 0,
        column: 0,
      });

      const userMessage = error.toUserMessage();
      expect(userMessage).toContain('Line 0');
      expect(userMessage).toContain('Column 0');
    });
  });
});
