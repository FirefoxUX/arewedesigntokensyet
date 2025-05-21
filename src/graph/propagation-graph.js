/* global fetch, document */
import Chart from 'chart.js/auto';
import 'chartjs-adapter-luxon';
import latestHistory from '../data/propagationHistoryLatest.json' with { type: 'json' };

/**
 * Fetches the historical design token propagation data from the server.
 *
 * This function retrieves the `propagationHistory.json` file from the `/data` directory.
 * If the response is not successful, it throws an error.
 *
 * @returns {Promise<Array<{ date: string, percentage: number, delta?: number }>>}
 *   A promise that resolves to an array of propagation data points.
 * @throws {Error} If the fetch request fails or returns a non-OK response.
 */
async function fetchPropagationData() {
  const res = await fetch('/data/propagationHistory.json');
  if (!res.ok) {
    throw new Error('Failed to load propagation history');
  }
  return res.json();
}

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
  const historyData = await fetchPropagationData();

  // Merge in the latest data.
  const data = [...historyData, ...latestHistory];

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
          min: '2023-04-08',
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
