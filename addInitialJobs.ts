import { Queue, Job } from 'bullmq';
import wordsFile from './words.txt';
import { JOB_NAME_TRANSLATION, QUEUE_NAME_TRANSLATION } from './src/constants.ts';

const TESTING = true;

async function main() {
  let words = wordsFile
    .split('\n')
    .map((word, i) => ({ word: word.trim(), index: i }))
    .filter(({ word }) => word.length > 0);

  // if testing, take the last 30 words
  if (TESTING) {
    words = words.slice(-30);
  }

  const queue = new Queue(QUEUE_NAME_TRANSLATION, {
    connection: {
      host: 'localhost',
      port: 6379,
    },
  });

  const existingJobs: Job[] = await queue.getJobs();
  const existingWords: string[] = existingJobs
    .filter(({ name }) => name === JOB_NAME_TRANSLATION)
    .map(job => job.data.word);

  const newWords = words.filter(({ word }) => !existingWords.includes(word));

  console.log('Existing jobs:', existingJobs.length, 'Jobs to add:', newWords.length);

  const addedJobs = await queue.addBulk(newWords.map((word) => ({
    name: JOB_NAME_TRANSLATION,
    data: word,
  })));

  console.log('Added jobs:', addedJobs.length);

  await queue.close();
}

main();
