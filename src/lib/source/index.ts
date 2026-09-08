/**
 * Editor-source archive (SEED.zip) Management API
 *
 * Complete API for managing SOURCE/ directory files and the editor-source
 * archive (SEED.zip; legacy SOURCE.zip still imported) creation/extraction in
 * EPUB workspaces.
 */

// Main classes
export { SourceManager } from './source-manager.js';

// Utility functions
export { SOURCE_ARCHIVE_NAME, SOURCE_ARCHIVE_NAMES } from './source-utils.js';

// Chapter frontmatter (the leading `---` YAML block) and its store
export {
  splitFrontmatter,
  frontmatterStorePath,
  FRONTMATTER_STORE_PREFIX,
  type FrontmatterSplit,
} from './frontmatter.js';
