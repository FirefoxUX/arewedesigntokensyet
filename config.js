import path from 'node:path';

export const repoPath =
  process.env.MOZILLA_CENTRAL_REPO_PATH || '../mozilla-unified';

const { storybookTables } = await import(
  path.join(
    repoPath,
    '/toolkit/themes/shared/design-system/tokens-storybook.mjs',
  )
);

export default {
  repoPath,
  // Note this is mostly what we want but not always as some keys are not css properties.
  designTokenProperties: [
    'background-color',
    'border',
    'border-top',
    'border-right',
    'border-bottom',
    'border-left',
    'border-color',
    'border-width',
    'border-radius',
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
  designTokenKeys: Object.values(storybookTables).flatMap((list) =>
    list.map((item) => item.name),
  ),
  // Globs to find CSS to get design token propagation data for.
  includePatterns: [
    'browser/components/**/*.css',
    // Add New Tab directory path (note: located in browser/components/ dir)
    'browser/extensions/newtab/css/**/*.css',
    'toolkit/content/widgets/**/*.css',
  ],
  // Paths in the repo matching these glob patterns will be ignored to avoid generating
  // coverage for storybook files, tests and node deps.
  ignorePatterns: ['**/test{,s}/**', '**/node_modules/**', '**/storybook/**'],
  // supports RegExp or string.
  excludedCSSValues: [
    0,
    'auto',
    /calc(.*?)/,
    'currentColor',
    'inherit',
    'initial',
    /max(.*?)/,
    'none',
    'transparent',
    'unset',
  ],
};
