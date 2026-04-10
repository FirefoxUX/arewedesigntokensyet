import fs from 'fs/promises';
import loadAndAnnotateFile from './loadAndAnnotateFile.js';
import { getStatus } from './loadAndAnnotateFile.js';

/**
 *
 * @param lineText
 * @param snippet
 */
function getOffsetRange(lineText, snippet) {
  const startIndex = lineText.indexOf(snippet);
  if (startIndex === -1) {
    throw new Error(`Snippet "${snippet}" not found in line: "${lineText}"`);
  }
  const startColumn = startIndex + 1;
  const endColumn = startColumn + snippet.length;
  return { startColumn, endColumn };
}

describe('getStatus', () => {
  test(`it returns 'good-external' when external ref and has a design token`, () => {
    expect(
      getStatus({
        resolutionType: 'external',
        containsValidDesignToken: true,
        isValidPropertyValue: true,
      }),
    ).toBe('good-external');
  });

  test(`it returns 'warn' when external ref and does not have a design token but is a valid prop`, () => {
    expect(
      getStatus({
        resolutionType: 'external',
        containsValidDesignToken: false,
        isValidPropertyValue: true,
      }),
    ).toBe('warn');
  });

  test(`it returns 'bar' when external ref and does not have a design token or valid prop`, () => {
    expect(
      getStatus({
        resolutionType: 'external',
        containsValidDesignToken: false,
        isValidPropertyValue: false,
      }),
    ).toBe('bad');
  });

  test(`it returns 'warn' when external ref and does not have a design token but is a valid prop`, () => {
    expect(
      getStatus({
        resolutionType: 'external',
        containsValidDesignToken: false,
        isValidPropertyValue: true,
      }),
    ).toBe('warn');
  });

  test(`it returns 'good-excludedByStylelint' when a valid token and valid prop value`, () => {
    expect(
      getStatus({
        isExcludedByStylelint: true,
        containsValidDesignToken: true,
        isValidPropertyValue: true,
      }),
    ).toBe('good-excludedByStylelint');
  });

  test(`it returns 'warn-excludedByStylelint' when not a valid token but is a valid prop value`, () => {
    expect(
      getStatus({
        isExcludedByStylelint: true,
        containsValidDesignToken: false,
        isValidPropertyValue: true,
      }),
    ).toBe('warn-excludedByStylelint');
  });

  test(`it returns 'bad-excludedByStylelint' when not a valid token or prop value`, () => {
    expect(
      getStatus({
        isExcludedByStylelint: true,
        containsValidDesignToken: false,
        isValidPropertyValue: false,
      }),
    ).toBe('bad-excludedByStylelint');
  });

  test(`it returns 'good' when is both a valid token and prop value`, () => {
    expect(
      getStatus({
        containsValidDesignToken: true,
        isValidPropertyValue: true,
      }),
    ).toBe('good');
  });
});

describe('loadAndAnnotateFile', () => {
  beforeEach(() => {
    vi.mock('node:fs/promises');
    fs.readFile = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('renders highlighted HTML with annotations for design tokens', async () => {
    const css = `
      :root {
        --color-accent-primary: #f00;
      }

      .button {
        color: var(--color-accent-primary);
      }
    `;

    fs.readFile.mockResolvedValueOnce(css);

    const line = css.split('\n')[6]; // 0-based line index for line 7 (actual code line)
    const { startColumn, endColumn } = getOffsetRange(
      line,
      'var(--color-accent-primary)',
    );

    const foundPropValues = [
      {
        property: 'color',
        value: 'var(--color-accent-primary)',
        start: { line: 7, column: startColumn },
        end: { line: 7, column: endColumn },
        resolutionType: 'external',
        resolutionTrace: ['var(--color-accent-primary)', '#f00'],
        resolutionSources: ['tokens/colors.css'],
        unresolvedVariables: [],
        containsValidDesignToken: true,
        isValidPropertyValue: true,
      },
    ];

    const html = await loadAndAnnotateFile(
      '/project/styles.css',
      foundPropValues,
    );

    expect(html).toMatch(/var\(--color-accent-primary\)/);
    expect(html).toMatch(/class="awdty--external"/);
    expect(html).toMatch(/data-trace/);
    expect(html).toMatch(/tokens\/colors\.css/);
  });

  test('handles files without matches gracefully', async () => {
    const css = `
      .card {
        padding: 16px;
      }
    `;

    fs.readFile.mockResolvedValueOnce(css);
    const html = await loadAndAnnotateFile('/project/card.css', []);
    expect(html).toMatch(/padding/);
    expect(html).toMatch(/16/);
    expect(html).not.toMatch(/awdty--/);
  });
});
