<script lang="ts">
  import { onMount } from 'svelte';
  import { TransformPipeline, type ChapterMetadata, type BlobUrlManager } from '../lib/transform';
  import './transform-pipeline-demo.css';
  import sampleTextTransform from './transform-scripts/sample-text-transform.js?raw';
  import sampleDomTransform from './transform-scripts/sample-dom-transform.js?raw';

  interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'action';
    message: string;
  }

  interface FileStorageAPI {
    readTextFile(workspaceId: string, path: string): Promise<string>;
    getFileInfo(workspaceId: string, path: string): Promise<{ size: number; lastModified: Date }>;
  }

  // Demo state
  let transformPipeline: TransformPipeline;
  let logs: LogEntry[] = [];
  let isLoading = false;

  // Demo input and output
  let inputText =
    '# Chapter 1: Introduction\n\nThis is the opening chapter of our story.\n\n## A New Beginning\n\nThe adventure starts here with some **bold text** and *italic text*.';
  let textTransformResult = '';
  let domTransformResult = '';
  let finalXHTML = '';

  // Transform scripts are imported as raw strings from external files

  // Mock File Storage API
  const mockFileStorage: FileStorageAPI = {
    async readTextFile(workspaceId: string, path: string): Promise<string> {
      if (path === 'SOURCE/settings.json') {
        return JSON.stringify({
          transform_pipeline: {
            text_transform: 'text-transform.js',
            dom_transforms: ['dom-transform.js'],
            enabled: true,
            timeout_ms: 2000,
          },
        });
      }
      if (path === 'SOURCE/scripts/text-transform.js') {
        return sampleTextTransform;
      }
      if (path === 'SOURCE/scripts/dom-transform.js') {
        return sampleDomTransform;
      }
      throw new Error(`File not found: ${path}`);
    },

    async getFileInfo(workspaceId: string, path: string) {
      return {
        size: 1000,
        lastModified: new Date(),
      };
    },
  };

  // Mock Blob URL Manager
  const mockBlobUrlManager: BlobUrlManager = {
    getLoadedGlobals(): Record<string, any> {
      return {}; // No extension libraries for simple demo
    },
  };

  // Sample chapter metadata
  const sampleMetadata: ChapterMetadata = {
    title: 'Chapter 1: Introduction',
    language: 'en',
    stylesheets: ['../styles/chapter.css'],
    scripts: [],
    customHead: '<meta name="chapter" content="1" />',
  };

  onMount(() => {
    addLog('info', 'Transform Pipeline Demo initialized');
    addLog('info', 'Ready to transform text through the pipeline');

    // Initialize the transform pipeline
    transformPipeline = new TransformPipeline(mockFileStorage, mockBlobUrlManager);
  });

  async function runTransformation() {
    if (!transformPipeline || isLoading) return;

    isLoading = true;
    addLog('action', 'Starting transform pipeline...');

    try {
      // Step 1: Text transformation
      addLog('info', 'Step 1: Executing text transformation');
      const textResult = await transformPipeline.transformText(
        inputText,
        'demo-workspace',
        'chapter-1'
      );

      if (textResult.success && textResult.transformedText) {
        textTransformResult = textResult.transformedText;
        addLog('success', 'Text transformation completed');
      } else {
        // addLog('error', textResult.error);
        console.log(textResult.error);
        throw new Error('Text transformation failed');
      }

      // Step 2: DOM transformation
      addLog('info', 'Step 2: Executing DOM transformation');
      const parser = new DOMParser();
      const document = parser.parseFromString(`<div>${textTransformResult}</div>`, 'text/html');

      const transformedDoc = await transformPipeline.transformDOM(
        document,
        'demo-workspace',
        'chapter-1'
      );
      domTransformResult =
        transformedDoc.querySelector('div')?.innerHTML || transformedDoc.body.innerHTML;
      addLog('success', 'DOM transformation completed');

      // Step 3: XHTML generation
      addLog('info', 'Step 3: Generating final XHTML document');
      const xhtmlString = transformPipeline.generateXHTMLDocument(
        domTransformResult,
        sampleMetadata
      );
      finalXHTML = xhtmlString;
      addLog('success', 'XHTML generation completed');

      addLog('success', 'Transform pipeline completed successfully!');
    } catch (error) {
      addLog(
        'error',
        `Transform pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      isLoading = false;
    }
  }

  function resetDemo() {
    textTransformResult = '';
    domTransformResult = '';
    finalXHTML = '';
    inputText =
      '# Chapter 1: Introduction\n\nThis is the opening chapter of our story.\n\n## A New Beginning\n\nThe adventure starts here with some **bold text** and *italic text*.';
    addLog('success', 'Demo reset completed');
  }

  function addLog(type: LogEntry['type'], message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, { timestamp, type, message }];
  }
</script>

<div class="transform-pipeline-demo">
  <div class="demo-header">
    <h2>Transform Pipeline Demo</h2>
    <p>
      Interactive demonstration of the Transform Pipeline converting plain text to XHTML through
      text and DOM transformations.
    </p>
  </div>

  <div class="demo-controls">
    <button on:click={runTransformation} disabled={isLoading} class="transform-btn">
      {isLoading ? 'Transforming...' : 'Run Transform Pipeline'}
    </button>
    <button on:click={resetDemo} disabled={isLoading} class="reset-btn"> Reset Demo </button>
  </div>

  <div class="demo-content">
    <!-- Input Section -->
    <div class="input-section">
      <h3>Input Text</h3>
      <textarea
        bind:value={inputText}
        placeholder="Enter your plain text here..."
        disabled={isLoading}
      ></textarea>
    </div>

    <!-- Transform Results -->
    <div class="results-section">
      <div class="result-panel">
        <h4>1. Text Transform Result</h4>
        <div class="result-content">
          {#if textTransformResult}
            <pre>{textTransformResult}</pre>
          {:else}
            <div class="placeholder">Text transformation result will appear here</div>
          {/if}
        </div>
      </div>

      <div class="result-panel">
        <h4>2. DOM Transform Result</h4>
        <div class="result-content">
          {#if domTransformResult}
            <pre>{domTransformResult}</pre>
          {:else}
            <div class="placeholder">DOM transformation result will appear here</div>
          {/if}
        </div>
      </div>

      <div class="result-panel">
        <h4>3. Final XHTML Document</h4>
        <div class="result-content">
          {#if finalXHTML}
            <!-- <pre>{finalXHTML}</pre> -->
            <iframe
              title="preview"
              srcdoc={finalXHTML}
              style="box-sizing: border-box; width: 100%; height: 100%;"
              frameborder="0"
            ></iframe>
          {:else}
            <div class="placeholder">Final XHTML document will appear here</div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Console Log -->
  <div class="console-section">
    <h3>Console Log</h3>
    <div class="console-log">
      {#each logs as log}
        <div class="log-entry log-{log.type}">
          <span class="log-time">{log.timestamp}</span>
          <span class="log-message">{log.message}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
