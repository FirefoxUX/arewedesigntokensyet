import { parseCSS } from './cssParser.js';
import {
  isVariableDefinition,
  isWithinValidParentSelector,
} from './tokenUtils.js';
import {
  containsDesignTokenValue,
  containsExcludedValue,
} from './tokenUtils.js';

/**
 * Extracts CSS variable definitions from a file and marks them as external.
 *
 * @param {string} filePath - The absolute path to the external CSS file.
 * @returns {Promise<Object>} - Map of variable name to metadata.
 */
export async function getExternalVars(filePath) {
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
 * Constructs metadata for a CSS variable node.
 *
 * @param {import('postcss').Declaration} node - The PostCSS declaration node.
 * @param {{ isExternal: boolean, filePath?: string }} options
 * @returns {Object} - Metadata about the variable's value.
 */
export function getVarData(node, { isExternal = false, filePath = null } = {}) {
  const value = node.value;
  const containsDesignToken = containsDesignTokenValue(value);
  const containsExcluded = containsExcludedValue(value);

  const data = {
    value,
    containsDesignToken,
    containsExcludedValue: containsExcluded,
    isIndirectRef: true,
    isExternal,
    start: node.source.start,
    end: node.source.end,
  };

  if (isExternal && filePath) {
    data.src = filePath;
  }

  return data;
}
