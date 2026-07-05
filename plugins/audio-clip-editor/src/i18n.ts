/**
 * Plugin-side i18n. The plugin has no catalog or bundle of its own: the host
 * pushes the active locale's dictionary via the `context` message (see
 * src/lib/plugins/contract.ts), and `setPluginMessages` feeds it here. The `t`
 * store mirrors the host's `$t` semantics — look up the English source string,
 * fall back to the key (which is the English source) when missing, and do
 * `{param}` interpolation — so plugin components author strings identically to
 * the app (`{$t('Save')}`), and the shared extractor picks them up.
 */
import { writable, derived, get } from 'svelte/store';

const messages = writable<Record<string, string>>({});

/** Replace the active translation dictionary (called from the context handler). */
export function setPluginMessages(next: Record<string, string>): void {
  messages.set(next);
}

export type TranslateFn = (
  key: string,
  params?: Record<string, unknown>,
) => string;

/** Reactive translator: `{$t('Save')}`, `{$t('Hello {name}', { name })}`. */
function lookup(
  dict: Record<string, string>,
  key: string,
  params?: Record<string, unknown>,
): string {
  // `|| key` (not `??`): untranslated entries arrive as empty strings for
  // non-English locales, so fall back to the English source key for those too.
  let result = dict[key] || key;
  if (params) {
    for (const [param, value] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
    }
  }
  return result;
}

export const t = derived(
  messages,
  ($messages): TranslateFn =>
    (key, params) =>
      lookup($messages, key, params),
);

/**
 * Non-reactive translation for script-context strings (status messages, confirm
 * dialogs) that are read once rather than rendered. Matched by the extractor.
 */
export const translate: TranslateFn = (key, params) =>
  lookup(get(messages), key, params);
