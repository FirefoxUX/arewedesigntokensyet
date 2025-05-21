/* globals customElements */

import { LitElement, html, css } from 'lit';

/**
 * `<token-tooltip>` is a custom element for displaying contextual information
 * about CSS design token usage.
 *
 * It renders:
 * - A status message ("good", "warn", or "bad")
 * - A list of design tokens used
 * - A trace of variable resolution
 * - The source file(s) involved
 * - Any unresolved variables
 *
 * Intended for use as a floating tooltip element, e.g. in a code viewer.
 */
export class TokenTooltip extends LitElement {
  static properties = {
    // Token usage status: "good", "warn", or "bad".
    // Controls the icon/message shown at the top of the tooltip.
    status: { type: String },
    // Trace of CSS variable resolution steps, e.g., ['var(--a)', 'var(--b)', '12px'].
    trace: { type: Array },
    // List of source file paths where the tokens were defined.
    source: { type: Array },
    // List of unresolved CSS variables (e.g., ['--missing']).
    unresolved: { type: Array },
    // List of design tokens identified in the value.
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

  /**
   * Renders the tooltip content dynamically based on the component's properties.
   *
   * @returns {import('lit').TemplateResult} The rendered HTML content.
   */
  render() {
    const statusMsg = {
      good: '🏆 Nice use of Design Tokens!',
      warn: `☑️  This value doesn't need to use a Design Token.`,
      bad: '❌ Not currently using a design token.',
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
              <div class="label">🔬 Trace:</div>
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

  /**
   * Recursively renders a nested unordered list representing a variable resolution trace.
   *
   * @param {string[]} steps - The resolution steps (e.g., ['var(--a)', 'var(--b)', '12px']).
   * @returns {import('lit').TemplateResult|null}
   */
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
