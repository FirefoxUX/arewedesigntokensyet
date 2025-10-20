/* global setTimeout, window, customElements */

import { LitElement, html, css, svg } from 'lit';
import { when } from 'lit/directives/when.js';

/**
 * Minimal fullscreen loader that "draws" a single SVG path using Web Animations API.
 * Props:
 *  - active: boolean
 *  - d: string (single-contour path data)
 *  - duration: number (ms), default 1500
 *  - easing: string, default 'cubic-bezier(.17,.84,.44,1)'
 *  - minDuration: number (ms) for showFor, default 1200
 *  - respectReducedMotion: boolean, default true
 */
export class AcornLoader extends LitElement {
  static properties = {
    active: { type: Boolean, reflect: true },
    d: { type: String },
    duration: { type: Number },
    easing: { type: String },
    minDuration: { type: Number },
    respectReducedMotion: { type: Boolean },
  };

  static styles = css`
    :host {
      --loader-size: 40%;
      --loader-stroke: currentColor;
      --loader-stroke-width: 2.5;
      --loader-bg: color-mix(in oklab, Canvas 86%, transparent);
      --loader-z: 99;
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: var(--loader-z);
      color: #ce4b12;
    }

    :host([active]) {
      display: flex;
    }

    .scrim {
      position: absolute;
      inset: 0;
      background: var(--loader-bg);
      backdrop-filter: blur(2px);
    }

    .wrap {
      position: relative;
      display: grid;
      place-items: center;
      width: var(--loader-size);
      height: var(--loader-size);
    }

    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  `;

  constructor() {
    super();
    this.active = false;
    // Default to your single-contour outer acorn path; replace with your new traced 'd' if needed.
    this.d =
      'M7.649 20.66c-1.077 1.727-1.175 4.287-1.175 6.086 0 5.26 1.927 9.398 6.451 11.72.727.373 1.132 1.944 1.954 2.154 1.161.297 1.586-.925 2.846-.925 5.394 0 8.978-2.197 12.131-5.28 1.972-1.928 3.47-5.319 3.47-7.51 0-7.297-8.545-11.91-12.152-12.577-3.607-.666-8.026.32-10.228 1.743-2.201 1.423-2.81 4.46-3.45 4.352-.83 1.47-2.191-.6-2.191-3.456 0-5.758 4.333-9.94 9.778-11.448 2.7-.747 5.475-.116 8.525-.116 1.1 0 1.189-2.698 2.44-2.95 1.317-.267 2.953.495 3.574 1.867.62 1.371-1.303 2.51-.664 3.018 2.989 2.37 6.366 4.447 8.019 7.081 3.876 6.181.903 15.531-4.4 16.34';
    this.duration = 1000;
    this.easing = 'cubic-bezier(.17,.84,.44,1)'; // slow into the finish, feels more "drawn"
    this.minDuration = 300;
    this.respectReducedMotion = true;

    /** @type {Animation|null} */
    this._anim = null;
  }

  /**
   * Render the loader UI when the component is active.
   *
   * When `this.active` is `true`, displays:
   * - A translucent scrim overlay.
   * - An SVG spinner wrapped in a container with `role="status"`,
   *   `aria-live="polite"`, and `aria-busy="true"` for accessibility.
   *
   * When inactive, renders nothing.
   *
   * @returns {import('lit').TemplateResult} The Lit template representing the loader markup.
   */
  render() {
    return html`
      ${when(
        this.active,
        () => html`
          <div class="scrim"></div>
          <div class="wrap" role="status" aria-live="polite" aria-busy="true">
            ${svg`
            <svg viewBox="0 0 42.667 42.667" aria-hidden="true">
              <path id="loader-path" d=${this.d}></path>
            </svg>
          `}
          </div>
        `,
      )}
    `;
  }

  /**
   * Show the loader.
   *
   * @returns {void}
   */
  show() {
    this.active = true;
  }

  /**
   * Hide the loader.
   *
   * @returns {void}
   */
  hide() {
    this.active = false;
  }

  /**
   * Show the loader for at least a minimum duration while awaiting a task.
   * The loader is always hidden in a finally block.
   *
   * @template T
   * @param {Promise<T>} promise Task to await.
   * @param {number} [minMs] Minimum visible duration in milliseconds, defaults to `this.minDuration`.
   * @returns {Promise<T>} Resolves with the task result, rejects with the task error.
   */
  async showFor(promise, minMs = this.minDuration) {
    this.show();
    try {
      const [task] = await Promise.all([
        promise
          .then((v) => {
            return { ok: true, v };
          })
          .catch((e) => {
            return { ok: false, e };
          }),
        new Promise((r) => {
          setTimeout(r, minMs);
        }),
      ]);
      if (!task.ok) {
        throw task.e;
      }
      return task.v;
    } finally {
      this.hide();
    }
  }

  /**
   * Lit lifecycle hook. Starts or cancels animation when relevant properties change.
   *
   * Triggers animation when `active` becomes true, when the path data `d` changes
   * while active, or when timing and motion preference properties change.
   * Cancels any running animation when `active` becomes false.
   *
   * @param {import('lit').PropertyValues<this>} changed Set of changed properties.
   * @returns {void}
   */
  updated(changed) {
    if (
      (changed.has('active') && this.active) ||
      (changed.has('d') && this.active) ||
      changed.has('duration') ||
      changed.has('easing') ||
      changed.has('respectReducedMotion')
    ) {
      this.#animate();
    }
    if (changed.has('active') && !this.active) {
      if (this._anim) {
        this._anim.cancel();
        this._anim = null;
      }
    }
  }

  /**
   * Start the stroke-dasharray animation via WAAPI when available,
   * otherwise apply the final state immediately.
   *
   * @private
   * @param {SVGPathElement} path SVG path to animate.
   * @param {number} len Precomputed path length.
   * @returns {void}
   */
  #animatePath(path, len) {
    const EPS = 0.001;

    // No WAAPI in some environments (e.g. JSDOM)
    const canAnimate = !!(path && typeof path.animate === 'function');
    if (!canAnimate) {
      // Apply the end state so visuals are correct in tests
      path.style.strokeDasharray = `${len} ${len}`;
      this._anim = null;
      return;
    }

    // Kick off WAAPI animation of the dasharray from tiny to full.
    this._anim = path.animate(
      [
        { strokeDasharray: `${EPS} ${len}` },
        // optional mid-way keys to bias time toward visible drawing:
        {
          strokeDasharray: `${Math.round(len * 0.35)} ${Math.round(len * 0.65)}`,
          offset: 0.55,
        },
        {
          strokeDasharray: `${Math.round(len * 0.7)} ${Math.round(len * 0.3)}`,
          offset: 0.8,
        },
        { strokeDasharray: `${len} 0`, offset: 0.92 },
        { strokeDasharray: `${len} 0`, offset: 1 },
      ],
      {
        duration: this.duration,
        easing: this.easing,
        fill: 'forwards',
      },
    );
  }

  /**
   * Prepare and run the loader animation, respecting reduced motion settings.
   *
   * No-ops if the SVG path or root elements are missing.
   *
   * @private
   * @returns {void}
   */
  #animate() {
    const path = /** @type {SVGPathElement|null} */ (
      this.renderRoot.querySelector('#loader-path')
    );
    const svgEl = /** @type {SVGSVGElement|null} */ (
      this.renderRoot.querySelector('svg')
    );
    if (!path || !svgEl) {
      return;
    }

    // Style as an outline only.
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--loader-stroke)');
    path.setAttribute('stroke-width', 'var(--loader-stroke-width)');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-miterlimit', '2');

    // Respect reduced motion unless overridden.
    const reducedSetting = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const prefersReduced = this.respectReducedMotion && reducedSetting;

    // Compute the actual path length once.
    const len = this.#safeLen(path);

    // Reset prior animation
    if (this._anim) {
      this._anim.cancel();
      this._anim = null;
    }
    path.style.strokeDashoffset = '0';

    if (prefersReduced) {
      // Show completed outline, no motion.
      path.style.strokeDasharray = `${len} 0`;
      svgEl.animate([{ opacity: 0.9 }, { opacity: 1 }], {
        duration: 1200,
        iterations: Infinity,
        direction: 'alternate',
      });
      return;
    }

    // Avoid the initial round-cap "dot": start with a tiny (epsilon) dash.
    const EPS = Math.max(0.001 * len, 0.1);
    path.style.strokeDasharray = `${EPS} ${len}`;

    // Kick off WAAPI animation when supported.
    this._anim = this.#animatePath(path, len);
  }

  /**
   * Safely compute the SVG path length, falling back to a sensible default.
   *
   * @private
   * @param {SVGPathElement} p Path whose length to compute.
   * @returns {number} Positive path length, defaults to 100 on failure.
   */
  #safeLen(p) {
    try {
      const n = p.getTotalLength();
      if (Number.isFinite(n) && n > 0) {
        return n;
      }
    } catch {
      /* ignore */
    }
    return 100;
  }
}

if (!customElements.get('acorn-loader')) {
  customElements.define('acorn-loader', AcornLoader);
}
