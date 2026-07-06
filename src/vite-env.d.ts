/// <reference types="svelte" />
/// <reference types="vite/client" />

// Support for importing files as raw strings
declare module '*.js?raw' {
  const content: string;
  export default content;
}

declare module '*.ts?raw' {
  const content: string;
  export default content;
}

// Global types for internationalization. The build injects the assignment as a
// stable anchor: null in the base build (no embedded catalogs), or a
// data:application/zip;base64 URL when catalogs are embedded/injected.
declare global {
  interface Window {
    __EDITME_I18N_BUNDLE__?: string | null;
  }
}
