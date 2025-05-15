import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';

import pluginJest from 'eslint-plugin-jest';

import eslintConfigPrettier from 'eslint-config-prettier/flat';

const globalRules = {
  curly: 'error',
  'arrow-body-style': 'off',
};

export default defineConfig([
  globalIgnores(['**/*.min.js', 'build/**/*']),
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
      ...globalRules,
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended', eslintConfigPrettier],
    rules: {
      ...globalRules,
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
