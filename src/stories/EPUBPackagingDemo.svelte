<script lang="ts">
  import { EPUBPackager } from '$lib/epub';
  import type { PackageResult, PackageProgress } from '$lib/epub';
  import { BASIC_EPUB_WORKSPACE, MockFileStorageAPI } from './epub-packaging-mock-data';

  export let showProgress = true;
  export let allowDownload = true;

  let isPackaging = false;
  let packageResult: PackageResult | null = null;
  let progress: PackageProgress | null = null;
  let error: string | null = null;

  // Create packager with mocked storage
  const packager = new EPUBPackager();
  const mockStorage = new MockFileStorageAPI(BASIC_EPUB_WORKSPACE);

  // Replace the file storage with our mock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (packager as any).fileStorage = mockStorage;

  async function handlePackage() {
    isPackaging = true;
    packageResult = null;
    progress = null;
    error = null;

    try {
      const result = await packager.packageEPUB(BASIC_EPUB_WORKSPACE.id, {
        progressCallback: showProgress
          ? p => {
              progress = p;
            }
          : undefined,
      });

      packageResult = result;

      if (!result.success) {
        error = result.error || 'Unknown packaging error';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      isPackaging = false;
    }
  }

  function handleDownload() {
    if (packageResult?.success && packageResult.blob && packageResult.filename) {
      packager.downloadEPUB(packageResult.blob, packageResult.filename);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatProgress(progress: PackageProgress): string {
    const percentage = Math.round((progress.processedFiles / progress.totalFiles) * 100);
    return `${percentage}% (${progress.processedFiles}/${progress.totalFiles} files)`;
  }
</script>

<div class="epub-packaging-demo">
  <h2>EPUB Packaging Demo</h2>

  <!-- Workspace Info -->
  <div class="workspace-info">
    <h3>Workspace: {BASIC_EPUB_WORKSPACE.name}</h3>
    <div class="file-list">
      <h4>Files ({BASIC_EPUB_WORKSPACE.files.length}):</h4>
      <ul>
        {#each BASIC_EPUB_WORKSPACE.files as file}
          <li>
            <code>{file.path}</code>
            <span class="file-type">({file.mimeType})</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>

  <!-- Controls -->
  <div class="controls">
    <button class="package-btn" disabled={isPackaging} onclick={handlePackage}>
      {#if isPackaging}
        Packaging...
      {:else}
        Package EPUB
      {/if}
    </button>
  </div>

  <!-- Progress -->
  {#if showProgress && progress}
    <div class="progress-section">
      <h4>Progress</h4>
      <div class="progress-info">
        <div class="phase">Phase: <strong>{progress.phase}</strong></div>
        <div class="file-progress">{formatProgress(progress)}</div>
        {#if progress.currentFile}
          <div class="current-file">Processing: <code>{progress.currentFile}</code></div>
        {/if}
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          style="width: {(progress.processedFiles / progress.totalFiles) * 100}%"
        ></div>
      </div>
    </div>
  {/if}

  <!-- Error Display -->
  {#if error}
    <div class="error">
      <h4>Error</h4>
      <p>{error}</p>
    </div>
  {/if}

  <!-- Results -->
  {#if packageResult}
    <div class="results">
      <h4>Packaging Results</h4>
      {#if packageResult.success}
        <div class="success">
          <div class="result-item">
            <strong>Status:</strong> <span class="success-text">Success ✓</span>
          </div>
          <div class="result-item">
            <strong>Filename:</strong> <code>{packageResult.filename}</code>
          </div>
          <div class="result-item">
            <strong>Files:</strong>
            {packageResult.fileCount}
          </div>
          <div class="result-item">
            <strong>Original Size:</strong>
            {formatBytes(packageResult.totalSize || 0)}
          </div>
          <div class="result-item">
            <strong>Compressed Size:</strong>
            {formatBytes(packageResult.compressedSize || 0)}
          </div>
          <div class="result-item">
            <strong>Compression Ratio:</strong>
            {Math.round(
              (((packageResult.totalSize || 0) - (packageResult.compressedSize || 0)) /
                (packageResult.totalSize || 1)) *
                100
            )}%
          </div>
          <div class="result-item">
            <strong>Processing Time:</strong>
            {packageResult.processingTime}ms
          </div>

          {#if allowDownload}
            <button class="download-btn" onclick={handleDownload}> Download EPUB </button>
          {/if}
        </div>
      {:else}
        <div class="error">
          <strong>Status:</strong> <span class="error-text">Failed ✗</span>
          <p>{packageResult.error}</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .epub-packaging-demo {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-family: system-ui, sans-serif;
  }

  .workspace-info {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .file-list ul {
    list-style: none;
    padding: 0;
    margin: 8px 0;
  }

  .file-list li {
    padding: 4px 0;
    border-bottom: 1px solid #e9ecef;
  }

  .file-list li:last-child {
    border-bottom: none;
  }

  .file-type {
    color: #6c757d;
    font-size: 0.9em;
    margin-left: 8px;
  }

  .controls {
    text-align: center;
    margin: 20px 0;
  }

  .package-btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .package-btn:hover:not(:disabled) {
    background: #0056b3;
  }

  .package-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .progress-section {
    background: #e3f2fd;
    border: 1px solid #bbdefb;
    border-radius: 6px;
    padding: 16px;
    margin: 20px 0;
  }

  .progress-info {
    margin-bottom: 12px;
  }

  .progress-info > div {
    margin-bottom: 4px;
  }

  .progress-bar {
    background: #f0f0f0;
    border-radius: 4px;
    height: 8px;
    overflow: hidden;
  }

  .progress-fill {
    background: #007bff;
    height: 100%;
    transition: width 0.3s ease;
  }

  .results {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    padding: 16px;
    margin: 20px 0;
  }

  .result-item {
    margin-bottom: 8px;
  }

  .success-text {
    color: #28a745;
  }

  .error-text {
    color: #dc3545;
  }

  .error {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 6px;
    padding: 16px;
    margin: 20px 0;
    color: #721c24;
  }

  .download-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    margin-top: 12px;
    transition: background 0.2s;
  }

  .download-btn:hover {
    background: #218838;
  }

  code {
    background: #e9ecef;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 0.9em;
  }

  h2,
  h3,
  h4 {
    margin-top: 0;
    color: #343a40;
  }
</style>
