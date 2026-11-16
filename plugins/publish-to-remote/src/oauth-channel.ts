/**
 * The same-origin BroadcastChannel an OAuth popup also announces its result
 * on (App.svelte), for when the provider's pages have severed the popup's
 * `window.opener`.
 */
export const OAUTH_CHANNEL = 'seedhtml-oauth';
