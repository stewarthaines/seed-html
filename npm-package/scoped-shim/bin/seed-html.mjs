#!/usr/bin/env node
/**
 * Compatibility alias: @stewarthaines/seed-html delegates to the unscoped
 * seed-html package. The "*" dependency resolves to the latest release at
 * install time, and process.argv passes through untouched, so this launcher
 * behaves exactly like `npx seed-html`.
 *
 * Published once (v1.0.0, frozen); all releases ship under seed-html only.
 */
import('seed-html/bin/seed-html.mjs');
