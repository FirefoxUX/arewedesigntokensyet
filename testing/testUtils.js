/* globals document */

import '../src/components/TokenTooltip.js';

/**
 * Creates a mock HTML element to simulate a design token target for tooltip testing.
 *
 * The element is positioned using a mocked `getBoundingClientRect()` and
 * populated with `data-*` attributes to mimic real analysis output.
 *
 * @param {object} options - Configuration for the mock element.
 * @param {'good' | 'warn' | 'bad'} options.status - Tooltip status type.
 * @param {string[]} options.trace - Trace values used in the tooltip.
 * @param {string[]} options.tokens - Tokens used in the value.
 * @param {string[]} options.source - Source files.
 * @param {string[]} options.unresolved - Unresolved variable references.
 * @param {number} options.top - Top coordinate for layout simulation.
 * @param {number} options.left - Left coordinate for layout simulation.
 * @returns {HTMLElement} - The mock trigger element, appended to `document.body`.
 */
export function createMockTrigger({
  status = 'good',
  trace = ['var(--a)', '#fff'],
  tokens = ['--a'],
  source = ['tokens.css'],
  unresolved = [],
  top = 100,
  left = 100,
} = {}) {
  const el = document.createElement('span');
  el.className = 'mock-token';
  el.dataset.status = status;
  el.dataset.trace = JSON.stringify(trace);
  el.dataset.tokens = JSON.stringify(tokens);
  el.dataset.source = JSON.stringify(source);
  el.dataset.unresolved = JSON.stringify(unresolved);

  // Mock getBoundingClientRect to control position
  el.getBoundingClientRect = () => ({
    top,
    left,
    bottom: top + 20,
    right: left + 100,
    width: 100,
    height: 20,
  });

  document.body.appendChild(el);
  return el;
}

/**
 * Creates and appends a `<token-tooltip>` element with optional initial properties.
 *
 * @param {Partial<HTMLElement>} props - Properties to assign to the tooltip.
 * @returns {HTMLElement} - A configured tooltip element.
 */
export function createTooltipInstance(props = { hidden: true }) {
  const tooltip = document.createElement('token-tooltip');
  Object.assign(tooltip, props);
  document.body.appendChild(tooltip);
  return tooltip;
}

/**
 * Populates a tooltip with data from a trigger element and positions it on the page.
 *
 * This simulates how the real system injects and activates a `<token-tooltip>`.
 *
 * @param {HTMLElement} triggerEl - The element with `data-*` attributes for the tooltip.
 * @param {HTMLElement} tooltip - The `<token-tooltip>` instance to populate and show.
 * @returns {void}
 */
export function showTooltip(triggerEl, tooltip) {
  const scrollY = 0;
  const scrollX = 0;
  const rect = triggerEl.getBoundingClientRect();

  tooltip.status = triggerEl.dataset.status || 'bad';
  tooltip.trace = JSON.parse(triggerEl.dataset.trace || '[]');
  tooltip.tokens = JSON.parse(triggerEl.dataset.tokens || '[]');
  tooltip.source = JSON.parse(triggerEl.dataset.source || '[]');
  tooltip.unresolved = JSON.parse(triggerEl.dataset.unresolved || '[]');

  tooltip.hidden = false;
  tooltip.pinned = false;

  tooltip.style.top = `${rect.bottom + scrollY + 6}px`;
  tooltip.style.left = `${rect.left + scrollX}px`;
}
