/* global URL */

import {
  tokensFallbackPath,
  tokensStorybookPath,
  tokensTablePath,
  tokensTableDistPath,
  tokenPropsFallbackPath,
  stylelintPluginConfigPath,
} from 'config';

const CONFIG_PATH = new URL('./config.js', import.meta.url).href;

// Helper to import config.js fresh after installing mocks
async function importConfigFresh() {
  vi.resetModules();
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const config = await import(CONFIG_PATH);
  return { config, consoleSpy };
}

let mockedFiles;

function mockFile(filePath) {
  mockedFiles.add(String(filePath));
}

vi.doMock('node:fs/promises', () => ({
  default: {
    constants: { R_OK: 4 },
    access: async (url) => {
      if (mockedFiles.has(String(url))) {
        return;
      } else {
        const err = new Error('not found');
        err.code = 'ENOENT';
        throw err;
      }
    },
  },
}));

describe('loadDesignTokenProps fallbacks', () => {
  beforeEach(() => {
    mockedFiles = new Set();
    vi.doMock(String(tokensTableDistPath), () => ({
      tokensTable: {
        colors: [{ name: '--color-accent-dist' }],
        spacing: [{ name: '--space-xsmall-dist' }],
      },
    }));
    mockFile(tokensTableDistPath);
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  test('uses stylelint-plugin-mozilla/config.mjs when present', async () => {
    vi.doMock(String(stylelintPluginConfigPath), () => ({
      propertyConfig: {
        background: {},
        'background-position': {},
      },
    }));
    mockFile(stylelintPluginConfigPath);

    const { config, consoleSpy } = await importConfigFresh();
    const keys = await config.loadDesignTokenProps();

    expect(keys).toEqual(['background', 'background-position']);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Using 'stylelint-plugin-mozilla/config.mjs' as prop source",
    );
  });

  test('uses fallback props JSON when other files are missing', async () => {
    vi.doMock(String(tokenPropsFallbackPath), () => ({
      default: ['whatever'],
    }));
    mockFile(tokenPropsFallbackPath);

    const { config, consoleSpy } = await importConfigFresh();
    const keys = await config.loadDesignTokenProps();
    expect(keys).toEqual(['whatever']);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Using 'propsBackup.json' as prop source",
    );
  });
});

describe('loadDesignTokenKeys fallbacks', () => {
  beforeEach(() => {
    mockedFiles = new Set();
    vi.doMock(String(stylelintPluginConfigPath), () => ({
      propertyConfig: {
        background: {},
        'background-position': {},
      },
    }));
    mockFile(stylelintPluginConfigPath);
  });

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

    mockFile(tokensTableDistPath);

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

    mockFile(tokensTablePath);

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

    mockFile(tokensStorybookPath);

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

    mockFile(tokensFallbackPath);

    const { config, consoleSpy } = await importConfigFresh();
    const keys = await config.loadDesignTokenKeys();
    expect(keys).toEqual(['--color-accent3', '--space-xsmall3']);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Using 'tokensBackup.json' as token source",
    );
  });
});
