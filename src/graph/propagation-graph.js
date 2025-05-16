/* global fetch, document */
import Chart from 'chart.js/auto';
import 'chartjs-adapter-luxon';

async function fetchPropagationData() {
  const res = await fetch('/data/propagationHistory.json');
  if (!res.ok) {
    throw new Error('Failed to load propagation history');
  }
  return res.json();
}

export async function renderPropagationChart(canvasId) {
  const data = await fetchPropagationData();

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
