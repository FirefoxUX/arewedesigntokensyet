import { memoize } from './memoize.js';
import { parseCSS } from './cssParser.js';
import {
  isVariableDefinition,
  isWithinValidParentSelector,
} from './tokenUtils.js';

/**
 * Parses a CSS file and extracts variable definitions, marking each with metadata.
 *
 * This function walks the parsed PostCSS AST, filters for valid `--*` variables
 * within acceptable parent selectors, and returns a map of variable names to
 * metadata objects. Used to track externally defined variables.
 *
 * @param {string} filePath - The absolute path to the external CSS file.
 * @returns {Promise<Record<string, object>>} - A promise resolving to a map of variable names to metadata.
 *
 * @private
 */
async function __getExternalVars(filePath) {
  const root = await parseCSS(filePath);
  const cssVars = {};

  root.walk((node) => {
    if (isVariableDefinition(node.prop) && isWithinValidParentSelector(node)) {
      cssVars[node.prop] = getVarData(node, {
        isExternal: true,
        filePath,
      });
    }
  });

  return cssVars;
}

/**
 * Memoized version of `__getExternalVars`, used to cache variable extraction
 * results per file path.
 *
 * @type {(filePath: string) => Promise<Record<string, object>>}
 */
export const getExternalVars = memoize(__getExternalVars);

/**
 * Constructs metadata for a given PostCSS CSS variable node.
 *
 * This includes:
 * - The raw value
 * - Source location info (start/end)
 * - Whether it's external and where it came from
 *
 * @param {import('postcss').Declaration} node - The PostCSS declaration node.
 * @param {object} options - Options for the variable context.
 * @param {boolean} [options.isExternal] - Whether the variable is from an external file.
 * @param {string} [options.filePath] - Source path, used when `isExternal` is true.
 * @returns {object} - Structured metadata about the variable.
 *
 * @example
 * {
 *   value: 'var(--color-primary)',
 *   isExternal: true,
 *   start: { line: 5, column: 3 },
 *   end: { line: 5, column: 42 },
 *   src: '/path/to/external.css'
 * }
 */
export function getVarData(node, { isExternal = false, filePath = null } = {}) {
  const value = node.value;

  const data = {
    value,
    isExternal,
    start: node.source.start,
    end: node.source.end,
  };

  if (isExternal && filePath) {
    data.src = filePath;
  }

  return data;
}
