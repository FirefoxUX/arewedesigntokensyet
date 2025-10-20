import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';

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
    languageOptions: {
      globals: {
        vi: 'readonly',
        expect: 'readonly',
        test: 'readonly',
        describe: 'readonly',
        afterAll: 'readonly',
        beforeAll: 'readonly',
        afterEach: 'readonly',
        beforeEach: 'readonly',
      },
    },
    rules: {
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
  {
    files: ['**/*.{js,mjs,cjs}'],
    ignores: ['**/*.test.js', '**/*.config.js'],
    plugins: { jsdoc: pluginJSdoc },
    extends: [eslintConfigPrettier],
    rules: {
      ...pluginJSdoc.configs['flat/recommended-error'].rules,
      'jsdoc/valid-types': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'error',
      'jsdoc/require-param-type': 'error',

      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/no-undefined-types': 'off',
      'jsdoc/tag-lines': 'off',

      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            ClassDeclaration: true,
            ClassExpression: true,
            MethodDefinition: true,
          },
          exemptEmptyConstructors: true,
          contexts: [
            // Optional: also enforce on arrow functions assigned to class fields
            'PropertyDefinition > ArrowFunctionExpression',
          ],
        },
      ],
    },
  },
]);
