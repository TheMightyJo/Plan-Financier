import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
      // L'app est en français : les espaces insécables (U+00A0) dans le texte
      // JSX sont voulus (typographie « avant : », « 1 000 € »). On les tolère
      // dans le texte JSX tout en gardant la règle active partout ailleurs.
      'no-irregular-whitespace': ['error', { skipJSXText: true }],
    },
  },
])
