/* global URL */

import {
  tokensFallbackPath,
  tokensStorybookPath,
  tokensTablePath,
  tokensTableDistPath,
} from 'config';

const CONFIG_PATH = new URL('./config.js', import.meta.url).href;

// Helper to import config.js fresh after installing mocks
async function importConfigFresh() {
  vi.resetModules();
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const config = await import(CONFIG_PATH);
  return { config, consoleSpy };
}

function mockTokensFile(tokensFilePath) {
  vi.doMock('node:fs/promises', () => ({
    default: {
      constants: { R_OK: 4 },
      access: async (url) => {
        if (url == String(tokensFilePath)) {
          return;
        } else {
          const err = new Error('not found');
          err.code = 'ENOENT';
          throw err;
        }
      },
    },
  }));
}

describe('loadDesignTokenKeys fallback', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  test('uses dist/tokens-table.mjs when present', async () => {
    vi.doMock(String(tokensTableDistPath), () => ({
      tokensTable: {
        colors: [{ name: '--color-accent-dist' }],
        spacing: [{ name: '--space-xsmall-dist' }],
      },
    }));

    mockTokensFile(tokensTableDistPath);

    const { config, consoleSpy } = await importConfigFresh();
    const keys = await config.loadDesignTokenKeys();

    expect(keys).toEqual(['--color-accent-dist', '--space-xsmall-dist']);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Using 'dist/tokens-table.mjs' as token source",
    );
  });

  test('uses tokens-table.mjs when present', async () => {
    vi.doMock(String(tokensTablePath), () => ({
      tokensTable: {
        colors: [{ name: '--color-accent' }],
        spacing: [{ name: '--space-xsmall' }],
      },
    }));

    mockTokensFile(tokensTablePath);

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

    mockTokensFile(tokensStorybookPath);

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

    mockTokensFile(tokensFallbackPath);

    const { config, consoleSpy } = await importConfigFresh();
    const keys = await config.loadDesignTokenKeys();
    expect(keys).toEqual(['--color-accent3', '--space-xsmall3']);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Using 'tokensBackup.json' as token source",
    );
  });
});
