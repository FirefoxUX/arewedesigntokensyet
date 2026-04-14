import fs from 'fs/promises';
import path from 'path';
import {
  normalizePathForOutput,
  getPropagationData,
  buildUsageAggregates,
} from './propagationUtils.js';
import config from '../../config.js';

const originalConfig = { ...config };

describe('getPropagationData', () => {
  beforeAll(() => {
    Object.assign(config, {
      repoPath: '/project',
    });
  });

  afterAll(() => {
    Object.assign(config, originalConfig);
  });

  beforeEach(() => {
    vi.mock('node:fs/promises');
    fs.writeFile = vi.fn();
    fs.readFile = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('still detects tokens referenced via external files', async () => {
    const css = `
      .btn {
        border: 1px solid var(--fxview-border);
      }
    `;
    const filePath = '/project/test.css';
    fs.readFile.mockResolvedValue(css);

    const fakeExtVars = {
      '--fxview-border': {
        value: 'var(--border-color-transparent)',
        isExternal: true,
        start: { column: 3, line: 24, offset: 1308 },
        end: { column: 51, line: 24, offset: 1357 },
        src: 'firefoxview.css',
      },
    };

    const fakeCollectExternalVars = vi.fn();
    fakeCollectExternalVars.mockResolvedValueOnce(fakeExtVars);

    const result = await getPropagationData(filePath, fakeCollectExternalVars);
    expect(result.percentage).toBe(100);
    expect(result.designTokenCount).toBe(1);

    const props = result.foundPropValues;

    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prop: 'border',
          containsValidDesignToken: true,
          isValidPropertyValue: true,
          resolutionType: 'external',
          isExcludedByStylelint: false,
        }),
      ]),
    );
  });

  test('still counts valid tokens that are stylelint excluded and external refs', async () => {
    const css = `
      .btn {
        /* stylelint-disable-next-line stylelint-plugin-mozilla/use-design-tokens -- some other comment */
        border: 1px solid var(--fxview-border);
      }
    `;
    const filePath = '/project/test.css';
    fs.readFile.mockResolvedValue(css);

    const fakeExtVars = {
      '--fxview-border': {
        value: 'var(--border-color-transparent)',
        isExternal: true,
        start: { column: 3, line: 24, offset: 1308 },
        end: { column: 51, line: 24, offset: 1357 },
        src: 'firefoxview.css',
      },
    };

    const fakeCollectExternalVars = vi.fn();
    fakeCollectExternalVars.mockResolvedValueOnce(fakeExtVars);

    const result = await getPropagationData(filePath, fakeCollectExternalVars);
    expect(result.percentage).toBe(100);
    expect(result.designTokenCount).toBe(1);

    const props = result.foundPropValues;

    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prop: 'border',
          containsValidDesignToken: true,
          isValidPropertyValue: true,
          resolutionType: 'external',
          isExcludedByStylelint: true,
        }),
      ]),
    );
  });

  test('detects tokens used in vars defined and used in the same rule', async () => {
    const css = `
      :host {
        --visual-picker-item-border-radius: var(--border-radius-medium);
        --visual-picker-item-border-width: var(--border-width);
        --visual-picker-item-border-color: var(--border-color-interactive);
        cursor: default;
      }

      ::slotted(:first-child) {
        --visual-picker-item-child-border-radius: calc(var(--visual-picker-item-border-radius) - var(--visual-picker-item-border-width));
        border-radius: var(--visual-picker-item-child-border-radius);
      }
    `;
    const filePath = '/project/test.css';
    fs.readFile.mockResolvedValue(css);

    const result = await getPropagationData(filePath);
    const props = result.foundPropValues;

    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prop: 'border-radius',
          containsValidDesignToken: true,
          isValidPropertyValue: true,
          resolutionType: 'local',
        }),
      ]),
    );
  });

  test('does detect vars referenced outside :host and :root to match use-design-tokens all local vars approach', async () => {
    const css = `
      :host {
        --visual-picker-item-border-radius: var(--border-radius-medium);
        --visual-picker-item-border-width: var(--border-width);
        cursor: default;
      }

      .foo {
        --visual-picker-item-child-border-radius: calc(var(--visual-picker-item-border-radius) - var(--visual-picker-item-border-width));
      }

      .foo .bar {
        border-radius: var(--visual-picker-item-child-border-radius);
      }
    `;
    const filePath = '/project/test.css';
    fs.readFile.mockResolvedValue(css);

    const result = await getPropagationData(filePath);
    const props = result.foundPropValues;

    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prop: 'border-radius',
          containsValidDesignToken: true,
          isValidPropertyValue: true,
          resolutionType: 'local',
        }),
      ]),
    );
  });

  test('still includes token usage with preceding (use-design-tokens) stylelint-disable-next-line comment', async () => {
    const css = `
      .btn {
        /* stylelint-disable-next-line stylelint-plugin-mozilla/use-design-tokens -- some other comment */
        background-color: var(--background-color-canvas);
        color: var(--button-text-color-primary);
        border-color: #000;
      }
    `;

    fs.readFile.mockResolvedValueOnce(css);
    const result = await getPropagationData(
      '/project/src/components/button.css',
    );

    const props = result.foundPropValues;

    expect(result).toHaveProperty('foundPropValues');
    expect(result).toHaveProperty('foundVariables');
    // 2 design token found out of 3 that can be tokenized = 50%
    expect(result.percentage).toBe(66.67);
    expect(result.designTokenCount).toBe(2);
    expect(fs.writeFile).toHaveBeenCalled();

    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prop: 'background-color',
          isValidPropertyValue: true,
          isExcludedByStylelint: true,
          containsValidDesignToken: true,
        }),
        expect.objectContaining({
          prop: 'color',
          isValidPropertyValue: true,
          isExcludedByStylelint: false,
          containsValidDesignToken: true,
        }),
        expect.objectContaining({
          prop: 'border-color',
          isValidPropertyValue: false,
          isExcludedByStylelint: false,
          containsValidDesignToken: false,
        }),
      ]),
    );
  });

  test('ignores invalid token usage with preceding (use-design-tokens) stylelint-disable-next-line comment', async () => {
    const css = `
      .btn {
        /* stylelint-disable-next-line stylelint-plugin-mozilla/use-design-tokens -- some other comment */
        background-color: var(--color-gray-80);
        color: var(--button-text-color-primary);
        border-color: #000;
      }
    `;

    fs.readFile.mockResolvedValueOnce(css);
    const result = await getPropagationData(
      '/project/src/components/button.css',
    );

    const props = result.foundPropValues;

    expect(result).toHaveProperty('foundPropValues');
    expect(result).toHaveProperty('foundVariables');
    // 1 design token found out of 2 that can be tokenized = 50%
    expect(result.percentage).toBe(50);
    expect(result.designTokenCount).toBe(1);
    expect(fs.writeFile).toHaveBeenCalled();

    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prop: 'background-color',
          isValidPropertyValue: false,
          isExcludedByStylelint: true,
          containsValidDesignToken: true,
        }),
        expect.objectContaining({
          prop: 'color',
          isValidPropertyValue: true,
          isExcludedByStylelint: false,
          containsValidDesignToken: true,
        }),
        expect.objectContaining({
          prop: 'border-color',
          isValidPropertyValue: false,
          isExcludedByStylelint: false,
          containsValidDesignToken: false,
        }),
      ]),
    );
  });

  test('excludes non-aliased base token usage', async () => {
    const css = `
      .btn {
        /* Some unaliased based tokens are allowed directly - see ...versatileColorTokens
         * landed in https://bugzilla.mozilla.org/show_bug.cgi?id=2022975 */
        background-color: var(--color-accent-primary);
        /* Not allowed unless aliased */
        color: var(--color-gray-80);
        border-color: #000;
      }
    `;

    fs.readFile.mockResolvedValueOnce(css);
    const result = await getPropagationData(
      '/project/src/components/button.css',
    );

    const props = result.foundPropValues;

    expect(result).toHaveProperty('foundPropValues');
    expect(result).toHaveProperty('foundVariables');
    // 1 design token found out of 3 that can be tokenized = 33.33
    expect(result.percentage).toBe(33.33);
    expect(result.designTokenCount).toBe(1);
    expect(fs.writeFile).toHaveBeenCalled();

    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prop: 'background-color',
          isValidPropertyValue: true,
          isExcludedByStylelint: false,
          containsValidDesignToken: true,
        }),
        expect.objectContaining({
          prop: 'color',
          isValidPropertyValue: false,
          isExcludedByStylelint: false,
          containsValidDesignToken: true,
        }),
        expect.objectContaining({
          prop: 'border-color',
          isValidPropertyValue: false,
          isExcludedByStylelint: false,
          containsValidDesignToken: false,
        }),
      ]),
    );
  });

  test('excludes non-token usage with preceding (use-design-tokens) stylelint-disable-next-line comment', async () => {
    const css = `
      .btn {
        --my-alias: var(--color-gray-80);
        /* stylelint-disable-next-line stylelint-plugin-mozilla/use-design-tokens -- some other comment */
        background-color: #fff;
        /* This is allowed because it's aliasing --color-gray-80 */
        color: var(--my-alias);
        /* stylelint-disable-next-line */
        border-color: #000;
      }
    `;

    fs.readFile.mockResolvedValueOnce(css);
    const result = await getPropagationData(
      '/project/src/components/button.css',
    );

    const props = result.foundPropValues;

    expect(result).toHaveProperty('foundPropValues');
    expect(result).toHaveProperty('foundVariables');
    // 1 design token found out of 2 that can be tokenized = 50%
    // and the stylelint disable line scoped to use-design-tokens is ignored.
    expect(result.percentage).toBe(50);
    expect(result.designTokenCount).toBe(1);
    expect(fs.writeFile).toHaveBeenCalled();

    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prop: 'background-color',
          isValidPropertyValue: false,
          isExcludedByStylelint: true,
          containsValidDesignToken: false,
        }),
        expect.objectContaining({
          prop: 'color',
          isValidPropertyValue: true,
          isExcludedByStylelint: false,
          containsValidDesignToken: true,
        }),
        expect.objectContaining({
          prop: 'border-color',
          isValidPropertyValue: false,
          isExcludedByStylelint: false,
          containsValidDesignToken: false,
        }),
      ]),
    );
  });

  test('extracts token usage from a single CSS file', async () => {
    const css = `
      :root {
        --bcolor: red;
      }

      .btn {
        color: var(--button-text-color-primary);
        border: 1px solid var(--bcolor);
        background-color: inherit;
      }
    `;

    fs.readFile.mockResolvedValueOnce(css);
    const result = await getPropagationData(
      '/project/src/components/button.css',
    );

    const props = result.foundPropValues;

    expect(result).toHaveProperty('foundPropValues');
    expect(result).toHaveProperty('foundVariables');
    expect(result.percentage).toBe(50);
    expect(result.designTokenCount).toBe(1);
    expect(fs.writeFile).toHaveBeenCalled();

    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prop: 'color',
          containsValidDesignToken: true,
          isValidPropertyValue: true,
          resolutionType: 'local',
        }),
        expect.objectContaining({
          prop: 'border',
          resolutionType: 'local',
          containsValidDesignToken: false,
          isValidPropertyValue: false,
        }),
        expect.objectContaining({
          prop: 'background-color',
          containsValidDesignToken: false,
          isValidPropertyValue: true,
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
          prop: 'color',
          containsValidDesignToken: false,
          resolutionType: 'local',
        }),
        expect.objectContaining({
          prop: 'border',
          resolutionType: 'local',
          containsValidDesignToken: false,
        }),
        expect.objectContaining({
          prop: 'background-color',
          isValidPropertyValue: true,
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
        outline-offset: 15px;
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
          prop: 'background-color',
          isValidPropertyValue: true,
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

describe('usage aggregation', () => {
  /**
   * Convert getPropagationData(...) result into the minimal
   * findings format expected by buildUsageAggregates(...).
   * @param {object} result
   * @param {string} filePath
   * @returns {Array<object>}
   */
  function toFindings(result, filePath) {
    return (result.foundPropValues || []).map((d) => {
      const base = {
        path: filePath,
        property: d.prop,
        value: d.value,
        containsValidDesignToken: Boolean(d.containsValidDesignToken),
        isIgnored: Boolean(d.isValidPropertyValue),
      };
      if (Array.isArray(d.tokens) && d.tokens.length > 0) {
        base.tokens = d.tokens;
      }
      return base;
    });
  }

  test('counts duplicate occurrences via a single-hop alias in one declaration', async () => {
    // No token definition here, only an alias mapping to the token id.
    fs.readFile.mockResolvedValueOnce(`
      :root {
        --accent: var(--color-accent-primary);
      }
      .btn {
        /* Two occurrences of the alias in a single value */
        border-color: var(--accent) var(--accent);
      }
    `);

    const filePath = '/project/alias-dup.css';
    const result = await getPropagationData(filePath);
    const aggregates = buildUsageAggregates(toFindings(result, filePath));

    // Counts should accrue to the base token id.
    const tokenData = aggregates.tokenUsage.byToken['--color-accent-primary'];
    expect(tokenData).toEqual({
      total: 2,
      properties: { 'border-color': 2 },
      files: { [filePath]: 2 },
    });

    // Alias itself is not treated as a token.
    expect(aggregates.tokenUsage.byToken['--accent']).toBeUndefined();
  });

  test('aggregates token usage across multiple declarations using only aliases', async () => {
    fs.readFile.mockResolvedValueOnce(`
      :root {
        --accent: var(--color-accent-primary);
      }
      .card { color: var(--accent); }                 /* 1 */
      .chip { background-color: var(--accent); }      /* 1 */
      .tag  { border-color: var(--accent); }          /* 1 */
    `);

    const filePath = '/project/alias-across.css';
    const result = await getPropagationData(filePath);
    const aggregates = buildUsageAggregates(toFindings(result, filePath));

    const tokenData = aggregates.tokenUsage.byToken['--color-accent-primary'];
    expect(tokenData).toEqual({
      total: 3,
      properties: {
        color: 1,
        'background-color': 1,
        'border-color': 1,
      },
      files: { [filePath]: 3 },
    });
  });

  test('resolves multi-hop alias chains to the underlying design token id', async () => {
    fs.readFile.mockResolvedValueOnce(`
      :root {
        --accent: var(--color-accent-primary);  /* alias 1 -> token id (not defined here) */
        --accent-strong: var(--accent);         /* alias 2 -> alias 1 */
      }
      .thing {
        color: var(--accent-strong);
        background-color: var(--accent-strong);
      }
    `);

    const filePath = '/project/alias-chain.css';
    const result = await getPropagationData(filePath);
    const aggregates = buildUsageAggregates(toFindings(result, filePath));

    const tokenData = aggregates.tokenUsage.byToken['--color-accent-primary'];
    expect(tokenData).toEqual({
      total: 2,
      properties: {
        color: 1,
        'background-color': 1,
      },
      files: { [filePath]: 2 },
    });

    // Neither alias is recorded as a token.
    expect(aggregates.tokenUsage.byToken['--accent']).toBeUndefined();
    expect(aggregates.tokenUsage.byToken['--accent-strong']).toBeUndefined();
  });

  test('property values aggregate normally even when tokens only appear via aliases', async () => {
    fs.readFile.mockResolvedValueOnce(`
      :root {
        --accent: var(--color-accent-primary);
      }
      .alpha { background-color: var(--accent); padding: 4px; }
      .beta  { padding: 4px; }
    `);

    const filePath = '/project/alias-properties.css';
    const result = await getPropagationData(filePath);
    const aggregates = buildUsageAggregates(toFindings(result, filePath));

    // Non-token property aggregation
    const dv = aggregates.propertyValues.byProperty;
    const paddingBucket = Object.values(dv).find(
      (d) => d.values && d.values['4px'],
    );
    expect(paddingBucket).toBeTruthy();
    expect(paddingBucket.values['4px'].count).toBe(2);

    // Token usage accrues to the base token id
    const colorToken = aggregates.tokenUsage.byToken['--color-accent-primary'];
    expect(colorToken).toEqual({
      total: 1,
      properties: { 'background-color': 1 },
      files: { [filePath]: 1 },
    });
  });
});

describe('normalizePathForOutput', () => {
  const originalRepoPath = config.repoPath;

  beforeEach(() => {
    config.repoPath = path.resolve('/project/firefox'); // mock repo root
  });

  afterEach(() => {
    config.repoPath = originalRepoPath;
  });

  test('returns input if not a string', () => {
    expect(normalizePathForOutput(null)).toBe(null);
    expect(normalizePathForOutput(123)).toBe(123);
  });

  test('returns relative path within repo', () => {
    const absPath = path.join(config.repoPath, 'toolkit/themes/shared/foo.css');
    const result = normalizePathForOutput(absPath);
    expect(result).toBe('toolkit/themes/shared/foo.css');
  });

  test('returns unchanged path when outside repo', () => {
    const absPath = path.resolve('/tmp/other/file.css');
    const result = normalizePathForOutput(absPath);
    expect(result).toBe(absPath);
  });

  test('handles forward slashes and backslashes consistently', () => {
    const absPath = path.join(config.repoPath, '/browser/components/foo.css');
    const result = normalizePathForOutput(absPath);
    expect(result).toBe('browser/components/foo.css');
  });

  test('falls back to original path on error', () => {
    const badPath = '/broken/path.css';
    const relativeSpy = vi.spyOn(path, 'relative').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(normalizePathForOutput(badPath)).toBe(badPath);
    relativeSpy.mockRestore();
  });
});
