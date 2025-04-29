import fs from 'node:fs/promises';
import { jest } from '@jest/globals';

import {
  isVariableDefinition,
  isDesignTokenValue,
  isExcludedValue,
  isTokenizableProperty,
  getPropagationData,
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

describe('isDesignTokenValue', () => {
  it(`should be true for '--space-xsmall'`, () => {
    expect(isDesignTokenValue('var(--space-xsmall)')).toBe(true);
  });

  it(`should be true for a mixed value`, () => {
    expect(isDesignTokenValue('4px var(--space-xsmall)')).toBe(true);
  });

  it(`should not be true for a value that has no tokens present`, () => {
    expect(isDesignTokenValue('4px 4px')).toBe(false);
  });

  it(`should not be true for an ignored value`, () => {
    expect(isDesignTokenValue('unset')).toBe(false);
  });
});

describe('isExcludedValue', () => {
  it('should ignore unset', () => {
    expect(isExcludedValue('unset')).toBe(true);
  });

  it('should ignore 0', () => {
    expect(isExcludedValue('0')).toBe(true);
  });

  it('should ignore an a pattern match for calc()', () => {
    expect(isExcludedValue('calc(100vh - 100px)')).toBe(true);
  });

  it('should ignore a pattern match for max()', () => {
    expect(isExcludedValue('max(20vw, 400px)')).toBe(true);
  });

  it('should not ignore a hard-coded value', () => {
    expect(isExcludedValue('400px')).toBe(false);
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
    expect(result.foundPropValues[0].isDesignToken).toBe(false);
    expect(result.foundPropValues[2].isExcludedValue).toBe(false);
    expect(result.foundPropValues[2].isIndirectRef).toBe(false);

    // Uses space token so should be true.
    expect(result.foundPropValues[1].isDesignToken).toBe(true);
    // These will be false.
    expect(result.foundPropValues[2].isExcludedValue).toBe(false);
    expect(result.foundPropValues[2].isIndirectRef).toBe(false);
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
    expect(result.foundPropValues[2].isDesignToken).toBe(false);
    expect(result.foundPropValues[2].isExcludedValue).toBe(true);
    expect(result.foundPropValues[2].isIndirectRef).toBe(false);
  });
});
