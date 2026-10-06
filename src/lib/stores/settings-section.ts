/**
 * The Settings section last opened, remembered across sheets and reloads.
 * Shared so the app can land the sheet on a section (the publish plugin's
 * "Destinations…" link) as well as the sheet remembering its own choice.
 */
import { persisted, asString } from '../state/persisted.svelte.js';

export const settingsSection = persisted<string>('seedhtml_settings_section', 'general', asString);
