<!--
  ExtensionDetails Component
  
  Displays detailed information about a selected extension including
  file list, sizes, types, and available actions.
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ExtensionInfo } from '../../../lib/extensions/types.js';

  export let extension: ExtensionInfo | null = null;

  const dispatch = createEventDispatcher();

  // Format file size utility
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Get file type icon
  function getFileTypeIcon(fileType: string): string {
    switch (fileType) {
      case 'javascript': return '📄';
      case 'license': return '📜';
      default: return '📎';
    }
  }

  // Get file type description
  function getFileTypeDescription(fileType: string): string {
    switch (fileType) {
      case 'javascript': return 'JavaScript Library';
      case 'license': return 'License File';
      default: return 'Unknown File Type';
    }
  }

  // Get extension category based on name patterns
  function getExtensionCategory(extension: ExtensionInfo): string {
    const name = extension.name.toLowerCase();
    if (name.includes('markdown') || name.includes('marked')) return 'Text Processing';
    if (name.includes('highlight') || name.includes('prism')) return 'Syntax Highlighting';
    if (name.includes('d3') || name.includes('chart')) return 'Data Visualization';
    if (name.includes('lodash') || name.includes('jquery')) return 'Utilities';
    if (name.includes('katex') || name.includes('mathjax')) return 'Math';
    if (name.includes('abc') || name.includes('vex')) return 'Music Notation';
    return 'Other';
  }

  // Get category description
  function getCategoryDescription(category: string): string {
    switch (category) {
      case 'Text Processing': return 'Libraries for processing and rendering text content';
      case 'Syntax Highlighting': return 'Libraries for highlighting code syntax';
      case 'Data Visualization': return 'Libraries for creating charts and graphs';
      case 'Utilities': return 'General-purpose utility libraries';
      case 'Math': return 'Libraries for rendering mathematical expressions';
      case 'Music Notation': return 'Libraries for rendering musical notation';
      default: return 'Miscellaneous JavaScript library';
    }
  }

  // Handle extension actions
  function handleDelete() {
    if (!extension) return;
    
    dispatch('extensionAction', {
      action: 'delete',
      extensionName: extension.name,
      location: extension.location
    });
  }

  function handleExport() {
    if (!extension) return;
    
    // Simulate extension export
    const exportData = {
      name: extension.name,
      files: extension.files,
      totalSize: extension.totalSize,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${extension.name}-export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleCache() {
    if (!extension) return;
    
    dispatch('extensionAction', {
      action: 'cache',
      extensionName: extension.name
    });
  }

  // Calculate file type distribution
  $: fileTypeDistribution = extension ? 
    extension.files.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) : {};

  // Calculate size distribution
  $: sizeDistribution = extension ?
    extension.files.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + file.size;
      return acc;
    }, {} as Record<string, number>) : {};
</script>

<div class="extension-details">
  {#if extension}
    <!-- Extension Header -->
    <div class="details-header">
      <div class="extension-title">
        <h3>{extension.name}</h3>
        <div class="extension-meta">
          <span class="category-badge">
            {getExtensionCategory(extension)}
          </span>
          <span class="location-badge" class:workspace={extension.location === 'workspace'} class:cache={extension.location === 'cache'}>
            {extension.location}
          </span>
        </div>
      </div>
      
      <div class="extension-summary">
        <div class="summary-item">
          <span class="summary-value">{extension.files.length}</span>
          <span class="summary-label">File{extension.files.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">{formatFileSize(extension.totalSize)}</span>
          <span class="summary-label">Total Size</span>
        </div>
      </div>
    </div>

    <!-- Extension Description -->
    <div class="extension-description">
      <p>{getCategoryDescription(getExtensionCategory(extension))}</p>
    </div>

    <!-- File List -->
    <div class="file-section">
      <h4>Files</h4>
      <div class="file-list">
        {#each extension.files as file, index}
          <div class="file-item">
            <div class="file-info">
              <span class="file-icon">{getFileTypeIcon(file.type)}</span>
              <div class="file-details">
                <div class="file-name">{file.filename}</div>
                <div class="file-meta">
                  <span class="file-type">{getFileTypeDescription(file.type)}</span>
                  <span class="file-size">{formatFileSize(file.size)}</span>
                </div>
              </div>
            </div>
            <div class="file-actions">
              <button class="file-action-btn" title="Download file">
                ⬇️
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- File Type Distribution -->
    {#if Object.keys(fileTypeDistribution).length > 1}
      <div class="distribution-section">
        <h4>File Distribution</h4>
        <div class="distribution-chart">
          {#each Object.entries(fileTypeDistribution) as [type, count]}
            <div class="distribution-item">
              <span class="distribution-icon">{getFileTypeIcon(type)}</span>
              <span class="distribution-label">{getFileTypeDescription(type)}</span>
              <span class="distribution-count">{count}</span>
              <span class="distribution-size">({formatFileSize(sizeDistribution[type] || 0)})</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Extension Actions -->
    <div class="extension-actions">
      <h4>Actions</h4>
      <div class="action-buttons">
        {#if extension.location === 'workspace'}
          <button class="btn btn-primary" on:click={handleCache}>
            Cache Extension
          </button>
        {/if}
        
        <button class="btn btn-secondary" on:click={handleExport}>
          Export Extension
        </button>
        
        <button class="btn btn-danger" on:click={handleDelete}>
          Delete Extension
        </button>
      </div>
    </div>

    <!-- Technical Details -->
    <div class="technical-details">
      <h4>Technical Details</h4>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Extension Name:</span>
          <span class="detail-value">{extension.name}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Location:</span>
          <span class="detail-value">{extension.location}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">File Count:</span>
          <span class="detail-value">{extension.files.length}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Total Size:</span>
          <span class="detail-value">{formatFileSize(extension.totalSize)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Category:</span>
          <span class="detail-value">{getExtensionCategory(extension)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Primary Type:</span>
          <span class="detail-value">
            {extension.files.find(f => f.type === 'javascript') ? 'JavaScript Library' : 'Other'}
          </span>
        </div>
      </div>
    </div>

  {:else}
    <!-- Empty State -->
    <div class="empty-details">
      <div class="empty-icon">📦</div>
      <h3>No Extension Selected</h3>
      <p>Select an extension from the browser to view detailed information.</p>
      
      <div class="selection-tips">
        <h4>What you can see here:</h4>
        <ul>
          <li>Complete file listing with sizes and types</li>
          <li>Extension metadata and categorization</li>
          <li>File distribution analysis</li>
          <li>Available actions (cache, export, delete)</li>
          <li>Technical details and specifications</li>
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  .extension-details {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    overflow: hidden;
    min-height: 400px;
  }

  .details-header {
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border-secondary);
    background: var(--color-bg-tertiary);
  }

  .extension-title {
    margin-bottom: var(--space-3);
  }

  .extension-title h3 {
    margin: 0 0 var(--space-2) 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-xl);
  }

  .extension-meta {
    display: flex;
    gap: var(--space-2);
  }

  .category-badge,
  .location-badge {
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
  }

  .category-badge {
    background: var(--color-bg-accent);
    color: var(--color-text-accent);
    border: 1px solid var(--color-border-accent);
  }

  .location-badge.workspace {
    background: var(--color-success);
    color: white;
  }

  .location-badge.cache {
    background: var(--color-info);
    color: white;
  }

  .extension-summary {
    display: flex;
    gap: var(--space-4);
  }

  .summary-item {
    text-align: center;
  }

  .summary-value {
    display: block;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
  }

  .summary-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .extension-description {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border-secondary);
    background: var(--color-bg-accent);
  }

  .extension-description p {
    margin: 0;
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .file-section,
  .distribution-section,
  .extension-actions,
  .technical-details {
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .file-section h4,
  .distribution-section h4,
  .extension-actions h4,
  .technical-details h4 {
    margin: 0 0 var(--space-3) 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-md);
  }

  .file-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .file-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .file-icon {
    font-size: var(--font-size-lg);
  }

  .file-name {
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
  }

  .file-meta {
    display: flex;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .file-actions {
    display: flex;
    gap: var(--space-1);
  }

  .file-action-btn {
    padding: var(--space-1);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    cursor: pointer;
    font-size: var(--font-size-sm);
  }

  .file-action-btn:hover {
    background: var(--color-bg-accent);
  }

  .distribution-chart {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .distribution-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--color-bg-primary);
    border-radius: var(--radius-sm);
  }

  .distribution-label {
    flex: 1;
    color: var(--color-text-primary);
  }

  .distribution-count,
  .distribution-size {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2);
    background: var(--color-bg-primary);
    border-radius: var(--radius-sm);
  }

  .detail-label {
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
  }

  .detail-value {
    color: var(--color-text-primary);
  }

  /* Empty State */
  .empty-details {
    padding: var(--space-8);
    text-align: center;
    color: var(--color-text-secondary);
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: var(--space-3);
    opacity: 0.5;
  }

  .empty-details h3 {
    margin: 0 0 var(--space-2) 0;
    color: var(--color-text-primary);
  }

  .empty-details p {
    margin: 0 0 var(--space-4) 0;
  }

  .selection-tips {
    text-align: left;
    max-width: 400px;
    margin: 0 auto;
  }

  .selection-tips h4 {
    margin: 0 0 var(--space-2) 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-md);
  }

  .selection-tips ul {
    margin: 0;
    padding-left: var(--space-4);
  }

  .selection-tips li {
    margin-bottom: var(--space-1);
    font-size: var(--font-size-sm);
  }

  /* Button styles */
  .btn {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn:hover {
    background: var(--color-bg-accent);
  }

  .btn-primary {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
  }

  .btn-secondary {
    background: var(--color-bg-tertiary);
    border-color: var(--color-border-secondary);
  }

  .btn-danger {
    background: var(--color-error);
    border-color: var(--color-error);
    color: white;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .extension-summary {
      justify-content: center;
    }

    .extension-meta {
      flex-direction: column;
      align-items: flex-start;
    }

    .detail-grid {
      grid-template-columns: 1fr;
    }

    .action-buttons {
      flex-direction: column;
    }
  }
</style>