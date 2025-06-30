/**
 * Transform Pipeline Error Handling
 * 
 * Provides detailed error information for transform pipeline failures
 * with user-friendly error messages and debugging information.
 */

export type TransformStage = 'loading' | 'text' | 'dom' | 'template';

export interface TransformErrorDetails {
  stage: TransformStage;
  message: string;
  scriptName?: string;
  line?: number;
  column?: number;
  stack?: string;
}

export interface TransformErrorInfo extends TransformErrorDetails {
  userMessage: string;
}

/**
 * Error class for transform pipeline failures
 * 
 * Provides detailed error information with user-friendly messages
 * for different stages of the transformation process.
 */
export class TransformError extends Error {
  public readonly stage: TransformStage;
  public readonly scriptName?: string;
  public readonly line?: number;
  public readonly column?: number;
  private readonly hasCustomStack: boolean;

  constructor(details: TransformErrorDetails) {
    super(details.message);
    
    this.name = 'TransformError';
    this.stage = details.stage;
    this.scriptName = details.scriptName;
    this.line = details.line;
    this.column = details.column;
    this.hasCustomStack = !!details.stack;
    
    if (details.stack) {
      this.stack = details.stack;
    }
  }

  /**
   * Generate user-friendly error message
   */
  toUserMessage(): string {
    const stageNames = {
      'loading': 'Script Loading',
      'text': 'Text Transform',
      'dom': 'DOM Transform',
      'template': 'Template Generation'
    };

    const stageName = stageNames[this.stage];
    let message = `${stageName} Error: ${this.message}`;

    if (this.scriptName) {
      message += `\nScript: ${this.scriptName}`;
    }

    if (this.line !== undefined) {
      message += `\nLine ${this.line}`;
    }

    if (this.column !== undefined) {
      message += `\nColumn ${this.column}`;
    }

    return message;
  }

  /**
   * Get complete error details including user message
   */
  getErrorDetails(): TransformErrorInfo {
    return {
      stage: this.stage,
      message: this.message,
      scriptName: this.scriptName,
      line: this.line,
      column: this.column,
      stack: this.hasCustomStack ? this.stack : undefined,
      userMessage: this.toUserMessage()
    };
  }
}