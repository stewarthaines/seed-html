import { persisted, asBoolean } from '../state/persisted.svelte.js';

/**
 * Advanced mode — a single app-level preference (set once, applies across every
 * project), persisted to localStorage. Read `advancedMode.current` reactively;
 * assign to it to change + persist (e.g. `advancedMode.current = !advancedMode.current`).
 *
 * It unlocks power-user surfaces app-wide: extra metadata fields, the manifest's
 * individual SOURCE files, the Plugins / Available Extensions / EPUB / Extensions /
 * Generators settings, JavaScript files in the editor, and the catalog URL import.
 */
export const advancedMode = persisted('editme_advanced_mode', false, asBoolean);
