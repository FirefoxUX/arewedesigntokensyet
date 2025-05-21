import fs from 'fs/promises';
import { getPropagationData } from './propagationUtils.js';
import config from '../../config.js';

const originalConfig = { ...config };

describe('getPropagationData', () => {
  beforeAll(() => {
    Object.assign(config, {
      designTokenKeys: ['--color-accent-primary'],
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
    fs.writeFile = jest.fn();
    fs.readFile = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('extracts token usage from a single CSS file', async () => {
    const css = `
      :root {
        --color-accent-primary: #ff0000;
        --spacing: 12px;
      }

      .btn {
        color: var(--color-accent-primary);
        border: 1px solid var(--spacing);
        background-color: inherit;
      }
    `;

    fs.readFile.mockResolvedValueOnce(css);
    const result = await getPropagationData(
      '/project/src/components/button.css',
    );

    expect(result).toHaveProperty('foundPropValues');
    expect(result).toHaveProperty('foundVariables');
    expect(result.percentage).toBe(50);
    expect(result.designTokenCount).toBe(1);
    expect(fs.writeFile).toHaveBeenCalled();

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

  test('sets percentage to 0 when there are found props and no design-tokens in use', async () => {
    const css = `
      :root {
        --not-a-token: #ff0000;
        --spacing: 12px;
      }

      .btn {
        color: var(--not-a-token);
        border: 1px solid var(--spacing);
        background-color: inherit;
      }
    `;

    fs.readFile.mockResolvedValueOnce(css);
    const result = await getPropagationData(
      '/project/src/components/button2.css',
    );

    expect(result).toHaveProperty('foundPropValues');
    expect(result).toHaveProperty('foundVariables');
    expect(result.percentage).toEqual(0);
    expect(result.designTokenCount).toEqual(0);
    expect(fs.writeFile).toHaveBeenCalled();

    const props = result.foundPropValues;

    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'color',
          containsDesignToken: false,
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

  test('sets percentage to -1 when there are no found props excluding ignores', async () => {
    const css = `
      :root {
        --not-a-token: #ff0000;
        --spacing: 12px;
      }

      .btn {
        width: var(--not-a-token);
        height: 1px solid var(--spacing);
        background-color: inherit;
      }
    `;

    fs.readFile.mockResolvedValueOnce(css);
    const result = await getPropagationData(
      '/project/src/components/button2.css',
    );

    expect(result.percentage).toEqual(-1);
    expect(result.foundPropValues.length).toEqual(1);
    expect(result.designTokenCount).toEqual(0);
    expect(fs.writeFile).toHaveBeenCalled();

    const props = result.foundPropValues;

    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'background-color',
          containsExcludedValue: true,
        }),
      ]),
    );
  });

  test('handles empty CSS gracefully', async () => {
    fs.readFile.mockResolvedValueOnce('');

    const result = await getPropagationData('/project/empty.css');
    expect(result.foundPropValues).toEqual([]);
    expect(result.percentage).toBe(-1); // no props = -1
  });
});
