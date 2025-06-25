# 19. Storage Quota Monitor

## Overview

Monitors browser storage usage and quota limits, providing warnings, usage breakdowns, and cleanup suggestions to prevent storage-related failures.

## Requirements

- Display current storage usage
- Quota warnings and notifications
- Storage cleanup suggestions
- Per-workspace storage breakdown

## Dependencies

- None (independent advanced feature)

## Technical Approach

- StorageManager API for quota information
- Workspace storage calculation
- Proactive warning system
- User-friendly cleanup interface

## API Design

```typescript
interface StorageQuotaMonitor {
  // Quota information
  getQuotaInfo(): Promise<QuotaInfo>;
  getUsageBreakdown(): Promise<UsageBreakdown>;

  // Monitoring
  startMonitoring(interval?: number): void;
  stopMonitoring(): void;
  checkQuotaStatus(): Promise<QuotaStatus>;

  // Warnings
  setWarningThreshold(percentage: number): void;
  onQuotaWarning(callback: (info: QuotaWarning) => void): () => void;

  // Cleanup
  suggestCleanupActions(): Promise<CleanupSuggestion[]>;
  executeCleanup(action: CleanupAction): Promise<CleanupResult>;

  // Utilities
  estimateSpaceNeeded(operation: string, size?: number): Promise<number>;
  canPerformOperation(operation: string, size: number): Promise<boolean>;
}

interface QuotaInfo {
  total: number;
  used: number;
  available: number;
  usagePercentage: number;
  storageType: 'persistent' | 'temporary';
}

interface UsageBreakdown {
  workspaces: WorkspaceUsage[];
  system: number;
  cache: number;
  temp: number;
  unknown: number;
}

interface WorkspaceUsage {
  id: string;
  name: string;
  size: number;
  files: number;
  lastAccessed: Date;
}

interface QuotaStatus {
  level: 'ok' | 'warning' | 'critical' | 'full';
  message: string;
  percentage: number;
  availableSpace: number;
}

interface CleanupSuggestion {
  type: 'workspace' | 'cache' | 'temp' | 'old-files';
  description: string;
  potentialSavings: number;
  risk: 'low' | 'medium' | 'high';
  action: CleanupAction;
}

interface CleanupAction {
  type: string;
  target: string;
  confirm?: boolean;
}
```

## Storage Monitor Component

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let showDetails = false;
  export let warningThreshold = 80; // percentage
  export let criticalThreshold = 95;

  let quotaInfo = null;
  let usageBreakdown = null;
  let cleanupSuggestions = [];
  let isLoading = true;
  let monitoringInterval = null;
  let showCleanupDialog = false;

  $: quotaStatus = getQuotaStatus(quotaInfo);
  $: shouldShowWarning = quotaStatus?.level === 'warning' || quotaStatus?.level === 'critical';
</script>

<div class="storage-quota-monitor">
  {#if isLoading}
    <div class="loading">
      <span>Checking storage...</span>
    </div>
  {:else if quotaInfo}
    <div class="quota-summary" class:warning={shouldShowWarning}>
      <div class="quota-bar">
        <div
          class="quota-fill"
          class:warning={quotaStatus.level === 'warning'}
          class:critical={quotaStatus.level === 'critical'}
          style="width: {quotaInfo.usagePercentage}%"
        ></div>
      </div>

      <div class="quota-text">
        <span class="usage">
          {formatSize(quotaInfo.used)} of {formatSize(quotaInfo.total)} used
        </span>
        <span class="percentage">({quotaInfo.usagePercentage.toFixed(1)}%)</span>
      </div>

      {#if shouldShowWarning}
        <div class="quota-warning">
          <Icon name="alert-triangle" />
          <span>{quotaStatus.message}</span>
        </div>
      {/if}
    </div>

    {#if showDetails}
      <div class="quota-details">
        <div class="storage-info">
          <div class="info-item">
            <label>Available:</label>
            <span>{formatSize(quotaInfo.available)}</span>
          </div>
          <div class="info-item">
            <label>Storage Type:</label>
            <span>{quotaInfo.storageType}</span>
          </div>
        </div>

        {#if usageBreakdown}
          <div class="usage-breakdown">
            <h4>Storage Breakdown</h4>

            {#if usageBreakdown.workspaces.length > 0}
              <div class="breakdown-section">
                <h5>Workspaces ({usageBreakdown.workspaces.length})</h5>
                <div class="workspace-list">
                  {#each usageBreakdown.workspaces as workspace}
                    <div class="workspace-item">
                      <div class="workspace-info">
                        <span class="workspace-name">{workspace.name}</span>
                        <span class="workspace-files">{workspace.files} files</span>
                      </div>
                      <div class="workspace-size">
                        {formatSize(workspace.size)}
                      </div>
                      <div class="workspace-actions">
                        <button on:click={() => viewWorkspace(workspace.id)}> View </button>
                        <button on:click={() => deleteWorkspace(workspace.id)} class="danger">
                          Delete
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="breakdown-section">
              <h5>System Data</h5>
              <div class="system-breakdown">
                <div class="breakdown-item">
                  <span>Cache:</span>
                  <span>{formatSize(usageBreakdown.cache)}</span>
                </div>
                <div class="breakdown-item">
                  <span>Temporary:</span>
                  <span>{formatSize(usageBreakdown.temp)}</span>
                </div>
                <div class="breakdown-item">
                  <span>Other:</span>
                  <span>{formatSize(usageBreakdown.unknown)}</span>
                </div>
              </div>
            </div>
          </div>
        {/if}

        {#if cleanupSuggestions.length > 0}
          <div class="cleanup-suggestions">
            <h4>Cleanup Suggestions</h4>
            <div class="suggestions-list">
              {#each cleanupSuggestions as suggestion}
                <div class="suggestion-item" class:high-risk={suggestion.risk === 'high'}>
                  <div class="suggestion-content">
                    <div class="suggestion-description">
                      {suggestion.description}
                    </div>
                    <div class="suggestion-savings">
                      Could free: {formatSize(suggestion.potentialSavings)}
                    </div>
                    {#if suggestion.risk === 'high'}
                      <div class="risk-warning">
                        <Icon name="alert-triangle" />
                        High risk - data may be permanently lost
                      </div>
                    {/if}
                  </div>
                  <button
                    on:click={() => executeCleanup(suggestion)}
                    class="cleanup-button"
                    class:danger={suggestion.risk === 'high'}
                  >
                    Clean Up
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <div class="quota-actions">
      <button on:click={refreshQuotaInfo}> Refresh </button>
      <button on:click={() => (showDetails = !showDetails)}>
        {showDetails ? 'Hide' : 'Show'} Details
      </button>
      <button on:click={() => (showCleanupDialog = true)}> Free Up Space </button>
    </div>
  {:else}
    <div class="quota-error">
      <Icon name="alert-circle" />
      <span>Unable to check storage quota</span>
    </div>
  {/if}
</div>

<style>
  .storage-quota-monitor {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
  }

  .quota-bar {
    width: 100%;
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    margin-bottom: 0.5rem;
    overflow: hidden;
  }

  .quota-fill {
    height: 100%;
    background: var(--success-color);
    transition: all 0.3s ease;
  }

  .quota-fill.warning {
    background: var(--warning-color);
  }

  .quota-fill.critical {
    background: var(--error-color);
  }

  .quota-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    color: var(--error-color);
    font-size: 0.875rem;
  }

  .workspace-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .workspace-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--bg-primary);
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .workspace-actions {
    display: flex;
    gap: 0.25rem;
  }

  .cleanup-suggestions {
    margin-top: 1rem;
  }

  .suggestion-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .suggestion-item.high-risk {
    border-color: var(--error-color);
    background: rgba(220, 53, 69, 0.05);
  }

  .risk-warning {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--error-color);
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
</style>
```

## Quota Information Retrieval

```typescript
const getQuotaInfo = async (): Promise<QuotaInfo> => {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();

      const total = estimate.quota || 0;
      const used = estimate.usage || 0;
      const available = total - used;
      const usagePercentage = total > 0 ? (used / total) * 100 : 0;

      // Check if storage is persistent
      const isPersistent = (await navigator.storage.persist?.()) || false;

      return {
        total,
        used,
        available,
        usagePercentage,
        storageType: isPersistent ? 'persistent' : 'temporary',
      };
    } else {
      throw new Error('Storage estimation not supported');
    }
  } catch (error) {
    console.error('Failed to get quota info:', error);
    throw error;
  }
};

const getUsageBreakdown = async (): Promise<UsageBreakdown> => {
  try {
    const workspaces = await calculateWorkspaceUsage();

    // Estimate system usage (this is approximate)
    const totalWorkspaceSize = workspaces.reduce((sum, ws) => sum + ws.size, 0);
    const quotaInfo = await getQuotaInfo();
    const systemUsage = quotaInfo.used - totalWorkspaceSize;

    return {
      workspaces,
      system: Math.max(0, systemUsage * 0.1), // Estimated system overhead
      cache: Math.max(0, systemUsage * 0.3), // Estimated cache usage
      temp: Math.max(0, systemUsage * 0.1), // Estimated temp files
      unknown: Math.max(0, systemUsage * 0.5), // Remaining unknown usage
    };
  } catch (error) {
    console.error('Failed to get usage breakdown:', error);
    throw error;
  }
};
```

## Workspace Usage Calculation

```typescript
const calculateWorkspaceUsage = async (): Promise<WorkspaceUsage[]> => {
  const workspaces: WorkspaceUsage[] = [];

  try {
    const workspaceIds = await fileStorage.listWorkspaces();

    for (const workspaceId of workspaceIds) {
      const usage = await calculateSingleWorkspaceUsage(workspaceId);
      workspaces.push(usage);
    }

    // Sort by size (largest first)
    workspaces.sort((a, b) => b.size - a.size);

    return workspaces;
  } catch (error) {
    console.error('Failed to calculate workspace usage:', error);
    return [];
  }
};

const calculateSingleWorkspaceUsage = async (workspaceId: string): Promise<WorkspaceUsage> => {
  try {
    const files = await fileStorage.listFiles(workspaceId);
    let totalSize = 0;
    let lastAccessed = new Date(0);

    for (const filePath of files) {
      try {
        const content = await fileStorage.readFile(workspaceId, filePath);
        totalSize += content.byteLength;

        // Update last accessed time (this is approximate)
        const fileModTime = await getFileModificationTime(workspaceId, filePath);
        if (fileModTime > lastAccessed) {
          lastAccessed = fileModTime;
        }
      } catch (error) {
        console.warn(`Failed to read file ${filePath} in workspace ${workspaceId}:`, error);
      }
    }

    // Get workspace name from metadata
    const metadata = await getWorkspaceMetadata(workspaceId);
    const name = metadata?.title || `Workspace ${workspaceId.slice(0, 8)}`;

    return {
      id: workspaceId,
      name,
      size: totalSize,
      files: files.length,
      lastAccessed,
    };
  } catch (error) {
    console.error(`Failed to calculate usage for workspace ${workspaceId}:`, error);
    return {
      id: workspaceId,
      name: `Workspace ${workspaceId.slice(0, 8)}`,
      size: 0,
      files: 0,
      lastAccessed: new Date(0),
    };
  }
};
```

## Cleanup Suggestions

```typescript
const generateCleanupSuggestions = async (): Promise<CleanupSuggestion[]> => {
  const suggestions: CleanupSuggestion[] = [];
  const usageBreakdown = await getUsageBreakdown();

  // Suggest cleaning old workspaces
  const oldWorkspaces = usageBreakdown.workspaces.filter(ws => {
    const daysSinceAccess = (Date.now() - ws.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceAccess > 30 && ws.size > 1024 * 1024; // > 30 days and > 1MB
  });

  if (oldWorkspaces.length > 0) {
    const totalSavings = oldWorkspaces.reduce((sum, ws) => sum + ws.size, 0);
    suggestions.push({
      type: 'workspace',
      description: `Delete ${oldWorkspaces.length} old workspace(s) not accessed in 30+ days`,
      potentialSavings: totalSavings,
      risk: 'high',
      action: { type: 'delete-old-workspaces', target: 'old-workspaces', confirm: true },
    });
  }

  // Suggest cleaning cache
  if (usageBreakdown.cache > 1024 * 1024) {
    // > 1MB cache
    suggestions.push({
      type: 'cache',
      description: 'Clear application cache and temporary files',
      potentialSavings: usageBreakdown.cache + usageBreakdown.temp,
      risk: 'low',
      action: { type: 'clear-cache', target: 'cache' },
    });
  }

  // Suggest cleaning large workspaces
  const largeWorkspaces = usageBreakdown.workspaces.filter(ws => ws.size > 10 * 1024 * 1024); // > 10MB
  if (largeWorkspaces.length > 0) {
    suggestions.push({
      type: 'workspace',
      description: `Review ${largeWorkspaces.length} large workspace(s) for cleanup`,
      potentialSavings: largeWorkspaces.reduce((sum, ws) => sum + ws.size * 0.3, 0), // Estimate 30% reduction
      risk: 'medium',
      action: { type: 'review-large-workspaces', target: 'large-workspaces' },
    });
  }

  // Sort by potential savings
  suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);

  return suggestions;
};
```

## Quota Monitoring

```typescript
let monitoringInterval: number | null = null;
let quotaWarningCallbacks: ((warning: QuotaWarning) => void)[] = [];

const startQuotaMonitoring = (interval: number = 60000): void => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }

  monitoringInterval = setInterval(async () => {
    try {
      const quotaInfo = await getQuotaInfo();
      const status = getQuotaStatus(quotaInfo);

      if (status.level === 'warning' || status.level === 'critical') {
        notifyQuotaWarning({
          level: status.level,
          message: status.message,
          percentage: status.percentage,
          availableSpace: status.availableSpace,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error('Quota monitoring error:', error);
    }
  }, interval);
};

const getQuotaStatus = (quotaInfo: QuotaInfo | null): QuotaStatus => {
  if (!quotaInfo) {
    return {
      level: 'ok',
      message: 'Unable to determine storage status',
      percentage: 0,
      availableSpace: 0,
    };
  }

  const percentage = quotaInfo.usagePercentage;

  if (percentage >= 98) {
    return {
      level: 'full',
      message: 'Storage is nearly full. Some operations may fail.',
      percentage,
      availableSpace: quotaInfo.available,
    };
  } else if (percentage >= 95) {
    return {
      level: 'critical',
      message: 'Storage is critically low. Please free up space immediately.',
      percentage,
      availableSpace: quotaInfo.available,
    };
  } else if (percentage >= 80) {
    return {
      level: 'warning',
      message: 'Storage is getting low. Consider cleaning up old files.',
      percentage,
      availableSpace: quotaInfo.available,
    };
  } else {
    return {
      level: 'ok',
      message: 'Storage usage is normal',
      percentage,
      availableSpace: quotaInfo.available,
    };
  }
};

const notifyQuotaWarning = (warning: QuotaWarning): void => {
  quotaWarningCallbacks.forEach(callback => {
    try {
      callback(warning);
    } catch (error) {
      console.error('Error in quota warning callback:', error);
    }
  });
};
```

## Cleanup Execution

```typescript
const executeCleanup = async (suggestion: CleanupSuggestion): Promise<CleanupResult> => {
  try {
    let cleanedSize = 0;
    let cleanedItems = 0;

    switch (suggestion.action.type) {
      case 'delete-old-workspaces':
        const result = await deleteOldWorkspaces();
        cleanedSize = result.size;
        cleanedItems = result.count;
        break;

      case 'clear-cache':
        cleanedSize = await clearApplicationCache();
        cleanedItems = 1;
        break;

      case 'review-large-workspaces':
        // This would open a detailed view - no immediate cleanup
        break;

      default:
        throw new Error(`Unknown cleanup action: ${suggestion.action.type}`);
    }

    return {
      success: true,
      cleanedSize,
      cleanedItems,
      message: `Freed ${formatSize(cleanedSize)} by cleaning ${cleanedItems} item(s)`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `Cleanup failed: ${error.message}`,
    };
  }
};

const deleteOldWorkspaces = async (): Promise<{ size: number; count: number }> => {
  const usageBreakdown = await getUsageBreakdown();
  const oldWorkspaces = usageBreakdown.workspaces.filter(ws => {
    const daysSinceAccess = (Date.now() - ws.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceAccess > 30;
  });

  let totalSize = 0;
  let count = 0;

  for (const workspace of oldWorkspaces) {
    try {
      await fileStorage.deleteWorkspace(workspace.id);
      totalSize += workspace.size;
      count++;
    } catch (error) {
      console.error(`Failed to delete workspace ${workspace.id}:`, error);
    }
  }

  return { size: totalSize, count };
};

const clearApplicationCache = async (): Promise<number> => {
  let clearedSize = 0;

  try {
    // Clear blob URL cache
    blobURLManager.revokeAllURLs();

    // Clear localStorage items (except user preferences)
    const itemsToKeep = ['theme-preference', 'layout-state'];
    const toRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !itemsToKeep.includes(key)) {
        toRemove.push(key);
      }
    }

    toRemove.forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        clearedSize += item.length * 2; // Rough estimate (UTF-16)
      }
      localStorage.removeItem(key);
    });

    return clearedSize;
  } catch (error) {
    console.error('Failed to clear cache:', error);
    return 0;
  }
};
```

## Utility Functions

```typescript
const formatSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const canPerformOperation = async (
  operationType: string,
  estimatedSize: number
): Promise<boolean> => {
  try {
    const quotaInfo = await getQuotaInfo();
    const safetyMargin = 1024 * 1024 * 10; // 10MB safety margin

    return quotaInfo.available > estimatedSize + safetyMargin;
  } catch (error) {
    console.warn('Could not check storage capacity:', error);
    return false; // Err on the side of caution
  }
};
```

## Testing Considerations

- Test quota calculation accuracy
- Test cleanup suggestions relevance
- Test monitoring performance impact
- Test with various storage states
- Test cross-browser compatibility
- Test error handling for storage failures

## Implementation Notes

- Start with basic quota monitoring
- Add cleanup suggestions incrementally
- Test storage calculations thoroughly
- Consider privacy implications of storage monitoring
- Ensure graceful degradation when StorageManager API unavailable
