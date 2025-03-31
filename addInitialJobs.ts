// TODO add initial jobs - take all words from the words.txt and push them to the job queue
//  Make sure there are deduplication settings - we don't want duplicate jobs

import { Queue, Job } from 'bullmq';
import wordsFile from './words.txt';

async function main() {
  const words = wordsFile
    .split('\n')
    .map((word, i) => ({ word: word.trim(), index: i }))
    .filter(({ word }) => word.length > 0);

  const queue = new Queue('cz_translation_jobs', {
    connection: {
      host: 'localhost',
      port: 6379,
    },
  });

  const existingJobs: Job[] = await queue.getJobs();
  const existingWords: string[] = existingJobs
    .filter(({ name }) => name === 'translate')
    .map(job => job.data.word);

  const newWords = words.filter(({ word }) => !existingWords.includes(word));

  console.log('Existing jobs:', existingJobs.length, 'Jobs to add:', newWords.length);

  const addedJobs = await queue.addBulk(newWords.map((word) => ({
    name: 'translate',
    data: word,
  })));

  console.log('Added jobs:', addedJobs.length);

  await queue.close();
}

main();
