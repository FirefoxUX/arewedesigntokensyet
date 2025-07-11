import {
  isVariableDefinition,
  containsDesignTokenValue,
  containsExcludedValue,
  isTokenizableProperty,
  getCSSVariables,
  isWithinValidParentSelector,
} from './tokenUtils.js';

describe('isVariableDefinition', () => {
  test('should return true for a CSS var', () => {
    expect(isVariableDefinition('--foo')).toBe(true);
  });

  test(`should return false for value that isn't a CSS var`, () => {
    expect(isVariableDefinition('whatever')).toBe(false);
  });

  test('should return false for undefined', () => {
    expect(isVariableDefinition(undefined)).toBe(false);
  });

  test('should return false for true', () => {
    expect(isVariableDefinition(true)).toBe(false);
  });

  test('should return false for []', () => {
    expect(isVariableDefinition([])).toBe(false);
  });
});

describe('containsDesignTokenValue', () => {
  test(`should be true for '--space-xsmall'`, () => {
    expect(containsDesignTokenValue('var(--space-xsmall)')).toBe(true);
  });

  test(`should be true for a mixed value`, () => {
    expect(containsDesignTokenValue('4px var(--space-xsmall)')).toBe(true);
  });

  test(`should not be true for a value that has no tokens present`, () => {
    expect(containsDesignTokenValue('4px 4px')).toBe(false);
  });

  test(`should not be true for an ignored value`, () => {
    expect(containsDesignTokenValue('unset')).toBe(false);
  });
});

describe('containsExcludedValue', () => {
  test('should ignore unset', () => {
    expect(containsExcludedValue('unset')).toBe(true);
  });

  test('should ignore 0', () => {
    expect(containsExcludedValue('0')).toBe(true);
  });

  test('should ignore unitless 1', () => {
    expect(containsExcludedValue('1')).toBe(true);
  });

  test('should not ignore 1px', () => {
    expect(containsExcludedValue('1px')).toBe(false);
  });

  test('should ignore an a pattern match for calc()', () => {
    expect(containsExcludedValue('calc(100vh - 100px)')).toBe(true);
  });

  test('should ignore a pattern match for max()', () => {
    expect(containsExcludedValue('max(20vw, 400px)')).toBe(true);
  });

  test('should not ignore a hard-coded value', () => {
    expect(containsExcludedValue('400px')).toBe(false);
  });
});

describe('isTokenizableProperty', () => {
  test(`should identify 'gap' as a  tokenizable property`, () => {
    expect(isTokenizableProperty('gap')).toBe(true);
  });

  test(`should not identify 'width' as a  tokenizable property`, () => {
    expect(isTokenizableProperty('width')).toBe(false);
  });
});

describe('getCSSVariables', () => {
  test('extracts a single variable', () => {
    const result = getCSSVariables('var(--primary-color)');
    expect(result).toEqual(['--primary-color']);
  });

  test('extracts multiple variables from chained usage', () => {
    const result = getCSSVariables('1px solid var(--a) var(--b)');
    expect(result).toEqual(['--a', '--b']);
  });

  test('returns empty array when no vars used', () => {
    const result = getCSSVariables('10px solid red');
    expect(result).toEqual([]);
  });

  test('handles nested fallback vars', () => {
    const result = getCSSVariables('var(--a, var(--b, var(--c)))');
    expect(result).toEqual(['--a', '--b', '--c']);
  });
});

describe('isWithinValidParentSelector', () => {
  test('returns true for :root', () => {
    const node = {
      parent: {
        type: 'rule',
        selector: ':root',
      },
    };
    expect(isWithinValidParentSelector(node)).toBe(true);
  });

  test('returns true for :host', () => {
    const node = {
      parent: {
        type: 'rule',
        selector: ':host',
      },
    };
    expect(isWithinValidParentSelector(node)).toBe(true);
  });

  test('returns false for other selectors', () => {
    const node = {
      parent: {
        type: 'rule',
        selector: '.button',
      },
    };
    expect(isWithinValidParentSelector(node)).toBe(false);
  });

  test('handles multiple selectors', () => {
    const node = {
      parent: {
        type: 'rule',
        selector: ':root, .foo',
      },
    };
    expect(isWithinValidParentSelector(node)).toBe(true);
  });
});
