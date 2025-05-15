/* globals window, document, history */

export class LineHighlighter {
  constructor(container = document) {
    this.container = container;
    this.lastClicked = null;
    this.userClickedLine = false;

    this._onClick = this._onClick.bind(this);
    this._onHashChange = this._onHashChange.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

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

  _onHashChange() {
    this.handleHashChange();
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      history.pushState(null, '', window.location.pathname);
      this.highlightLines([]);
    }
  }

  bindEvents() {
    window.addEventListener('hashchange', this._onHashChange);
    window.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('click', this._onClick);
  }

  destroy() {
    window.removeEventListener('hashchange', this._onHashChange);
    window.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('click', this._onClick);
  }

  init() {
    this.injectLineNumbers();
    this.handleHashChange();
    this.bindEvents();
  }
}
