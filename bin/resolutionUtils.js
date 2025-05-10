import path from 'path';
import config from '../config.js';
import {
  getCSSVariables,
  containsDesignTokenValue,
  containsExcludedValue,
} from './tokenUtils.js';

/**
 * Builds a trace showing each step of resolving CSS variable references.
 *
 * @param {string} initialValue - The starting CSS value (e.g. "var(--bg-color)").
 * @param {Object} foundVariables - Map of CSS variable names to their data.
 * @returns {string[]} - A trace of resolution steps, including any missing values.
 */
export function buildResolutionTrace(initialValue, foundVariables) {
  const trace = [initialValue];
  const visited = new Set();

  while (true) {
    const current = trace[trace.length - 1];
    const variables = getCSSVariables(current);

    if (variables.length === 0) break;

    let nextValue = current;
    let changed = false;

    for (const variable of variables) {
      if (visited.has(variable)) continue;
      visited.add(variable);

      const ref = foundVariables[variable];
      const replacement = ref ? ref.value : 'MISSING';

      if (nextValue.includes(`var(${variable})`)) {
        nextValue = nextValue.replace(`var(${variable})`, replacement);
        changed = true;
      }
    }

    if (!changed || nextValue === current) break;
    trace.push(nextValue);
  }

  return trace;
}

/**
 * Analyzes a trace to determine if it includes design tokens or excluded values.
 *
 * @param {string[]} trace - A resolution trace of CSS values.
 * @returns {{ containsDesignToken: boolean, containsExcludedValue: boolean }}
 */
export function analyzeTrace(trace) {
  return {
    containsDesignToken: trace.some(containsDesignTokenValue),
    containsExcludedValue: trace.some(containsExcludedValue),
  };
}

/**
 * Returns a list of unique external files used to resolve the value.
 *
 * @param {string[]} trace - The resolution trace for a CSS value.
 * @param {Object} foundVariables - Map of var names to varData.
 * @param {string} currentFile - The file currently being analyzed.
 * @returns {string[]} - List of relative paths to external files used in resolution.
 */
export function getResolutionSources(trace, foundVariables, currentFile) {
  const externalSources = Object.values(foundVariables)
    .filter(
      (varData) =>
        varData.src &&
        varData.src !== currentFile &&
        trace.includes(varData.value),
    )
    .map((varData) => path.relative(config.repoPath, varData.src));

  return [...new Set(externalSources)];
}

/**
 * Returns unresolved variable names from across the full resolution trace.
 *
 * @param {string[]} trace - Resolution trace (e.g. ['var(--a)', 'var(--b)', 'MISSING'])
 * @param {Object} foundVariables - Known var definitions
 * @returns {string[]} - Unresolved var names (excluding known tokens)
 */
export function getUnresolvedVariablesFromTrace(trace, foundVariables) {
  const seen = new Set();

  for (const val of trace) {
    const vars = getCSSVariables(val);
    for (const name of vars) {
      if (seen.has(name)) continue;
      seen.add(name);
    }
  }

  return [...seen].filter((name) => {
    const isMissing = !foundVariables[name];
    const isDesignToken = config.designTokenKeys.some((token) =>
      name.includes(token),
    );
    return isMissing && !isDesignToken;
  });
}

/**
 * Classifies how a CSS property was resolved based on the entire trace.
 *
 * @param {string[]} trace - The full resolution trace.
 * @param {Object} foundVariables - All known vars.
 * @param {string} currentFile - The file being analyzed.
 * @returns {'direct' | 'local' | 'external' | 'mixed'}
 */
export function classifyResolutionFromTrace(
  trace,
  foundVariables,
  currentFile,
) {
  const allVars = new Set();

  // Collect all variables referenced in any trace step
  for (const value of trace) {
    getCSSVariables(value).forEach((name) => allVars.add(name));
  }

  // No variables used at all → direct literal
  if (allVars.size === 0) return 'direct';

  const sources = new Set();

  for (const varName of allVars) {
    const varData = foundVariables[varName];

    if (!varData) continue;

    const isExternal = varData.src && varData.src !== currentFile;
    sources.add(isExternal ? 'external' : 'local');
  }

  if (sources.has('local') && sources.has('external')) return 'mixed';
  if (sources.has('external')) return 'external';
  return 'local';
}

/**
 * Builds a map of each variable name in the trace to the file it came from.
 *
 * @param {string[]} trace - Resolution trace for a declaration.
 * @param {Object} foundVariables - Known variable metadata.
 * @param {string} currentFile - File being analyzed (for relative path mapping).
 * @returns {Object} - Map: varName → relative source path
 */
export function getResolvedVarOrigins(trace, foundVariables) {
  const result = {};

  for (const value of trace) {
    const vars = getCSSVariables(value);

    for (const name of vars) {
      const varData = foundVariables[name];
      if (!varData?.src) continue;

      // Skip if value isn't the one used in this trace step
      if (value.includes(`var(${name})`)) {
        result[name] = path.relative(config.repoPath, varData.src);
      }
    }
  }

  return result;
}
