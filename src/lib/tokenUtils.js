import config from '../../config.js';

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
 * Returns true if the value contains any configured design token key.
 *
 * @param {string} value - The CSS value to inspect.
 * @returns {boolean} - true if a design token key is found in the value.
 */
export function containsDesignTokenValue(value) {
  return config.designTokenKeys.some((token) => value?.includes(token));
}

/**
 * Returns true if the value matches any excluded CSS value or pattern.
 * This includes exact string matches or RegExp patterns like 'inherit', 'unset', etc.
 *
 * @param {string} value - The CSS value to test.
 * @returns {boolean} - true if the value is considered excluded.
 */
export function containsExcludedValue(value) {
  return config.excludedCSSValues.some((item) =>
    item instanceof RegExp ? item.test(value) : value === String(item),
  );
}

/**
 * Returns true if the property is in the configured list of analyzable properties.
 * These include CSS props like `color`, `background-color`, etc.
 *
 * @param {string} prop - The CSS property name.
 * @returns {boolean} - true if the property should be token-analyzed.
 */
export function isTokenizableProperty(prop) {
  return config.designTokenProperties.includes(prop);
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

  /**
   * Extract all CSS custom property identifiers (e.g. `--color-accent-primary`)
   * referenced within a CSS value string. This uses `getCSSVariables` to return
   * every `var(--foo)` occurrence in order, preserving duplicates.
   *
   * @param {string} text - The raw CSS value string to scan for variable references.
   * @returns {string[]} An array of CSS variable identifiers (e.g. `['--foo', '--bar']`);
   * returns an empty array if no variables are found or if input is not a string.
   */
  function varsFromCSSValue(text) {
    if (typeof text !== 'string' || text.length === 0) {
      return [];
    }
    const vars = getCSSVariables(text);
    return Array.isArray(vars) ? vars.slice() : [];
  }

  // 1) Authored value: collect all vars and build an occurrence map.
  const authoredVars = varsFromCSSValue(authoredValue);
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

      const traceVars = varsFromCSSValue(s);
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
