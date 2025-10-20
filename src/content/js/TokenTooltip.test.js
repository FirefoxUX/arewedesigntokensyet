// @vitest-environment jsdom
/* global document */

import {
  createMockTrigger,
  createTooltipInstance,
  showTooltip,
} from '../../../testing/testUtils';

/**
 * Creates a <token-tooltip> with props and adds it to the DOM.
 * @param {object} options - Tooltip attributes.
 * @returns {TokenTooltip}
 */
function setupTooltip(options = {}) {
  return createTooltipInstance({
    status: 'good',
    trace: [],
    tokens: [],
    source: [],
    unresolved: [],
    ...options,
  });
}

describe('<token-tooltip>', () => {
  let tooltip;

  afterEach(() => {
    tooltip?.remove();
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

function getRoot(el) {
  return el.shadowRoot ?? el;
}

describe('token tooltip handling of hostile content', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('hostile values in tokens, trace, source, unresolved do not inject DOM', async () => {
    const tip = document.createElement('token-tooltip');
    document.body.appendChild(tip);

    // Pack hostile strings into every public property that is rendered.
    tip.status = 'good';
    tip.tokens = [
      '<img src=x onerror="alert(1)">',
      '<script>alert(1)</script>',
      'javascript:alert(3)',
    ];
    tip.trace = ['var(--ok)', '<script>alert(2)</script>', '12px'];
    tip.source = ['/safe.css', 'javascript:alert(4)', '<svg onload=alert(5)>'];
    tip.unresolved = ['--bad" onmouseover="pwned"', '<img src=x>'];

    // Wait until Lit has rendered something
    await vi.waitFor(() => {
      const root = getRoot(tip);
      expect(root.innerHTML.length).toBeGreaterThan(0);
    });

    const root = getRoot(tip);

    // Check no executable nodes were created anywhere
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('svg')).toBeNull();

    // Check links are present but never use javascript: URLs
    const links = Array.from(root.querySelectorAll('a'));
    for (const a of links) {
      const href = (a.getAttribute('href') || '').trim().toLowerCase();
      expect(href.startsWith('javascript:')).toBe(false);
    }

    // Check rendered code text is escaped, not raw HTML
    // Focus on summary <code> nodes produced by tokens/trace lists.
    const codeSnippets = Array.from(root.querySelectorAll('code')).map(
      (c) => c.innerHTML,
    );
    // At least one <script and one <img appear as text, escaped
    expect(codeSnippets.some((html) => html.includes('&lt;script'))).toBe(true);
    expect(codeSnippets.some((html) => html.includes('&lt;img'))).toBe(true);
    // And there are no raw tags inside those code nodes
    expect(codeSnippets.some((html) => html.includes('<script'))).toBe(false);
    expect(codeSnippets.some((html) => html.includes('<img'))).toBe(false);

    // Check attribute-injection attempts stayed inside data/text, not as real attributes
    const anyInjectedHandler = Array.from(root.querySelectorAll('*')).some(
      (el) => {
        return Array.from(el.attributes).some((a) => a.name.startsWith('on'));
      },
    );
    expect(anyInjectedHandler).toBe(false);

    // Check status attribute is a plain value, proving normal rendering still works
    const statusEl = root.querySelector('.status');
    expect(statusEl?.getAttribute('data-status')).toBe('good');
  });
});
