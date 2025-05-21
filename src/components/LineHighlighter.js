/* globals window, document, history */

/**
 * Adds clickable line numbers and highlight behavior to code blocks rendered by Shiki.
 *
 * Features:
 * - Injects line number anchors into `.line` elements
 * - Supports highlighting individual lines or ranges via URL hash (e.g. `#L5` or `#L3-8`)
 * - Updates the hash on click and scrolls to highlighted lines
 * - Removes highlights on Escape
 */
export class LineHighlighter {
  /**
   * @param {Document | HTMLElement} container - The DOM container in which to operate (defaults to `document`).
   */
  constructor(container = document) {
    this.container = container;
    this.lastClicked = null;
    this.userClickedLine = false;

    this._onClick = this._onClick.bind(this);
    this._onHashChange = this._onHashChange.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  /**
   * Injects clickable line number elements into Shiki-rendered lines (`.line`).
   * Adds `data-line`, `id="L{n}"`, and a span with class `line-number-trigger` to each line.
   */
  injectLineNumbers() {
    this.container.querySelectorAll('pre.shiki .line').forEach((lineEl, i) => {
      const lineNumber = i + 1;

      const numberEl = document.createElement('span');
      numberEl.className = 'line-number-trigger';
      numberEl.dataset.line = lineNumber;
      numberEl.textContent = lineNumber;

      lineEl.dataset.line = lineNumber;
      lineEl.id = `L${lineNumber}`;
      lineEl.prepend(numberEl);
    });
  }

  /**
   * Parses the URL hash to extract a line or range of lines.
   * Supports `#L3` and `#L3-7` formats.
   *
   * @returns {number[]} An array of line numbers to highlight.
   */
  parseLineHash() {
    const hash = window.location.hash;
    if (!hash.startsWith('#L')) {
      return [];
    }

    const [start, end] = hash.slice(2).split('-').map(Number);
    if (Number.isNaN(start)) {
      return [];
    }

    const to = end || start;
    return Array.from({ length: to - start + 1 }, (_, i) => start + i);
  }

  /**
   * Removes all line highlights and applies highlights to the given set of line numbers.
   *
   * @param {number[]} lines - Line numbers to highlight.
   */
  highlightLines(lines) {
    this.container
      .querySelectorAll('.line')
      .forEach((el) => el.classList.remove('highlighted-line'));

    lines.forEach((n) => {
      const el = this.container.querySelector(`#L${n}`);
      if (el) {
        el.classList.add('highlighted-line');
      }
    });
  }

  /**
   * Updates highlights based on the current hash. Scrolls to the first highlighted line
   * unless the user initiated the click.
   */
  handleHashChange() {
    const lines = this.parseLineHash();
    this.highlightLines(lines);

    if (!this.userClickedLine && lines.length) {
      const el = this.container.querySelector(`#L${lines[0]}`);
      if (el?.scrollIntoView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    this.userClickedLine = false;
  }

  /**
   * Handles clicks on `.line-number-trigger` elements.
   * Updates the hash to reflect selected lines.
   *
   * @param {MouseEvent} e - The click event.
   * @private
   */
  _onClick(e) {
    const el = e.target.closest('.line-number-trigger');
    if (!el) {
      return;
    }

    const line = Number(el.dataset.line);
    if (Number.isNaN(line)) {
      return;
    }

    this.userClickedLine = true;

    if (e.shiftKey && this.lastClicked) {
      const [from, to] = [this.lastClicked, line].sort((a, b) => a - b);
      history.pushState(null, '', `#L${from}-${to}`);
      this.highlightLines(this.parseLineHash());
    } else {
      history.pushState(null, '', `#L${line}`);
      this.highlightLines([line]);
      this.lastClicked = line;
    }

    e.preventDefault();
  }

  /**
   * Handles the `hashchange` event by updating highlighted lines.
   * @private
   */
  _onHashChange() {
    this.handleHashChange();
  }

  /**
   * Handles Escape key to clear the hash and remove highlights.
   * @param {KeyboardEvent} e - The keydown event.
   * @private
   */
  _onKeyDown(e) {
    if (e.key === 'Escape') {
      history.pushState(null, '', window.location.pathname);
      this.highlightLines([]);
    }
  }

  /**
   * Attaches DOM event listeners for hash changes, key presses, and line number clicks.
   */
  bindEvents() {
    window.addEventListener('hashchange', this._onHashChange);
    window.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('click', this._onClick);
  }

  /**
   * Removes all event listeners attached by this instance.
   */
  destroy() {
    window.removeEventListener('hashchange', this._onHashChange);
    window.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('click', this._onClick);
  }

  /**
   * Initializes the highlighter:
   * - Adds line numbers
   * - Highlights any line(s) from the current URL hash
   * - Attaches event listeners
   */
  init() {
    this.injectLineNumbers();
    this.handleHashChange();
    this.bindEvents();
  }
}
