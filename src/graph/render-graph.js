/* global document */
import { renderPropagationChart } from './propagation-graph.js';

// Only render if the #propagationChart markup is present.
if (document.getElementById('propagationChart')) {
  renderPropagationChart('propagationChart');
}
