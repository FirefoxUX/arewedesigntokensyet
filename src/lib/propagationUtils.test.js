import fs from 'fs/promises';
import { getPropagationData } from './propagationUtils.js';
import config from '../../config.js';

const originalConfig = { ...config };

describe('getPropagationData', () => {
  beforeAll(() => {
    Object.assign(config, {
      designTokenKeys: ['--color-primary'],
      designTokenProperties: ['color', 'background-color', 'border'],
      excludedCSSValues: ['inherit'],
      externalVarMapping: {},
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

  test('extracts token usage from a single CSS file', async () => {
    const css = `
      :root {
        --color-primary: #ff0000;
        --spacing: 12px;
      }

      .btn {
        color: var(--color-primary);
        border: 1px solid var(--spacing);
        background-color: inherit;
      }
    `;

    fs.readFile = jest.fn().mockResolvedValueOnce(css);

    const result = await getPropagationData(
      '/project/src/components/button.css',
    );

    expect(result).toHaveProperty('foundPropValues');
    expect(result).toHaveProperty('foundVariables');
    expect(result).toHaveProperty('percentage');
    expect(result.designTokenCount).toBeGreaterThan(0);

    const props = result.foundPropValues;

    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'color',
          containsDesignToken: true,
          resolutionType: 'local',
        }),
        expect.objectContaining({
          property: 'border',
          resolutionType: 'local',
          containsDesignToken: false,
        }),
        expect.objectContaining({
          property: 'background-color',
          containsExcludedValue: true,
        }),
      ]),
    );
  });

  test('handles empty CSS gracefully', async () => {
    fs.readFile = jest.fn().mockResolvedValueOnce('');

    const result = await getPropagationData('/project/empty.css');
    expect(result.foundPropValues).toEqual([]);
    expect(result.percentage).toBe(100); // no props = 100%
  });
});
