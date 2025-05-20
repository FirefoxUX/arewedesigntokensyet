import config from '../../config.js';

/**
 * Returns true if the property is a custom property (CSS variable).
 */
export function isVariableDefinition(prop) {
  return !!prop?.startsWith?.('--');
}

/**
 * Returns true if the value contains any configured design token key.
 */
export function containsDesignTokenValue(value) {
  return config.designTokenKeys.some((token) => value?.includes(token));
}

/**
 * Returns true if the value is excluded (e.g., `inherit`, `unset`, or matching regex).
 */
export function containsExcludedValue(value) {
  return config.excludedCSSValues.some((item) =>
    item instanceof RegExp ? item.test(value) : value === String(item),
  );
}

/**
 * Returns true if the property name is one we want to analyze for tokens.
 */
export function isTokenizableProperty(prop) {
  return config.designTokenProperties.includes(prop);
}

/**
 * Extracts all CSS custom property references in a value.
 * e.g. var(--a) or var(--a, var(--b)) returns ['--a', '--b']
 */
const varRegex = /var\(\s*(--[\w-]+)/g;
export function getCSSVariables(value = '') {
  const variables = [];
  let match;

  while ((match = varRegex.exec(value)) !== null) {
    variables.push(match[1]);
  }

  return variables;
}

/**
 * Checks if the rule node is defined within a valid selector like :root or :host.
 */
const selectorRegex = /^(?::root$|:host$)/i;
export function isWithinValidParentSelector(node) {
  const parent = node.parent;

  return (
    parent?.type === 'rule' &&
    parent.selector.split(',').some((sel) => selectorRegex.test(sel.trim()))
  );
}
