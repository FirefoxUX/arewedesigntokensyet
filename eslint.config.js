import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';

import pluginJest from 'eslint-plugin-jest';

import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default defineConfig([
  globalIgnores(['**/*.min.js']),
  {
    files: ['**/*.test.js'],
    plugins: { jest: pluginJest },
    languageOptions: {
      globals: {
        ...pluginJest.environments.globals.globals,
      },
    },
    rules: {
      ...pluginJest.configs['flat/recommended'].rules,
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended', eslintConfigPrettier],
    rules: {
      'arrow-body-style': 'off',
    },
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        global: 'readonly',
      },
    },
  },
]);
