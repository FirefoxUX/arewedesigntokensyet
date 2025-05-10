import fs from 'node:fs/promises';

import { jest } from '@jest/globals';

import {
  isVariableDefinition,
  containsDesignTokenValue,
  containsExcludedValue,
  isTokenizableProperty,
  convertPathToURI,
  getPropagationData,
  getCssFilesList,
} from '../bin/buildTokenData.js';

describe('isVariableDefinition', () => {
  it('should return true for a CSS var', () => {
    expect(isVariableDefinition('--foo')).toBe(true);
  });

  it(`should return false for value that isn't a CSS var`, () => {
    expect(isVariableDefinition('whatever')).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isVariableDefinition(undefined)).toBe(false);
  });

  it('should return false for true', () => {
    expect(isVariableDefinition(true)).toBe(false);
  });

  it('should return false for []', () => {
    expect(isVariableDefinition([])).toBe(false);
  });
});

describe('containsDesignTokenValue', () => {
  it(`should be true for '--space-xsmall'`, () => {
    expect(containsDesignTokenValue('var(--space-xsmall)')).toBe(true);
  });

  it(`should be true for a mixed value`, () => {
    expect(containsDesignTokenValue('4px var(--space-xsmall)')).toBe(true);
  });

  it(`should not be true for a value that has no tokens present`, () => {
    expect(containsDesignTokenValue('4px 4px')).toBe(false);
  });

  it(`should not be true for an ignored value`, () => {
    expect(containsDesignTokenValue('unset')).toBe(false);
  });
});

describe('containsExcludedValue', () => {
  it('should ignore unset', () => {
    expect(containsExcludedValue('unset')).toBe(true);
  });

  it('should ignore 0', () => {
    expect(containsExcludedValue('0')).toBe(true);
  });

  it('should ignore an a pattern match for calc()', () => {
    expect(containsExcludedValue('calc(100vh - 100px)')).toBe(true);
  });

  it('should ignore a pattern match for max()', () => {
    expect(containsExcludedValue('max(20vw, 400px)')).toBe(true);
  });

  it('should not ignore a hard-coded value', () => {
    expect(containsExcludedValue('400px')).toBe(false);
  });
});

describe('isTokenizableProperty', () => {
  it(`should identify 'gap' as a  tokenizable property`, () => {
    expect(isTokenizableProperty('gap')).toBe(true);
  });

  it(`should not identify 'width' as a  tokenizable property`, () => {
    expect(isTokenizableProperty('width')).toBe(false);
  });
});

describe('convertPathToURI', () => {
  it('should convert a path to URI', () => {
    expect(convertPathToURI('\\browser\\components')).toEqual(
      '/browser/components',
    );
  });
});

describe('getPropagationData', () => {
  beforeEach(() => {
    jest.mock('node:fs/promises');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return expected data structure', async () => {
    // In this CSS the width property won't be matched.
    const fakeCSS = `.test {
      width: 100px;
      background-color: var(--whatever);
      gap: --space-xsmall;
    }`;
    fs.readFile = jest.fn().mockResolvedValue(fakeCSS);

    const result = await getPropagationData('whatever');

    // Only one of the two props 'found' uses a design token.
    expect(result.designTokenCount).toEqual(1);

    // foundProps will be 2 because width is not currently a property that
    // we'd expect could be associated with a design token.
    expect(result.foundProps).toEqual(2);

    // Uses a random var so these will be false
    expect(result.foundPropValues[0].containsDesignToken).toBe(false);
    expect(result.foundPropValues[0].containsExcludedValue).toBe(false);
    expect(result.foundPropValues[0].isIndirectRef).toBe(false);

    // Uses space token so should be true.
    expect(result.foundPropValues[1].containsDesignToken).toBe(true);
    // These will be false.
    expect(result.foundPropValues[1].containsExcludedValue).toBe(false);
    expect(result.foundPropValues[1].isIndirectRef).toBe(false);
  });

  it('should handle ignored values', async () => {
    // In this CSS the width property won't be matched.
    const fakeCSS = `.test {
      width: 100px;
      background-color: var(--whatever);
      gap: --space-xsmall;
      color: transparent;
    }`;
    fs.readFile = jest.fn().mockResolvedValue(fakeCSS);

    const result = await getPropagationData('whatever');

    // Only one of the two props 'found' uses a design token.
    expect(result.designTokenCount).toEqual(2);
    expect(result.foundProps).toEqual(3);

    // Uses an ignored value.
    expect(result.foundPropValues[2].containsDesignToken).toBe(false);
    expect(result.foundPropValues[2].containsExcludedValue).toBe(true);
    expect(result.foundPropValues[2].isIndirectRef).toBe(false);

    // 2 of 3 expected props are pointing at design tokens or
    // excluded values so this should be 66.67%
    expect(result.percentage).toEqual(66.67);
  });

  it('should handle collecting vars referencing design token in the same file', async () => {
    // In this CSS the width property won't be matched.
    const fakeCSS = `.test {
      :root {
        --whatever: var(--space-xsmall);
      }
      width: 100px;
      background-color: var(--whatever);
      gap: --space-xsmall;
      color: transparent;
    }`;
    fs.readFile = jest.fn().mockResolvedValue(fakeCSS);

    const result = await getPropagationData();

    // Only one of the two props 'found' uses a design token.
    expect(result.designTokenCount).toEqual(3);
    expect(result.foundProps).toEqual(3);

    // background-color points to a design token via the var --whatever.
    expect(result.foundPropValues[0].containsDesignToken).toBe(true);
    expect(result.foundPropValues[0].containsExcludedValue).toBe(false);
    expect(result.foundPropValues[0].isIndirectRef).toBe(true);

    // The variable pointing at --space-xsmall is recorded.
    expect(result.foundVariables['--whatever'].containsDesignToken).toBe(true);

    // 3 of 3 expected props all are pointing at design tokens or
    // excluded values so this should be 100%
    expect(result.percentage).toEqual(100);
  });

  it('should handle exceptions', async () => {
    fs.readFile = jest.fn().mockRejectedValue(new Error('test-error'));
    await expect(
      async () => await getPropagationData('whatever'),
    ).rejects.toThrow('test-error');
  });
});

describe('getCssFilesList', () => {
  beforeEach(() => {
    jest.mock('node:fs/promises');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return correct css files data', async () => {
    const fakeCSS = `.test {
      width: 100px;
      background-color: var(--whatever);
      gap: --space-xsmall;
      color: transparent;
    }`;

    fs.readFile = jest.fn().mockResolvedValue(fakeCSS);

    const mockedFiles = ['foo/foo.css', 'bar/bar.css'];
    const result = await getCssFilesList('../mozilla-unified', {
      __glob: jest.fn(() => mockedFiles),
    });
    expect(result.length).toBe(2);
    expect(result[0].fileURI).toMatch(/foo\/foo.css/);
    expect(result[1].fileURI).toMatch(/bar\/bar.css/);
  });
});
