import {
  isVariableDefinition,
  containsValidDesignToken,
  getValidTokensForProp,
  isValidPropertyValue,
  isTokenizableProperty,
  getCSSVariables,
  isWithinValidParentSelector,
  extractValidTokensForProp,
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

describe('getValidTokensForProp', () => {
  test(`should return valid tokens for 'border'`, () => {
    const validTokens = getValidTokensForProp('border');
    expect(validTokens).toContain('--border-color');
  });
});

describe('extractValidTokensForProp', () => {
  test(`should return valid tokens for 'border'`, () => {
    const extractedTokens = extractValidTokensForProp(
      'border',
      '1px solid var(--focus-outline)',
    );
    expect(extractedTokens).not.toContain('1px');
    expect(extractedTokens).toContain('--focus-outline');
  });

  test(`should return valid tokens for 'border'`, () => {
    const extractedTokens = extractValidTokensForProp(
      'padding-inline-end',
      'var(--space-xsmall)',
    );
    expect(extractedTokens).toContain('--space-xsmall');
  });
});

describe('containsValidDesignToken', () => {
  test(`should be true for '--size-item-xsmall'`, () => {
    expect(containsValidDesignToken('height', 'var(--size-item-xsmall)')).toBe(
      true,
    );
  });

  test(`should be true for a mixed value`, () => {
    expect(containsValidDesignToken('margin', '4px var(--space-xsmall)')).toBe(
      true,
    );
  });

  test(`should be true for a base token`, () => {
    expect(
      containsValidDesignToken('color', 'var(--color-accent-primary)'),
    ).toBe(true);
  });

  test(`should not be true for a value that has no tokens present`, () => {
    expect(containsValidDesignToken('margin', '4px 4px')).toBe(false);
  });

  test(`should not be true for an ignored value`, () => {
    expect(containsValidDesignToken('margin', '0 auto')).toBe(false);
  });
});

describe('isValidPropertyValue', () => {
  test(`should be true for a base token`, () => {
    // This should be aliased to be allowed.
    expect(isValidPropertyValue('color', 'var(--color-accent-primary)')).toBe(
      false,
    );
  });

  test('should allow an aliased base token', () => {
    expect(
      isValidPropertyValue('color', 'var(--local-var)', {
        '--local-var': 'var(--color-accent-primary)',
      }),
    ).toBe(true);
  });

  test('should not see border: 1px solid LinkText as valid', () => {
    expect(isValidPropertyValue('border', '1px solid LinkText')).toBe(false);
  });

  test('should allow font-weight: normal', () => {
    expect(isValidPropertyValue('font-weight', 'normal')).toBe(true);
  });

  test('should allow font-weight: NoRmAl due to case insensitivity', () => {
    expect(isValidPropertyValue('font-weight', 'NoRmAl')).toBe(true);
  });

  test(`should allow font-weight: inherit`, () => {
    expect(isValidPropertyValue('font-weight', 'inherit')).toBe(true);
  });

  test(`should allow font-weight: INHERIT`, () => {
    expect(isValidPropertyValue('font-weight', 'INHERIT')).toBe(true);
  });

  test(`should allow font-weight: unset`, () => {
    expect(isValidPropertyValue('font-weight', 'unset')).toBe(true);
  });

  test('should ignore 0', () => {
    expect(isValidPropertyValue('margin', '0')).toBe(true);
  });

  test('should allow unitless 1 for flex', () => {
    expect(isValidPropertyValue('flex', '1')).toBe(true);
  });

  test('should allow 1px', () => {
    expect(isValidPropertyValue('width', '1px')).toBe(true);
  });

  test('should allow calc() with vh and 1px (allowed value)', () => {
    expect(isValidPropertyValue('width', 'calc(100vh - 1px)')).toBe(true);
  });

  test('should not allow a hard-coded value', () => {
    expect(isValidPropertyValue('width', '400px')).toBe(false);
  });

  test('should allow a local var that matches an allowed value', () => {
    expect(
      isValidPropertyValue('width', 'var(--local-var)', { '--local-var': '0' }),
    ).toBe(true);
  });

  test('should not allow a local var pointing to a hard-coded value', () => {
    expect(
      isValidPropertyValue('width', 'var(--local-var)', {
        '--local-var': '400px',
      }),
    ).toBe(false);
  });

  test('should allow a local var pointing to a valid token', () => {
    expect(
      isValidPropertyValue('width', 'var(--local-var)', {
        '--local-var': 'var(--size-item-xsmall)',
      }),
    ).toBe(true);
  });

  test('should not allow a local var pointing to an unresolved var', () => {
    expect(
      isValidPropertyValue('width', 'var(--local-var)', {
        '--local-var': 'var(--whatever)',
      }),
    ).toBe(false);
  });
});

describe('isTokenizableProperty', () => {
  test(`should identify 'gap' as a  tokenizable property`, () => {
    expect(isTokenizableProperty('gap')).toBe(true);
  });

  test(`should not identify 'non-existent' as a  tokenizable property`, () => {
    expect(isTokenizableProperty('non-existent')).toBe(false);
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
