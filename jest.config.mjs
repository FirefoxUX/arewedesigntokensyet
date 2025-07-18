/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
const config = {
  roots: ['<rootDir>'],
  modulePaths: ['<rootDir>'],
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: false,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: ['**/*.js'],

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // An array of regexp pattern strings used to skip coverage collection
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/coverage/',
    '/src/data/',
    '(?:esbuild|eslint|eleventy).config.js',
  ],

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'v8',

  // A map from regular expressions to paths to transformers
  transform: {},

  // Specify a setup file.
  setupFilesAfterEnv: ['./jest.setup.js', '@testing-library/jest-dom'],

  injectGlobals: true,

  watchPathIgnorePatterns: ['<rootDir>/build/'],
};

export default config;
