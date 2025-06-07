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

// Generate a sequence with parameters
const N = 100; // Max number in the sequence
const Mmin = 4; // Minimum duplicates
const Mmax = 7; // Maximum duplicates
const wordsSequence = generateSequence(N, Mmin, Mmax);
const reorderedSequence = reorderTranslations(wordsSequence, 5, 1);

const newCardsPerDay = 20;
const wordsByDay = [];
for (let i = 0; i < reorderedSequence.length; i += newCardsPerDay) {
  wordsByDay.push(reorderedSequence.slice(i, i + newCardsPerDay));
}
const coords = wordsByDay.flatMap((day, dayIndex) => day.map((word) => [word, dayIndex + 1]));

const myChart = echarts.init(document.getElementById('main'));

const option = {
  // title: {
  //   text: 'ECharts Getting Started Example',
  // },
  // tooltip: {},
  // legend: {
  //   data: ['sales'],
  // },
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
myChart.setOption(option);
