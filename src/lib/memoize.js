/**
 * Simple memoization utility.
 * Caches results by stringified arguments (single or multiple).
 * @param {Function} fn - The function to memoize.
 * @returns {Function} Memoized version of the input function.
 */
export function memoize(fn) {
  const cache = new Map();

  const memoized = function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };

  memoized.clear = () => cache.clear();
  return memoized;
}
