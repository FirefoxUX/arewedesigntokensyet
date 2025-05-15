/**
 * @jest-environment jsdom
 */

/* globals document */

import {
  TooltipController,
  safeParseJSON,
} from '../src/components/tooltip-controller.js';
import '../src/components/token-tooltip.js';

describe('TooltipController', () => {
  let controller;
  let triggerEl;

  function createMockTrigger(overrides = {}) {
    const el = document.createElement('span');
    el.dataset.status = overrides.status || 'good';
    el.dataset.trace = JSON.stringify(overrides.trace || ['var(--a)', '#fff']);
    el.dataset.tokens = JSON.stringify(overrides.tokens || ['--a']);
    el.dataset.source = JSON.stringify(overrides.source || ['tokens.css']);
    el.dataset.unresolved = JSON.stringify(overrides.unresolved || []);
    el.getBoundingClientRect = () => ({
      top: 100,
      left: 100,
      bottom: 120,
      right: 200,
      width: 100,
      height: 20,
    });
    document.body.appendChild(el);
    return el;
  }

  afterEach(() => {
    controller?.destroy();
    triggerEl?.remove();

    const leftovers = document.querySelectorAll('token-tooltip');
    if (leftovers.length > 0) {
      console.warn(`Found ${leftovers.length} tooltip(s) still in the DOM`);
      leftovers.forEach((el) => el.remove());
    }
  });

  test('safeParseJSON handles valid arrays', () => {
    expect(safeParseJSON('["--a"]')).toEqual(['--a']);
  });

  test('safeParseJSON returns fallback on bad input', () => {
    expect(safeParseJSON('not-json')).toEqual([]);
    expect(safeParseJSON('{}')).toEqual([]);
    expect(safeParseJSON(123)).toEqual([]);
  });

  test('show() populates tooltip content correctly', async () => {
    controller = new TooltipController();
    triggerEl = createMockTrigger();

    controller.show(triggerEl);
    await controller.element.updateComplete;

    expect(controller.element.trace).toEqual(['var(--a)', '#fff']);
    expect(controller.element.tokens).toEqual(['--a']);
    expect(controller.element.status).toBe('good');
    expect(controller.element.hidden).toBe(false);
  });

  test('hide() hides the tooltip when not pinned', () => {
    controller = new TooltipController();
    controller.tooltip.hidden = false;
    controller.tooltip.pinned = false;

    controller.hide();
    expect(controller.tooltip.hidden).toBe(true);
  });

  test('togglePinned() toggles pinned + visibility', () => {
    controller = new TooltipController();
    controller.tooltip.hidden = false;
    controller.tooltip.pinned = false;

    controller.togglePinned();
    expect(controller.tooltip.pinned).toBe(true);
    expect(controller.tooltip.hidden).toBe(false);

    controller.togglePinned();
    expect(controller.tooltip.pinned).toBe(false);
    expect(controller.tooltip.hidden).toBe(true);
  });

  test('initGlobalEvents and destroy remove listeners and tooltip', () => {
    controller = new TooltipController();
    const spyAdd = jest.spyOn(document, 'addEventListener');
    const spyRemove = jest.spyOn(document, 'removeEventListener');

    controller.initGlobalEvents();
    expect(spyAdd).toHaveBeenCalledWith('mouseover', expect.any(Function));

    controller.destroy();

    expect(spyRemove).toHaveBeenCalledWith('mouseover', expect.any(Function));
    expect(document.querySelector('token-tooltip')).toBeNull();
  });
});
