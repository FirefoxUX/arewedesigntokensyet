import config from '../../config.js';

import {
  buildResolutionTrace,
  analyzeTrace,
  classifyResolutionFromTrace,
  getResolvedVarOrigins,
  getResolutionSources,
  getUnresolvedVariablesFromTrace,
} from './resolutionUtils.js';

describe('buildResolutionTrace', () => {
  const foundVars = {
    '--a': { value: 'var(--b)' },
    '--b': { value: '12px' },
  };

  test('resolves a nested chain', () => {
    const result = buildResolutionTrace('var(--a)', foundVars);
    expect(result).toEqual(['var(--a)', 'var(--b)', '12px']);
  });

  test('retains unresolved var names instead of "MISSING"', () => {
    const result = buildResolutionTrace('var(--x)', {});
    // expect(result).toEqual(['var(--x)', 'var(--x)']);
    expect(result).toEqual(['var(--x)']);
  });
});

describe('analyzeTrace', () => {
  beforeAll(() => {
    config.designTokenKeys = ['--color-primary'];
    config.excludedCSSValues = ['inherit'];
  });

  test('detects design token and excluded values', () => {
    const trace = ['var(--color-primary)', 'inherit'];
    const result = analyzeTrace(trace);
    expect(result.containsDesignToken).toBe(true);
    expect(result.containsExcludedValue).toBe(true);
  });
});

describe('classifyResolutionFromTrace', () => {
  beforeAll(() => {
    config.designTokenKeys = ['--color-primary'];
    config.excludedCSSValues = ['inherit'];
    config.repoPath = '/project';
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

describe('getResolvedVarOrigins', () => {
  test('returns map of var names to source paths', () => {
    const foundVars = {
      '--a': { value: '12px', src: '/project/tokens/spacing.css' },
      '--b': { value: '4px', src: '/project/tokens/spacing.css' },
    };
    const trace = ['var(--a)', 'var(--b)', '4px'];
    const currentFile = '/src/components/button.css';

    const result = getResolvedVarOrigins(trace, foundVars, currentFile);
    expect(result).toEqual({
      '--a': 'tokens/spacing.css',
      '--b': 'tokens/spacing.css',
    });
  });
});

describe('getUnresolvedVariablesFromTrace', () => {
  test('returns only unresolved, non-token vars', () => {
    const trace = ['var(--unknown)', 'var(--color-primary)'];
    const foundVars = {
      '--color-primary': { value: '#000' }, // token defined
    };

    const result = getUnresolvedVariablesFromTrace(trace, foundVars);
    expect(result).toEqual(['--unknown']);
  });
});

describe('getResolutionSources', () => {
  beforeAll(() => {
    config.repoPath = '/project';
    config.designTokenKeys = ['--color-primary'];
    config.excludedCSSValues = [];
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
