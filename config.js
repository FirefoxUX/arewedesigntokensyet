import { tokensTable } from './src/vendor/firefox/toolkit/themes/shared/design-system/dist/tokens-table.mjs';
import { propertyConfig } from './src/vendor/firefox/tools/lint/stylelint/stylelint-plugin-mozilla/config.mjs';

const allTokens = Object.values(tokensTable).flatMap((list) =>
  list.map((item) => item.name),
);

const tokenProperties = Object.keys(propertyConfig).sort();

export default {
  allTokens,
  tokenProperties,
  repoPath: process.env.FIREFOX_ROOT || '../mozilla-unified',
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
};
