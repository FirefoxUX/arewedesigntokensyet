/* globals document */

import '../src/components/TokenTooltip.js';

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

export function createTooltipInstance() {
  const tooltip = document.createElement('token-tooltip');
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  return tooltip;
}

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
