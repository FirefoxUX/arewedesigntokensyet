/* global document, fetch */
import Chart from 'chart.js/auto';
import 'chartjs-adapter-luxon';

/**
 * Fetches and parses JSON data from two local files in parallel.
 *
 * This function retrieves `propagationHistory.json` and `propagationHistoryLatest.json`
 * concurrently using `Promise.all`, and returns their parsed contents as an array.
 *
 * @async
 * @function fetchData
 * @returns {Promise<Array<object>>} A promise that resolves to an array containing
 *   the parsed JSON data from both files.
 *   If an error occurs, `undefined` is returned and an error is logged to the console.
 */
export async function fetchData() {
  const urls = ['./propagationHistory.json', './propagationHistoryLatest.json'];

  try {
    const responses = await Promise.all(urls.map((url) => fetch(url)));
    return Promise.all(responses.map((res) => res.json()));
  } catch (error) {
    console.error('Error fetching data:', error);
  }
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
  // Merge in the latest data.
  const [history, historyLatest] = await fetchData();

  // Conditionally merge only if the date of the latest isn't already part of the historical data.
  const latestDate = historyLatest[0].date;
  const existingIndex = history.findIndex((entry) => entry.date === latestDate);
  const data = existingIndex === -1 ? [...history, ...historyLatest] : history;

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
