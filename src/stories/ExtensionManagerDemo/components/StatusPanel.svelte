<!--
  StatusPanel Component
  
  Displays system status, storage quota visualization, extension statistics,
  and current operation progress.
-->

<script lang="ts">
  interface StorageQuota {
    used: number;
    total: number;
    extensionCount: number;
    cacheCount: number;
  }

  interface UploadProgress {
    filename: string;
    progress: number;
    status: 'uploading' | 'validating' | 'importing' | 'caching' | 'complete' | 'error';
  }

  export let storageQuota: StorageQuota;
  export let uploadProgress: UploadProgress | null = null;
  export let isLoading: boolean = false;

  // System information (mock data for demo)
  const systemInfo = {
    storageBackend: 'Mock File Storage',
    cacheEnabled: true,
    compressionEnabled: true,
    version: 'Demo v1.0.0',
    lastUpdate: new Date()
  };

  // Calculate storage percentages
  $: usagePercentage = storageQuota.total > 0 ? (storageQuota.used / storageQuota.total) * 100 : 0;
  $: remainingSpace = storageQuota.total - storageQuota.used;

  // Format file size utility
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Get storage usage color
  function getUsageColor(percentage: number): string {
    if (percentage >= 90) return 'var(--color-error)';
    if (percentage >= 75) return 'var(--color-warning)';
    if (percentage >= 50) return 'var(--color-info)';
    return 'var(--color-success)';
  }

  // Get upload status info
  function getUploadStatusInfo(status: UploadProgress['status']) {
    switch (status) {
      case 'uploading':
        return { icon: '⬆️', label: 'Uploading', color: 'var(--color-info)' };
      case 'validating':
        return { icon: '🔍', label: 'Validating', color: 'var(--color-warning)' };
      case 'importing':
        return { icon: '📦', label: 'Importing', color: 'var(--color-accent)' };
      case 'caching':
        return { icon: '💾', label: 'Caching', color: 'var(--color-accent)' };
      case 'complete':
        return { icon: '✅', label: 'Complete', color: 'var(--color-success)' };
      case 'error':
        return { icon: '❌', label: 'Error', color: 'var(--color-error)' };
      default:
        return { icon: '📝', label: 'Unknown', color: 'var(--color-text-secondary)' };
    }
  }

  // Format timestamp
  function formatTimestamp(date: Date): string {
    return date.toLocaleString();
  }

  // Health check indicator
  $: systemHealth = getSystemHealth();

  function getSystemHealth() {
    if (usagePercentage >= 95) return { status: 'critical', message: 'Storage almost full' };
    if (usagePercentage >= 85) return { status: 'warning', message: 'Storage getting full' };
    if (!systemInfo.cacheEnabled) return { status: 'warning', message: 'Cache disabled' };
    return { status: 'healthy', message: 'System operating normally' };
  }

  // Get health indicator
  function getHealthIcon(status: string): string {
    switch (status) {
      case 'healthy': return '💚';
      case 'warning': return '🟡';
      case 'critical': return '🔴';
      default: return '⚪';
    }
  }
</script>

<div class="status-panel">
  <!-- System Health -->
  <div class="status-section">
    <h3>System Status</h3>
    <div class="health-indicator">
      <span class="health-icon">{getHealthIcon(systemHealth.status)}</span>
      <div class="health-info">
        <div class="health-status">{systemHealth.status.toUpperCase()}</div>
        <div class="health-message">{systemHealth.message}</div>
      </div>
    </div>
  </div>

  <!-- Storage Quota -->
  <div class="status-section">
    <h4>Storage Usage</h4>
    <div class="storage-stats">
      <div class="storage-bar">
        <div 
          class="storage-fill" 
          style="width: {usagePercentage}%; background-color: {getUsageColor(usagePercentage)}"
        ></div>
      </div>
      <div class="storage-info">
        <div class="storage-used">
          {formatFileSize(storageQuota.used)} used
        </div>
        <div class="storage-total">
          {formatFileSize(storageQuota.total)} total
        </div>
      </div>
      <div class="storage-percentage">
        {usagePercentage.toFixed(1)}% used
      </div>
      <div class="storage-remaining">
        {formatFileSize(remainingSpace)} available
      </div>
    </div>
  </div>

  <!-- Extension Statistics -->
  <div class="status-section">
    <h4>Extension Statistics</h4>
    <div class="extension-stats">
      <div class="stat-item">
        <span class="stat-icon">📦</span>
        <div class="stat-info">
          <div class="stat-value">{storageQuota.extensionCount}</div>
          <div class="stat-label">Workspace Extensions</div>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-icon">💾</span>
        <div class="stat-info">
          <div class="stat-value">{storageQuota.cacheCount}</div>
          <div class="stat-label">Cached Extensions</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Current Operation -->
  {#if uploadProgress || isLoading}
    <div class="status-section">
      <h4>Current Operation</h4>
      {#if uploadProgress}
        {@const statusInfo = getUploadStatusInfo(uploadProgress.status)}
        <div class="operation-status">
          <div class="operation-header">
            <span class="operation-icon">{statusInfo.icon}</span>
            <div class="operation-info">
              <div class="operation-file">{uploadProgress.filename}</div>
              <div class="operation-stage" style="color: {statusInfo.color}">
                {statusInfo.label}
              </div>
            </div>
          </div>
          <div class="progress-container">
            <div class="progress-bar">
              <div 
                class="progress-fill"
                style="width: {uploadProgress.progress}%; background-color: {statusInfo.color}"
              ></div>
            </div>
            <div class="progress-text">{uploadProgress.progress}%</div>
          </div>
        </div>
      {:else if isLoading}
        <div class="loading-indicator">
          <span class="loading-spinner">⏳</span>
          <span class="loading-text">Loading...</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- System Information -->
  <div class="status-section">
    <h4>System Information</h4>
    <div class="system-info">
      <div class="info-item">
        <span class="info-label">Storage Backend:</span>
        <span class="info-value">{systemInfo.storageBackend}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Cache Enabled:</span>
        <span class="info-value" class:enabled={systemInfo.cacheEnabled} class:disabled={!systemInfo.cacheEnabled}>
          {systemInfo.cacheEnabled ? 'Yes' : 'No'}
        </span>
      </div>
      <div class="info-item">
        <span class="info-label">Compression:</span>
        <span class="info-value" class:enabled={systemInfo.compressionEnabled} class:disabled={!systemInfo.compressionEnabled}>
          {systemInfo.compressionEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <div class="info-item">
        <span class="info-label">Demo Version:</span>
        <span class="info-value">{systemInfo.version}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Last Updated:</span>
        <span class="info-value">{formatTimestamp(systemInfo.lastUpdate)}</span>
      </div>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="status-section">
    <h4>Quick Actions</h4>
    <div class="quick-actions">
      <button class="action-btn" title="Refresh statistics">
        🔄 Refresh
      </button>
      <button class="action-btn" title="Clear cache">
        🗑️ Clear Cache
      </button>
      <button class="action-btn" title="Export statistics">
        📊 Export Stats
      </button>
    </div>
  </div>
</div>

<style>
  .status-panel {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-height: 600px;
    overflow-y: auto;
  }

  .status-section {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .status-section:last-child {
    border-bottom: none;
  }

  .status-section h3 {
    margin: 0 0 var(--space-3) 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-lg);
  }

  .status-section h4 {
    margin: 0 0 var(--space-2) 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-md);
  }

  /* Health Indicator */
  .health-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
  }

  .health-icon {
    font-size: var(--font-size-xl);
  }

  .health-status {
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
  }

  .health-message {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  /* Storage Usage */
  .storage-stats {
    background: var(--color-bg-primary);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-primary);
  }

  .storage-bar {
    width: 100%;
    height: 12px;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
    margin-bottom: var(--space-2);
  }

  .storage-fill {
    height: 100%;
    transition: width 0.3s ease, background-color 0.3s ease;
  }

  .storage-info {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-1);
  }

  .storage-percentage {
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    margin-bottom: var(--space-1);
  }

  .storage-remaining {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  /* Extension Statistics */
  .extension-stats {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
  }

  .stat-icon {
    font-size: var(--font-size-lg);
  }

  .stat-value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
  }

  .stat-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  /* Current Operation */
  .operation-status {
    background: var(--color-bg-primary);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-primary);
  }

  .operation-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }

  .operation-icon {
    font-size: var(--font-size-lg);
  }

  .operation-file {
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
  }

  .operation-stage {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }

  .progress-container {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    min-width: 40px;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--color-bg-primary);
    border-radius: var(--radius-sm);
  }

  .loading-spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .loading-text {
    color: var(--color-text-secondary);
  }

  /* System Information */
  .system-info {
    background: var(--color-bg-primary);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-primary);
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--color-border-secondary);
    font-size: var(--font-size-sm);
  }

  .info-item:last-child {
    border-bottom: none;
  }

  .info-label {
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-medium);
  }

  .info-value {
    color: var(--color-text-primary);
  }

  .info-value.enabled {
    color: var(--color-success);
  }

  .info-value.disabled {
    color: var(--color-error);
  }

  /* Quick Actions */
  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .action-btn {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: var(--font-size-sm);
    text-align: left;
  }

  .action-btn:hover {
    background: var(--color-bg-accent);
    border-color: var(--color-border-accent);
  }

  /* Custom scrollbar */
  .status-panel::-webkit-scrollbar {
    width: 8px;
  }

  .status-panel::-webkit-scrollbar-track {
    background: var(--color-bg-secondary);
  }

  .status-panel::-webkit-scrollbar-thumb {
    background: var(--color-border-secondary);
    border-radius: var(--radius-sm);
  }

  .status-panel::-webkit-scrollbar-thumb:hover {
    background: var(--color-border-primary);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .storage-info {
      flex-direction: column;
      gap: var(--space-1);
    }

    .operation-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-1);
    }

    .info-item {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-1);
    }
  }
</style>