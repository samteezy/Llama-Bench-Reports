// Chart.js configuration and utilities for Llama Bench Reports

// Set Chart.js defaults
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = 'system-ui, -apple-system, sans-serif';
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
}

// Helper to format large numbers
function formatNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

// Color palette for charts
const chartColors = [
  'rgb(75, 192, 192)',
  'rgb(54, 162, 235)',
  'rgb(255, 99, 132)',
  'rgb(255, 205, 86)',
  'rgb(153, 102, 255)',
  'rgb(255, 159, 64)',
  'rgb(201, 203, 207)'
];

function getChartColor(index) {
  return chartColors[index % chartColors.length];
}
