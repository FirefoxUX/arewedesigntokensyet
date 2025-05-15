/* globals window, document, customElements, requestAnimationFrame */

import { LitElement, html, css } from 'lit';

export class TokenTooltip extends LitElement {
  static properties = {
    status: { type: String },
    trace: { type: Array },
    source: { type: Array },
    unresolved: { type: Array },
    tokens: { type: Array },
  };

  constructor() {
    super();
    this.status = 'bad';
    this.trace = [];
    this.tokens = [];
    this.source = [];
    this.unresolved = [];
  }

  static styles = css`
    :host {
      position: absolute;
      z-index: 1000;
      background: #fff;
      border: 1px solid #ccc;
      padding: 0.75rem;
      font-size: 0.75rem;
      border-radius: 6px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
      white-space: nowrap;
      overflow-x: auto;
      max-width: 90vw;
    }

    :host(.wrap) {
      white-space: normal;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    ul,
    li {
      margin: 0.25em 0 0.25em 1em;
      padding: 0;
    }

    .status {
      font-weight: bold;
    }

    .label {
      font-weight: bold;
      margin-top: 0.5rem;
      display: block;
    }

    .block {
      margin-top: 0.25rem;
    }

    .label + ul {
      margin-top: 0;
    }
  `;

  render() {
    const statusMsg = {
      good: '🏆 Nice use of Design Tokens!',
      warn: '🆗 This value is ignored.',
      bad: '🚫 Not using a design token.',
    };

    return html`
      <div aria-live="polite">
        <div class="status" data-status=${this.status}>
          ${statusMsg[this.status] || statusMsg.bad}
        </div>

        ${this.tokens.length
          ? html`
              <div class="label">🎨 Design Tokens Used:</div>
              <ul>
                ${this.tokens.map(
                  (token) => html`<li><code>${token}</code></li>`,
                )}
              </ul>
            `
          : ''}
        ${this.trace.length > 1
          ? html`
              <div class="label">🔁 Trace:</div>
              ${this.renderTraceTree(this.trace)}
            `
          : ''}
        ${this.source.length
          ? html`
              <div class="label">📁 Source(s):</div>
              <ul>
                ${this.source.map((src) => html`<li><code>${src}</code></li>`)}
              </ul>
            `
          : ''}
        ${this.unresolved.length
          ? html`
              <div class="label">⚠️ Unresolved Vars:</div>
              <ul>
                ${this.unresolved.map(
                  (unresolvedVar) =>
                    html`<li><code>${unresolvedVar}</code></li>`,
                )}
              </ul>
            `
          : ''}
      </div>
    `;
  }

  renderTraceTree(steps = []) {
    if (steps.length === 0) {
      return null;
    }
    const [head, ...rest] = steps;
    return html`
      <ul>
        <li>
          <code>${head}</code>
          ${rest.length ? this.renderTraceTree(rest) : ''}
        </li>
      </ul>
    `;
  }
}

customElements.define('token-tooltip', TokenTooltip);

if (!window._sharedTokenTooltipInitialized) {
  window._sharedTokenTooltipInitialized = true;

  function safeParseJSON(value, fallback = []) {
    try {
      if (typeof value !== 'string') {
        return fallback;
      }
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  const tooltip = document.createElement('token-tooltip');
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  function showTooltip(triggerEl) {
    const rect = triggerEl.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;

    tooltip.status = triggerEl.dataset.status || '';
    tooltip.trace = safeParseJSON(triggerEl.dataset.trace);
    tooltip.source = safeParseJSON(triggerEl.dataset.source);
    tooltip.unresolved = safeParseJSON(triggerEl.dataset.unresolved);
    tooltip.tokens = safeParseJSON(triggerEl.dataset.tokens);
    tooltip.style.top = `${rect.bottom + scrollY + 6}px`;
    tooltip.style.left = `${rect.left + scrollX}px`;
    tooltip.hidden = false;
    tooltip.pinned = false;

    // Position the tooltip
    tooltip.style.top = `${rect.bottom + scrollY + 6}px`;
    tooltip.style.left = `${rect.left + scrollX}px`;

    // Wait for the DOM to update, then check overflow
    requestAnimationFrame(() => {
      const tipRect = tooltip.getBoundingClientRect();
      const overflowRight = tipRect.right > window.innerWidth;
      tooltip.classList.toggle('wrap', overflowRight);
    });
  }

  function hideTooltip() {
    if (!tooltip.pinned) {
      tooltip.hidden = true;
    }
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-status]');
    if (el) {
      showTooltip(el);
    } else {
      hideTooltip();
    }
  });

  document.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-status]');
    if (el) {
      showTooltip(el);
    }
  });

  document.addEventListener('focusout', hideTooltip);
  document.addEventListener('scroll', hideTooltip, true);

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-status]')) {
      e.preventDefault();
      tooltip.pinned = !tooltip.pinned;
    } else {
      tooltip.pinned = false;
      tooltip.hidden = true;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      tooltip.pinned = false;
      tooltip.hidden = true;
    }
  });
}
