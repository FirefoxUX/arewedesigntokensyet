/* global window */

import './token-tooltip.js';
import './code-line-highlighting.js';
import { TooltipController } from './tooltip-controller.js';

if (!window._tooltipInit) {
  window._tooltipInit = true;
  const controller = new TooltipController();
  controller.initGlobalEvents();
}
