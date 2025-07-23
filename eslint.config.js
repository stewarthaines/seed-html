import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,ts,mjs}'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        Worker: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        DOMException: 'readonly',
        DOMParser: 'readonly',
        XMLSerializer: 'readonly',
        Document: 'readonly',
        Element: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        KeyboardEvent: 'readonly',
        DragEvent: 'readonly',
        EventTarget: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLIFrameElement: 'readonly',
        ResizeObserver: 'readonly',
        DOMRect: 'readonly',
        FocusEvent: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        Window: 'readonly',
        ReadableStream: 'readonly',
        WritableStream: 'readonly',
        TransformStream: 'readonly',
        CompressionStream: 'readonly',
        DecompressionStream: 'readonly',
        // File System Access API
        FileSystemDirectoryHandle: 'readonly',
        FileSystemFileHandle: 'readonly',
        // IndexedDB
        indexedDB: 'readonly',
        IDBDatabase: 'readonly',
        IDBTransaction: 'readonly',
        IDBObjectStore: 'readonly',
        IDBOpenDBRequest: 'readonly',
        IDBTransactionMode: 'readonly',
        IDBIndex: 'readonly',
        IDBValidKey: 'readonly',
        IDBKeyRange: 'readonly',
        // Web Workers
        self: 'readonly',
        MessageEvent: 'readonly',
        ErrorEvent: 'readonly',
        // File API
        File: 'readonly',
        // Performance API
        performance: 'readonly',
        // Storage API
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        // Crypto API
        crypto: 'readonly',
        // Node.js globals  
        process: 'readonly',
        module: 'readonly',
        // CSS DOM types
        CSSRule: 'readonly',
        CSSStyleSheet: 'readonly', 
        CSSRuleList: 'readonly',
        CSSImportRule: 'readonly',
        CSSStyleRule: 'readonly',
        CSSFontFaceRule: 'readonly',
        CSSStyleDeclaration: 'readonly',
        MediaList: 'readonly',
        // Additional Web APIs
        Response: 'readonly',
        btoa: 'readonly',
        ReadableStreamDefaultController: 'readonly',
        queueMicrotask: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // Allow unused vars that start with underscore
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Allow any type in some cases
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow empty functions
      '@typescript-eslint/no-empty-function': 'warn',
      // Allow console in development
      'no-console': 'warn',
      // Allow const assertions
      '@typescript-eslint/prefer-as-const': 'warn'
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tsparser,
        ecmaVersion: 2022,
        sourceType: 'module'
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        Worker: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        DOMException: 'readonly',
        DOMParser: 'readonly',
        XMLSerializer: 'readonly',
        Document: 'readonly',
        Element: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        KeyboardEvent: 'readonly',
        DragEvent: 'readonly',
        EventTarget: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLIFrameElement: 'readonly',
        ResizeObserver: 'readonly',
        DOMRect: 'readonly',
        FocusEvent: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        Window: 'readonly',
        ReadableStream: 'readonly',
        WritableStream: 'readonly',
        TransformStream: 'readonly',
        CompressionStream: 'readonly',
        DecompressionStream: 'readonly',
        // File System Access API
        FileSystemDirectoryHandle: 'readonly',
        FileSystemFileHandle: 'readonly',
        // IndexedDB
        indexedDB: 'readonly',
        IDBDatabase: 'readonly',
        IDBTransaction: 'readonly',
        IDBObjectStore: 'readonly',
        IDBOpenDBRequest: 'readonly',
        IDBTransactionMode: 'readonly',
        IDBIndex: 'readonly',
        IDBValidKey: 'readonly',
        IDBKeyRange: 'readonly',
        // Web Workers
        self: 'readonly',
        MessageEvent: 'readonly',
        ErrorEvent: 'readonly',
        // File API
        File: 'readonly',
        // Performance API
        performance: 'readonly',
        // Storage API
        localStorage: 'readonly',
        sessionStorage: 'readonly'
      }
    },
    plugins: {
      svelte,
      '@typescript-eslint': tseslint
    },
    rules: {
      ...svelte.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      // Svelte-specific adjustments
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow console.log in development
      'no-console': 'warn',
      // Allow const assertions
      '@typescript-eslint/prefer-as-const': 'warn',
      // Allow unnecessary escape in regex for clarity
      'no-useless-escape': 'warn',
      // Allow case declarations
      'no-case-declarations': 'warn'
    }
  },
  {
    files: ['src/stories/**/*.{js,ts,svelte}'],
    rules: {
      // More lenient rules for story/demo files
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'no-case-declarations': 'off',
      'no-self-assign': 'off',
      'no-useless-escape': 'off',
      'no-undef': 'off'
    }
  },
  {
    files: ['**/*.test.{js,ts}', '**/*.spec.{js,ts}'],
    languageOptions: {
      globals: {
        // Test environment globals
        global: 'writable',
        // Vitest globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly'
      }
    },
    rules: {
      // More lenient rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off'
    }
  },
  {
    files: ['scripts/**/*.js', 'scripts/**/*.mjs', 'build-scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        // Node.js modules
        fs: 'readonly',
        path: 'readonly',
        crypto: 'readonly',
        // Plus browser globals for Playwright
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    },
    rules: {
      // More lenient for Node.js scripts
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow require in Node.js scripts
      '@typescript-eslint/no-var-requires': 'off'
    }
  },
  {
    ignores: [
      'dist/',
      'build/',
      '.svelte-kit/',
      'node_modules/',
      '__screenshots__/',
      'storybook-static/',
      'coverage/',
      '.claude/',
      '*.config.js',
      '*.config.ts',
      '.storybook/',
      // Ignore specific generated files
      '**/lcov-report/',
      '**/coverage-report/',
      '**/.nyc_output/',
      // Ignore auto-generated documentation
      '**/api-docs/',
      '**/typedoc/'
    ]
  }
];
