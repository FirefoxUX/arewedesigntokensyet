/**
 * @jest-environment jsdom
 */

/* globals document, window, Element, MouseEvent */

import { LineHighlighter } from './LineHighlighter.js';

describe('LineHighlighter', () => {
  let highlighter;

  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <pre class="shiki">
        <span class="line" id="L1">line 1</span>
        <span class="line" id="L2">line 2</span>
        <span class="line" id="L3">line 3</span>
      </pre>
    `;
    highlighter = new LineHighlighter(); // Create fresh instance for each test
    highlighter.init();
  });

  afterEach(() => {
    highlighter.destroy();
  });

  test('parseLineHash returns single line for #L12', () => {
    window.location.hash = '#L12';
    expect(highlighter.parseLineHash()).toEqual([12]);
  });

  test('parseLineHash returns range for #L5-7', () => {
    window.location.hash = '#L5-7';
    expect(highlighter.parseLineHash()).toEqual([5, 6, 7]);
  });

  test('highlightLines adds and removes classes', () => {
    const lines = Array.from(document.querySelectorAll('.line'));
    lines[0].classList.add('highlighted-line');
    highlighter.highlightLines([2]);

    expect(lines[0].classList.contains('highlighted-line')).toBe(false);
    expect(lines[1].classList.contains('highlighted-line')).toBe(true);
    expect(lines[2].classList.contains('highlighted-line')).toBe(false);
  });

  test('injectLineNumbers adds triggers to each line', () => {
    const triggers = document.querySelectorAll('.line-number-trigger');
    expect(triggers).toHaveLength(3);
    expect(triggers[0].textContent).toBe('1');
    expect(triggers[1].dataset.line).toBe('2');
    expect(document.getElementById('L3')).not.toBeNull();
  });

  test('handleHashChange highlights lines from hash', () => {
    window.location.hash = '#L2';

    highlighter.handleHashChange();

    expect(document.getElementById('L2').classList).toContain(
      'highlighted-line',
    );
  });

  test('handleHashChange highlights line ranges', () => {
    window.location.hash = '#L1-3';

    highlighter.handleHashChange();

    expect(document.getElementById('L1').classList).toContain(
      'highlighted-line',
    );
    expect(document.getElementById('L2').classList).toContain(
      'highlighted-line',
    );
    expect(document.getElementById('L3').classList).toContain(
      'highlighted-line',
    );
  });

  test('Shift+Click selects a line range and updates the hash', () => {
    const triggers = document.querySelectorAll('.line-number-trigger');
    const first = triggers[0];
    const third = triggers[2];

    first.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    third.dispatchEvent(
      new MouseEvent('click', { bubbles: true, shiftKey: true }),
    );

    expect(window.location.hash).toBe('#L1-3');
    expect(document.getElementById('L1').classList).toContain(
      'highlighted-line',
    );
    expect(document.getElementById('L3').classList).toContain(
      'highlighted-line',
    );
  });
});
