import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const repoPath =
  process.env.MOZILLA_CENTRAL_REPO_PATH || '../mozilla-unified';

// Note that pathToFileURL ensures a x-platform path for the dynamic import
// otherwise this will fail on windows with ERR_UNSUPORTED_ESM_URL_SCHEME
export const tokensTableDistPath = pathToFileURL(
  path.join(
    repoPath,
    '/toolkit/themes/shared/design-system/dist/tokens-table.mjs',
  ),
);
export const tokensTablePath = pathToFileURL(
  path.join(repoPath, '/toolkit/themes/shared/design-system/tokens-table.mjs'),
);
export const tokensStorybookPath = pathToFileURL(
  path.join(
    repoPath,
    '/toolkit/themes/shared/design-system/tokens-storybook.mjs',
  ),
);
export const tokensFallbackPath = pathToFileURL('./src/data/tokensBackup.json');

// Tokenizable Property Paths
export const stylelintPluginConfigPath = pathToFileURL(
  path.join(
    repoPath,
    '/tools/lint/stylelint/stylelint-plugin-mozilla/config.mjs',
  ),
);
export const tokenPropsFallbackPath = pathToFileURL(
  './src/data/propsBackup.json',
);

const extractFromTokenTables = (mod, key) =>
  Object.values(mod?.[key] || {}).flatMap((list) =>
    list.map((item) => item.name),
  );

const extractPropsConfig = (mod, key) => {
  return Object.keys(mod?.[key]);
};

const extractFromJSONList = (jsonMod) => jsonMod.default ?? [];

/**
 * Attempts to import a module or JSON file from a given path/URL.
 *
 * This helper performs a lightweight existence check with `fs.access` first
 * to avoid noisy stack traces when expected files are absent (e.g. older
 * revisions of the Firefox tree). It then dynamically imports the module.
 *
 * Only "not found" class errors (`ERR_MODULE_NOT_FOUND`, `ENOENT`) are
 * swallowed and reported as `{ ok: false, reason: 'not-found' }`. All other
 * errors (e.g. syntax errors, runtime errors inside the module) are rethrown.
 *
 * @async
 * @function tryImport
 * @param {string|URL} url - Absolute path or file:// URL to the target file.
 *   Can point to an `.mjs` or `.json` file.
 * @param {object} [options]
 * @param {'mjs'|'json'} options.type - Module type. Defaults to `"mjs"`. `'mjs'` performs a
 *   normal import, `'json'` imports with `{ with: { type: 'json' } }`.
 * @returns {Promise<{ok: true, mod: any} | {ok: false, reason: 'not-found'}>}
 *   - On success, returns `{ ok: true, mod }` where `mod` is the imported module.
 *   - On missing file, returns `{ ok: false, reason: 'not-found' }`.
 * @throws {Error} Re-throws any non "not found" errors from the import attempt.
 */
async function tryImport(url, { type = 'mjs' } = {}) {
  try {
    await fs.access(url, fs.constants.R_OK);
  } catch {
    return { ok: false, reason: 'not-found' };
  }

  try {
    let mod;
    if (type === 'json') {
      mod = await import(url, { with: { type: 'json' } });
    } else {
      mod = await import(url);
    }
    return { ok: true, mod };
  } catch (err) {
    if (err && (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'ENOENT')) {
      return { ok: false, reason: 'not-found' };
    }
    throw err;
  }
}

/**
 * Attempts to load data from a list of candidate sources in order.
 *
 * Each source is imported and, if successful, passed to its `pick` function.
 * The first successful source is used.
 *
 * @async
 * @param {object} options
 * @param {Array<{
 *   label: string,
 *   url: string,
 *   type: 'mjs' | 'json',
 *   pick: (mod: unknown, key?: string) => string[],
 *   key?: string
 * }>} options.sources
 * @param {string} options.successLabel
 * @param {string} options.errorMessage
 * @returns {Promise<string[]>}
 * @throws {Error} If none of the sources could be loaded successfully.
 */
async function loadFromSources({ sources, successLabel, errorMessage }) {
  for (const src of sources) {
    const res = await tryImport(src.url, { type: src.type });

    if (res.ok) {
      const values = src.pick(res.mod, src.key);
      console.log(`Using '${src.label}' as ${successLabel}`);
      return values;
    }
  }

  throw new Error(errorMessage);
}

/**
 * Loads design token keys by attempting multiple sources in order.
 *
 * @async
 * @returns {Promise<string[]>} An array of design token key names.
 * @throws {Error} If none of the sources could be loaded successfully.
 */
export async function loadDesignTokenKeys() {
  return loadFromSources({
    sources: [
      {
        label: 'dist/tokens-table.mjs',
        url: tokensTableDistPath,
        type: 'mjs',
        pick: extractFromTokenTables,
        key: 'tokensTable',
      },
      {
        label: 'tokens-table.mjs',
        url: tokensTablePath,
        type: 'mjs',
        pick: extractFromTokenTables,
        key: 'tokensTable',
      },
      {
        label: 'tokens-storybook.mjs',
        url: tokensStorybookPath,
        type: 'mjs',
        pick: extractFromTokenTables,
        key: 'storybookTables',
      },
      {
        label: 'tokensBackup.json',
        url: tokensFallbackPath,
        type: 'json',
        pick: extractFromJSONList,
      },
    ],
    successLabel: 'token source',
    errorMessage: 'Could not load design token keys from any source!',
  });
}

/**
 * Loads design token props by attempting multiple sources in order.
 *
 * @async
 * @returns {Promise<string[]>} An array of design token property names.
 * @throws {Error} If none of the sources could be loaded successfully.
 */
export async function loadDesignTokenProps() {
  return loadFromSources({
    sources: [
      {
        label: 'stylelint-plugin-mozilla/config.mjs',
        url: stylelintPluginConfigPath,
        type: 'mjs',
        pick: extractPropsConfig,
        key: 'propertyConfig',
      },
      {
        label: 'propsBackup.json',
        url: tokenPropsFallbackPath,
        type: 'json',
        pick: extractFromJSONList,
      },
    ],
    successLabel: 'prop source',
    errorMessage: 'Could not load design token props from any source!',
  });
}

const designTokenProperties = await loadDesignTokenProps();
const designTokenKeys = await loadDesignTokenKeys();

export default {
  repoPath,
  // These are the properties we look for, and expect to utilize design tokens.
  designTokenProperties,
  designTokenKeys,
  // Globs to find CSS to get design token propagation data for.
  includePatterns: [
    'browser/components/**/*.css',
    // Add New Tab directory path (note: located in browser/components/ dir)
    'browser/extensions/newtab/css/**/*.css',
    'browser/themes/**/*.css',
    'toolkit/content/widgets/**/*.css',
    'toolkit/themes/**/*.css',
  ],
  externalVarMapping: {
    // For everything that matches the glob on the left hand side, get the vars from
    // each file in the list on the right hand side. Files in the RHS list are ignored
    // during processing.
    'browser/components/aboutlogins/content/components/*.css': [
      'browser/components/aboutlogins/content/aboutLogins.css',
    ],
    'browser/components/firefoxview/*.css': [
      'browser/components/firefoxview/firefoxview.css',
    ],
    'browser/components/sidebar/*.css': [
      'browser/components/sidebar/sidebar.css',
    ],
    'toolkit/content/widgets/moz-box-*/*.css': [
      'toolkit/content/widgets/moz-box-common.css',
    ],
    'toolkit/content/widgets/moz-page-nav/*.css': [
      'toolkit/content/widgets/moz-page-nav/moz-page-nav.css',
    ],
  },
  // Paths in the repo matching these glob patterns will be ignored to avoid generating
  // coverage for storybook files, tests and node deps.
  ignorePatterns: ['**/test{,s}/**', '**/node_modules/**', '**/storybook/**'],
  // Patterns for declarations that should be excluded.
  // Processed in order, first matched or negated wins.
  // Values can be strings or regexes.
  // A wildcard '*', can be used to match all properties.
  // Value negation is possible with a leading '!' such as '!normal'. Use this
  //    if you don't want a wildcard value to match a specific property.
  excludedDeclarations: [
    {
      property: 'outline-style',
      values: ['solid', 'auto'],
    },
    {
      property: 'margin',
      values: ['0 auto', 'auto 0'],
    },
    {
      property: 'font-weight',
      values: ['normal'],
    },
    {
      property: '*',
      values: [
        '0',
        '0px',
        '1',
        'auto',
        'currentColor',
        'fit-content',
        'inherit',
        'initial',
        'none',
        'revert',
        'revert-layer',
        'transparent',
        'unset',
        /calc(.*?)/,
        /max(.*?)/,
      ],
    },
  ],
};
