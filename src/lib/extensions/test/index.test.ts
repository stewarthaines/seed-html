/**
 * Extension Manager Test Suite Index
 *
 * Comprehensive test coverage for the Extension Manager API including:
 * - Core ExtensionManager functionality
 * - Internal ExtensionCache utility
 * - Utility functions (name detection, validation)
 * - Integration workflows and scenarios
 */

// Import all test suites to ensure they run as a complete suite
import './extension-manager.test.js';
import './extension-cache.test.js';
import './utils.test.js';
import './integration.test.js';

/**
 * Test Suite Overview:
 * 
 * 1. extension-manager.test.ts
 *    - Core ExtensionManager class methods
 *    - Import/export workflows
 *    - Error handling and validation
 *    - Workspace and cache operations
 *    - Batch operations and auto-caching
 * 
 * 2. extension-cache.test.ts
 *    - Internal ExtensionCache utility class
 *    - Cache operations and conflict detection
 *    - Extension comparison logic
 *    - Cache statistics and management
 * 
 * 3. utils.test.ts
 *    - Name detection from filenames
 *    - File validation and type classification
 *    - Name normalization and sanitization
 *    - Edge cases and security validation
 * 
 * 4. integration.test.ts
 *    - End-to-end workflows
 *    - Real-world usage scenarios
 *    - Performance and scalability testing
 *    - Error recovery and cleanup
 *    - Multi-extension workflows
 * 
 * Test Infrastructure:
 * - MockFileStorage: Simulates File Storage API with controllable failures
 * - Test Data Fixtures: Comprehensive sample extensions and scenarios
 * - Performance Testing: Memory and timing validation
 * - Security Testing: Path traversal and filename validation
 * 
 * Coverage Areas:
 * ✅ All public API methods
 * ✅ Error handling and edge cases
 * ✅ File validation and security
 * ✅ Cache operations and conflicts
 * ✅ Integration workflows
 * ✅ Performance scenarios
 * ✅ Real-world usage patterns
 */

export * from './mocks/file-storage.mock.js';
export * from './fixtures/create-test-data.js';
export * from './fixtures/extension-samples.js';