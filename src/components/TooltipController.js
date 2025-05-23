/* globals window, document, requestAnimationFrame */

/**
 * Safely parses a JSON string into an array.
 *
 * If the string is not valid JSON, or the parsed result is not an array,
 * the fallback value is returned instead.
 * @param {string} value - The JSON string to parse.
 * @param {Array} [fallback] - A fallback value to return if parsing fails or the result is not an array.
 * @returns {Array} - The parsed array or the fallback.
 */
export function safeParseJSON(value, fallback = []) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * TooltipController manages the lifecycle and behavior of a floating `<token-tooltip>`
 * element. It handles showing, hiding, pinning, and positioning based on user interaction.
 *
 * It binds to global events like `mouseover`, `focusin`, `click`, and `keydown`
 * to provide accessibility and interactivity for inspecting design token usage.
 */
export class TooltipController {
  /**
   * @param {HTMLElement|null} [tooltip] - An existing tooltip element to reuse. If not provided, one is created.
   */
  constructor(tooltip = null) {
    this.tooltip = tooltip || document.createElement('token-tooltip');
    this.tooltip.hidden = true;
    document.body.appendChild(this.tooltip);
    this._bound = false;
  }

  /**
   * Shows the tooltip relative to the given trigger element.
   * Populates the tooltip with data attributes from the trigger.
   * @param {HTMLElement} triggerEl - The element with `data-status` and related attributes.
   */
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

  /**
   * Hides the tooltip if it is not currently pinned.
   */
  hide() {
    if (!this.tooltip.pinned) {
      this.tooltip.hidden = true;
    }
  }

  /**
   * Toggles the pinned state of the tooltip.
   * When pinned, it remains visible until explicitly dismissed.
   */
  togglePinned() {
    this.tooltip.pinned = !this.tooltip.pinned;
    this.tooltip.hidden = !this.tooltip.pinned;
  }

  /**
   * Returns the managed tooltip element.
   * @returns {HTMLElement}
   */
  get element() {
    return this.tooltip;
  }

  /**
   * Binds global event listeners for triggering and dismissing the tooltip.
   * Should be called once, typically after initialization.
   */
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

  /**
   * Unbinds all event listeners and removes the tooltip from the DOM.
   */
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
