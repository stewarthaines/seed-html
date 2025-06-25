<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { userEvent, within } from 'storybook/test';
  import LayoutManager from '../lib/LayoutManager.svelte';

  const { Story } = defineMeta({
    title: 'Application/LayoutManager',
    component: LayoutManager,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'The main layout component providing collapsible sidebar and resizable content panes for the EDITME EPUB editor.',
        },
      },
    },
    tags: ['autodocs'],
  });
</script>

<Story
  name="Default Layout"
  parameters={{
    docs: {
      description: {
        story:
          'Default layout with sidebar expanded and 50/50 content split. Shows workspace section active with placeholder content.',
      },
    },
  }}
>
  <svelte:fragment slot="sidebar-workspace">
    <div class="demo-content">
      <h3>📁 Workspace</h3>
      <p>Current workspace: <strong>My EPUB Project</strong></p>
      <ul>
        <li>✅ Basic setup complete</li>
        <li>🔄 Content in progress</li>
        <li>⏳ Packaging pending</li>
      </ul>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="sidebar-metadata">
    <div class="demo-content">
      <h3>📄 Metadata</h3>
      <div class="form-group">
        <label>Title:</label>
        <input type="text" value="My EPUB Book" readonly />
      </div>
      <div class="form-group">
        <label>Author:</label>
        <input type="text" value="Jane Doe" readonly />
      </div>
      <div class="form-group">
        <label>Language:</label>
        <select disabled>
          <option>English (en)</option>
        </select>
      </div>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="sidebar-manifest">
    <div class="demo-content">
      <h3>📋 Manifest</h3>
      <div class="file-list">
        <div class="file-item">📄 chapter1.xhtml</div>
        <div class="file-item">📄 chapter2.xhtml</div>
        <div class="file-item">📄 chapter3.xhtml</div>
        <div class="file-item">🖼️ cover.jpg</div>
        <div class="file-item">🎨 styles.css</div>
      </div>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="sidebar-nav">
    <div class="demo-content">
      <h3>📖 Navigation</h3>
      <nav class="toc">
        <div class="toc-item">1. Introduction</div>
        <div class="toc-item">2. Getting Started</div>
        <div class="toc-item">3. Advanced Topics</div>
        <div class="toc-item">4. Conclusion</div>
      </nav>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="sidebar-spine">
    <div class="demo-content">
      <h3>📖 Spine Items</h3>
      <div class="spine-list">
        <div class="spine-item">1. cover.xhtml</div>
        <div class="spine-item">2. chapter1.xhtml</div>
        <div class="spine-item">3. chapter2.xhtml</div>
        <div class="spine-item">4. chapter3.xhtml</div>
      </div>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="sidebar-settings">
    <div class="demo-content">
      <h3>⚙️ Settings</h3>
      <div class="setting-group">
        <label><input type="checkbox" checked /> Auto-save</label>
      </div>
      <div class="setting-group">
        <label><input type="checkbox" /> Dark mode</label>
      </div>
      <div class="setting-group">
        <label>Preview device:</label>
        <select>
          <option>iPhone</option>
          <option>iPad</option>
          <option>Desktop</option>
        </select>
      </div>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="left-content">
    <div class="editor-demo">
      <h3>Plain Text Editor</h3>
      <textarea rows="20" placeholder="Write your content here...">
        # Chapter 1: Introduction Welcome to the world of EPUB creation! In this chapter, we'll
        explore the basics of creating digital books. ## What is EPUB? EPUB (Electronic Publication)
        is a widely-used format for digital books and publications. It's based on web standards like
        HTML, CSS, and XML. ## Key Features - **Reflowable**: Text adapts to different screen sizes
        - **Accessibility**: Built-in support for screen readers - **Multimedia**: Support for
        images, audio, and video - **Interactive**: Can include interactive elements Let's dive
        deeper into the creation process...
      </textarea>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="right-content">
    <div class="preview-demo">
      <h3>XHTML Preview</h3>
      <div class="preview-frame">
        <div class="preview-content">
          <h1>Chapter 1: Introduction</h1>
          <p>
            Welcome to the world of EPUB creation! In this chapter, we'll explore the basics of
            creating digital books.
          </p>
          <h2>What is EPUB?</h2>
          <p>
            EPUB (Electronic Publication) is a widely-used format for digital books and
            publications. It's based on web standards like HTML, CSS, and XML.
          </p>
          <h2>Key Features</h2>
          <ul>
            <li><strong>Reflowable</strong>: Text adapts to different screen sizes</li>
            <li><strong>Accessibility</strong>: Built-in support for screen readers</li>
            <li><strong>Multimedia</strong>: Support for images, audio, and video</li>
            <li><strong>Interactive</strong>: Can include interactive elements</li>
          </ul>
          <p>Let's dive deeper into the creation process...</p>
        </div>
      </div>
    </div>
  </svelte:fragment>
</Story>

<Story
  name="Collapsed Sidebar"
  parameters={{
    docs: {
      description: {
        story:
          'Layout with sidebar collapsed to show maximum content area. Icons remain visible for navigation.',
      },
    },
  }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggleButton = canvas.getByLabelText('Toggle sidebar');
    await userEvent.click(toggleButton);
  }}
>
  <svelte:fragment slot="sidebar-workspace">
    <div class="demo-content">
      <h3>📁 Workspace</h3>
      <p>Workspace content hidden when collapsed</p>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="left-content">
    <div class="editor-demo">
      <h3>Expanded Editor View</h3>
      <p>With sidebar collapsed, the editor gets more space for content editing.</p>
      <textarea rows="25" placeholder="More space for writing...">
        # Chapter 2: Advanced Editing With the sidebar collapsed, you have maximum space for content
        creation. This is perfect for focused writing sessions. ## Full-Width Editing The expanded
        editor provides: - More characters per line - Better context visibility - Reduced
        distractions - Improved writing flow ## Resizable Panes You can still resize the left and
        right panes to balance between editing and preview as needed. Continue writing your content
        here...
      </textarea>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="right-content">
    <div class="preview-demo">
      <h3>Preview Pane</h3>
      <div class="preview-frame">
        <div class="preview-content">
          <h1>Chapter 2: Advanced Editing</h1>
          <p>
            With the sidebar collapsed, you have maximum space for content creation. This is perfect
            for focused writing sessions.
          </p>
          <h2>Full-Width Editing</h2>
          <p>The expanded editor provides:</p>
          <ul>
            <li>More characters per line</li>
            <li>Better context visibility</li>
            <li>Reduced distractions</li>
            <li>Improved writing flow</li>
          </ul>
        </div>
      </div>
    </div>
  </svelte:fragment>
</Story>

<Story
  name="Section Navigation"
  parameters={{
    docs: {
      description: {
        story:
          'Demonstrates switching between different sidebar sections (workspace, metadata, manifest, navigation, spine, settings).',
      },
    },
  }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click through different sections
    const metadataButton = canvas.getByTitle('Metadata');
    await userEvent.click(metadataButton);

    // Wait a moment then click manifest
    await new Promise(resolve => setTimeout(resolve, 1000));
    const manifestButton = canvas.getByTitle('Manifest');
    await userEvent.click(manifestButton);

    // Wait a moment then click navigation
    await new Promise(resolve => setTimeout(resolve, 1000));
    const navButton = canvas.getByTitle('Navigation');
    await userEvent.click(navButton);
  }}
>
  <svelte:fragment slot="sidebar-workspace">
    <div class="demo-content">
      <h3>📁 Workspace</h3>
      <p>Manage your EPUB projects and workspaces</p>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="sidebar-metadata">
    <div class="demo-content">
      <h3>📄 Metadata</h3>
      <p>Edit book metadata and publication details</p>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="sidebar-manifest">
    <div class="demo-content">
      <h3>📋 Manifest</h3>
      <p>View and manage all files in your EPUB</p>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="sidebar-nav">
    <div class="demo-content">
      <h3>📖 Navigation</h3>
      <p>Create and edit table of contents</p>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="sidebar-spine">
    <div class="demo-content">
      <h3>📖 Spine Items</h3>
      <p>Manage chapter order and spine structure</p>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="sidebar-settings">
    <div class="demo-content">
      <h3>⚙️ Settings</h3>
      <p>Configure application preferences</p>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="left-content">
    <div class="editor-demo">
      <h3>Text Editor</h3>
      <p>The editor content remains stable while switching sidebar sections.</p>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="right-content">
    <div class="preview-demo">
      <h3>Preview</h3>
      <p>Preview content is independent of sidebar state.</p>
    </div>
  </svelte:fragment>
</Story>

<style>
  .demo-content {
    padding: 1rem;
  }

  .demo-content h3 {
    margin: 0 0 0.75rem 0;
    color: #333;
    font-size: 1rem;
  }

  .demo-content p {
    margin: 0 0 0.5rem 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .demo-content ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
    font-size: 0.9rem;
    color: #666;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
    font-size: 0.9rem;
    color: #555;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .file-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .file-item {
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 4px;
    font-size: 0.9rem;
    border: 1px solid #e9ecef;
  }

  .toc {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .toc-item {
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .toc-item:hover {
    background: #e9ecef;
  }

  .spine-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .spine-item {
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 4px;
    font-size: 0.9rem;
    border-left: 3px solid #007bff;
  }

  .setting-group {
    margin-bottom: 1rem;
  }

  .setting-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: #555;
  }

  .setting-group input[type='checkbox'] {
    width: auto;
  }

  .setting-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .editor-demo {
    padding: 1rem;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .editor-demo h3 {
    margin: 0 0 1rem 0;
    color: #333;
  }

  .editor-demo textarea {
    flex: 1;
    width: 100%;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    resize: none;
  }

  .preview-demo {
    padding: 1rem;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .preview-demo h3 {
    margin: 0 0 1rem 0;
    color: #333;
  }

  .preview-frame {
    flex: 1;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    overflow: auto;
  }

  .preview-content {
    padding: 2rem;
    max-width: 650px;
    margin: 0 auto;
    font-family: Georgia, serif;
    line-height: 1.6;
  }

  .preview-content h1 {
    color: #2c3e50;
    border-bottom: 2px solid #3498db;
    padding-bottom: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .preview-content h2 {
    color: #34495e;
    margin-top: 2rem;
    margin-bottom: 1rem;
  }

  .preview-content p {
    margin-bottom: 1rem;
    color: #2c3e50;
  }

  .preview-content ul {
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }

  .preview-content li {
    margin-bottom: 0.5rem;
    color: #2c3e50;
  }
</style>
