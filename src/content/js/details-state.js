/* global URLSearchParams, window, document, history, HTMLDetailsElement */

// Persist <details> state to the URL as ?open=key1,key2,... (URL-encoded)
export const OPEN_PARAM = 'o';

/**
 * Parses the current URL query string to extract a set of open item identifiers.
 *
 * @returns {Set<string>} A set of identifiers representing open items.
 */
function parseOpenSet() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(OPEN_PARAM);
  if (!raw) {
    return new Set();
  }
  // Filter out empty params from the list after splitting on the comma.
  return new Set(raw.split(',').filter(Boolean));
}

/**
 * Updates the browser URL to reflect the current set of open item identifiers.
 *
 * Encodes the provided set as a comma-separated list under the `OPEN_PARAM` query parameter.
 * If the set is empty, the parameter is removed. The updated state is written to
 * the browser history using either `pushState` or `replaceState`.
 *
 * @param {Set<string>} set - A set of identifiers representing open items.
 * @param {object} [opts] - Optional configuration.
 * @param {boolean} opts.replace - When true, replaces the current history entry instead of pushing a new one.
 * @returns {void}
 */
function writeOpenSet(set, opts = {}) {
  const params = new URLSearchParams(window.location.search);

  if (set.size) {
    // URLSearchParams will handle encoding automatically
    params.set(OPEN_PARAM, Array.from(set).join(','));
  } else {
    params.delete(OPEN_PARAM);
  }

  const qs = params.toString();
  const url = qs
    ? `${window.location.pathname}?${qs}`
    : window.location.pathname;

  if (opts.replace) {
    history.replaceState(null, '', url);
  } else {
    history.pushState(null, '', url);
  }
}

/**
 * Restores the open or closed state of all <details> elements based on the URL query parameter.
 *
 * Uses {@link parseOpenSet} to determine which details keys should be open, then updates
 * all matching `<details data-details-key>` elements within the specified root.
 *
 * @param {Document|HTMLElement} root - The root node to search within. Defaults to the current document.
 * @returns {void}
 */
export function applyDetailsState(root = document) {
  const openSet = parseOpenSet();
  const nodes = root.querySelectorAll('details[data-details-key]');
  for (const d of nodes) {
    const k = d.getAttribute('data-details-key');
    if (!k) {
      continue;
    }
    d.open = openSet.has(k);
  }
}

/**
 * Initializes synchronization between <details> element states and the URL query parameter.
 *
 * Sets up listeners to track open/close toggles on <details data-details-key> elements,
 * updating the URL accordingly via {@link writeOpenSet}. Also restores the correct
 * open state on initial load and whenever the user navigates with the browser’s
 * back or forward buttons.
 *
 * @param {Document|HTMLElement} root - The root node to apply state updates within. Defaults to the current document.
 * @returns {void}
 */
export function initDetailsURLState(root = document) {
  const openSet = parseOpenSet();

  /**
   * Handles <details> toggle events and updates the URL to reflect the current open state.
   *
   * When a <details data-details-key> element is opened or closed, the corresponding
   * key is added to or removed from the open set, then {@link writeOpenSet} is called
   * to persist the change in the query string.
   *
   * @param {Event} ev - The toggle event triggered by a <details> element.
   * @returns {void}
   */
  function onToggle(ev) {
    const tgt = ev.target;
    if (!(tgt instanceof HTMLDetailsElement)) {
      return;
    }
    const key = tgt.getAttribute('data-details-key');
    if (!key) {
      return;
    }
    if (tgt.open) {
      openSet.add(key);
    } else {
      openSet.delete(key);
    }
    writeOpenSet(openSet);
  }

  root.addEventListener('toggle', onToggle, true);

  // Apply once on load and whenever user navigates back/forward
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () =>
      applyDetailsState(root),
    );
  } else {
    applyDetailsState(root);
  }
  window.addEventListener('popstate', () => applyDetailsState(root));
}

// Enable prevention of auto-init in tests.
if (!window.__AWDT_DISABLE_AUTO_INIT__) {
  initDetailsURLState(document);
}

export const __internals = { parseOpenSet, writeOpenSet };
