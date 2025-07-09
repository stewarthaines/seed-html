/**
 * Reusable utilities for Storybook stories that work with WorkspaceManager
 *
 * This module provides standardized patterns for creating demo workspaces,
 * managing content, and handling story lifecycle in workspace-based demos.
 */

import type { WorkspaceManager } from '../../lib/workspace';

// Types for workspace story utilities
export interface DemoMetadata {
  title: string;
  language: string;
  identifier: string;
  creator: string[];
  publisher?: string;
  description?: string;
  subject?: string[];
  date?: string;
}

export interface DemoChapter {
  id: string;
  title: string;
  content: string;
  linear?: boolean;
  mediaType?: string;
}

export interface WorkspaceSetupOptions {
  workspaceId?: string;
  metadata?: Partial<DemoMetadata>;
  chapters?: DemoChapter[];
  createSourceFiles?: boolean;
  skipMissingChapters?: string[];
  includeCSS?: boolean;
  includeImages?: boolean;
  includeExtensions?: boolean;
}

export interface WorkspaceStoryState {
  workspaceManager: WorkspaceManager | null;
  workspaceId: string | null;
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Create standardized demo metadata
 */
export function createSampleMetadata(overrides: Partial<DemoMetadata> = {}): DemoMetadata {
  return {
    title: 'Demo EPUB Project',
    language: 'en',
    identifier: 'demo-epub-' + Date.now(),
    creator: ['Demo Author'],
    publisher: 'Storybook Demo Publisher',
    description: 'A sample EPUB created for Storybook demonstration purposes',
    subject: ['Demo', 'Sample', 'EPUB'],
    date: new Date().toISOString().split('T')[0],
    ...overrides,
  };
}

/**
 * Create sample chapters with realistic content
 */
export function createSampleChapters(count: number = 5): DemoChapter[] {
  const chapters: DemoChapter[] = [];

  // Prologue
  chapters.push({
    id: 'prologue',
    title: 'Prologue',
    content: `# Prologue

The story begins in a small village nestled between rolling hills and ancient forests. Here, where time seems to move more slowly, our tale unfolds...

This is where everything started, long before the main events that would change everything.`,
    linear: true,
  });

  // Main chapters
  for (let i = 1; i <= count; i++) {
    chapters.push({
      id: `chapter${i}`,
      title: `Chapter ${i}`,
      content: `# Chapter ${i}

## The Adventure Continues

In this chapter, we explore new territories and meet fascinating characters. Each chapter builds upon the last, creating a rich tapestry of story and meaning.

### Key Events

- Important event number one
- Another significant development
- The plot thickens considerably

The content of this chapter demonstrates how the EDITME system handles structured text with various formatting elements.

> "Every great story has moments that define its characters." - Demo Author

Here we see how blockquotes and other elements are handled within the transform pipeline.`,
      linear: true,
    });
  }

  // Epilogue (non-linear to show validation warnings)
  chapters.push({
    id: 'epilogue',
    title: 'Epilogue',
    content: `# Epilogue

And so our story comes to a close. The characters have grown, the conflicts have been resolved, and new possibilities stretch out before us.

This epilogue is marked as non-linear to demonstrate how the spine manager handles validation warnings for non-standard content organization.`,
    linear: false,
  });

  return chapters;
}

/**
 * Initialize a WorkspaceManager instance
 */
export async function initializeWorkspaceManager(): Promise<WorkspaceManager> {
  const { WorkspaceManager } = await import('../../lib/workspace');
  const workspaceManager = new WorkspaceManager();
  await workspaceManager.init();
  return workspaceManager;
}

/**
 * Clean up any existing demo workspace
 */
export async function cleanupDemoWorkspace(
  workspaceManager: WorkspaceManager,
  workspaceId: string
): Promise<void> {
  try {
    await workspaceManager.deleteWorkspace(workspaceId);
  } catch {
    // Workspace doesn't exist, which is fine
  }
}

/**
 * Create a complete demo workspace with content
 */
export async function createDemoWorkspace(
  workspaceManager: WorkspaceManager,
  options: WorkspaceSetupOptions = {}
): Promise<string> {
  const {
    workspaceId: providedId,
    metadata = {},
    chapters = createSampleChapters(),
    createSourceFiles = true,
    skipMissingChapters = [],
    includeCSS = true,
    includeImages = false,
  } = options;

  // Create metadata
  const demoMetadata = createSampleMetadata(metadata);

  // Clean up existing workspace if using a specific ID
  const workspaceId = providedId || `demo-workspace-${Date.now()}`;
  if (providedId) {
    await cleanupDemoWorkspace(workspaceManager, workspaceId);
  }

  // Create new workspace
  const actualWorkspaceId = await workspaceManager.createEPUBWorkspace(demoMetadata);

  // Add chapters to workspace
  await addChaptersToWorkspace(workspaceManager, actualWorkspaceId, chapters, {
    createSourceFiles,
    skipMissingChapters,
  });

  // Add additional resources if requested
  if (includeCSS) {
    await addSampleCSS(workspaceManager, actualWorkspaceId);
  }

  if (includeImages) {
    await addSampleImages(workspaceManager, actualWorkspaceId);
  }

  return actualWorkspaceId;
}

/**
 * Add chapters to manifest and spine
 */
export async function addChaptersToWorkspace(
  workspaceManager: WorkspaceManager,
  workspaceId: string,
  chapters: DemoChapter[],
  options: {
    createSourceFiles?: boolean;
    skipMissingChapters?: string[];
  } = {}
): Promise<void> {
  const { createSourceFiles = true, skipMissingChapters = [] } = options;

  for (const chapter of chapters) {
    // Add to manifest
    await workspaceManager.addManifestItem(workspaceId, {
      id: chapter.id,
      href: `Text/${chapter.id}.xhtml`,
      mediaType: chapter.mediaType || 'application/xhtml+xml',
    });

    // Add to spine
    await workspaceManager.addSpineItem(workspaceId, {
      idref: chapter.id,
      linear: chapter.linear !== false,
    });

    // Write source text file (skip some to show missing file errors)
    if (createSourceFiles && !skipMissingChapters.includes(chapter.id)) {
      await workspaceManager.writeTextFile(
        workspaceId,
        `SOURCE/text/${chapter.id}.txt`,
        chapter.content
      );
    }
  }
}

/**
 * Add sample CSS to the workspace
 */
export async function addSampleCSS(
  workspaceManager: WorkspaceManager,
  workspaceId: string
): Promise<void> {
  const sampleCSS = `/* Sample EPUB Stylesheet */

body {
  font-family: Georgia, serif;
  line-height: 1.6;
  margin: 0;
  padding: 1em;
  color: #333;
}

h1, h2, h3, h4, h5, h6 {
  color: #2c3e50;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

h1 {
  font-size: 2em;
  border-bottom: 2px solid #3498db;
  padding-bottom: 0.25em;
}

h2 {
  font-size: 1.5em;
  color: #34495e;
}

h3 {
  font-size: 1.25em;
}

p {
  margin-bottom: 1em;
  text-align: justify;
}

blockquote {
  margin: 1em 2em;
  padding: 0.5em 1em;
  border-left: 4px solid #3498db;
  background-color: #f8f9fa;
  font-style: italic;
}

ul, ol {
  margin-bottom: 1em;
  padding-left: 2em;
}

li {
  margin-bottom: 0.25em;
}

.chapter-title {
  text-align: center;
  margin-bottom: 2em;
}

.section-break {
  text-align: center;
  margin: 2em 0;
  font-size: 1.5em;
  color: #7f8c8d;
}`;

  // Add CSS to manifest
  await workspaceManager.addManifestItem(workspaceId, {
    id: 'stylesheet',
    href: 'Styles/style.css',
    mediaType: 'text/css',
  });

  // Write CSS file
  await workspaceManager.writeTextFile(workspaceId, 'Styles/style.css', sampleCSS);

  // Also create a SOURCE version for editing
  await workspaceManager.writeTextFile(workspaceId, 'SOURCE/styles/style.css', sampleCSS);
}

/**
 * Add sample image references to the workspace
 */
export async function addSampleImages(
  workspaceManager: WorkspaceManager,
  workspaceId: string
): Promise<void> {
  // Add placeholder image entries to manifest
  const images = [
    { id: 'cover', href: 'Images/cover.jpg', mediaType: 'image/jpeg' },
    { id: 'illustration1', href: 'Images/illustration1.png', mediaType: 'image/png' },
  ];

  for (const image of images) {
    await workspaceManager.addManifestItem(workspaceId, image);
  }
}

/**
 * Create initial story state for workspace-based stories
 */
export function createInitialStoryState(): WorkspaceStoryState {
  return {
    workspaceManager: null,
    workspaceId: null,
    initialized: false,
    isLoading: false,
    error: null,
  };
}

/**
 * Handle story initialization with error handling
 */
export async function initializeStoryWorkspace(options: WorkspaceSetupOptions = {}): Promise<{
  workspaceManager: WorkspaceManager;
  workspaceId: string;
}> {
  const workspaceManager = await initializeWorkspaceManager();
  const workspaceId = await createDemoWorkspace(workspaceManager, options);

  return { workspaceManager, workspaceId };
}

/**
 * Wrapper for safe workspace operations with error handling
 */
export async function withWorkspaceErrorHandling<T>(
  operation: () => Promise<T>,
  onError?: (error: Error) => void
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error : new Error('Unknown error');
    console.error('Workspace operation failed:', errorMessage);
    if (onError) {
      onError(errorMessage);
    }
    return null;
  }
}

/**
 * Generate a unique workspace ID for stories
 */
export function generateStoryWorkspaceId(storyName: string): string {
  const timestamp = Date.now();
  const sanitizedName = storyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `story-${sanitizedName}-${timestamp}`;
}
