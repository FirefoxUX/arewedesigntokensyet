/* globals window, document, requestAnimationFrame */

export function safeParseJSON(value, fallback = []) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export class TooltipController {
  constructor(tooltip = null) {
    this.tooltip = tooltip || document.createElement('token-tooltip');
    this.tooltip.hidden = true;
    document.body.appendChild(this.tooltip);

    this._bound = false;
  }

  show(triggerEl) {
    const rect = triggerEl.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;

    this.tooltip.status = triggerEl.dataset.status || 'bad';
    this.tooltip.trace = safeParseJSON(triggerEl.dataset.trace);
    this.tooltip.tokens = safeParseJSON(triggerEl.dataset.tokens);
    this.tooltip.source = safeParseJSON(triggerEl.dataset.source);
    this.tooltip.unresolved = safeParseJSON(triggerEl.dataset.unresolved);

    this.tooltip.style.top = `${rect.bottom + scrollY + 6}px`;
    this.tooltip.style.left = `${rect.left + scrollX}px`;

    this.tooltip.hidden = false;
    this.tooltip.pinned = false;

    requestAnimationFrame(() => {
      const tipRect = this.tooltip.getBoundingClientRect();
      const overflowRight = tipRect.right > window.innerWidth;
      this.tooltip.classList.toggle('wrap', overflowRight);
    });
  }

  hide() {
    if (!this.tooltip.pinned) {
      this.tooltip.hidden = true;
    }
  }

  togglePinned() {
    this.tooltip.pinned = !this.tooltip.pinned;
    this.tooltip.hidden = !this.tooltip.pinned;
  }

  get element() {
    return this.tooltip;
  }

  initGlobalEvents() {
    if (this._bound) {
      return;
    }
    this._bound = true;

    this._onMouseOver = (e) => {
      const el = e.target.closest('[data-status]');
      el ? this.show(el) : this.hide();
    };

    this._onFocusIn = (e) => {
      const el = e.target.closest('[data-status]');
      if (el) {
        this.show(el);
      }
    };

    this._onFocusOut = () => this.hide();
    this._onScroll = () => this.hide();

    this._onClick = (e) => {
      const isTrigger = e.target.closest('[data-status]');
      if (isTrigger) {
        e.preventDefault();
        this.togglePinned();
      } else {
        this.tooltip.pinned = false;
        this.tooltip.hidden = true;
      }
    };

    this._onKeyDown = (e) => {
      if (e.key === 'Escape') {
        this.tooltip.pinned = false;
        this.tooltip.hidden = true;
      }
    };

    document.addEventListener('mouseover', this._onMouseOver);
    document.addEventListener('focusin', this._onFocusIn);
    document.addEventListener('focusout', this._onFocusOut);
    document.addEventListener('scroll', this._onScroll, true);
    document.addEventListener('click', this._onClick);
    document.addEventListener('keydown', this._onKeyDown);
  }

  destroy() {
    if (this._bound) {
      document.removeEventListener('mouseover', this._onMouseOver);
      document.removeEventListener('focusin', this._onFocusIn);
      document.removeEventListener('focusout', this._onFocusOut);
      document.removeEventListener('scroll', this._onScroll, true);
      document.removeEventListener('click', this._onClick);
      document.removeEventListener('keydown', this._onKeyDown);
      this._bound = false;
    }
    this.tooltip.remove();
  }
}
