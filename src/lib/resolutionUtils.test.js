import config from '../../config.js';

import {
  buildResolutionTrace,
  analyzeTrace,
  classifyResolutionFromTrace,
  getResolutionSources,
  getUnresolvedVariablesFromTrace,
} from './resolutionUtils.js';

const originalConfig = { ...config };

describe('buildResolutionTrace', () => {
  test('resolves a nested chain', () => {
    const foundVars = {
      '--a': { value: 'var(--b)' },
      '--b': { value: '12px' },
    };
    const result = buildResolutionTrace('var(--a)', foundVars);
    expect(result).toEqual(['var(--a)', 'var(--b)', '12px']);
  });

  test('resolves a nested chain with multiple vars', () => {
    const foundVars = {
      '--a': { value: 'var(--b)' },
      '--b': { value: '12px' },
      '--c': { value: '24px' },
    };
    const result = buildResolutionTrace('var(--a) var(--c)', foundVars);
    expect(result).toEqual(['var(--a) var(--c)', 'var(--b) 24px', '12px 24px']);
  });

  test('handles non-resolvable vars', () => {
    const foundVars = {};
    const result = buildResolutionTrace('12px 24px', foundVars);
    expect(result).toEqual(['12px 24px']);
  });

  test('handles a potential loop', () => {
    const foundVars = {
      '--a': { value: 'var(--a)' },
    };
    const result = buildResolutionTrace('var(--a)', foundVars);
    expect(result).toEqual(['var(--a)']);
  });

  test('retains unresolved var names instead of "MISSING"', () => {
    const result = buildResolutionTrace('var(--x)', {});
    expect(result).toEqual(['var(--x)']);
  });
});

describe('analyzeTrace', () => {
  beforeAll(() => {
    config.allTokens = ['--color-accent-primary'];
  });

  afterAll(() => {
    Object.assign(config, originalConfig);
  });

  test('detects design token and is allowed prop', () => {
    const trace = ['var(--color-accent-primary)'];
    const result = analyzeTrace(trace, {
      prop: 'background-color',
      value: 'var(--color-accent-primary)',
    });
    expect(result.containsValidDesignToken).toBe(true);
    expect(result.isValidPropertyValue).toBe(true);
  });

  test('detects font-weight: normal specific exclusion', () => {
    const trace = ['var(--some-var)', 'normal'];
    // Check with random property first.
    const result = analyzeTrace(trace, {
      prop: 'whatever',
      value: 'var(--some-var)',
    });
    expect(result.containsValidDesignToken).toBe(false);
    expect(result.isValidPropertyValue).toBe(false);
    // This should be excluded.
    const result2 = analyzeTrace(trace, {
      prop: 'font-weight',
      value: 'var(--some-var)',
    });
    expect(result2.containsValidDesignToken).toBe(false);
    expect(result2.isValidPropertyValue).toBe(true);
  });

  test('correctly identifies non-design token use', () => {
    const trace = ['var(--not-token)', 'inherit'];
    const result = analyzeTrace(trace, {
      prop: 'margin',
      value: 'var(--not-token)',
    });
    expect(result.containsValidDesignToken).toBe(false);
    expect(result.isValidPropertyValue).toBe(true);
  });

  test('correctly identifies non-design token and non excluded value use', () => {
    const trace = ['var(--not-token)', 'whatever'];
    const result = analyzeTrace(trace, {
      prop: 'margin',
      value: 'var(--not-token)',
    });
    expect(result.containsValidDesignToken).toBe(false);
    expect(result.isValidPropertyValue).toBe(false);
  });
});

describe('classifyResolutionFromTrace', () => {
  beforeAll(() => {
    config.designTokenKeys = ['--color-accent-primary'];
    config.repoPath = '/project';
  });

  afterAll(() => {
    Object.assign(config, originalConfig);
  });

  const currentFile = '/src/components/button.css';

  test('returns "direct" when no vars used', () => {
    const result = classifyResolutionFromTrace(['12px'], {}, currentFile);
    expect(result).toBe('direct');
  });

  test('returns "local" for current file vars', () => {
    const foundVars = {
      '--a': { value: '12px', src: currentFile },
    };
    const result = classifyResolutionFromTrace(
      ['var(--a)', '12px'],
      foundVars,
      currentFile,
    );
    expect(result).toBe('local');
  });

  test('returns "external" for external vars', () => {
    const foundVars = {
      '--a': { value: '12px', src: '/project/tokens/spacing.css' },
    };
    const result = classifyResolutionFromTrace(
      ['var(--a)', '12px'],
      foundVars,
      currentFile,
    );
    expect(result).toBe('external');
  });

  test('returns "mixed" for local and external vars', () => {
    const foundVars = {
      '--a': { value: 'var(--b)', src: currentFile },
      '--b': { value: '12px', src: '/project/tokens/spacing.css' },
    };
    const result = classifyResolutionFromTrace(
      ['var(--a)', 'var(--b)', '12px'],
      foundVars,
      currentFile,
    );
    expect(result).toBe('mixed');
  });
});

describe('getUnresolvedVariablesFromTrace', () => {
  test('returns only unresolved, non-token vars', () => {
    const trace = ['var(--unknown)', 'var(--color-accent-primary)'];
    const foundVars = {
      '--color-accent-primary': { value: '#000' }, // token defined
    };

    const result = getUnresolvedVariablesFromTrace(
      'background-color',
      trace,
      foundVars,
    );
    expect(result).toEqual(['--unknown']);
  });
});

describe('getResolutionSources', () => {
  beforeAll(() => {
    config.repoPath = '/project';
    config.designTokenKeys = ['--color-accent-primary'];
  });

  afterAll(() => {
    Object.assign(config, originalConfig);
  });

  const currentFile = '/project/src/components/button.css';

  test('returns source files for matched var values in trace', () => {
    const foundVars = {
      '--a': { value: '12px', src: '/project/tokens/spacing.css' },
      '--b': { value: 'var(--a)', src: '/project/tokens/spacing.css' },
      '--c': { value: '4px', src: currentFile }, // should be excluded
    };

    const trace = ['var(--b)', 'var(--a)', '12px', '4px'];

    const result = getResolutionSources(trace, foundVars, currentFile);

    expect(result).toEqual(['tokens/spacing.css']);
  });

  test('returns source files for matched var values inside trace entries', () => {
    const foundVars = {
      '--a': {
        value: '--color-accent-primary',
        src: '/project/tokens/colors.css',
      },
      '--b': { value: 'var(--a)', src: currentFile },
    };

    const trace = [
      '1px solid var(--b)',
      '1px solid var(--a)',
      '1px solid var(--color-accent-primary)',
    ];

    const result = getResolutionSources(trace, foundVars, currentFile);

    expect(result).toEqual(['tokens/colors.css']);
  });

  test('deduplicates source files', () => {
    const foundVars = {
      '--a': { value: '12px', src: '/project/tokens/spacing.css' },
      '--b': { value: '12px', src: '/project/tokens/spacing.css' },
    };

    const trace = ['var(--a)', 'var(--b)', '12px'];

    const result = getResolutionSources(trace, foundVars, currentFile);

    expect(result).toEqual(['tokens/spacing.css']);
  });

  test('returns empty array when all sources are local', () => {
    const foundVars = {
      '--x': { value: '16px', src: currentFile },
    };

    const trace = ['var(--x)', '16px'];

    const result = getResolutionSources(trace, foundVars, currentFile);

    expect(result).toEqual([]);
  });
});
