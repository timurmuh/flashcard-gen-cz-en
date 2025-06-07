import * as echarts from 'echarts';
import { reorderTranslations } from '../src/reorderTranslations';

/**
 * Generates an array of numbers from 1 to N, where each number is duplicated
 * randomly from Mmin to Mmax times (uniform distribution).
 *
 * @param {number} N - The maximum number in the sequence
 * @param {number} Mmin - The minimum number of times each number should be duplicated
 * @param {number} Mmax - The maximum number of times each number should be duplicated
 * @returns {Array<number>} - The sequence of numbers
 */
function generateSequence(N: number, Mmin: number, Mmax: number): number[] {
  if (!Number.isInteger(N) || N < 1) {
    throw new Error('N must be a positive integer');
  }
  if (!Number.isInteger(Mmin) || Mmin < 1) {
    throw new Error('Mmin must be a positive integer');
  }
  if (!Number.isInteger(Mmax) || Mmax < Mmin) {
    throw new Error('Mmax must be greater than or equal to Mmin');
  }

  const sequence = [];

  for (let i = 1; i <= N; i++) {
    const duplicates = Math.floor(Math.random() * (Mmax - Mmin + 1)) + Mmin;

    for (let j = 0; j < duplicates; j++) {
      sequence.push(i);
    }
  }

  return sequence;
}

// Function to regenerate the chart with new parameters
let debounceTimeout: number | null = null;
let myChart: echarts.ECharts;

// Initialize the chart with default values when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Get all input elements
  const nInput = document.getElementById('n-input') as HTMLInputElement;
  const mminInput = document.getElementById('mmin-input') as HTMLInputElement;
  const mmaxInput = document.getElementById('mmax-input') as HTMLInputElement;
  const wordsPerDayInput = document.getElementById('words-per-day') as HTMLInputElement;
  const wordsPerDayValue = document.getElementById('words-per-day-value') as HTMLSpanElement;
  const entriesPerWordInput = document.getElementById('entries-per-word') as HTMLInputElement;
  const entriesPerWordValue = document.getElementById('entries-per-word-value') as HTMLSpanElement;
  const newCardsPerDayInput = document.getElementById('new-cards-per-day') as HTMLInputElement;

  // Initialize the chart
  myChart = echarts.init(document.getElementById('main'));
  
  // Update displays for range inputs
  wordsPerDayInput.addEventListener('input', () => {
    wordsPerDayValue.textContent = wordsPerDayInput.value;
  });

  entriesPerWordInput.addEventListener('input', () => {
    entriesPerWordValue.textContent = entriesPerWordInput.value;
  });

  // Set up event listeners for all inputs with debounce
  [nInput, mminInput, mmaxInput, wordsPerDayInput, entriesPerWordInput, newCardsPerDayInput].forEach(element => {
    element.addEventListener('change', debounceUpdateChart);
    element.addEventListener('input', debounceUpdateChart);
  });

  // Update max value for wordsPerDay based on N
  nInput.addEventListener('change', () => {
    const nValue = parseInt(nInput.value);
    wordsPerDayInput.max = nValue.toString();
    
    // Update Mmax constraints
    if (parseInt(mmaxInput.value) < parseInt(mminInput.value)) {
      mmaxInput.value = mminInput.value;
    }
  });

  // Update max value for entriesPerWord based on Mmax
  mmaxInput.addEventListener('change', () => {
    const mmaxValue = parseInt(mmaxInput.value);
    entriesPerWordInput.max = mmaxValue.toString();
    
    // Keep Mmax >= Mmin
    if (mmaxValue < parseInt(mminInput.value)) {
      mmaxInput.value = mminInput.value;
    }
  });

  // Update min value for Mmax based on Mmin
  mminInput.addEventListener('change', () => {
    const mminValue = parseInt(mminInput.value);
    if (parseInt(mmaxInput.value) < mminValue) {
      mmaxInput.value = mminValue.toString();
    }
  });

  // Create initial chart
  updateChart();
});

// Debounced function to update chart
function debounceUpdateChart() {
  if (debounceTimeout !== null) {
    window.clearTimeout(debounceTimeout);
  }
  
  debounceTimeout = window.setTimeout(() => {
    updateChart();
    debounceTimeout = null;
  }, 300); // 300ms debounce
}

// Function to update the chart with current input values
function updateChart() {
  // Get current values from inputs
  const N = parseInt((document.getElementById('n-input') as HTMLInputElement).value);
  const Mmin = parseInt((document.getElementById('mmin-input') as HTMLInputElement).value);
  const Mmax = parseInt((document.getElementById('mmax-input') as HTMLInputElement).value);
  const wordsPerDay = parseInt((document.getElementById('words-per-day') as HTMLInputElement).value);
  const entriesPerWord = parseInt((document.getElementById('entries-per-word') as HTMLInputElement).value);
  const newCardsPerDay = parseInt((document.getElementById('new-cards-per-day') as HTMLInputElement).value);

  // Generate data with current parameters
  const wordsSequence = generateSequence(N, Mmin, Mmax);
  const reorderedSequence = reorderTranslations(wordsSequence, wordsPerDay, entriesPerWord);

  const wordsByDay = [];
  for (let i = 0; i < reorderedSequence.length; i += newCardsPerDay) {
    wordsByDay.push(reorderedSequence.slice(i, i + newCardsPerDay));
  }
  const coords = wordsByDay.flatMap((day, dayIndex) => day.map((word) => [word, dayIndex + 1]));

  // Configure and render the chart with the new data
  const option = {
    toolbox: {
      feature: {
        dataZoom: {
          // for zooming
          yAxisIndex: 'none',
        },
        restore: {}, // to reset zoom/pan
      },
    },
    dataZoom: [
      {
        type: 'slider',
        xAxisIndex: 0,
        start: 0,
        end: N,
      },
      {
        type: 'inside',
        xAxisIndex: 0,
      },
    ],
    xAxis: {
      type: 'value',
      name: 'Word',
      min: 0,
      max: N,
      interval: 1,
      axisLabel: {
        formatter: function (value: number) {
          return Math.trunc(value);
        },
      },
    },
    yAxis: {
      type: 'value',
      name: 'Day',
      min: 0,
      max: wordsByDay.length,
      interval: 1,
      axisLabel: {
        formatter: function (value: number) {
          return Math.trunc(value);
        },
      },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: 10,
        data: coords,
      },
    ],
  };

  // Display the chart using the configuration items and data just specified.
  myChart.setOption(option, true); // true forces a complete redraw
}
