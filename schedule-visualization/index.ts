import * as echarts from 'echarts';
import translations from '../words_sequence.json';

const newCardsPerDay = 20;
const wordsByDay = [];
for (let i = 0; i < translations.wordsSequence.length; i += newCardsPerDay) {
  wordsByDay.push(translations.wordsSequence.slice(i, i + newCardsPerDay));
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
        yAxisIndex: 'none',
      },
      restore: {},
    },
  },
  dataZoom: [
    {
      type: 'inside',
      start: 0,
      end: 10,
    },
    {
      start: 0,
      end: 10,
    },
  ],
  xAxis: {},
  yAxis: {},
  series: [
    {
      name: 'schedule',
      type: 'scatter',
      data: coords,
    },
  ],
};

// Display the chart using the configuration items and data just specified.
myChart.setOption(option);
