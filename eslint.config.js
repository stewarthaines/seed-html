import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';

// The `globals` package ships a browser key with stray whitespace
// ("AudioWorkletGlobalScope "), which ESLint 9 rejects. Trim all keys.
const trimGlobals = source =>
  Object.fromEntries(Object.entries(source).map(([key, value]) => [key.trim(), value]));
const browserGlobals = trimGlobals(globals.browser);
const nodeGlobals = trimGlobals(globals.node);
const jestGlobals = trimGlobals(globals.jest);

// Rules shared by the TS/JS and Svelte passes. Errors block; the noisier
// stylistic rules stay warnings so they can be ratcheted down over time.
const sharedRules = {
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-empty-function': 'warn',
  'no-console': 'warn',
  '@typescript-eslint/prefer-as-const': 'warn',
};

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,ts,mjs,cjs}'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...sharedRules,
    },
  },
  {
    // TypeScript already reports undefined identifiers, and core `no-undef`
    // false-positives on type-only names (NodeListOf, HTMLCollectionOf).
    // `npm run check` (svelte-check/tsc) is the authority here.
    files: ['**/*.ts'],
    rules: {
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tsparser,
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...browserGlobals,
      },
    },
    plugins: {
      svelte,
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...svelte.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...sharedRules,
      // Components are TypeScript; tsc owns undefined-symbol checking.
      'no-undef': 'off',
      // Allow unnecessary escape in regex for clarity
      'no-useless-escape': 'warn',
      // Allow case declarations
      'no-case-declarations': 'warn',
    },
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
      'no-undef': 'off',
    },
  },
  {
    // Test files and their support code (mocks, fixtures, test helpers).
    files: [
      '**/*.test.{js,ts}',
      '**/*.spec.{js,ts}',
      '**/test/**/*.{js,ts}',
      '**/*.mock.{js,ts}',
      '**/fixtures/**/*.{js,ts}',
    ],
    languageOptions: {
      globals: {
        ...browserGlobals,
        ...jestGlobals,
        // Vitest globals not covered by the `jest` set
        vi: 'readonly',
        global: 'writable',
      },
    },
    rules: {
      // More lenient rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs}', 'build-scripts/**/*.{js,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...nodeGlobals,
        // Plus browser globals for Playwright
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      // More lenient for Node.js scripts
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow require()/module.exports in Node.js CommonJS scripts
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
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
      // Local Python virtualenv (untracked) — not app code.
      '.venv/',
      // Workspace plugins are separate packages with their own lint/format/test
      // toolchain (and newer dep majors); the core gate does not govern them.
      'plugins/',
      // Extensions catalog: vendored 3rd-party libs + example transform scripts,
      // served as-is (mirrors src/assets and plugins/); not linted as app modules.
      'extensions/',
      '*.config.js',
      '*.config.ts',
      '.storybook/',
      // Runtime-injected / vendored assets (eval'd in a sandbox or bundled
      // third-party code) — not linted as app modules. Behaviour of the
      // transform scripts is covered by the transform test suite instead.
      'src/assets/**',
      '**/*.min.js',
      // Vendored Paged.js polyfill, served as-is (not named *.min.js).
      'public/paged.polyfill.js',
      // Ignore specific generated files
      '**/lcov-report/',
      '**/coverage-report/',
      '**/.nyc_output/',
      // Ignore auto-generated documentation
      '**/api-docs/',
      '**/typedoc/',
    ],
  },
];
