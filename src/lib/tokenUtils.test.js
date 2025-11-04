import {
  isVariableDefinition,
  containsDesignTokenValue,
  isExcludedDeclaration,
  isTokenizableProperty,
  getCSSVariables,
  isWithinValidParentSelector,
  extractDesignTokenIdsFromDecl,
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

describe('isExcludedDeclaration', () => {
  test('should ignore font-weight: normal', () => {
    expect(
      isExcludedDeclaration({ prop: 'font-weight', value: 'normal' }),
    ).toBe(true);
  });

  test('should ignore unset', () => {
    expect(isExcludedDeclaration({ prop: 'any-prop', value: 'unset' })).toBe(
      true,
    );
  });

  test('should ignore 0', () => {
    expect(isExcludedDeclaration({ prop: 'any-prop', value: '0' })).toBe(true);
  });

  test('should ignore unitless 1', () => {
    expect(isExcludedDeclaration({ prop: 'any-prop', value: '1' })).toBe(true);
  });

  test('should not ignore 1px', () => {
    expect(isExcludedDeclaration({ prop: 'any-prop', value: '1px' })).toBe(
      false,
    );
  });

  test('should ignore an a pattern match for calc()', () => {
    expect(
      isExcludedDeclaration({ prop: 'any-prop', value: 'calc(100vh - 100px)' }),
    ).toBe(true);
  });

  test('should ignore a pattern match for max()', () => {
    expect(
      isExcludedDeclaration({ prop: 'any-prop', value: 'max(20vw, 400px)' }),
    ).toBe(true);
  });

  test('should not ignore a hard-coded value', () => {
    expect(isExcludedDeclaration({ prop: 'any-prop', value: '400px' })).toBe(
      false,
    );
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

describe('extractDesignTokenIdsFromDecl', () => {
  // Small helper to build a decl-like object
  function makeDecl(value, resolutionTrace) {
    return { value, resolutionTrace };
  }

  test('returns [] for empty input or empty token set', () => {
    expect(extractDesignTokenIdsFromDecl(undefined, new Set())).toEqual([]);
    expect(extractDesignTokenIdsFromDecl({}, new Set(['--a']))).toEqual([]);
    expect(
      extractDesignTokenIdsFromDecl(makeDecl('', []), new Set(['--a'])),
    ).toEqual([]);
    expect(
      extractDesignTokenIdsFromDecl(makeDecl('var(--a)', []), new Set()),
    ).toEqual([]);
  });

  test('ignores non-canonical vars entirely when tokenKeySet does not include them', () => {
    const d = makeDecl('var(--not-a-token) var(--also-not-token)', [
      'var(--also-not-token)',
    ]);
    const tokenKeySet = new Set(['--real-token']);
    expect(extractDesignTokenIdsFromDecl(d, tokenKeySet)).toEqual([]);
  });

  test('preserves duplicates from authored value (no trace)', () => {
    const d = makeDecl('var(--a) var(--a)', []);
    const tokenKeySet = new Set(['--a']);
    expect(extractDesignTokenIdsFromDecl(d, tokenKeySet)).toEqual([
      '--a',
      '--a',
    ]);
  });

  test('preserves duplicates from authored value and ignores echo trace (exact match)', () => {
    const d = makeDecl('var(--a) var(--a)', ['var(--a) var(--a)']);
    const tokenKeySet = new Set(['--a']);
    expect(extractDesignTokenIdsFromDecl(d, tokenKeySet)).toEqual([
      '--a',
      '--a',
    ]);
  });

  test('echo suppression trims whitespace', () => {
    const d = makeDecl('var(--a) var(--a)', [
      '   var(--a) var(--a)   ',
      'var(--a)',
    ]);
    const tokenKeySet = new Set(['--a']);
    // authored contributes 2, later distinct trace adds 1
    expect(extractDesignTokenIdsFromDecl(d, tokenKeySet)).toEqual([
      '--a',
      '--a',
      '--a',
    ]);
  });

  test('retains discovery order across authored value then trace strings', () => {
    const d = makeDecl('var(--a) var(--b) var(--a)', [
      'var(--a) var(--b) var(--a)', // echo, ignore
      'color-mix(in srgb, var(--b) 75%, var(--c))',
      'var(--a)',
    ]);
    const tokenKeySet = new Set(['--a', '--b', '--c']);
    // authored: --a, --b, --a  then trace: --b, --c, --a
    expect(extractDesignTokenIdsFromDecl(d, tokenKeySet)).toEqual([
      '--a',
      '--b',
      '--a',
      '--b',
      '--c',
      '--a',
    ]);
  });

  test('detects canonical tokens appearing later within CSS-like trace strings', () => {
    const d = makeDecl('var(--alias)', [
      'var(--alias)', // echo, ignore
      'color-mix(in srgb, var(--alias) 75%, var(--canonical))',
    ]);
    const tokenKeySet = new Set(['--canonical']);
    expect(extractDesignTokenIdsFromDecl(d, tokenKeySet)).toEqual([
      '--canonical',
    ]);
  });

  test('color-mix trace without canonical tokens yields empty', () => {
    const d = makeDecl('1px solid var(--border)', [
      '1px solid var(--border)',
      '1px solid color-mix(in srgb, var(--bg) 75%, #000)',
      '1px solid color-mix(in srgb, #F9F9FB 75%, #000)',
    ]);
    const tokenKeySet = new Set(['--canonical']);
    expect(extractDesignTokenIdsFromDecl(d, tokenKeySet)).toEqual([]);
  });

  test('later trace includes canonical but no authored aliases from that step, counts once', () => {
    const d = makeDecl('var(--other)', [
      'var(--other)', // echo
      'color-mix(in srgb, #000 50%, var(--canonical) 50%)',
    ]);
    const tokenKeySet = new Set(['--canonical']);
    expect(extractDesignTokenIdsFromDecl(d, tokenKeySet)).toEqual([
      '--canonical',
    ]);
  });

  test('when multiple aliases in value map to same canonical later, duplicates preserved via multiplier', () => {
    const d = makeDecl('var(--x) var(--y) var(--y)', [
      'var(--x) var(--y) var(--y)', // echo
      // realistic CSS-like step where canonical appears alongside aliases
      'color-mix(in srgb, var(--x) 50%, var(--y) 50%, var(--token))',
    ]);
    const tokenKeySet = new Set(['--token']);
    // max occurrence among aliases present in this trace step is 2 (for --y)
    expect(extractDesignTokenIdsFromDecl(d, tokenKeySet)).toEqual([
      '--token',
      '--token',
    ]);
  });

  test('robust to non-string entries in trace, which are ignored', () => {
    // Production emits strings, but ensure odd entries do not break things.
    const d = makeDecl('var(--a)', [
      'var(--a)',
      null,
      42,
      {},
      'color-mix(in srgb, var(--a), var(--b))',
    ]);
    const tokenKeySet = new Set(['--a', '--b']);
    // authored: --a; trace: echo ignored, null/42/{} ignored, last step adds --a and --b
    expect(extractDesignTokenIdsFromDecl(d, tokenKeySet)).toEqual([
      '--a',
      '--a',
      '--b',
    ]);
  });

  test('whitespace-only trace entries are ignored', () => {
    const d = makeDecl('var(--a)', [
      '   ',
      '\n\t',
      'color-mix(in srgb, #000, var(--a))',
    ]);
    const tokenKeySet = new Set(['--a']);
    expect(extractDesignTokenIdsFromDecl(d, tokenKeySet)).toEqual([
      '--a',
      '--a',
    ]);
  });
});
