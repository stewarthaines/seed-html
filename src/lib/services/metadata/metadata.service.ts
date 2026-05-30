/**
 * MetadataService - Clean Service Architecture Implementation
 * 
 * Manages EPUB metadata with validation, field-level updates, and array operations
 * following the clean service architecture with single responsibility principle.
 */

import type { EPUBMetadata, Creator } from '../../epub/opf-utils.js';
import { creatorName } from '../../epub/opf-utils.js';
import type { WorkspaceService, WorkspaceState } from '../workspace/workspace.service.js';

// Use existing ValidationResult from MetadataValidator for compatibility
import type { ValidationResult } from '../../metadata/MetadataValidator.js';

// Re-export for component usage
export type { ValidationResult } from '../../metadata/MetadataValidator.js';

export interface MetadataFieldUpdate {
  field: keyof EPUBMetadata;
  value: any;
}

// Service error types
export class MetadataServiceError extends Error {
  constructor(message: string, public code: string, public workspaceId?: string) {
    super(message);
    this.name = 'MetadataServiceError';
  }
}

export class MetadataValidationError extends MetadataServiceError {
  constructor(message: string, public validationResults: ValidationResult[], workspaceId?: string) {
    super(message, 'VALIDATION_FAILED', workspaceId);
    this.name = 'MetadataValidationError';
  }
}

/**
 * MetadataService - Single responsibility for EPUB metadata management
 */
export class MetadataService {
  constructor(
    private workspaceService: WorkspaceService
  ) {}

  /**
   * Load metadata from cached workspace state
   */
  loadMetadata(workspace: WorkspaceState): EPUBMetadata {
    return workspace.opf.metadata;
  }

  /**
   * Update a single metadata field
   */
  async updateField(workspace: WorkspaceState, field: keyof EPUBMetadata, value: any): Promise<WorkspaceState> {
    try {
      // Validate the field update
      const updates = { [field]: value };
      const validationResults = this.validateMetadataUpdates(updates);
      
      if (validationResults.some(r => r.type === 'error')) {
        throw new MetadataValidationError('Field validation failed', validationResults, workspace.id);
      }

      // Update the workspace metadata
      return await this.workspaceService.updateMetadata(workspace, updates);
    } catch (error) {
      if (error instanceof MetadataServiceError) {
        throw error;
      }
      throw new MetadataServiceError(
        `Failed to update field ${String(field)}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPDATE_ERROR',
        workspace.id
      );
    }
  }

  /**
   * Update multiple metadata fields
   */
  async updateMetadata(workspace: WorkspaceState, updates: Partial<EPUBMetadata>): Promise<WorkspaceState> {
    try {
      // Validate all updates
      const validationResults = this.validateMetadataUpdates(updates);
      const errors = validationResults.filter(r => r.type === 'error');
      
      if (errors.length > 0) {
        throw new MetadataValidationError('Metadata validation failed', validationResults, workspace.id);
      }

      // Update the workspace metadata
      return await this.workspaceService.updateMetadata(workspace, updates);
    } catch (error) {
      if (error instanceof MetadataServiceError) {
        throw error;
      }
      throw new MetadataServiceError(
        `Failed to update metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPDATE_ERROR',
        workspace.id
      );
    }
  }

  /**
   * Add an item to an array field (creator, contributor, subject)
   */
  async addArrayItem(workspace: WorkspaceState, field: 'creator' | 'contributor' | 'subject', value: string = ''): Promise<WorkspaceState> {
    try {
      const currentArray: any[] = (workspace.opf.metadata as any)[field] || [];

      // Creators/contributors are structured (name + roles); subjects are strings.
      const newItem: string | Creator =
        field === 'subject'
          ? value || this.getDefaultArrayValue(field)
          : { name: value, roles: [] };

      const updates = {
        [field]: [...currentArray, newItem],
      };

      return await this.workspaceService.updateMetadata(workspace, updates);
    } catch (error) {
      throw new MetadataServiceError(
        `Failed to add ${field} item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ARRAY_ADD_ERROR',
        workspace.id
      );
    }
  }

  /**
   * Remove an item from an array field
   */
  async removeArrayItem(workspace: WorkspaceState, field: 'creator' | 'contributor' | 'subject', index: number): Promise<WorkspaceState> {
    try {
      const currentArray = workspace.opf.metadata[field] || [];
      
      if (index < 0 || index >= currentArray.length) {
        throw new MetadataServiceError(`Invalid index ${index} for ${field} array`, 'INVALID_INDEX', workspace.id);
      }

      const newArray = [...currentArray];
      newArray.splice(index, 1);
      
      const updates = { [field]: newArray };
      return await this.workspaceService.updateMetadata(workspace, updates);
    } catch (error) {
      if (error instanceof MetadataServiceError) {
        throw error;
      }
      throw new MetadataServiceError(
        `Failed to remove ${field} item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ARRAY_REMOVE_ERROR',
        workspace.id
      );
    }
  }

  /**
   * Validate metadata fields
   */
  validateMetadata(metadata: EPUBMetadata): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Required field validation
    if (!metadata.title?.trim()) {
      results.push({
        field: 'title',
        message: 'Title is required',
        type: 'error'
      });
    }

    if (!metadata.language?.trim()) {
      results.push({
        field: 'language',
        message: 'Language is required',
        type: 'error'
      });
    }

    if (!metadata.identifier?.trim()) {
      results.push({
        field: 'identifier',
        message: 'Identifier is required',
        type: 'error'
      });
    }

    // Language code validation
    if (metadata.language && !/^[a-z]{2}(-[A-Z]{2})?$/.test(metadata.language)) {
      results.push({
        field: 'language',
        message: 'Invalid language code format (use ISO 639-1, e.g., "en" or "en-US")',
        type: 'warning'
      });
    }

    // Title length validation
    if (metadata.title && metadata.title.length > 200) {
      results.push({
        field: 'title',
        message: 'Title should be under 200 characters',
        type: 'warning'
      });
    }

    // Creator validation
    if (metadata.creator && metadata.creator.some(c => !creatorName(c).trim())) {
      results.push({
        field: 'creator',
        message: 'Creator entries cannot be empty',
        type: 'warning'
      });
    }

    return results;
  }

  /**
   * Validate specific metadata field updates
   */
  validateMetadataUpdates(updates: Partial<EPUBMetadata>): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Validate title
    if (updates.title !== undefined && !updates.title.trim()) {
      results.push({
        field: 'title',
        message: 'Title cannot be empty',
        type: 'error'
      });
    }

    // Validate language
    if (updates.language !== undefined) {
      if (!updates.language.trim()) {
        results.push({
          field: 'language',
          message: 'Language cannot be empty',
          type: 'error'
        });
      } else if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(updates.language)) {
        results.push({
          field: 'language',
          message: 'Invalid language code format',
          type: 'warning'
        });
      }
    }

    // Validate identifier
    if (updates.identifier !== undefined && !updates.identifier.trim()) {
      results.push({
        field: 'identifier',
        message: 'Identifier cannot be empty',
        type: 'error'
      });
    }

    return results;
  }

  // Private helper methods

  private getDefaultArrayValue(field: 'creator' | 'contributor' | 'subject'): string {
    switch (field) {
      case 'creator':
        return 'Unknown Author';
      case 'contributor':
        return 'Unknown Contributor';
      case 'subject':
        return 'New Subject';
      default:
        return '';
    }
  }
}