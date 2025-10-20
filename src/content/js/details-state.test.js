// @vitest-environment jsdom
/* global Event, PopStateEvent, document, window, location, URLSearchParams, history */

import {
  OPEN_PARAM,
  initDetailsURLState,
  applyDetailsState,
} from './details-state.js';

describe('details-state.js', () => {
  let mod;

  // Utilities
  function setSearch(search) {
    const qs = search.startsWith('?') ? search : `?${search}`;
    const url = `${window.location.pathname}${qs}`;
    window.history.replaceState(null, '', url);
  }

  function getSearch() {
    return window.location.search;
  }

  function createDetails(root, key, open = false) {
    const d = root.ownerDocument.createElement('details');
    d.setAttribute('data-details-key', key);
    if (open) {
      d.setAttribute('open', '');
      d.open = true;
    }
    root.appendChild(d);
    return d;
  }

  beforeEach(async () => {
    // Disable auto-init before importing the module under test
    window.__AWDT_DISABLE_AUTO_INIT__ = true;

    // Reset URL to a clean state
    window.history.replaceState(null, '', '/test');

    // Fresh DOM root
    document.body.innerHTML = '<div id="root"></div>';

    // Dynamic import after guard is set
    mod = await import('./details-state.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('__internals.parseOpenSet', () => {
    test('returns empty set when param is missing', () => {
      setSearch('');
      const { parseOpenSet } = mod.__internals;
      const set = parseOpenSet();
      expect(set instanceof Set).toBe(true);
      expect(set.size).toBe(0);
    });

    test('parses comma-separated values and decodes them', () => {
      setSearch('o=alpha,beta,gamma%2Fdelta');
      const { parseOpenSet } = mod.__internals;
      const set = parseOpenSet();
      expect(set.has('alpha')).toBe(true);
      expect(set.has('beta')).toBe(true);
      expect(set.has('gamma/delta')).toBe(true);
      expect(set.size).toBe(3);
    });

    test('ignores empty items', () => {
      setSearch('o=alpha,,beta,');
      const { parseOpenSet } = mod.__internals;
      const set = parseOpenSet();
      expect(set.has('alpha')).toBe(true);
      expect(set.has('beta')).toBe(true);
      expect(set.size).toBe(2);
    });
  });

  describe('__internals.writeOpenSet', () => {
    test('writes o param with encoded, comma-separated values', () => {
      const { writeOpenSet } = mod.__internals;
      const s = new Set(['a', 'b/c', 'd e']);
      writeOpenSet(s);
      // URLSearchParams will encode commas, slashes, and spaces
      expect(getSearch()).toBe('?o=a%2Cb%2Fc%2Cd+e');
    });

    test(`removes ${OPEN_PARAM} param when set is empty`, () => {
      const { writeOpenSet } = mod.__internals;
      setSearch(`${OPEN_PARAM}=alpha,beta`);
      writeOpenSet(new Set());
      expect(getSearch()).toBe('');
    });

    test('uses replaceState when opts.replace is true', () => {
      const { writeOpenSet } = mod.__internals;
      const spyPush = vi.spyOn(window.history, 'pushState');
      const spyReplace = vi.spyOn(window.history, 'replaceState');
      writeOpenSet(new Set(['x']), { replace: true });
      expect(spyReplace).toHaveBeenCalled();
      expect(spyPush).not.toHaveBeenCalled();
      spyPush.mockRestore();
      spyReplace.mockRestore();
    });
  });

  describe('applyDetailsState', () => {
    test(`opens and closes details based on URL ${OPEN_PARAM} param`, () => {
      const root = document.getElementById('root');
      if (!root) {
        throw new Error('missing #root');
      }
      const d1 = createDetails(root, 'alpha');
      const d2 = createDetails(root, 'beta', true);
      setSearch(`${OPEN_PARAM}=alpha`);

      mod.applyDetailsState(document);
      expect(d1.open).toBe(true);
      expect(d2.open).toBe(false);
    });

    test('does nothing if details have no data-details-key', () => {
      const root = document.getElementById('root');
      if (!root) {
        throw new Error('missing #root');
      }
      const d = document.createElement('details');
      root.appendChild(d);
      setSearch(`${OPEN_PARAM}=alpha`);
      mod.applyDetailsState(document);
      expect(d.open).toBe(false);
    });
  });

  describe('initDetailsURLState', () => {
    test('toggle adds and removes keys, updating URL', () => {
      const root = document.getElementById('root');
      if (!root) {
        throw new Error('missing #root');
      }

      setSearch('');
      const d = createDetails(root, 'alpha', false);

      mod.initDetailsURLState(document);

      d.open = true;
      d.dispatchEvent(new Event('toggle', { bubbles: true }));
      expect(getSearch()).toBe(`?${OPEN_PARAM}=alpha`);

      d.open = false;
      d.dispatchEvent(new Event('toggle', { bubbles: true }));
      expect(getSearch()).toBe('');
    });

    test('applies state on load and on popstate', () => {
      const root = document.getElementById('root');
      if (!root) {
        throw new Error('missing #root');
      }
      const a = createDetails(root, 'alpha', false);
      const b = createDetails(root, 'beta', false);

      setSearch('o=beta');
      mod.initDetailsURLState(document);
      expect(a.open).toBe(false);
      expect(b.open).toBe(true);

      setSearch('o=alpha');
      window.dispatchEvent(new PopStateEvent('popstate'));
      expect(a.open).toBe(true);
      expect(b.open).toBe(false);
    });

    test('ignores toggle events from non-<details> targets', () => {
      const root = document.getElementById('root');
      if (!root) {
        throw new Error('missing #root');
      }
      setSearch('');
      mod.initDetailsURLState(document);
      const div = document.createElement('div');
      root.appendChild(div);
      div.dispatchEvent(new Event('toggle', { bubbles: true }));
      expect(getSearch()).toBe('');
    });
  });
});

function makeDetails(keys) {
  for (const k of keys) {
    const d = document.createElement('details');
    d.setAttribute('data-details-key', k);
    document.body.appendChild(d);
  }
}

function setURL(pathAndQuery = '/') {
  history.replaceState({}, '', pathAndQuery);
}

describe('details-state handling of malformed content', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  beforeEach(() => {
    setURL('/stats/tokens/?o=a,b,c');
  });

  test('writes state via URLSearchParams', () => {
    // Sanity: calling init should not explode and should attach listeners.
    initDetailsURLState(document);

    // Simulate user toggling a details with a normal key.
    const d = document.createElement('details');
    d.setAttribute('data-details-key', 'safe');
    document.body.appendChild(d);

    const evt = new Event('toggle', { bubbles: true });
    d.open = true;
    d.dispatchEvent(evt);

    // Ensure query lacks raw XSS chars
    expect(location.search).toContain('a%2Cb%2Cc%2Csafe');
    expect(location.search).not.toMatch(/[<>"']/);
  });

  test('applies open state only for matching keys, ignores unknown and hostile', () => {
    // URL contains safe keys, unknown keys, and hostile junk
    const hostileBits = [
      '<svg onload=alert(1)>',
      'javascript:alert(1)',
      '%3Cscript%3Ealert(1)%3C/script%3E',
    ];
    const qs = new URLSearchParams();
    qs.set(
      OPEN_PARAM,
      ['k1', 'k2', 'k-does-not-exist', ...hostileBits].join(','),
    );
    setURL(`/stats/tokens/?${qs.toString()}`);

    makeDetails(['k1', 'k2', 'k3']); // only k1, k2 exist
    applyDetailsState(document);

    const byKey = (k) =>
      document.querySelector(`details[data-details-key="${k}"]`);
    expect(byKey('k1')?.open).toBe(true);
    expect(byKey('k2')?.open).toBe(true);
    // Not in DOM, should not magically appear or be opened
    expect(byKey('k-does-not-exist')).toBeNull();
    // Hostile inputs should never create DOM
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('svg')).toBeNull();
    // k3 exists but was not requested, stays closed
    expect(byKey('k3')?.open).toBe(false);
  });

  test('open param round-trip keeps values intact, not raw-encoded in URL', () => {
    setURL('/stats/tokens/');
    initDetailsURLState(document);

    const det = document.createElement('details');
    det.setAttribute('data-details-key', 'alpha,beta,<bad>'); // comma inside key should be treated safely
    document.body.appendChild(det);

    det.open = true;
    det.dispatchEvent(new Event('toggle', { bubbles: true }));

    expect(location.search).toContain('alpha%2Cbeta%2C%3Cbad%3E');
    expect(location.search).not.toMatch(/[<>"']/);
  });
});
