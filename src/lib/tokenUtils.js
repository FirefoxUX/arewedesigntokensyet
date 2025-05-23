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
