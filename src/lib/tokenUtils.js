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
 * Determine whether a CSS declaration should be excluded based on a set of rules.
 *
 * Each rule describes one or more property–value pairs that should be ignored.
 * Matching proceeds as follows:
 * - The rule applies if its `property` matches the declaration’s property name,
 *   or if `property` is the wildcard `"*"`, which matches any property.
 * - The rule’s `values` array is then tested against the declaration’s value:
 *   - String patterns are compared case-insensitively.
 *   - Strings prefixed with `!` represent negation, meaning that if the value matches,
 *     the declaration is explicitly **not excluded**, and later rules are ignored.
 *   - RegExp patterns are tested as-is.
 * - The first matching rule determines the result:
 *   - A normal (non-negated) match returns `true` (excluded).
 *   - A negated match (`!value`) returns `false` (not excluded), overriding later matches.
 *
 * Throws an error if:
 * - `decl` is not a PostCSS Declaration or an object with `prop` and `value` strings.
 * - `rules` is not a non-empty array.
 * - Any rule object is malformed.
 *
 * @param {import('postcss').Declaration | { prop: string, value: string }} decl
 *   The CSS declaration to test. Must include string `prop` and `value` keys.
 * @param {Array<{ property: string, values: Array<string|RegExp> }>} rules
 *   List of exclusion rules. Each rule defines a `property` and matching `values`.
 * @returns {boolean}
 *   Returns `true` if the declaration matches any exclusion rule, or `false` if none apply
 *   or if a negated match explicitly cancels exclusion.
 * @throws {Error}
 *   If input arguments or rule shapes are invalid.
 */
export function isExcludedDeclaration(
  decl,
  rules = config.excludedDeclarations,
) {
  if (
    !decl ||
    typeof decl.prop !== 'string' ||
    typeof decl.value !== 'string'
  ) {
    throw new Error(
      'Invalid declaration: expected a PostCSS Declaration or { prop: string, value: string }.',
    );
  }

  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error('rules not provided');
  }

  const prop = decl.prop.trim();
  const value = decl.value.trim();

  for (const rule of rules) {
    if (
      !rule ||
      !Array.isArray(rule.values) ||
      typeof rule.property !== 'string'
    ) {
      throw new Error(`invalid exclusion rule ${rule}`);
    }

    // Property match: '*' wildcard or exact property provided.
    const propertyMatches =
      rule.property === '*' ? true : rule.property === prop;

    if (!propertyMatches) {
      continue;
    }

    // Value match: case-insensitive string check or RegExp.test
    for (const pattern of rule.values) {
      if (typeof pattern === 'string') {
        let patternLower = pattern.toLowerCase();
        let valueLower = value.toLowerCase();
        if (valueLower === patternLower) {
          return true;
          // Support simple negation.
        } else if (`!${valueLower}` === patternLower) {
          return false;
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(value)) {
          return true;
        }
      }
    }
  }
  return false;
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
