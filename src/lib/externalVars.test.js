import fs from 'fs/promises';

import { getVarData } from './externalVars.js';
import { getExternalVars } from './externalVars.js';
import config from '../../config.js';

const originalConfig = { ...config };

describe('getVarData', () => {
  beforeAll(() => {
    config.designTokenKeys = ['--color-accent-primary'];
    config.repoPath = '/project';
  });

  afterAll(() => {
    Object.assign(config, originalConfig);
  });

  test('provides file and source data', () => {
    const node = {
      value: 'var(--color-accent-primary)',
      source: { start: { line: 1 }, end: { line: 1 } },
    };

    const result = getVarData(node, {
      isExternal: true,
      filePath: '/project/tokens/colors.css',
    });

    expect(result.value).toBe('var(--color-accent-primary)');
    expect(result.isExternal).toBe(true);
    expect(result.src).toBe('/project/tokens/colors.css');
  });

  test(`doesn't record src if isExternal is false`, () => {
    const node = {
      value: 'inherit',
      source: { start: { line: 2 }, end: { line: 2 } },
    };
    const result = getVarData(node, { isExternal: false });
    expect(result.src).toBe(undefined);
    expect(result.isExternal).toBe(false);
  });
});

describe('getExternalVars', () => {
  beforeAll(() => {
    Object.assign(config, {
      designTokenKeys: ['--color-accent-primary'],
      repoPath: '/project',
    });
  });

  afterAll(() => {
    Object.assign(config, originalConfig);
  });

  beforeEach(() => {
    vi.mock('node:fs/promises');
    fs.readFile = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('extracts external vars defined in :root', async () => {
    const css = `
      :root {
        --color-accent-primary: #f00;
        --space-small: 4px;
      }

      .button {
        --local-color: #123;
      }
    `;

    fs.readFile.mockResolvedValue(css);

    const result = await getExternalVars('/fake/path/tokens.css');

    expect(result).toHaveProperty('--color-accent-primary');
    expect(result).toHaveProperty('--space-small');
    expect(result).not.toHaveProperty('--local-color');

    expect(result['--color-accent-primary'].isExternal).toBe(true);
    expect(result['--color-accent-primary'].src).toBe('/fake/path/tokens.css');
  });
});
