import path from 'path';
import config from '../../config.js';
import {
  getCSSVariables,
  containsDesignTokenValue,
  isExcludedDeclaration,
} from './tokenUtils.js';

/**
 * Builds a trace showing each step of resolving CSS variable references.
 * @param {string} initialValue - The starting CSS value (e.g. "var(--bg-color)").
 * @param {object} foundVariables - Map of CSS variable names to their data.
 * @returns {string[]} - A trace of resolution steps, including any missing values.
 */
export function buildResolutionTrace(initialValue, foundVariables) {
  const trace = [initialValue];
  const visited = new Set();

  while (true) {
    const current = trace[trace.length - 1];
    const variables = getCSSVariables(current);

    if (variables.length === 0) {
      break;
    }

    let nextValue = current;
    let changed = false;

    for (const variable of variables) {
      if (visited.has(variable)) {
        continue;
      }
      visited.add(variable);

      const ref = foundVariables[variable];

      const replacement = ref?.value;
      if (nextValue.includes(`var(${variable})`) && replacement) {
        nextValue = nextValue.replace(`var(${variable})`, replacement);
        changed = true;
      }
    }

    if (!changed || nextValue === current) {
      break;
    }
    trace.push(nextValue);
  }

  return trace;
}

/**
 * Analyzes a trace to determine if it includes design tokens or excluded values.
 * @param {string[]} trace - A resolution trace of CSS values.
 * @param {string} descriptor - A CSS descriptor to enable specific exclusions based on the value and descriptor combination.
 * @returns {{ containsDesignToken: boolean, containsExcludedDeclaration: boolean }}
 */
export function analyzeTrace(trace, descriptor) {
  return {
    containsDesignToken: trace.some(containsDesignTokenValue),
    containsExcludedDeclaration: trace.some((traceValue) => {
      const result = isExcludedDeclaration({
        prop: descriptor,
        value: traceValue,
      });
      return result;
    }),
  };
}

/**
 * Returns a list of unique external files used to resolve the value.
 * @param {string[]} trace - The resolution trace for a CSS value.
 * @param {object} foundVariables - Map of var names to varData.
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
 * @param {string[]} trace - Resolution trace (e.g. ['var(--a)', 'var(--b)', 'MISSING'])
 * @param {object} foundVariables - Known var definitions
 * @returns {string[]} - Unresolved var names (excluding known tokens)
 */
export function getUnresolvedVariablesFromTrace(trace, foundVariables) {
  const seen = new Set();

  for (const val of trace) {
    const vars = getCSSVariables(val);
    for (const name of vars) {
      if (seen.has(name)) {
        continue;
      }
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
 * @param {string[]} trace - The full resolution trace.
 * @param {object} foundVariables - All known vars.
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
  if (allVars.size === 0) {
    return 'direct';
  }

  const sources = new Set();

  for (const varName of allVars) {
    const varData = foundVariables[varName];

    if (!varData) {
      continue;
    }

    const isExternal = varData.src && varData.src !== currentFile;
    sources.add(isExternal ? 'external' : 'local');
  }

  if (sources.has('local') && sources.has('external')) {
    return 'mixed';
  }
  if (sources.has('external')) {
    return 'external';
  }
  return 'local';
}

/**
 * Builds a map of each variable name in the trace to the file it came from.
 * @param {string[]} trace - Resolution trace for a declaration.
 * @param {object} foundVariables - Known variable metadata.
 * @returns {object} - Map: varName → relative source path
 */
export function getResolvedVarOrigins(trace, foundVariables) {
  const result = {};

  for (const value of trace) {
    const vars = getCSSVariables(value);

    for (const name of vars) {
      const varData = foundVariables[name];
      if (!varData?.src) {
        continue;
      }

      // Skip if value isn't the one used in this trace step
      if (value.includes(`var(${name})`)) {
        result[name] = path.relative(config.repoPath, varData.src);
      }
    }
  }

  return result;
}
