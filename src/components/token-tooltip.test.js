/**
 * @jest-environment jsdom
 */

/* globals document */

// eslint-disable-next-line no-unused-vars
import { TokenTooltip } from './token-tooltip.js';
import {
  createMockTrigger,
  createTooltipInstance,
  showTooltip,
} from '../../tests/helpers/tooltipControllerTestUtils';

function setupTooltip({
  status = 'good',
  trace = [],
  tokens = [],
  source = [],
  unresolved = [],
} = {}) {
  const tooltip = document.createElement('token-tooltip');
  tooltip.status = status;
  tooltip.trace = trace;
  tooltip.tokens = tokens;
  tooltip.source = source;
  tooltip.unresolved = unresolved;

  document.body.appendChild(tooltip);
  return tooltip;
}

function teardownTooltip(tooltip) {
  tooltip?.remove();
}

describe('<token-tooltip>', () => {
  let tooltip;

  afterEach(() => {
    teardownTooltip(tooltip);
  });

  test('renders trace and tokens correctly', async () => {
    tooltip = setupTooltip({
      status: 'good',
      trace: ['var(--a)', 'var(--b)', '1rem'],
      tokens: ['--a', '--b'],
    });

    await tooltip.updateComplete;

    expect(tooltip.shadowRoot.textContent).toContain('Design Tokens Used');
    expect(tooltip.shadowRoot.textContent).toContain('--a');
    expect(tooltip.shadowRoot.textContent).toContain('Trace');
    expect(tooltip.shadowRoot.textContent).toContain('1rem');
  });

  test('does not render trace if only one step', async () => {
    tooltip = setupTooltip({ trace: ['12px'] });
    await tooltip.updateComplete;
    expect(tooltip.shadowRoot.textContent).not.toContain('Trace');
  });

  test('renders unresolved section when present', async () => {
    tooltip = setupTooltip({ unresolved: ['--bad-ref'] });
    await tooltip.updateComplete;
    expect(tooltip.shadowRoot.textContent).toContain('--bad-ref');
  });
});

describe('tooltip controller integration', () => {
  let triggerEl, tooltip;

  afterEach(() => {
    triggerEl?.remove();
    tooltip?.remove();
  });

  test('populates tooltip from data attributes', async () => {
    triggerEl = createMockTrigger({
      status: 'good',
      trace: ['var(--a)', '12px'],
      tokens: ['--a'],
      source: ['tokens/base.css'],
      unresolved: ['--b'],
    });

    tooltip = createTooltipInstance();
    showTooltip(triggerEl, tooltip);
    await tooltip.updateComplete;

    expect(tooltip.status).toBe('good');
    expect(tooltip.trace).toEqual(['var(--a)', '12px']);
    expect(tooltip.tokens).toEqual(['--a']);
    expect(tooltip.source).toEqual(['tokens/base.css']);
    expect(tooltip.unresolved).toEqual(['--b']);
    expect(tooltip.hidden).toBe(false);
  });
});
