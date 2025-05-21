import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';

import pluginJest from 'eslint-plugin-jest';
import pluginJSdoc from 'eslint-plugin-jsdoc';
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
      'jest/consistent-test-it': ['error', { fn: 'test' }],
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
  {
    files: ['**/*.{js,mjs,cjs}'],
    ignores: ['**/*.test.js', '**/*.config.js'],
    plugins: { jsdoc: pluginJSdoc },
    extends: [eslintConfigPrettier],
    rules: {
      ...pluginJSdoc.configs['flat/recommended-error'].rules,
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/no-undefined-types': 'off',
      'jsdoc/tag-lines': 'off',
    },
  },
]);
