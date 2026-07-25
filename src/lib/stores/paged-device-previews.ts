import { persisted, asBoolean } from '../state/persisted.svelte.js';

/**
 * Paged device previews — an app-level opt-out (default on), persisted to
 * localStorage. When on (and served over http, with the reader modules present),
 * the device presets (Commute / Home / Travel) render through the foliate reader
 * engine — paginated pages at the device's size. When off, those presets fall
 * back to the built-in scrolling preview, exactly as they do over file://.
 *
 * The READ.html entry is deliberately unaffected — it is always the reader
 * engine, with no built-in equivalent. Read `pagedDevicePreviews.current`
 * reactively; assign to it to change + persist.
 */
export const pagedDevicePreviews = persisted('seedhtml_paged_device_previews', true, asBoolean);
