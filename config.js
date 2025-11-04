import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const repoPath =
  process.env.MOZILLA_CENTRAL_REPO_PATH || '../mozilla-unified';

// Note that pathToFileURL ensures a x-platform path for the dynamic import
// otherwise this will fail on windows with ERR_UNSUPORTED_ESM_URL_SCHEME
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

const extractFromTokenTables = (mod, key) =>
  Object.values(mod?.[key] || {}).flatMap((list) =>
    list.map((item) => item.name),
  );

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
 * Loads design token keys by attempting multiple sources in order.
 *
 * The function tries to import from two `.mjs` modules (usually containing
 * `storybookTables`) and finally falls back to a backup JSON file that contains
 * a direct list of keys. The first candidate that succeeds is used.
 *
 * This is designed to support backfilling data across Firefox revisions, where
 * newer revisions have Storybook table modules and older ones only have a
 * cached JSON snapshot.
 *
 * @async
 * @function loadDesignTokenKeys
 * @returns {Promise<string[]>} An array of design token key names.
 * @throws {Error} If none of the sources could be loaded successfully.
 *
 */
export async function loadDesignTokenKeys() {
  const sources = [
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
  ];

  let designTokenKeys;
  let chosen;

  for (const src of sources) {
    const res = await tryImport(src.url, { type: src.type });
    if (res.ok) {
      designTokenKeys = src.pick(res.mod, src.key);
      chosen = src.label;
      break;
    }
  }

  if (chosen) {
    console.log(`Using '${chosen}' as token source`);
    return designTokenKeys;
  }

  // If none of the candidates were usable
  throw new Error('Could not load design token keys from any source!');
}

const designTokenKeys = await loadDesignTokenKeys();

export default {
  repoPath,
  // These are the properties we look for, and expect to utilize design tokens.
  designTokenProperties: [
    'background',
    'background-color',
    'border',
    'border-block-end',
    'border-block-end-color',
    'border-block-end-width',
    'border-block-start',
    'border-block-start-color',
    'border-block-start-width',
    'border-top',
    'border-top-color',
    'border-right',
    'border-right-color',
    'border-bottom',
    'border-bottom-color',
    'border-left',
    'border-left-color',
    'border-color',
    'border-width',
    'border-radius',
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-left-radius',
    'border-bottom-right-radius',
    'border-inline',
    'border-inline-color',
    'border-inline-end',
    'border-inline-end-color',
    'border-inline-end-width',
    'border-inline-start',
    'border-inline-start-color',
    'border-inline-start-width',
    'border-inline-width',
    'border-start-end-radius',
    'border-start-start-radius',
    'border-end-start-radius',
    'border-end-end-radius',
    'box-shadow',
    'color',
    'fill',
    'font-size',
    'font-weight',
    'inset',
    'inset-block',
    'inset-block-end',
    'inset-block-start',
    'inset-inline',
    'inset-inline-end',
    'inset-inline-start',
    'gap',
    'grid-gap', // Deprecated in favour of gap but still used.
    'margin',
    'margin-block',
    'margin-block-end',
    'margin-block-start',
    'margin-inline',
    'margin-inline-end',
    'margin-inline-start',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'opacity',
    'outline',
    'outline-offset',
    'padding',
    'padding-block',
    'padding-block-end',
    'padding-block-start',
    'padding-inline',
    'padding-inline-end',
    'padding-inline-start',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'row-gap',
  ],
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
  excludedDeclarations: [
    {
      properties: ['font-weight'],
      values: ['normal'],
    },
    {
      properties: '*',
      values: [
        '0',
        '0px',
        '1',
        'auto',
        'currentColor',
        'inherit',
        'initial',
        'none',
        'transparent',
        'unset',
        /calc(.*?)/,
        /max(.*?)/,
      ],
    },
  ],
};
