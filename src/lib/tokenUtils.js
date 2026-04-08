import config from '../../config.js';
import { memoize } from './memoize.js';
import { propertyConfig } from '../vendor/firefox/tools/lint/stylelint/stylelint-plugin-mozilla/config.mjs';
import { isSystemColor } from '../vendor/firefox/tools/lint/stylelint/stylelint-plugin-mozilla/helpers.mjs';
import { PropertyValidator } from '../vendor/firefox/tools/lint/stylelint/stylelint-plugin-mozilla/property-validator.mjs';
import { tokensTable } from '../vendor/firefox/toolkit/themes/shared/design-system/dist/semantic-categories.mjs';

import valueParser from 'postcss-value-parser';

/**
 * Returns true if the property is a CSS custom property (e.g. starts with `--`).
 *
 * @param {string} prop - The CSS property name.
 * @returns {boolean} - true if it is a variable definition.
 */
export function isVariableDefinition(prop) {
  return !!prop?.startsWith?.('--');
}

/**
 * Determines whether a CSS variable name matches any known design token prefix.
 *
 * @param {string} tokenName - The name of the variable (e.g. "--color-text").
 * @returns {boolean} - true if the name contains a design token key.
 */
export function isDesignToken(tokenName) {
  return config.allTokens.includes(tokenName);
}

/**
 * Returns true if the value contains a valid canonical design token for the property.
 *
 * @param {string} prop - The CSS property to inspect.
 * @param {string} value - The CSS value to inspect.
 * @returns {boolean} - true if a design token key is found in the value.
 */
function __containsValidDesignToken(prop, value) {
  const propConfig = propertyConfig[prop];
  if (!propConfig) {
    return false;
  }

  // This is the canonical set of tokens for the prop, which is needed
  // as the stylelint rules add some overrides to the list of validTokenNames
  // but we want to stick to canonical tokens for this check.
  const validCanonicalTokenNames = new Set(
    propConfig.validTypes.flatMap((propType) => [
      ...(propType.tokenTypes || []).flatMap((tokenType) =>
        tokensTable[tokenType].map((token) => token.name),
      ),
      ...(propType.aliasTokenTypes || []).flatMap((tokenType) =>
        tokensTable[tokenType].map((token) => token.name),
      ),
    ]),
  );

  const parsedValue = valueParser(value);
  let found = false;

  parsedValue.walk((node) => {
    if (found) {
      return false;
    }

    if (node.type === 'function' && node.value === 'var') {
      const [varNameNode] = node.nodes;
      const varName = varNameNode.value;

      if (validCanonicalTokenNames.has(varName)) {
        found = true;
        return false;
      }
    }

    return undefined;
  });

  return found;
}

export const containsValidDesignToken = memoize(__containsValidDesignToken);

/**
 * Returns the referenced custom property name if the value is a simple
 * `var(--foo)` expression, otherwise returns null.
 *
 * This is used to detect direct alias relationships between custom properties,
 * ignoring more complex expressions like `calc(...)` or multiple values.
 *
 * @param {string} value
 * @returns {string|null}
 */
function getSingleVarReference(value) {
  const nodes = valueParser(value).nodes.filter((n) => n.type !== 'space');

  if (nodes.length !== 1) {
    return null;
  }

  const node = nodes[0];
  if (node.type !== 'function' || node.value !== 'var') {
    return null;
  }

  const [varNameNode] = node.nodes;
  return varNameNode?.value?.startsWith('--') ? varNameNode.value : null;
}

/**
 * Removes custom properties that participate in cyclic alias relationships.
 *
 * A cyclic alias is a chain of custom properties that ultimately reference
 * each other, for example:
 *
 *   --a: var(--b);
 *   --b: var(--a);
 *
 * These cycles can cause infinite recursion when resolving values. This
 * function detects such cycles (including longer chains) and excludes all
 * properties involved in them from the returned object.
 *
 * Only simple alias relationships of the form `var(--foo)` are considered.
 * More complex expressions are ignored.
 *
 * @param {object} localCustomProperties
 * @returns {object}
 */
function removeCyclicVarAliases(localCustomProperties) {
  const aliases = new Map();

  for (const [name, value] of Object.entries(localCustomProperties)) {
    const ref = getSingleVarReference(value);
    if (ref && Object.hasOwn(localCustomProperties, ref)) {
      aliases.set(name, ref);
    }
  }

  const cyclic = new Set();

  for (const start of aliases.keys()) {
    const path = [];
    const seen = new Map();
    let current = start;

    while (aliases.has(current)) {
      if (seen.has(current)) {
        const cycleStart = seen.get(current);
        for (const name of path.slice(cycleStart)) {
          cyclic.add(name);
        }
        cyclic.add(current);
        break;
      }

      seen.set(current, path.length);
      path.push(current);
      current = aliases.get(current);
    }
  }

  return Object.fromEntries(
    Object.entries(localCustomProperties).filter(([name]) => !cyclic.has(name)),
  );
}

/**
 * Determine whether a CSS property value is valid according to the configured
 * design token rules for a given property.
 *
 * This validates the value by parsing it with `postcss-value-parser` and
 * delegating each node to the property's `PropertyValidator`. Validation
 * includes support for:
 * - canonical design tokens
 * - alias tokens (when allowed by the validator)
 * - locally defined custom properties (via `localCustomProperties`)
 *
 * @param {string} prop - The CSS property name (e.g. "background-color").
 * @param {string} value - The raw CSS value to validate.
 * @param {object} localCustomProperties - A map of locally defined CSS (defaults to an empty object)
 * custom properties (e.g. `{ '--foo': 'var(--bar)' }`) used for resolving
 * `var()` references during validation.
 * @returns {boolean} `true` if every parsed node in the value is considered
 * valid for the given property, otherwise `false`.
 */
export function isValidPropertyValue(prop, value, localCustomProperties = {}) {
  const isToken = containsValidDesignToken(prop, value);
  if (isToken) {
    return true;
  }

  const propConfig = propertyConfig[prop];
  if (!propConfig) {
    return false;
  }

  if (!propConfig.validator) {
    propConfig.validator = new PropertyValidator(propConfig);
  }

  const parsedValue = valueParser(value);
  const isValid = propConfig.validator.isValidPropertyValue(
    parsedValue,
    removeCyclicVarAliases(localCustomProperties),
  );

  if (!isValid) {
    return propConfig.validator.warnSystemColors && isSystemColor(value);
  }

  return isValid;
}

/**
 * Returns true if the property is in the configured list of analyzable properties.
 * These include CSS props like `color`, `background-color`, etc.
 *
 * @param {string} prop - The CSS property name.
 * @returns {boolean} - true if the property should be token-analyzed.
 */
export function isTokenizableProperty(prop) {
  return !!propertyConfig?.[prop];
}

/**
 * Extracts all CSS custom property references from a value.
 * Supports multiple nested references like `var(--a, var(--b))` → ['--a', '--b'].
 *
 * @param {string} value - The CSS value to search.
 * @returns {string[]} - An array of custom property names found.
 *
 * @example
 * getCSSVariables('var(--a, var(--b))') // ['--a', '--b']
 */
export function getCSSVariables(value) {
  const variables = [];
  let match;
  const varRegex = /var\(\s*(--[\w-]+)/g;

  while ((match = varRegex.exec(value)) !== null) {
    variables.push(match[1]);
  }

  return variables;
}

/**
 * Determines if a variable definition is in a valid scope.
 *
 * Valid selectors are `:root` and `:host` (optionally comma-separated).
 *
 * @param {import('postcss').Declaration} node - A PostCSS declaration node.
 * @returns {boolean} - true if the declaration is inside a valid selector.
 */
export function isWithinValidParentSelector(node) {
  const parent = node.parent;
  const selectorRegex = /^(?::root$|:host$)/i;

  return (
    parent?.type === 'rule' &&
    parent.selector.split(',').some((sel) => selectorRegex.test(sel.trim()))
  );
}

/**
 * Return all design-token ids used in a declaration's authored value or resolution trace.
 * Order is first appearance across authored value then trace. Duplicates are preserved.
 *
 * Trace model:
 * - resolutionTrace is a list of strings. The first item typically echoes the authored value.
 * - Later strings may include var(--alias) and/or var(--canonical-token) and other functions.
 *
 * Behavior:
 * - Parse authored value with getCSSVariables to preserve duplicate var mentions and build an alias-occurrence map.
 * - Skip trace strings that exactly equal the authored value (trimmed) to avoid echoing.
 * - For each non-echo trace string:
 *   • Extract all var(...) ids with getCSSVariables.
 *   • Partition into canonical tokens (in tokenKeySet) and aliases (not in tokenKeySet).
 *   • Let multiplier = max(authoredCounts[alias]) among aliases present in this trace step, else 1.
 *   • Push each canonical token multiplier times.
 *
 * @param {{ value?: string, resolutionTrace?: Array<string> }} decl
 * @param {Set<string>} tokenKeySet
 * @returns {string[]}
 */
export function extractDesignTokenIdsFromDecl(decl, tokenKeySet) {
  /** @type {string[]} */

  const out = [];
  if (!decl || !tokenKeySet || tokenKeySet.size === 0) {
    return out;
  }

  const authoredValue = typeof decl.value === 'string' ? decl.value : '';
  const authoredTrim = authoredValue.trim();

  // 1) Authored value: collect all vars and build an occurrence map.
  const authoredVars = getCSSVariables(authoredValue);
  /** @type {Record<string, number>} */
  const authoredCounts = {};
  for (const v of authoredVars) {
    authoredCounts[v] = (authoredCounts[v] || 0) + 1;
  }
  // Push authored occurrences that are canonical token ids (duplicates preserved).
  for (const v of authoredVars) {
    if (tokenKeySet.has(v)) {
      out.push(v);
    }
  }

  // 2) Walk resolutionTrace (skip pure echo of authored value).
  if (Array.isArray(decl.resolutionTrace)) {
    for (const step of decl.resolutionTrace) {
      if (typeof step !== 'string') {
        continue;
      }
      const s = step.trim();
      if (s === authoredTrim) {
        continue;
      }

      const traceVars = getCSSVariables(s);
      if (traceVars.length === 0) {
        continue;
      }

      // Partition into canonical and alias vars for this step.
      const canonical = [];
      const aliases = [];
      for (const id of traceVars) {
        if (tokenKeySet.has(id)) {
          canonical.push(id);
        } else {
          aliases.push(id);
        }
      }
      if (canonical.length === 0) {
        continue;
      }

      // Multiplier equals the highest occurrence count among authored aliases
      // present in this trace step. If none, multiplier = 1.
      let multiplier = 1;
      for (const a of aliases) {
        const count = authoredCounts[a] || 0;
        if (count > multiplier) {
          multiplier = count;
        }
      }

      for (const tok of canonical) {
        for (let i = 0; i < multiplier; i += 1) {
          out.push(tok);
        }
      }
    }
  }

  return out;
}
