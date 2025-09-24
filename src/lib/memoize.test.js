import { memoize } from './memoize.js';

describe('memoize', () => {
  test('calls the original function only once for the same arguments', () => {
    const fn = vi.fn((x) => x * 2);
    const memoized = memoize(fn);

    expect(memoized(3)).toBe(6); // calls fn
    expect(memoized(3)).toBe(6); // uses cache
    expect(fn).toHaveBeenCalledTimes(1); // only called once
  });

  test('caches based on argument values', () => {
    const fn = vi.fn((a, b) => a + b);
    const memoized = memoize(fn);

    expect(memoized(1, 2)).toBe(3); // calls fn
    expect(memoized(1, 2)).toBe(3); // uses cache
    expect(memoized(2, 1)).toBe(3); // calls fn again (different args)
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('can clear the cache', () => {
    const fn = vi.fn((x) => x + 1);
    const memoized = memoize(fn);

    memoized(5);
    memoized(5);
    expect(fn).toHaveBeenCalledTimes(1);

    memoized.clear();

    memoized(5);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
