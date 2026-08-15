import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Edge Functions are Deno, not part of the Vite app: they use `Deno.*` and
  // `npm:`/`jsr:` specifiers this config knows nothing about, and tsconfig.app
  // doesn't compile them either.
  globalIgnores(['dist', 'supabase/functions']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['src/routes/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Block modules intentionally export a definition object (co-locating a
    // block's meta, factory, View and Editor) alongside its components — the
    // registry pattern. Fast-refresh of these presentational blocks isn't
    // worth fragmenting each into separate files.
    files: ['src/features/blocks/**/index.tsx', 'src/features/blocks/inline-md.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
