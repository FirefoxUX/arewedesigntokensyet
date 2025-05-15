import fs from 'fs/promises';

import { getVarData } from './externalVars.js';
import { getExternalVars } from './externalVars.js';
import config from '../../config.js';

const originalConfig = { ...config };

describe('getVarData', () => {
  beforeAll(() => {
    config.designTokenKeys = ['--color-primary'];
    config.excludedCSSValues = ['inherit'];
    config.repoPath = '/project';
  });

  afterAll(() => {
    Object.assign(config, originalConfig);
  });

  test('marks design tokens and flags metadata correctly', () => {
    const node = {
      value: 'var(--color-primary)',
      source: { start: { line: 1 }, end: { line: 1 } },
    };

    const result = getVarData(node, {
      isExternal: true,
      filePath: '/project/tokens/colors.css',
    });

    expect(result.value).toBe('var(--color-primary)');
    expect(result.containsDesignToken).toBe(true);
    expect(result.containsExcludedValue).toBe(false);
    expect(result.isExternal).toBe(true);
    expect(result.src).toBe('/project/tokens/colors.css');
  });

  test('flags excluded value', () => {
    const node = {
      value: 'inherit',
      source: { start: { line: 2 }, end: { line: 2 } },
    };

    const result = getVarData(node, { isExternal: false });

    expect(result.containsExcludedValue).toBe(true);
    expect(result.isExternal).toBe(false);
  });
});

describe('getExternalVars', () => {
  beforeAll(() => {
    Object.assign(config, {
      designTokenKeys: ['--color-primary'],
      excludedCSSValues: ['inherit'],
      repoPath: '/project',
    });
  });

  afterAll(() => {
    Object.assign(config, originalConfig);
  });

  beforeEach(() => {
    jest.mock('node:fs/promises');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('extracts external vars defined in :root', async () => {
    const css = `
      :root {
        --color-primary: #f00;
        --space-sm: 4px;
      }

      .button {
        --local-color: #123;
      }
    `;

    fs.readFile = jest.fn().mockResolvedValue(css);

    const result = await getExternalVars('/fake/path/tokens.css');

    expect(result).toHaveProperty('--color-primary');
    expect(result).toHaveProperty('--space-sm');
    expect(result).not.toHaveProperty('--local-color');

    expect(result['--color-primary'].isExternal).toBe(true);
    expect(result['--color-primary'].src).toBe('/fake/path/tokens.css');
  });
});
