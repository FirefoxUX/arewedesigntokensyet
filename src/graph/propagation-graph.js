/* global document */
import Chart from 'chart.js/auto';
import 'chartjs-adapter-luxon';
import history from '../data/propagationHistory.json' with { type: 'json' };
import latestHistory from '../data/propagationHistoryLatest.json' with { type: 'json' };

/**
 * Renders a line chart visualizing the propagation percentage over time.
 *
 * The chart is drawn using Chart.js and includes historical data merged with
 * the latest locally available snapshot. Tooltips display the percentage along
 * with any delta compared to the previous entry.
 *
 * @param {string} canvasId - The ID of the <canvas> element where the chart should be rendered.
 * @returns {Promise<void>} Resolves when the chart has been created.
 *
 * @example
 * // Assuming a <canvas id="propagationChart"></canvas> exists in the DOM:
 * await renderPropagationChart('propagationChart');
 */
export async function renderPropagationChart(canvasId) {
  // Merge in the latest data.
  const data = [...history, ...latestHistory];

  new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: {
      labels: data.map((d) => d.date),
      datasets: [
        {
          label: 'Propagation %',
          data: data.map((d) => d.percentage),
          borderColor: 'blue',
          backgroundColor: 'rgba(0, 0, 255, 0.2)',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
        },
      ],
      originalData: data,
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          min: 0,
          title: { display: true, text: '%' },
        },
        x: {
          type: 'time',
          time: {
            unit: 'month',
            tooltipFormat: 'MMM d, yyyy',
          },
          tooltipFormat: 'DD',
          title: { display: true, text: 'Date' },
        },
      },
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const percentage = ctx.parsed.y.toFixed(2);
              const entry = ctx.chart.data.originalData?.[ctx.dataIndex];
              const delta = entry?.delta;

              let deltaStr = '';
              if (typeof delta === 'number') {
                const sign = delta > 0 ? '+' : '';
                deltaStr = ` (${sign}${delta.toFixed(2)}%)`;
              }
              return `${percentage}%${deltaStr}`;
            },
          },
        },
      },
    },
  });
}
