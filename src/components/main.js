/* global window */

import './TokenTooltip.js';
import { LineHighlighter } from './LineHighlighter.js';
import { TooltipController } from './TooltipController.js';

if (!window._awdtyInit) {
  window._awdtyInit = true;

  const controller = new TooltipController();
  controller.initGlobalEvents();

  const highlighter = new LineHighlighter();
  highlighter.init();
}
