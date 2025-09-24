/* global URL */

import {
  tokensFallbackPath,
  tokensStorybookPath,
  tokensTablePath,
} from 'config';

const CONFIG_PATH = new URL('./config.js', import.meta.url).href;

// Helper to import config.js fresh after installing mocks
async function importConfigFresh() {
  vi.resetModules();
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const config = await import(CONFIG_PATH);
  return { config, consoleSpy };
}

describe('loadDesignTokenKeys fallback', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  test('uses tokens-table.mjs when present', async () => {
    vi.doMock(String(tokensTablePath), () => ({
      tokensTable: {
        colors: [{ name: '--color-accent' }],
        spacing: [{ name: '--space-xsmall' }],
      },
    }));

    // Not strictly if you have a checkout, but we can't guarantee
    // a test runner has this file present in the correct location.
    vi.doMock('node:fs/promises', () => ({
      default: {
        constants: { R_OK: 4 },
        access: async () => {
          return;
        },
      },
    }));

    const { config, consoleSpy } = await importConfigFresh();
    const keys = await config.loadDesignTokenKeys();

    expect(keys).toEqual(['--color-accent', '--space-xsmall']);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Using 'tokens-table.mjs' as token source",
    );
  });

  test('uses storybook-table.mjs when present', async () => {
    vi.doMock(String(tokensStorybookPath), () => ({
      storybookTables: {
        colors: [{ name: '--color-accent2' }],
        spacing: [{ name: '--space-xsmall2' }],
      },
    }));

    vi.doMock('node:fs/promises', () => ({
      default: {
        constants: { R_OK: 4 },
        access: async (url) => {
          if (url == String(tokensStorybookPath)) {
            return;
          } else {
            const err = new Error('not found');
            err.code = 'ENOENT';
            throw err;
          }
        },
      },
    }));

    const { config, consoleSpy } = await importConfigFresh();
    const keys = await config.loadDesignTokenKeys();
    expect(keys).toEqual(['--color-accent2', '--space-xsmall2']);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Using 'tokens-storybook.mjs' as token source",
    );
  });

  test('uses fallback JSON when other files are missing', async () => {
    vi.doMock(String(tokensFallbackPath), () => ({
      default: ['--color-accent3', '--space-xsmall3'],
    }));

    vi.doMock('node:fs/promises', () => ({
      default: {
        constants: { R_OK: 4 },
        access: async (url) => {
          if (url == String(tokensFallbackPath)) {
            return;
          } else {
            const err = new Error('not found');
            err.code = 'ENOENT';
            throw err;
          }
        },
      },
    }));

    const { config, consoleSpy } = await importConfigFresh();
    const keys = await config.loadDesignTokenKeys();
    expect(keys).toEqual(['--color-accent3', '--space-xsmall3']);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Using 'tokensBackup.json' as token source",
    );
  });
});
