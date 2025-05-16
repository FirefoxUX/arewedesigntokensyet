/* globals customElements */

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
