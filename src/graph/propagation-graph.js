/* global fetch, document */
import Chart from 'chart.js/auto';

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
          backgroundColor: 'rgba(0, 0, 255, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: '%' },
        },
        x: {
          title: { display: true, text: 'Date' },
        },
      },
      responsive: true,
      plugins: {
        legend: { display: false },
      },
    },
  });
}
